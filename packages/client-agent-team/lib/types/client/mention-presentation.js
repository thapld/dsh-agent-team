import { draftKindOf } from "./drafts.js";
export function mentionSurfaceOf(draftKey) {
    return draftKindOf(draftKey);
}
/** Owners lead, then the conversation the reader is writing into, then the wider Workspace. */
const GROUP_ORDER = ['owner', 'thread', 'project', 'other'];
/** Presence is the live signal; `unavailable` means offline, which no longer hides a durable mention target. */
function isOnline(status) {
    return status.presence !== 'unavailable';
}
function matchesQuery(status, query) {
    if (query === '')
        return true;
    const needle = query.toLocaleLowerCase();
    return status.member.handle.toLocaleLowerCase().includes(needle)
        || status.member.description.toLocaleLowerCase().includes(needle);
}
/**
 * Every Member a mention can address, narrowed by the typed query. A Member
 * leaves the roster only by lifecycle (`inactive`/`archived` reject a mention
 * at the Host too); an offline Member stays — the mention is a durable marker
 * they read when they return.
 */
export function mentionCandidatesFor(members, query) {
    return members.filter(status => status.member.state !== 'inactive'
        && status.member.state !== 'archived'
        && matchesQuery(status, query));
}
function groupOf(status, surface, roster) {
    const id = status.member.memberId;
    if (roster.owners?.has(id) === true)
        return 'owner';
    if (surface === 'thread' && roster.followers?.has(id) === true)
        return 'thread';
    if (roster.projectMembers?.has(id) === true)
        return 'project';
    return 'other';
}
/** Online first, then handle order — deterministic, so the order no longer drifts with the roster's arrival order. */
function compareRows(left, right) {
    const leftOnline = isOnline(left);
    const rightOnline = isOnline(right);
    if (leftOnline !== rightOnline)
        return leftOnline ? -1 : 1;
    const a = left.member.handle.toLocaleLowerCase();
    const b = right.member.handle.toLocaleLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
}
export function buildMentionGroups(members, query, surface, roster) {
    const buckets = new Map();
    for (const status of mentionCandidatesFor(members, query)) {
        const key = groupOf(status, surface, roster);
        const bucket = buckets.get(key);
        if (bucket === undefined)
            buckets.set(key, [status]);
        else
            bucket.push(status);
    }
    const groups = [];
    for (const key of GROUP_ORDER) {
        const bucket = buckets.get(key);
        if (bucket === undefined || bucket.length === 0)
            continue;
        groups.push({ key, options: Object.freeze([...bucket].sort(compareRows)) });
    }
    return groups;
}
/**
 * Members a pick would enroll: notified, yet not already taking part in the
 * Project. Empty when the roster is unknown (an empty set) rather than claiming
 * everyone is new.
 */
export function enrollmentIds(notified, projectMembers) {
    if (projectMembers === undefined || projectMembers.size === 0)
        return [];
    return notified.filter(memberId => !projectMembers.has(memberId));
}
