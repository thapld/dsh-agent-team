import { RemoteStreamCarrierError } from '@deepseek-ai/dsh-api-gateway/client';
function scopeKey(scope) {
    return scope === undefined ? 'all'
        : scope.kind === 'workspace' ? `workspace:${scope.workspaceId}`
            : scope.kind === 'project' ? `project:${scope.projectRef}`
                : scope.kind === 'presence' ? `presence:${scope.workspaceId}`
                    : `thread:${scope.threadRef}`;
}
/** One logical stream per scope per page; Harness owns the shared transport and recovery. */
export class TeamChangeStream {
    remote;
    subscriptions = new Map();
    constructor(remote) {
        this.remote = remote;
    }
    subscribe(scope, listener) {
        const key = scopeKey(scope);
        let subscription = this.subscriptions.get(key);
        if (subscription === undefined) {
            subscription = this.open(scope, new Set([listener]));
            this.subscriptions.set(key, subscription);
            void this.run(key, subscription);
        }
        else {
            subscription.listeners.add(listener);
            if (subscription.failure !== undefined)
                listener({ type: 'failed', message: subscription.failure });
        }
        const owned = subscription;
        return () => {
            if (!owned.listeners.delete(listener) || owned.listeners.size !== 0)
                return;
            if (this.subscriptions.get(key) === owned)
                this.subscriptions.delete(key);
            void owned.stream.dispose();
        };
    }
    /** Reopen every scope whose stream ended for good. The Harness resumes a live generation across reconnects, but a terminated one is gone; listeners keep their seats, so only the stream is replaced. */
    recover() {
        // Replacing an existing key's value is safe during Map iteration: the entry keeps
        // its place, and a scope that never failed is left untouched.
        for (const [key, subscription] of this.subscriptions) {
            if (subscription.failure === undefined)
                continue;
            const replacement = this.open(subscription.scope, subscription.listeners);
            this.subscriptions.set(key, replacement);
            void subscription.stream.dispose();
            void this.run(key, replacement);
        }
    }
    open(scope, listeners) {
        const key = scopeKey(scope);
        const stream = this.remote.$stream({
            name: `Team changes ${key}`,
            open: signal => this.remote.agentTeam.changes(scope === undefined ? {} : { scope }, signal),
            // A normal end after the baseline is an outage, not a verdict: the Harness
            // retries a carrier loss and reports it through `carrierFailed`, while every
            // other error stays terminal. Only an end before the opening baseline is a
            // protocol violation — this stream never yields nothing before it ends.
            ended: accepted => accepted
                ? new RemoteStreamCarrierError('Team change subscription ended without a terminal result')
                : new Error('Team change subscription ended before its opening baseline'),
            carrierFailed: error => this.fail(key, error.message),
        });
        return { scope, stream, listeners, failure: undefined, pendingBaseline: false };
    }
    async dispose() {
        const subscriptions = [...this.subscriptions.values()];
        this.subscriptions.clear();
        await Promise.all(subscriptions.map(subscription => subscription.stream.dispose()));
    }
    fail(key, message) {
        const subscription = this.subscriptions.get(key);
        if (subscription === undefined || subscription.failure !== undefined)
            return;
        subscription.failure = message;
        subscription.pendingBaseline = true;
        for (const listener of subscription.listeners)
            listener({ type: 'failed', message });
    }
    async run(key, subscription) {
        try {
            // One update object per dispatch, so every co-subscriber receives the identical value and the read layer folds it into one invalidation.
            // A baseline marks the stream's opening, including its first item after a carrier outage retried inside this loop.
            let opening = true;
            for await (const item of subscription.stream) {
                if (this.subscriptions.get(key) !== subscription)
                    return;
                item.accept();
                subscription.failure = undefined;
                const baseline = opening || subscription.pendingBaseline;
                subscription.pendingBaseline = false;
                opening = false;
                const update = { type: 'changed', version: item.value.version, ...(baseline ? { baseline: true } : {}) };
                for (const listener of subscription.listeners)
                    listener(update);
            }
        }
        catch (error) {
            if (this.subscriptions.get(key) === subscription)
                this.fail(key, error instanceof Error ? error.message : String(error));
        }
    }
}
/**
 * The Host's `changes` stream never wakes on a Thread read (it moves only the reader's private watermark), but a durable
 * read consumes the reader's mention markers, so the badge and Inbox refresh from the completed read itself.
 */
export class TeamReadStream {
    version = 0;
    listeners = new Set();
    bump() {
        this.version += 1;
        for (const listener of this.listeners)
            listener();
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
}
