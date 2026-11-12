/**
 * The interval scheduler: admission, the wait queue, failure counting, and the
 * publication budget. Every decision here is made from injected ports, so a
 * fake clock and a fake executor can prove the boundaries the ticket names
 * without a real shell, a real timer, or a real ledger.
 * @module @contexera/dsh-agent-team/subscription-runtime
 */
import { type SubscriptionShell } from './subscriptions.ts';
import type { AgentTeamSubscription, AgentTeamSubscriptionRef } from './types/entities.ts';
/**
 * What one run turned into, as the scheduler needs it. `accepted` and `empty`
 * are successful runs (the second found nothing new); `failed`, `backlog` and
 * `deferred` — a valid batch with no room in the unpublished queue — count
 * towards the pause; `dropped` means the subscription stopped being live while
 * the script ran.
 */
export type SubscriptionRunOutcome = 'accepted' | 'empty' | 'failed' | 'backlog' | 'deferred' | 'dropped';
/** Durable scheduler state for one subscription. It is not a Team fact: deleting it changes no domain result. */
export interface SubscriptionCheckpoint {
    readonly subscriptionRef: AgentTeamSubscriptionRef;
    /** Absolute UTC instant the next timer run is due; absent before the Host ever scheduled it. */
    readonly dueAt?: number | undefined;
    /** Failed runs in a row. Independent of the run records, which are diagnostics. */
    readonly consecutiveFailures: number;
    /** The latest ledger resume this count reflects; absent on legacy checkpoints. */
    readonly failureResumeSequence?: number | undefined;
    /** A success can clear the streak without appending a ledger fact. */
    readonly failureSuccessEpoch?: number | undefined;
    /** Only one spent admission settles at a time per subscription; its count and proof commit together. */
    readonly countedAdmissionRef?: string | undefined;
    /** When this subscription's output was last accepted. */
    readonly lastSuccessAt?: string | undefined;
    /** The publish rate window: the minute it counts and how many events left the queue inside it. */
    readonly publishWindowMinute?: number | undefined;
    readonly publishedInWindow: number;
}
export declare const INITIAL_CHECKPOINT: {
    readonly consecutiveFailures: 0;
    readonly publishedInWindow: 0;
};
/** The narrow host surface the scheduler drives. */
export interface SubscriptionRuntimePorts {
    readonly now: () => number;
    readonly random: () => number;
    readonly schedule: (run: () => void, delayMs: number) => unknown;
    readonly cancel: (handle: unknown) => void;
    readonly log: (message: string) => void;
    /** Every subscription the ledger holds, deleted ones included. */
    readonly subscriptions: () => readonly AgentTeamSubscription[];
    /**
     * The definition the ledger holds for one ref right now, or `undefined` when
     * the ref was never stored — a create's draft trial. A queue entry holds a
     * snapshot, so this is how admission sees a delete that happened meanwhile.
     */
    readonly current: (subscriptionRef: AgentTeamSubscriptionRef) => AgentTeamSubscription | undefined;
    /** Whether the Project that owns a subscription still runs. */
    readonly projectActive: (subscription: AgentTeamSubscription) => boolean;
    readonly workspacePath: (subscription: AgentTeamSubscription) => string | undefined;
    /** Accepted-but-unpublished events of one subscription, oldest first. */
    readonly pending: (subscriptionRef: AgentTeamSubscriptionRef) => readonly {
        readonly acceptedSequence: number;
        readonly eventId: string;
    }[];
    /** Execute one timer run end to end (execute, validate, accept). */
    readonly run: (subscription: AgentTeamSubscription) => Promise<SubscriptionRunOutcome>;
    /** Publish one accepted event; resolves when it is durable. */
    readonly publish: (subscription: AgentTeamSubscription, acceptedSequence: number, eventId: string) => Promise<void>;
    /** Stop a subscription after repeated failures; the reason is the ledger's own. */
    readonly pauseForFailures: (subscription: AgentTeamSubscription) => Promise<void>;
    readonly checkpoint: (subscriptionRef: AgentTeamSubscriptionRef) => SubscriptionCheckpoint;
    /** A due timer must wait for the failure accounting of a spent Webhook. */
    readonly timerReady: (subscriptionRef: AgentTeamSubscriptionRef) => boolean;
    /**
     * Change one checkpoint. `change` receives the record as it stands *at the
     * moment of the write*, under the subscription's write lock, and the settled
     * value comes back — or `undefined` when the subscription the ledger no longer
     * serves, where nothing is written. Callers pass a field, never the record
     * they read earlier: a whole-record write from a stale read drops what another
     * writer committed meanwhile.
     */
    readonly save: (subscriptionRef: AgentTeamSubscriptionRef, change: (checkpoint: SubscriptionCheckpoint) => SubscriptionCheckpoint) => Promise<SubscriptionCheckpoint | undefined>;
}
/**
 * What a queued entry is allowed to start. A trial — create, update, test,
 * resume — still reaches a paused subscription, because testing and resuming one
 * is exactly how an owner brings it back. A `run` does not: it is a real
 * execution that would publish, so being paused refuses it, and a webhook replay
 * is admitted under this policy rather than beside the scheduler.
 */
export type SubscriptionAdmissionPolicy = 'trial' | 'run';
/**
 * Owns the timer loop, the four run slots, and the per-minute publication
 * budget. A run and a publication are separate steps on purpose: a run that
 * succeeded only waits for budget, and is never executed twice for it.
 */
export declare class SubscriptionScheduler {
    private readonly ports;
    private handle;
    /** Whether the timer loop runs; a scheduler a test drives by hand is never started. */
    private stopped;
    /** Set by {@link stop}: nothing new is admitted, and the queue is settled. */
    private draining;
    private ticking;
    private readonly running;
    /** The due instant each executing timer run answers, so a tick can tell it is already spent. */
    private readonly runningDue;
    /** Admitted work, including publication after a run releases its slot; teardown does not wait for the queue. */
    private readonly inFlight;
    private readonly queue;
    /** One in-flight publication pass per subscription, so overlapping passes cannot spend the same budget. */
    private readonly publishing;
    constructor(ports: SubscriptionRuntimePorts);
    /** Start the loop and give every timer subscription its first due instant. */
    start(): void;
    /**
     * Stop admitting work and converge: reject every trial that never started,
     * then wait for admitted work, including publication that outlives its run
     * slot. A Host closes its stores only after this resolves, so late work cannot
     * write a closed one.
     */
    stop(): Promise<void>;
    /** Timer entry point. A tick never overlaps itself: one slow await must not queue the next one behind it. */
    private tick;
    /** Run one scheduler pass immediately; exposed so tests and a manual nudge share the production path. */
    runTick(): Promise<void>;
    /**
     * One owner-requested execution — the trial behind create, update, test, and
     * resume, or a replay of a failed delivery — under the same four slots as a
     * timer run. A trial is not a second kind of capacity: without this, twenty
     * creates would start twenty scripts, and a replay would run beside them.
     */
    runAdmitted<T>(subscription: AgentTeamSubscription, policy: SubscriptionAdmissionPolicy, task: () => Promise<T>): Promise<T>;
    /** The trial path: the same admission, with the policy that still lets a paused subscription be tested. */
    runTrial<T>(subscription: AgentTeamSubscription, task: () => Promise<T>): Promise<T>;
    /** Give booted or newly created timers a first due instant, preserving every persisted one for catch-up. */
    settleBoot(): Promise<void>;
    private timerPass;
    private admit;
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
    private admissionRefusal;
    private track;
    private launchAdmitted;
    private launchTimer;
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
    private settleOutcome;
    private saveDue;
    /** Keep the wait queue in due order: the longest wait is admitted first, whatever produced it. */
    private enqueue;
    /**
     * Publish what the budget allows, oldest accepted first, one subscription at
     * a time. A publication that fails leaves the event pending: the ledger has
     * no record of it, so the next pass retries from the same queue. One
     * subscription's storage failure must not abort the others' publications.
     */
    private publishPass;
    /** One subscription's share of a publication pass. */
    private publishOne;
    private publishOnePass;
    /** Live state for diagnostics and tests: what is running and what is waiting. */
    state(): {
        readonly running: readonly AgentTeamSubscriptionRef[];
        readonly queued: readonly AgentTeamSubscriptionRef[];
    };
}
/** The shell a snapshot was recorded under, as the executor reported itself; a different family fails the run with this. */
export declare function shellMismatchReason(recorded: SubscriptionShell, actual: SubscriptionShell): string | undefined;
//# sourceMappingURL=subscription-runtime.d.ts.map