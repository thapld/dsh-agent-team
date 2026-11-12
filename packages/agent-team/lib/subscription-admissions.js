/**
 * The private row written before a webhook answers 202. It stays while the
 * delivery owes execution, acceptance, or a replayable failure record.
 * @module @contexera/dsh-agent-team/subscription-admissions
 */
/**
 * The states a queued delivery passes through. `accepted` is not one: a delivery writes
 * itself out of this table, so a row that exists is always work still owed.
 */
export const SUBSCRIPTION_ADMISSION_STATES = ['queued', 'running', 'retrying', 'exhausted'];
/** The request id one attempt's accept commits under, so a restart can ask the ledger what it already accepted. */
export function admissionAttemptRequestId(admissionRef, attempt) {
    return `${admissionRef}:attempt-${attempt}`;
}
/** One admission's storage key: its subscription, then the Host's own delivery identity. */
export function admissionKey(subscriptionRef, admissionRef) {
    return `${subscriptionRef}|${admissionRef}`;
}
/** Keys of one subscription's admissions. A ref never contains the separator. */
export function admissionKeysOf(keys, subscriptionRef) {
    const prefix = `${subscriptionRef}|`;
    return [...keys].filter(key => key.startsWith(prefix));
}
/**
 * The failed-delivery ref one admission becomes: the provider's own delivery name when
 * it has one, so a redelivery replaces its record instead of piling up beside it, and
 * otherwise the admission's own ref, unique per admission.
 */
export function admissionDeliveryRef(admissionRef, headers) {
    for (const [name, value] of Object.entries(headers)) {
        if (!/^x-.*-delivery$/.test(name))
            continue;
        const provider = value.trim();
        // The key format admits one value with no separator; anything else is a quirk we skip.
        if (provider !== '' && !provider.includes(':') && provider.length <= 200)
            return `delivery:${provider}`;
    }
    return `delivery:${admissionRef.replace(/^admission:/, '')}`;
}
/** The admission identity minted for one request: random, stable for its whole life. */
export function admissionRefFor(id) {
    return `admission:${id}`;
}
/** The admissions due now, oldest arrival first: a fair order that does not starve an early delivery. */
export function dueAdmissions(records, nowMs) {
    return [...records]
        .filter(record => record.state !== 'running'
        && (record.nextAttemptAt === undefined || Date.parse(record.nextAttemptAt) <= nowMs))
        .sort((left, right) => Date.parse(left.receivedAt) - Date.parse(right.receivedAt));
}
