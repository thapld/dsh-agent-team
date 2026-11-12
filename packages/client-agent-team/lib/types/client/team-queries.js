/**
 * The stable identity of a rule: what it admits, not which closure computed it. Sorted so the order a factory lists
 * kinds in cannot make two equivalent rules look different.
 */
export function describeRule(rule) {
    return `${[...rule.kinds].sort().join(',')}|${rule.workspaceId ?? '*'}`;
}
/** The only way to brand a key: the production query factories call this, so every key's result type is stated once. */
export function teamQueryKey(key) {
    return key;
}
/**
 * Whether a change scope names one of the query's scope kinds in its Workspace. The scope-less stream is excluded:
 * every delivery touching such data has already woken the Workspace scope, so admitting it only adds redundant reads.
 */
export function coversWorkspaceScope(scope, workspaceId, kind) {
    return scope !== undefined && scope.kind === kind && scope.workspaceId === workspaceId;
}
/** Whether a rule admits a change scope. Derived from the rule, so no per-read closure can disagree with it. */
export function coversRule(scope, rule) {
    if (scope === undefined)
        return rule.kinds.includes('scopeLess');
    if (!rule.kinds.includes(scope.kind))
        return false;
    if (scope.kind !== 'workspace' && scope.kind !== 'presence')
        return true;
    return rule.workspaceId === undefined || coversWorkspaceScope(scope, rule.workspaceId, scope.kind);
}
const answeredFailure = (outcome) => outcome.ok && typeof outcome.value === 'object' && outcome.value !== null && outcome.value.ok === false;
/**
 * The Client's one owner for Team data reads, with per-query counters so duplicate reads and stale drops are observable.
 *
 * - A request joins the read for its key unless a wake it predates has invalidated it. A landed response stays joinable
 *   through the rest of the microtask drain; the next task reads Host state fresh.
 * - Each change dispatch invalidates once per (scope, version); a stream-opening baseline always invalidates.
 * - A superseded response never applies: waiters join its replacement, or the owner issues one, so an invalidation
 *   always ends in fresh data.
 * - The response lands on the microtask that resolves it; the issuance guard drops any older response arriving later.
 */
export class TeamQueries {
    changes;
    states = new Map();
    inFlight = new Map();
    /** Dispatches already folded into invalidations, so co-subscribers of one dispatch mark once. */
    folded = new WeakSet();
    issuance = 0;
    disposed = false;
    constructor(changes) {
        this.changes = changes;
    }
    read(identity, load) {
        const state = this.state(identity);
        const existing = this.inFlight.get(identity.key);
        if (existing !== undefined && !existing.superseded) {
            existing.state.counters.shared += 1;
            // The key's brand is what makes this re-type sound: `state` already confirmed this key's result type matches.
            const entry = existing;
            return new Promise((resolve, reject) => {
                const waiter = { resolve, reject };
                if (entry.outcome !== undefined) {
                    if (entry.outcome.ok)
                        waiter.resolve(entry.outcome.value);
                    else
                        waiter.reject(entry.outcome.error);
                    return;
                }
                entry.waiters.push(waiter);
            });
        }
        return new Promise((resolve, reject) => {
            this.issue(identity, state, load).waiters.push({ resolve, reject });
        });
    }
    issue(identity, state, load) {
        const issuance = (this.issuance += 1);
        const entry = { key: identity.key, issuance, state, load, superseded: false, waiters: [] };
        this.inFlight.set(identity.key, entry);
        state.counters.issued += 1;
        let started;
        try {
            started = load();
        }
        catch (error) {
            started = Promise.reject(error);
        }
        void started.then(value => this.settle(entry, { ok: true, value }), error => this.settle(entry, { ok: false, error }));
        return entry;
    }
    /**
     * Folds each dispatch into invalidations before the consumer's own listener runs, so the first requesting consumer
     * issues the shared read and the rest join it.
     */
    subscribeChanges(scope, listener) {
        return this.changes.subscribe(scope, update => {
            if (update.type === 'changed')
                this.invalidate(scope, update);
            listener(update);
        });
    }
    /**
     * A new generation restarts the presence epoch and supersedes every read, pending or landed; otherwise a low presence
     * version would collide with the old watermark and a pre-reset response could reach a post-reset reader.
     */
    newGeneration() {
        for (const state of this.states.values()) {
            delete state.invalidated.presence;
            delete state.invalidated.projection;
        }
        for (const entry of this.inFlight.values()) {
            this.supersede(entry);
            if (entry.outcome !== undefined && this.inFlight.get(entry.key) === entry)
                this.inFlight.delete(entry.key);
        }
    }
    diagnostics() {
        const snapshot = {};
        for (const [key, state] of this.states)
            snapshot[key] = { ...state.counters };
        return snapshot;
    }
    dispose() {
        this.disposed = true;
        this.states.clear();
        this.inFlight.clear();
    }
    /**
     * The state for a key, registering its rule on first use. A later read that names a different rule is a programming
     * error the type system cannot catch — the rule is data, not a type — so it fails here instead of silently replacing
     * the policy every later invalidation would then follow.
     */
    state(identity) {
        const existing = this.states.get(identity.key);
        if (existing !== undefined) {
            if (describeRule(existing.rule) !== describeRule(identity.rule)) {
                throw new Error(`query ${identity.key} was registered with a different invalidation rule: ${describeRule(existing.rule)} then ${describeRule(identity.rule)}`);
            }
            return existing;
        }
        const state = {
            key: identity.key,
            rule: identity.rule,
            counters: { issued: 0, shared: 0, superseded: 0, droppedStale: 0, droppedSuperseded: 0, failed: 0 },
            invalidated: {},
            applied: 0,
            stored: undefined,
        };
        this.states.set(identity.key, state);
        return state;
    }
    invalidate(scope, update) {
        if (this.folded.has(update))
            return;
        this.folded.add(update);
        const domain = scope?.kind === 'presence' ? 'presence' : 'projection';
        for (const state of this.states.values()) {
            if (!coversRule(scope, state.rule))
                continue;
            if (update.baseline !== true && state.invalidated[domain] === update.version)
                continue;
            state.invalidated[domain] = update.version;
            const entry = this.inFlight.get(state.key);
            if (entry !== undefined)
                this.supersede(entry);
        }
    }
    supersede(entry) {
        if (entry.superseded)
            return;
        entry.superseded = true;
        entry.state.counters.superseded += 1;
    }
    settle(entry, outcome) {
        const current = this.inFlight.get(entry.key) === entry;
        const state = entry.state;
        if (!outcome.ok || answeredFailure(outcome))
            state.counters.failed += 1;
        if (entry.issuance <= state.applied) {
            this.dropStale(entry, current);
            return;
        }
        if (entry.superseded) {
            this.deliverSuperseded(entry, current);
            return;
        }
        state.applied = entry.issuance;
        state.stored = outcome;
        entry.outcome = outcome;
        if (!outcome.ok) {
            // A failure is not shareable state: the next consumer retries Host state.
            if (current)
                this.inFlight.delete(entry.key);
            this.deliver(entry, outcome);
            return;
        }
        if (current) {
            queueMicrotask(() => {
                if (this.inFlight.get(entry.key) === entry)
                    this.inFlight.delete(entry.key);
            });
        }
        this.deliver(entry, outcome);
    }
    /** The stale payload is dropped whole, failure included, so an old error never masks newer data. */
    dropStale(entry, current) {
        entry.state.counters.droppedStale += 1;
        this.logDrop(entry, 'stale');
        if (current)
            this.inFlight.delete(entry.key);
        this.deliver(entry, entry.state.stored);
    }
    /**
     * An invalidation superseded this read: its payload must never become the query's state. Waiters move to the
     * replacement read; when the wake left none, issue it here so the invalidation still ends in fresh data.
     */
    deliverSuperseded(entry, current) {
        entry.state.counters.droppedSuperseded += 1;
        this.logDrop(entry, 'superseded');
        if (current)
            this.inFlight.delete(entry.key);
        const target = this.inFlight.get(entry.key);
        if (target !== undefined && target !== entry) {
            if (target.outcome !== undefined)
                this.deliver(entry, target.outcome);
            else
                target.waiters.push(...entry.waiters.splice(0, entry.waiters.length));
            return;
        }
        if (!this.disposed) {
            const retry = this.issue({ key: entry.state.key, rule: entry.state.rule }, entry.state, entry.load);
            retry.waiters.push(...entry.waiters.splice(0, entry.waiters.length));
            return;
        }
        this.deliver(entry, entry.state.stored);
    }
    logDrop(entry, reason) {
        console.info('[agent-team] stale read response dropped', { query: entry.key, issuance: entry.issuance, landed: entry.state.applied, reason });
    }
    deliver(entry, outcome) {
        const waiters = entry.waiters.splice(0, entry.waiters.length);
        if (outcome === undefined) {
            // Only a drop after dispose lands here: live drops hand waiters the
            // replacement read's result. Rejected rather than left pending so no waiter hangs.
            for (const waiter of waiters)
                waiter.reject(new Error('read superseded before any result landed'));
            return;
        }
        for (const waiter of waiters) {
            if (outcome.ok)
                waiter.resolve(outcome.value);
            else
                waiter.reject(outcome.error);
        }
    }
}
