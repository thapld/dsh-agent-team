/**
 * Run history and failed deliveries: the records an owner reads back after a
 * run, and the queue entry a delivery becomes when its retries are spent.
 *
 * Neither is a Team fact. Both live in the private subscription domain, are
 * evicted on their own schedule, and are dropped with the subscription that
 * owns them; the ledger's accepted and published events stay the only record of
 * what a subscription really delivered.
 * @module @contexera/dsh-agent-team/subscription-runs
 */
import { randomUUID } from 'node:crypto';
import { failureTail, runSucceeded } from "./subscription-runner.js";
/** How many runs one subscription keeps. Older records are evicted, newest first. */
export const SUBSCRIPTION_RUN_HISTORY_LIMIT = 50;
/** How many failed deliveries one subscription keeps, and how long each survives. */
export const SUBSCRIPTION_DELIVERY_LIMIT = 10;
export const SUBSCRIPTION_DELIVERY_RETENTION_MS = 7 * 24 * 60 * 60_000;
/**
 * The storage key of one run: subscription, start instant, run id. The instant
 * is zero-padded so key order is start order, which is what eviction reads.
 */
export function subscriptionRunKey(record) {
    const started = Date.parse(record.startedAt);
    return `${record.subscriptionRef}|${String(started).padStart(15, '0')}|${record.runRef}`;
}
/** Keys of one subscription's runs, oldest first. */
export function subscriptionRunKeysOf(keys, subscriptionRef) {
    const prefix = `${subscriptionRef}|`;
    return [...keys].filter(key => key.startsWith(prefix)).sort();
}
/** The keys an insert has to evict so that at most `limit` runs stay, oldest first. */
export function evictedRunKeys(keys, limit = SUBSCRIPTION_RUN_HISTORY_LIMIT) {
    return keys.length <= limit ? [] : [...keys].sort().slice(0, keys.length - limit);
}
/** The tail a record keeps: the same 8 KiB cap a refusal shows. */
export function runTail(text) {
    return failureTail(text);
}
/** One run as it is stored: the summary plus the capped tails and the identity that explains it. */
export function runRecordOf(input) {
    const { subscription, report } = input;
    return Object.freeze({
        runRef: `run:${randomUUID()}`,
        subscriptionRef: subscription.subscriptionRef,
        projectRef: subscription.projectRef,
        trigger: input.trigger,
        startedAt: new Date(input.startedAt).toISOString(),
        durationMs: input.durationMs,
        category: input.category,
        ...(report.reason === undefined ? {} : { reason: report.reason }),
        exitCode: report.exitCode,
        timedOut: report.timedOut,
        eventCount: input.eventCount,
        stdoutTail: runTail(report.stdout),
        stderrTail: runTail(report.stderr),
        subscriptionRevision: subscription.revision,
        scriptHash: subscription.script.sha256,
        ...(input.delivery === undefined ? {} : { deliveryRef: input.delivery.deliveryRef }),
        attempt: input.delivery?.attempt ?? 0,
    });
}
export function runSummaryOf(record) {
    return Object.freeze({ runRef: record.runRef, trigger: record.trigger, startedAt: record.startedAt,
        durationMs: record.durationMs, category: record.category, succeeded: runSucceeded(record.category),
        eventCount: record.eventCount, exitCode: record.exitCode, timedOut: record.timedOut,
        subscriptionRevision: record.subscriptionRevision });
}
/**
 * One delivery as it is stored. A retried admission of the same `deliveryRef`
 * replaces the earlier attempt count and error but keeps the received version
 * and the first arrival instant, so a pinned replay always runs what arrived.
 */
export function deliveryRecordOf(subscription, input, earlier) {
    const receivedAt = earlier?.receivedAt ?? new Date(input.receivedAt).toISOString();
    const admissionRef = earlier?.admissionRef ?? input.admissionRef;
    return Object.freeze({
        deliveryRef: input.deliveryRef,
        ...(admissionRef === undefined ? {} : { admissionRef }),
        subscriptionRef: subscription.subscriptionRef,
        projectRef: subscription.projectRef,
        receivedRevision: earlier?.receivedRevision ?? input.receivedRevision,
        receivedScriptHash: earlier?.receivedScriptHash ?? input.script.sha256,
        script: earlier?.script ?? input.script,
        credentials: earlier?.credentials ?? input.credentials,
        body: earlier?.body ?? input.body,
        receivedAt,
        expiresAt: earlier?.expiresAt ?? deliveryExpiresAt(input.receivedAt),
        attempts: input.attempts,
        lastError: input.lastError,
        ...(earlier?.replay === undefined ? {} : { replay: earlier.replay }),
    });
}
/** The storage key of one delivery: its own subscription, then the ingress-issued ref. */
export function deliveryKey(subscriptionRef, deliveryRef) {
    return `${subscriptionRef}|${deliveryRef}`;
}
/** Keys of one subscription's deliveries, newest last. */
export function deliveryKeysOf(keys, subscriptionRef) {
    const prefix = `${subscriptionRef}|`;
    return [...keys].filter(key => key.startsWith(prefix));
}
/**
 * The deliveries still worth an owner's attention: expired ones are gone, and a
 * delivery whose replay succeeded was handled even though its entry stays —
 * that entry is what makes a repeated replay idempotent. `replayed` names the
 * deliveries that delivered by whatever record survived, because the tombstone
 * on the delivery is only one of the records a replay leaves.
 */
export function failedDeliveries(records, now, replayed = new Set()) {
    return [...records]
        .filter(record => Date.parse(record.expiresAt) > now && record.replay?.succeeded !== true && !replayed.has(record.deliveryRef))
        .sort((left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt));
}
/** The deliveries to drop so that at most `limit` stay: the longest-received first. */
export function evictedDeliveries(records, limit = SUBSCRIPTION_DELIVERY_LIMIT) {
    const byArrival = [...records].sort((left, right) => Date.parse(left.receivedAt) - Date.parse(right.receivedAt));
    return byArrival.length <= limit ? [] : byArrival.slice(0, byArrival.length - limit);
}
/** One delivery as an owner reads it: identity, the error that spent its retries, and its expiry. */
export function deliveryEntryOf(record) {
    return Object.freeze({
        deliveryRef: record.deliveryRef,
        receivedRevision: record.receivedRevision,
        receivedScriptHash: record.receivedScriptHash,
        receivedAt: record.receivedAt,
        expiresAt: record.expiresAt,
        attempts: record.attempts,
        lastError: record.lastError,
    });
}
/** The instant a delivery record expires; it is dropped with the subscription and after this. */
export function deliveryExpiresAt(receivedAt) {
    return new Date(receivedAt + SUBSCRIPTION_DELIVERY_RETENTION_MS).toISOString();
}
/**
 * One requested replay, indexed by the request rather than by the delivery.
 *
 * The delivery row keeps the same answer for its own retention, but a delivery
 * row can only compare the request id of one delivery: the same id aimed at a
 * second delivery would run a second, different intent. This record is the whole
 * key — the request, the delivery it named, and the version it chose — so a
 * repeated call answers once, a concurrent one is refused, and reusing an id for
 * another intent collides instead of executing.
 */
/** Whether a request may still be executing, or its answer is recorded. */
export const SUBSCRIPTION_REPLAY_STATES = ['running', 'settled'];
/** The storage key of one replay: its own subscription, then the request that asked for it. */
export function replayKey(subscriptionRef, requestId) {
    return `${subscriptionRef}|${requestId}`;
}
/** Keys of one subscription's replays. */
export function replayKeysOf(keys, subscriptionRef) {
    const prefix = `${subscriptionRef}|`;
    return [...keys].filter(key => key.startsWith(prefix));
}
