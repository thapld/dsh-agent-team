const TRANSIENT_NETWORK_PATTERNS = [/fetch failed/i, /econnreset/i, /etimedout/i, /socket hang up/i];
const RATE_LIMIT_PATTERNS = [/\b429\b/, /rate limit/i, /\b503\b/, /overloaded/i];
/** Reads the stable code/status off any Harness-shaped failure by own fields, since a cross-package copy of `dsh-llm` loses `instanceof`. */
function structuredFailure(error) {
    if (typeof error !== 'object' || error === null)
        return {};
    const root = error;
    const failure = typeof root.failure === 'object' && root.failure !== null
        ? root.failure
        : undefined;
    const code = typeof failure?.code === 'string' && failure.code.length > 0 ? failure.code
        : typeof root.code === 'string' && root.code.length > 0 ? root.code : undefined;
    if (code === undefined)
        return {};
    const status = typeof failure?.status === 'number' && Number.isInteger(failure.status) ? failure.status
        : typeof root.status === 'number' && Number.isInteger(root.status) ? root.status : undefined;
    return { code, ...status === undefined ? {} : { status } };
}
/** The readable message of an arbitrary thrown value. */
function failureMessage(error) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === 'object' && error !== null) {
        const message = error.message;
        if (typeof message === 'string' && message.length > 0)
            return message;
    }
    return String(error);
}
/** One thrown value as a single-line diagnostic: error name, stable code if any, and message. Stacks and cause chains stay with the Harness exporter. */
export function failureDetail(error) {
    const message = failureMessage(error);
    if (!(error instanceof Error))
        return message;
    const code = error.code;
    return typeof code === 'string' && code.length > 0 ? `${error.name} code '${code}': ${message}` : `${error.name}: ${message}`;
}
/** Classify one `agent/error` occurrence into the family automatic recovery may act on, or `undefined` when a wake cannot help. */
export function classifyRecoverableError(error) {
    // Structured data outranks wording: a Harness code decides alone, and message signatures run only when no usable code exists (`UNKNOWN` is a folded foreign error whose taxonomy Team must not trust).
    const { code, status } = structuredFailure(error);
    if (code !== undefined && code !== 'UNKNOWN')
        return kindFromProvenance(code, status);
    const message = failureMessage(error);
    if (RATE_LIMIT_PATTERNS.some(pattern => pattern.test(message)))
        return 'rate limiting';
    if (TRANSIENT_NETWORK_PATTERNS.some(pattern => pattern.test(message)))
        return 'transient network';
    return undefined;
}
/** Classifies one Harness failure code: recoverable families map directly, any other code stays manual unless a matching HTTP status shows rate limiting. */
function kindFromProvenance(code, status) {
    if (code === 'RATE_LIMIT')
        return 'rate limiting';
    if (code === 'TRANSPORT' || code === 'TIMEOUT')
        return 'transient network';
    if (status === 429 || status === 503)
        return 'rate limiting';
    return undefined;
}
export const RECOVERY_DELAY_MS = 120_000;
export const RECOVERY_MAX_CONSECUTIVE_ERRORS = 3;
/** Per-member automatic recovery episodes. An episode is every recoverable `agent/error` until a clean turn end, regardless of text or family; each of the first two occurrences schedules its own wakeup. */
export class RecoveryCoordinator {
    episodes = new Map();
    wake;
    report;
    delayMs;
    maxConsecutiveErrors;
    constructor(options) {
        this.wake = options.wake;
        this.report = options.report;
        this.delayMs = options.delayMs ?? RECOVERY_DELAY_MS;
        this.maxConsecutiveErrors = options.maxConsecutiveErrors ?? RECOVERY_MAX_CONSECUTIVE_ERRORS;
    }
    /** Observe one `agent/error` occurrence for a Member; `error` is the raw event payload. */
    onError(memberId, error) {
        const errorKind = classifyRecoverableError(error);
        if (errorKind === undefined) {
            // A non-recoverable failure cancels anything pending: retrying cannot help.
            this.stopTracking(memberId, 'non-recoverable');
            return;
        }
        let episode = this.episodes.get(memberId);
        if (episode === undefined) {
            episode = { consecutiveFailures: 0, timers: new Set() };
            this.episodes.set(memberId, episode);
        }
        if (episode.stoodDown === true)
            return;
        episode.consecutiveFailures += 1;
        if (episode.consecutiveFailures >= this.maxConsecutiveErrors) {
            this.cancelTimers(episode);
            episode.stoodDown = true;
            this.emit({
                kind: 'stood-down', memberId, errorKind,
                consecutiveFailures: episode.consecutiveFailures, maxConsecutiveErrors: this.maxConsecutiveErrors,
            });
            return;
        }
        const timer = setTimeout(() => {
            episode.timers.delete(timer);
            this.emit({ kind: 'woke', memberId, consecutiveFailures: episode.consecutiveFailures });
            try {
                this.wake(memberId);
            }
            catch (error) {
                // The target is gone: the operator gets the reason instead of a silent
                // end, and the message is the only part of the failure worth keeping.
                this.stopTracking(memberId, 'wake-failed', failureDetail(error));
            }
        }, this.delayMs);
        episode.timers.add(timer);
        this.emit({
            kind: 'scheduled', memberId, errorKind,
            consecutiveFailures: episode.consecutiveFailures, maxConsecutiveErrors: this.maxConsecutiveErrors, delayMs: this.delayMs,
        });
    }
    /** A turn ended cleanly (running→idle without an error): the episode is over. */
    onCleanTurnEnd(memberId) {
        this.stopTracking(memberId, 'clean-turn');
    }
    /** End one Member's episode; `reason` says who ended it, and only a live episode reports. */
    stopTracking(memberId, reason, detail) {
        const episode = this.episodes.get(memberId);
        if (episode === undefined)
            return;
        const pendingWakes = episode.timers.size;
        this.cancelTimers(episode);
        this.episodes.delete(memberId);
        this.emit({
            kind: 'cleared', memberId, reason,
            consecutiveFailures: episode.consecutiveFailures,
            pendingWakes,
            stoodDown: episode.stoodDown === true,
            ...(detail === undefined ? {} : { detail }),
        });
    }
    dispose() {
        // Snapshot first: `stopTracking` deletes the entry it clears, and each
        // Member's clear must be reported before the next one is visited.
        for (const memberId of Array.from(this.episodes.keys()))
            this.stopTracking(memberId, 'host-disposed');
    }
    emit(fact) {
        this.report?.(fact);
    }
    cancelTimers(episode) {
        for (const timer of episode.timers)
            clearTimeout(timer);
        episode.timers.clear();
    }
}
