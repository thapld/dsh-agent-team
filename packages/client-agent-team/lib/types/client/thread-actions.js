import { useCallback, useEffect, useRef, useState } from 'react';
import { mintRequestId } from "./requests.js";
/**
 * Whether one Member follows a Thread, asked of the Host's whole follower set.
 *
 * The set holds every Member whose Attention is on the Thread, so "does the Human follow?" is a question about the
 * Human's own id rather than about the set's size: a set holding other Members is not a followed Thread for this
 * reader. An id that has not been projected yet leaves the question unanswered — `undefined` — because guessing an
 * id would let another Member's Attention be read as the Human's.
 */
function followsIn(followers, humanMemberId) {
    if (humanMemberId === undefined)
        return undefined;
    return (followers instanceof Set ? followers : new Set(followers)).has(humanMemberId);
}
/**
 * The Human's follow state for one Thread, read from the Host's Attention observation and written through the Human
 * Remote. Both faces that can open a Thread share this hook, so the control's display rule — the Host's current
 * observation, never an optimistic guess — and its recovery on failure live in one place.
 *
 * The observation is the Thread's whole follower set: every Member whose Attention is on it, not the Human's row
 * alone. The Human's standing is therefore that set *asked about the Human's own id*, which is why the caller hands
 * the id in rather than the hook assuming one: the Host projects it, and a set that holds other Members must read as
 * not following just as an empty one does.
 *
 * A write never optimistically flips the state: the button shows what the Host last answered, so a refused or failed
 * write leaves the previous standing on screen instead of a claim the next read would contradict.
 */
export function useThreadFollow(changeAttention, threadObservations, request, 
/** The observation a face has already read on mount, so the control starts from the answer that read landed instead of asking again. */
observed, 
/** The Human's own Member id, from the Host's projection; undefined keeps the standing unanswered rather than guessing one. */
humanMemberId) {
    const [following, setFollowing] = useState();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState();
    // The requestId a lost answer retries with, keyed by action and Thread: the Host answers a repeated
    // id from its idempotency cache, so a retry converges instead of writing twice. An id that the Host
    // has answered is dropped — the next write is a new operation, not a replay of the last one.
    const requestIds = useRef(new Map());
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);
    // The observation is the display authority. Reading it again after every write is what makes a follow or
    // unfollow visible on the other face too, without either face keeping its own copy of the standing.
    const refresh = useCallback(async () => {
        try {
            const result = await threadObservations({ workspaceId: request.workspaceId, ...(request.threadRef === undefined ? {} : { threadRef: request.threadRef }), ...(request.taskRef === undefined ? {} : { taskRef: request.taskRef }) });
            if (!mounted.current)
                return;
            // The follower set is every Member's Attention, so the Human's standing is the answer to a
            // question about the Human's own id. Until that id has been projected the standing stays
            // unanswered: guessing an id would let another Member's Attention read as the Human's.
            if (result.ok)
                setFollowing(followsIn(result.value.followers, humanMemberId));
        }
        catch {
            // A failed observation leaves the previous standing in place; the write itself reports its own failure.
        }
    }, [threadObservations, request.workspaceId, request.threadRef, request.taskRef, humanMemberId]);
    // A face that hands its own observation in takes each answer as the standing; a face with
    // none asks for one. Either way the control paints what the Host last answered.
    useEffect(() => {
        if (observed === undefined) {
            void refresh();
            return;
        }
        setFollowing(followsIn(observed, humanMemberId));
    }, [observed, refresh, humanMemberId]);
    const toggle = useCallback(async (action) => {
        if (pending)
            return;
        setPending(true);
        setError(undefined);
        const key = `${action}:${request.threadRef ?? request.taskRef ?? ''}`;
        const requestId = requestIds.current.get(key) ?? mintRequestId();
        requestIds.current.set(key, requestId);
        try {
            const result = await changeAttention({ requestId, workspaceId: request.workspaceId, ...(request.threadRef === undefined ? {} : { threadRef: request.threadRef }), ...(request.taskRef === undefined ? {} : { taskRef: request.taskRef }), action });
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error.message);
                requestIds.current.delete(key);
                return;
            }
            // The Host answered, so this id has played its part: keeping it would make the next write on
            // this action replay the old one instead of committing a new change of standing.
            requestIds.current.delete(key);
            // The result carries the durable Attention row, present after a follow and absent after an
            // unfollow. The re-read that follows re-projects the whole follower set, which is what the
            // other face of the Thread reads too — so both faces agree without either keeping a copy.
            setFollowing(result.value.attention !== undefined);
            await refresh();
        }
        catch (cause) {
            // The answer never arrived, so the id stays cached: a retry reuses it and converges on the
            // Host's own record of the write instead of issuing a second one.
            if (mounted.current)
                setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            if (mounted.current)
                setPending(false);
        }
    }, [pending, changeAttention, refresh, request.workspaceId, request.threadRef, request.taskRef]);
    return { following, pending, error, toggle };
}
/**
 * The Human's Task responsibility transfer, shared by the Thread page and the discussion panel. The Client offers a
 * target the Host already projected as a legal accountable and re-implements neither the authority rules nor the
 * fences: an unread or stale answer arrives as a typed outcome — the same control flow the accept, close, and reopen
 * buttons already model — and every refusal leaves the Task's current accountable on screen untouched.
 */
export function useTaskTransfer(transferTask, request) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState();
    const [refusal, setRefusal] = useState();
    const [landedOn, setLandedOn] = useState();
    const requestIds = useRef(new Map());
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);
    const transfer = useCallback(async (target) => {
        if (pending)
            return;
        const baseRevision = request.revisionOf();
        if (baseRevision === undefined)
            return;
        setPending(true);
        setError(undefined);
        setRefusal(undefined);
        setLandedOn(undefined);
        const requestId = requestIds.current.get(target) ?? mintRequestId();
        requestIds.current.set(target, requestId);
        try {
            const result = await transferTask({ requestId, workspaceId: request.workspaceId, taskRef: request.taskRef, target, baseRevision });
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            if (result.value.kind === 'committed') {
                requestIds.current.delete(target);
                // Stated from the Host's committed answer, not from the target that was asked for: the surface
                // names who holds the Task now, and a later refusal clears it again.
                setLandedOn(target);
                await request.onCommitted(result.value);
            }
            else if (result.value.kind === 'unread_required') {
                requestIds.current.delete(target);
                const refusal = { kind: 'unread_required', unreadCount: result.value.unreadCount };
                setRefusal(refusal);
                await request.onRefusal?.(refusal);
            }
            else {
                requestIds.current.delete(target);
                const refusal = { kind: 'stale_revision' };
                setRefusal(refusal);
                await request.onRefusal?.(refusal);
            }
        }
        catch (cause) {
            if (mounted.current)
                setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            if (mounted.current)
                setPending(false);
        }
    }, [pending, transferTask, request]);
    return { pending, error, refusal, landedOn, transfer };
}
