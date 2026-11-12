export const REVIEW_BACKLOG_IDLE_MS = 30 * 60 * 1000;
export const STALLED_PUBLIC_MS = 24 * 60 * 60 * 1000;
export const STALLED_IDLE_MS = 24 * 60 * 60 * 1000;
function eligible(input, candidate) {
    return !input.episodeExists(candidate.taskRef, candidate.kind, candidate.recipient, candidate.baselineSequence)
        && !input.hasUnreadResponsibility(candidate.taskRef, candidate.recipient);
}
/** Evaluate every open Task once. Unknown runtime presence never becomes an idle duration. */
export function planTaskReminders(input) {
    const candidates = [];
    for (const facts of input.tasks) {
        const { task } = facts;
        if (!facts.projectActive || task.resolution !== 'open')
            continue;
        if (task.status === 'in_review') {
            const recipient = input.verifierOf(task);
            const idleMs = input.idleMs(recipient);
            const ready = recipient === 'member:human'
                ? input.nowMs - Date.parse(facts.statusBaselineOccurredAt) >= REVIEW_BACKLOG_IDLE_MS
                : idleMs !== undefined && idleMs >= REVIEW_BACKLOG_IDLE_MS;
            const candidate = { taskRef: task.taskRef, kind: 'review-backlog', recipient, baselineSequence: facts.statusBaselineSequence };
            if (ready && input.isAvailable(recipient) && eligible(input, candidate))
                candidates.push(candidate);
            continue;
        }
        if (task.status !== 'in_progress')
            continue;
        const activeClaims = facts.claims.filter(entry => entry.claim.state === 'active');
        const quiet = input.nowMs - Date.parse(facts.latestPublicOccurredAt) > STALLED_PUBLIC_MS;
        const executorIdle = activeClaims.some(entry => {
            const idleMs = input.idleMs(entry.claim.owner);
            return idleMs !== undefined && idleMs > STALLED_IDLE_MS;
        });
        const baselineSequence = Math.max(facts.latestPublicSequence, ...activeClaims.map(entry => entry.createdSequence));
        const candidate = { taskRef: task.taskRef, kind: 'stalled', recipient: task.accountable, baselineSequence };
        if ((quiet || executorIdle) && input.isAvailable(task.accountable) && eligible(input, candidate))
            candidates.push(candidate);
    }
    return candidates;
}
