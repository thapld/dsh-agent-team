import { useSyncExternalStore } from 'react';
/** Compare refs by branded prefix plus hyphen-stripped UUID, so abbreviated spellings line up with their full form. */
export function refKeyOf(ref) {
    return ref.toLowerCase().replaceAll('-', '');
}
/** Concurrent callers deduplicate through the pending set; refs the Host does not know are parked so renders never retry-loop. */
function createRefStore(refOf) {
    const resolved = new Map();
    const pending = new Set();
    const unresolvable = new Set();
    const listeners = new Set();
    let version = 0;
    const emit = () => {
        version += 1;
        for (const listener of listeners)
            listener();
    };
    const subscribe = (listener) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    };
    /** Stable snapshot token; the map is read directly after this changes. */
    const getSnapshot = () => version;
    const useVersion = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const cached = (ref) => resolved.get(ref);
    const remember = (entry) => {
        resolved.set(refOf(entry), entry);
        pending.delete(refOf(entry));
        emit();
    };
    const resolveUnknown = async (refs, lookup) => {
        const missing = refs.filter(ref => !resolved.has(ref) && !pending.has(ref) && !unresolvable.has(ref));
        if (missing.length === 0)
            return;
        for (const ref of missing)
            pending.add(ref);
        try {
            const entries = await lookup(missing);
            for (const entry of entries) {
                resolved.set(refOf(entry), entry);
                pending.delete(refOf(entry));
            }
            // Parked for the session: re-querying on every render would hammer the Host.
            for (const ref of missing) {
                if (!resolved.has(ref))
                    unresolvable.add(ref);
            }
            if (entries.length > 0)
                emit();
        }
        finally {
            for (const ref of missing)
                pending.delete(ref);
        }
    };
    return { useVersion, cached, remember, resolveUnknown };
}
const taskStore = createRefStore((entry) => entry.taskRef);
const threadStore = createRefStore((entry) => entry.threadRef);
const messageStore = createRefStore((entry) => entry.messageRef);
export const useResolvedTaskRefVersion = taskStore.useVersion;
export const cachedResolvedTaskRef = taskStore.cached;
const rememberResolvedTaskRef = taskStore.remember;
export const resolveUnknownTaskRefs = taskStore.resolveUnknown;
export const useResolvedThreadRefVersion = threadStore.useVersion;
export const cachedResolvedThreadRef = threadStore.cached;
export const rememberResolvedThreadRef = threadStore.remember;
export const resolveUnknownThreadRefs = threadStore.resolveUnknown;
export const useResolvedMessageRefVersion = messageStore.useVersion;
export const cachedResolvedMessageRef = messageStore.cached;
const rememberResolvedMessageRef = messageStore.remember;
export const resolveUnknownMessageRefs = messageStore.resolveUnknown;
/**
 * Pair each resolved entry with the ref that requested it. The Host returns `resolved` in input order, unknowns omitted,
 * with full refs even for abbreviated inputs; an entry whose full ref does not extend the requested one marks an unknown
 * input and is skipped without consuming the entry. Each authored spelling is remembered as an alias.
 */
function rememberAliasedResolutions(entries, refs, remember, refOf, alias) {
    let entryIndex = 0;
    for (const requested of refs) {
        const entry = entries[entryIndex];
        if (entry === undefined || !refKeyOf(refOf(entry)).startsWith(refKeyOf(requested)))
            continue;
        if (refOf(entry) !== requested)
            remember(alias(entry, requested));
        remember(entry);
        entryIndex += 1;
    }
}
/** Click-path Host lookup shared by both ref kinds; relies on the ordering contract of {@link rememberAliasedResolutions}. */
async function hostRefLookup(remember, refOf, alias, request, refs) {
    const result = await request(refs);
    if (!result.ok)
        return [];
    rememberAliasedResolutions(result.value, refs, remember, refOf, alias);
    return result.value;
}
export const hostTaskRefLookup = (resolveTaskRefs, workspaceId) => async (taskRefs) => hostRefLookup(rememberResolvedTaskRef, entry => entry.taskRef, (entry, taskRef) => ({ ...entry, taskRef }), async (refs) => {
    const result = await resolveTaskRefs({ workspaceId, taskRefs: refs });
    return result.ok ? { ok: true, value: result.value.resolved } : result;
}, taskRefs);
export const hostThreadRefLookup = (resolveThreadRefs, workspaceId) => async (threadRefs) => hostRefLookup(rememberResolvedThreadRef, entry => entry.threadRef, (entry, threadRef) => ({ ...entry, threadRef }), async (refs) => {
    const result = await resolveThreadRefs({ workspaceId, threadRefs: refs });
    return result.ok ? { ok: true, value: result.value.resolved } : result;
}, threadRefs);
/** Reply parents are read-only context: fill quotes in place and leave unknown ones unresolved rather than render a quote of nothing. */
export const hostMessageRefLookup = (resolveMessageRefs, workspaceId) => async (messageRefs) => {
    const result = await resolveMessageRefs({ workspaceId, messageRefs });
    if (!result.ok)
        throw new Error(result.error.message);
    for (const entry of result.value.resolved)
        rememberResolvedMessageRef(entry);
    return result.value.resolved;
};
export const jumpToTaskThread = (resolveTaskRefs, workspaceId, taskRef, selectThread) => {
    void resolveTaskRefs({ workspaceId, taskRefs: [taskRef] }).then(result => {
        if (!result.ok)
            return;
        const hit = result.value.resolved[0];
        if (hit !== undefined)
            selectThread(hit.threadRef, hit.projectRef, hit.taskRef, hit.taskNumber);
    });
};
/**
 * One resolved Thread ref, sent to the face its kind belongs to: a Task Thread keeps the full page, a taskless
 * discussion opens beside its Project's Main stream. Every reader of a `thread:` ref routes through this, so a ref
 * cannot land on the full page from one surface and in the panel from another.
 */
export const resolvedThreadDestination = (selectThread, selectDiscussion) => entry => {
    if (entry.taskRef !== undefined) {
        selectThread(entry.threadRef, entry.projectRef, entry.taskRef, entry.taskNumber);
        return;
    }
    selectDiscussion(entry.threadRef, entry.projectRef);
};
export const jumpToThread = (resolveThreadRefs, workspaceId, threadRef, open) => {
    void resolveThreadRefs({ workspaceId, threadRefs: [threadRef] }).then(result => {
        if (!result.ok)
            return;
        const hit = result.value.resolved[0];
        if (hit !== undefined)
            open(hit);
    });
};
/** Exactly one roster entry whose full key extends the authored spelling; ambiguity resolves to nothing. */
function uniqueByPrefix(entries, keyOf, authored) {
    const key = refKeyOf(authored);
    const hits = entries.filter(entry => refKeyOf(keyOf(entry)).startsWith(key));
    return hits.length === 1 ? hits[0] : undefined;
}
/** Undefined when the loaded roster does not know the ref (the caller keeps plain text). Archived Projects never resolve. */
export const rosterProjectName = (projects, projectRef) => uniqueByPrefix(projects.filter(project => project.state === 'active'), project => project.projectRef, projectRef)?.name;
/** Undefined when nobody on the roster answers to it. The Human resolves to a handle with no session, never a link. */
export const rosterMember = (members, humanMemberId, humanHandle, memberRef) => {
    if (humanMemberId !== undefined && refKeyOf(memberRef) === refKeyOf(humanMemberId)) {
        return { memberId: humanMemberId, handle: humanHandle, openable: false };
    }
    const hit = uniqueByPrefix(members, status => status.member.memberId, memberRef);
    if (hit === undefined)
        return undefined;
    const openable = hit.availability === 'active';
    return {
        memberId: hit.member.memberId,
        handle: hit.member.handle.replace(/^@/, ''),
        ...(openable ? { sessionId: hit.member.sessionId } : {}),
        openable,
    };
};
/**
 * A Task's accountable as this roster draws them: the Human by their own name, a Member by handle, and — like the Host's
 * own resolution — an unresolvable id left as the id. The state rides along so a suspended owner reads as a standing.
 */
export const rosterAccountableOwner = (members, humanMemberId, humanHandle, accountable) => {
    const resolved = rosterMember(members, humanMemberId, humanHandle, accountable);
    const state = members.find(status => status.member.memberId === resolved?.memberId)?.member.state;
    return {
        memberId: resolved?.memberId ?? accountable,
        name: resolved?.handle ?? accountable,
        ...(state === undefined ? {} : { state }),
    };
};
