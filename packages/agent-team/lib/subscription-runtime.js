/**
 * The interval scheduler: admission, the wait queue, failure counting, and the
 * publication budget. Every decision here is made from injected ports, so a
 * fake clock and a fake executor can prove the boundaries the ticket names
 * without a real shell, a real timer, or a real ledger.
 * @module @contexera/dsh-agent-team/subscription-runtime
 */
import { nextDueAfter, scheduleAction, SUBSCRIPTION_CONCURRENT_RUNS, SUBSCRIPTION_FAILURES_BEFORE_PAUSE, SUBSCRIPTION_FIRST_RUN_MAX_DELAY_MS, SUBSCRIPTION_PUBLISH_PER_MINUTE, } from "./subscriptions.js";
export const INITIAL_CHECKPOINT = { consecutiveFailures: 0, publishedInWindow: 0 };
const TICK_MS = 1_000;
/**
 * Owns the timer loop, the four run slots, and the per-minute publication
 * budget. A run and a publication are separate steps on purpose: a run that
 * succeeded only waits for budget, and is never executed twice for it.
 */
export class SubscriptionScheduler {
    ports;
    handle;
    /** Whether the timer loop runs; a scheduler a test drives by hand is never started. */
    stopped = true;
    /** Set by {@link stop}: nothing new is admitted, and the queue is settled. */
    draining = false;
    ticking;
    running = new Set();
    /** The due instant each executing timer run answers, so a tick can tell it is already spent. */
    runningDue = new Map();
    /** Admitted work, including publication after a run releases its slot; teardown does not wait for the queue. */
    inFlight = new Set();
    queue = [];
    /** One in-flight publication pass per subscription, so overlapping passes cannot spend the same budget. */
    publishing = new Map();
    constructor(ports) {
        this.ports = ports;
    }
    /** Start the loop and give every timer subscription its first due instant. */
    start() {
        this.stopped = false;
        this.handle = this.ports.schedule(() => { this.tick(); }, TICK_MS);
    }
    /**
     * Stop admitting work and converge: reject every trial that never started,
     * then wait for admitted work, including publication that outlives its run
     * slot. A Host closes its stores only after this resolves, so late work cannot
     * write a closed one.
     */
    async stop() {
        this.stopped = true;
        this.draining = true;
        if (this.handle !== undefined)
            this.ports.cancel(this.handle);
        this.handle = undefined;
        for (const entry of this.queue.splice(0)) {
            entry.settle?.({ ok: false, error: new Error('the Host is shutting down, so this run never started') });
        }
        const pending = [...(this.ticking === undefined ? [] : [this.ticking]), ...this.inFlight];
        await Promise.allSettled(pending);
    }
    /** Timer entry point. A tick never overlaps itself: one slow await must not queue the next one behind it. */
    tick() {
        if (this.stopped)
            return;
        this.handle = this.ports.schedule(() => { this.tick(); }, TICK_MS);
        if (this.ticking !== undefined)
            return;
        this.ticking = this.runTick()
            .catch((error) => {
            this.ports.log(`subscription tick failed: ${error instanceof Error ? error.message : String(error)}`);
        })
            .finally(() => { this.ticking = undefined; });
    }
    /** Run one scheduler pass immediately; exposed so tests and a manual nudge share the production path. */
    async runTick() {
        if (this.draining)
            return;
        await this.settleBoot();
        await this.publishPass();
        await this.timerPass();
        await this.admit();
    }
    /**
     * One owner-requested execution — the trial behind create, update, test, and
     * resume, or a replay of a failed delivery — under the same four slots as a
     * timer run. A trial is not a second kind of capacity: without this, twenty
     * creates would start twenty scripts, and a replay would run beside them.
     */
    runAdmitted(subscription, policy, task) {
        if (this.draining)
            return Promise.reject(new Error('the Host is shutting down, so this run never started'));
        return new Promise((resolve, reject) => {
            this.enqueue({ subscription, policy, orderAt: this.ports.now(), task,
                settle: outcome => { if (outcome.ok)
                    resolve(outcome.value);
                else
                    reject(outcome.error); } });
            void this.admit();
        });
    }
    /** The trial path: the same admission, with the policy that still lets a paused subscription be tested. */
    runTrial(subscription, task) {
        return this.runAdmitted(subscription, 'trial', task);
    }
    /** Give booted or newly created timers a first due instant, preserving every persisted one for catch-up. */
    async settleBoot() {
        const now = this.ports.now();
        for (const subscription of this.ports.subscriptions()) {
            const live = this.ports.current(subscription.subscriptionRef) ?? subscription;
            if (live.triggers.interval === undefined)
                continue;
            if (live.state !== 'active' || !this.ports.projectActive(live))
                continue;
            if (this.ports.checkpoint(live.subscriptionRef).dueAt !== undefined)
                continue;
            const delay = Math.floor(this.ports.random() * SUBSCRIPTION_FIRST_RUN_MAX_DELAY_MS);
            await this.ports.save(live.subscriptionRef, checkpoint => ({ ...checkpoint, dueAt: now + delay }));
        }
    }
    timerPass() {
        const work = [];
        const now = this.ports.now();
        for (const subscription of this.ports.subscriptions()) {
            // The ledger's current record, not the snapshot this iteration happens to
            // hold: a deletion must stop the timer at the moment it is decided, not
            // one admission later.
            const live = this.ports.current(subscription.subscriptionRef) ?? subscription;
            const interval = live.triggers.interval;
            if (interval === undefined)
                continue;
            const checkpoint = this.ports.checkpoint(live.subscriptionRef);
            const queued = this.queue.some(entry => entry.task === undefined
                && entry.subscription.subscriptionRef === live.subscriptionRef);
            const action = scheduleAction({
                ...(checkpoint.dueAt === undefined ? {} : { dueAt: checkpoint.dueAt }),
                now,
                paused: live.state !== 'active',
                deleted: live.state === 'deleted',
                archived: !this.ports.projectActive(live),
                pending: this.ports.pending(live.subscriptionRef).length,
                // A due instant already being executed is spent, so it merges like a
                // queued one. A subscription that is merely busy with a trial still
                // takes its due place now — admission refuses to start it beside that
                // run — because waiting would hand its turn to a later request.
                busy: queued || this.runningDue.get(live.subscriptionRef) === checkpoint.dueAt,
            });
            if (action === 'wait')
                continue;
            if (action === 'skip') {
                // A terminal record keeps no checkpoint: the deletion already removed
                // it and nothing will ever run again, so writing one here would only
                // revive a row nobody reads.
                if (live.state === 'deleted' || !this.ports.projectActive(live))
                    continue;
                // A due instant still ahead already answers every later decision, so
                // a paused or backlogged subscription is re-decided each tick without
                // being re-written; the record advances only once the instant passes.
                if (checkpoint.dueAt !== undefined && checkpoint.dueAt > now)
                    continue;
                work.push(this.saveDue(live, nextDueAfter(now, interval.minutes)));
                continue;
            }
            // Wait in due order: an entry waiting for its own trial to finish keeps
            // the instant it came due, so the fairness rule stays "longest wait first".
            this.enqueue({ subscription: live, policy: 'run', orderAt: checkpoint.dueAt ?? now });
        }
        return Promise.all(work).then(() => { });
    }
    async admit() {
        if (this.draining)
            return;
        while (this.running.size < SUBSCRIPTION_CONCURRENT_RUNS) {
            // Skip entries whose own subscription is executing; they keep their place,
            // and blocking the whole queue behind one busy subscription would be worse.
            const index = this.queue.findIndex(entry => !this.running.has(entry.subscription.subscriptionRef));
            if (index === -1)
                return;
            const [next] = this.queue.splice(index, 1);
            if (next === undefined)
                return;
            // An entry waited with a snapshot, so the terminal barrier is read again
            // here from the ledger: one that was deleted or archived meanwhile must
            // not spend a slot, let alone run a script for a record that is gone.
            const stored = this.ports.current(next.subscription.subscriptionRef);
            const live = stored ?? next.subscription;
            if (next.task !== undefined) {
                const refusal = this.admissionRefusal(next.policy, stored, live);
                if (refusal !== undefined) {
                    next.settle?.({ ok: false, error: refusal });
                    continue;
                }
                this.track(this.launchAdmitted(next));
                continue;
            }
            // A subscription deleted or paused while it waited loses its turn: the
            // terminal barrier is checked again at admission, not only at enqueue.
            if (live.state !== 'active' || !this.ports.projectActive(live))
                continue;
            if (!this.ports.timerReady(live.subscriptionRef))
                continue;
            this.track(this.launchTimer(live, next.orderAt));
        }
    }
    /**
     * Why a queued execution may no longer start, or `undefined` when it may.
     *
     * The terminal barrier is re-read from the ledger, not from the snapshot the
     * entry waited with. A draft — a create's trial, never stored — is judged by
     * its own snapshot, because it has no record to reconcile against. A stored
     * record is judged by the state it holds now: `test` and `resume` still reach
     * a paused subscription, while a paused one refuses a real run, since a run is
     * what pausing stops.
     */
    admissionRefusal(policy, stored, live) {
        const ref = live.subscriptionRef;
        const noun = policy === 'trial' ? 'trial' : 'run';
        if (stored !== undefined && stored.state === 'deleted') {
            return new Error(`subscription '${ref}' was deleted while this ${noun} waited, so the script never ran (subscription_deleted)`);
        }
        if (!this.ports.projectActive(live)) {
            return new Error(`the Project of subscription '${ref}' was archived while this ${noun} waited, so the script never ran (project_archived)`);
        }
        if (policy === 'run') {
            if (stored === undefined)
                return new Error(`subscription '${ref}' is no longer in the ledger, so the script never ran (subscription_deleted)`);
            if (stored.state !== 'active') {
                return new Error(`subscription '${ref}' is paused, so it cannot run this delivery (subscription_paused)`);
            }
        }
        return undefined;
    }
    track(work) {
        this.inFlight.add(work);
        void work
            .catch((error) => {
            this.ports.log(`subscription run failed: ${error instanceof Error ? error.message : String(error)}`);
        })
            .finally(() => { this.inFlight.delete(work); });
    }
    async launchAdmitted(entry) {
        const ref = entry.subscription.subscriptionRef;
        const task = entry.task;
        this.running.add(ref);
        try {
            entry.settle?.({ ok: true, value: await task() });
        }
        catch (error) {
            entry.settle?.({ ok: false, error });
        }
        finally {
            this.running.delete(ref);
            // A freed slot is admitted immediately: a queued create must not wait for
            // the next timer tick to start.
            void this.admit();
        }
    }
    async launchTimer(subscription, dueAt) {
        const ref = subscription.subscriptionRef;
        // The spent-due marker outlives the execution: a tick that lands between
        // the run ending and its checkpoint write would re-execute the same due
        // instant if the marker were already gone.
        this.running.add(ref);
        this.runningDue.set(ref, dueAt);
        const interval = subscription.triggers.interval;
        let outcome = 'failed';
        try {
            try {
                outcome = await this.ports.run(subscription);
            }
            catch (error) {
                this.ports.log(`subscription '${ref}' run failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            // Recording the outcome and publishing are each best-effort steps of their
            // own: a checkpoint write or a publication that throws must not skip the
            // other, and must never surface as an unhandled rejection.
            await this.settleOutcome(subscription, outcome, interval).catch((error) => {
                this.ports.log(`subscription '${ref}' could not record its outcome: ${error instanceof Error ? error.message : String(error)}`);
            });
        }
        finally {
            this.running.delete(ref);
            this.runningDue.delete(ref);
            // A freed slot is admitted immediately: a queued create must not wait for
            // the next timer tick to start.
            void this.admit();
        }
        await this.publishPass().catch((error) => {
            this.ports.log(`subscription '${ref}' could not publish after its run: ${error instanceof Error ? error.message : String(error)}`);
        });
    }
    /**
     * Record what the run decided.
     *
     * A success wrote its own half already: the run clears the streak at the
     * instant its output was accepted, because only the accept knows that instant
     * — so this advances the next due time and nothing else. A failure increments
     * the count it reads at the write, under the same lock, so the count it adds to
     * is the one the previous writer committed. `deferred` counts like a failure:
     * a timer pulls, so its next run prints the same output again.
     */
    async settleOutcome(subscription, outcome, interval) {
        // Neither a success nor a failure, and no write either: the record it would
        // have updated is gone or archived, so saving here would revive a checkpoint
        // that the deletion already removed.
        if (outcome === 'dropped')
            return;
        const ref = subscription.subscriptionRef;
        const now = this.ports.now();
        const due = interval === undefined ? {} : { dueAt: nextDueAfter(now, interval.minutes) };
        const settled = await this.ports.save(ref, outcome === 'accepted' || outcome === 'empty'
            ? checkpoint => ({ ...checkpoint, ...due })
            : checkpoint => ({ ...checkpoint, consecutiveFailures: checkpoint.consecutiveFailures + 1, ...due }));
        if (settled === undefined)
            return;
        if (outcome !== 'accepted' && outcome !== 'empty' && settled.consecutiveFailures >= SUBSCRIPTION_FAILURES_BEFORE_PAUSE) {
            await this.ports.pauseForFailures(subscription);
        }
    }
    async saveDue(subscription, dueAt) {
        await this.ports.save(subscription.subscriptionRef, checkpoint => ({ ...checkpoint, dueAt }));
    }
    /** Keep the wait queue in due order: the longest wait is admitted first, whatever produced it. */
    enqueue(entry) {
        const index = this.queue.findIndex(queued => queued.orderAt > entry.orderAt);
        if (index === -1)
            this.queue.push(entry);
        else
            this.queue.splice(index, 0, entry);
    }
    /**
     * Publish what the budget allows, oldest accepted first, one subscription at
     * a time. A publication that fails leaves the event pending: the ledger has
     * no record of it, so the next pass retries from the same queue. One
     * subscription's storage failure must not abort the others' publications.
     */
    async publishPass() {
        for (const subscription of this.ports.subscriptions()) {
            try {
                await this.publishOne(subscription);
            }
            catch (error) {
                this.ports.log(`subscription '${subscription.subscriptionRef}' could not publish: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    /** One subscription's share of a publication pass. */
    async publishOne(subscription) {
        // Passes serialize per subscription: the tick's pass and a finishing run's
        // pass can overlap, and two of them reading the same budget and the same
        // pending head would double-spend the minute and republish one entry.
        const serialized = subscription.subscriptionRef;
        const chained = (this.publishing.get(serialized) ?? Promise.resolve()).catch(() => { })
            .then(() => this.publishOnePass(subscription));
        this.publishing.set(serialized, chained);
        try {
            await chained;
        }
        finally {
            if (this.publishing.get(serialized) === chained)
                this.publishing.delete(serialized);
        }
    }
    async publishOnePass(subscription) {
        // A terminal record publishes nothing, and its checkpoint is not rewritten
        // either: the accepted output stays unpublished, instead of being retried
        // and logged on every tick for a subscription that no longer exists. A
        // paused subscription still publishes — pausing stops runs, not delivery.
        const live = this.ports.current(subscription.subscriptionRef) ?? subscription;
        if (live.state === 'deleted' || !this.ports.projectActive(live))
            return;
        // The window is per minute per subscription, and it survives a restart
        // because it lives in the checkpoint, not in memory. It resets only
        // forward: a clock that jumps back must not hand out the same minute's
        // budget twice.
        let checkpoint = this.ports.checkpoint(subscription.subscriptionRef);
        const minute = Math.floor(this.ports.now() / 60_000);
        if (checkpoint.publishWindowMinute === undefined || minute > checkpoint.publishWindowMinute) {
            checkpoint = await this.ports.save(subscription.subscriptionRef, current => ({ ...current, publishWindowMinute: minute, publishedInWindow: 0 })) ?? checkpoint;
        }
        let budget = SUBSCRIPTION_PUBLISH_PER_MINUTE - checkpoint.publishedInWindow;
        if (budget <= 0)
            return;
        for (const entry of this.ports.pending(subscription.subscriptionRef)) {
            if (budget <= 0)
                break;
            try {
                await this.ports.publish(live, entry.acceptedSequence, entry.eventId);
            }
            catch (error) {
                this.ports.log(`subscription '${subscription.subscriptionRef}' could not publish '${entry.eventId}': ${error instanceof Error ? error.message : String(error)}`);
                break;
            }
            checkpoint = await this.ports.save(subscription.subscriptionRef, current => ({ ...current,
                publishedInWindow: current.publishedInWindow + 1 })) ?? checkpoint;
            budget -= 1;
        }
    }
    /** Live state for diagnostics and tests: what is running and what is waiting. */
    state() {
        return Object.freeze({ running: Object.freeze([...this.running]), queued: Object.freeze(this.queue.map(entry => entry.subscription.subscriptionRef)) });
    }
}
/** The shell a snapshot was recorded under, as the executor reported itself; a different family fails the run with this. */
export function shellMismatchReason(recorded, actual) {
    if (recorded === actual)
        return undefined;
    return `this subscription was created for ${recorded}, but the Host runs ${actual}`;
}
