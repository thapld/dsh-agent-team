import { activityFact } from '@contexera/dsh-agent-team/host';
/** Rebuild the exact Host Activity fact a view came from; a view missing its identity yields none, so it can never bind. */
export function activityFromView(value, projectRef) {
    if (value.kind !== 'activity' || value.activityRef === undefined || value.actor === undefined || value.activity === undefined)
        return undefined;
    const base = { activityRef: value.activityRef, sequence: value.sequence, actor: value.actor };
    if (projectRef !== undefined) {
        if (value.memberId === undefined || (value.activity !== 'owner-added' && value.activity !== 'owner-removed'))
            return undefined;
        return activityFact({ ...base, kind: value.activity, memberId: value.memberId, projectRef });
    }
    if (value.threadRef === undefined)
        return undefined;
    if (value.activity === 'worker_started' || value.activity === 'worker_settled') {
        if (value.workerRef === undefined || value.projectRef === undefined || value.engine === undefined)
            return undefined;
        const worker = { ...base, threadRef: value.threadRef, projectRef: value.projectRef, workerRef: value.workerRef,
            engine: value.engine, ...(value.taskRef === undefined ? {} : { taskRef: value.taskRef }) };
        if (value.activity === 'worker_started')
            return activityFact({ ...worker, kind: 'worker_started' });
        if (value.state === undefined)
            return undefined;
        return activityFact({ ...worker, kind: 'worker_settled', state: value.state,
            ...(value.reason === undefined ? {} : { reason: value.reason }) });
    }
    // Every remaining kind is Task progress, so its Task ref is part of its identity.
    if (value.taskRef === undefined)
        return undefined;
    const thread = { ...base, taskRef: value.taskRef, threadRef: value.threadRef };
    switch (value.activity) {
        case 'claim':
        case 'done':
        case 'release':
            return value.claimRef === undefined ? undefined
                : activityFact({ ...thread, kind: value.activity, claimRef: value.claimRef });
        case 'claims_released':
            return value.claimRefs === undefined ? undefined
                : activityFact({ ...thread, kind: value.activity, claimRefs: [...value.claimRefs] });
        case 'promote':
        case 'accept':
        case 'close':
        case 'reopen':
        case 'transfer':
            return activityFact({ ...thread, kind: value.activity, from: value.from, to: value.to,
                releasedClaimRefs: value.releasedClaimRefs === undefined ? undefined : [...value.releasedClaimRefs],
                completedClaimRefs: value.completedClaimRefs === undefined ? undefined : [...value.completedClaimRefs],
                acceptedClaimRefs: value.acceptedClaimRefs === undefined ? undefined : [...value.acceptedClaimRefs],
                refollowedMembers: value.refollowedMembers === undefined ? undefined : [...value.refollowedMembers] });
        default:
            return undefined;
    }
}
