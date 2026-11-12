import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { AgentTeamMainAttentionResult, AgentTeamMemberId, AgentTeamTask, AgentTeamTaskRef, AgentTeamThreadAttentionRequest, AgentTeamThreadAttentionResult, AgentTeamThreadObservations, AgentTeamThreadObservationsRequest, AgentTeamThreadRef, AgentTeamTransferTaskCommittedResult, AgentTeamTransferTaskRequest, AgentTeamTransferTaskResult } from '@contexera/dsh-agent-team/types';
/**
 * One Human Attention write. The Remote method is shared with the Project Main-stream control, so its answer is the
 * union of both shapes; this hook always addresses a Thread, and every Thread-addressed write answers with the
 * Thread result — the `attention` row both variants carry is the only field the control reads.
 */
export type AttentionWrite = (request: AgentTeamThreadAttentionRequest) => Promise<RemoteResult<AgentTeamThreadAttentionResult | AgentTeamMainAttentionResult>>;
export type AttentionObservation = (request: AgentTeamThreadObservationsRequest) => Promise<RemoteResult<AgentTeamThreadObservations>>;
export interface ThreadFollowState {
    /** Whether the Human follows this Thread right now; undefined until the Host has answered. */
    readonly following: boolean | undefined;
    readonly pending: boolean;
    readonly error: string | undefined;
    /** Write one follow or unfollow; the Host's answer is the only authority on what happened. */
    readonly toggle: (action: 'follow' | 'unfollow') => Promise<void>;
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
export declare function useThreadFollow(changeAttention: AttentionWrite, threadObservations: AttentionObservation, request: {
    readonly workspaceId: WorkspaceId;
    readonly threadRef?: AgentTeamThreadRef;
    readonly taskRef?: AgentTeamTaskRef;
}, 
/** The observation a face has already read on mount, so the control starts from the answer that read landed instead of asking again. */
observed?: ReadonlySet<AgentTeamMemberId> | undefined, 
/** The Human's own Member id, from the Host's projection; undefined keeps the standing unanswered rather than guessing one. */
humanMemberId?: AgentTeamMemberId | undefined): ThreadFollowState;
export type TransferWrite = (request: AgentTeamTransferTaskRequest) => Promise<RemoteResult<AgentTeamTransferTaskResult>>;
/** Why the Host declined the transfer, in the shape the caller localizes. */
export type TransferRefusal = {
    readonly kind: 'unread_required';
    readonly unreadCount: number;
} | {
    readonly kind: 'stale_revision';
};
export interface TaskTransferState {
    readonly pending: boolean;
    /** A Remote failure or a thrown call; the recoverable surface shows it beside the untouched control. */
    readonly error: string | undefined;
    /** A business fence the Host answered with; the caller re-reads and keeps the surface recoverable. */
    readonly refusal: TransferRefusal | undefined;
    /** The target a committed transfer landed on, so the surface can state the new accountable instead of leaving the reader to infer it from a feed row. */
    readonly landedOn: AgentTeamMemberId | undefined;
    /** Hand this Task to one legal accountable; the Host decides whether the target is legal and whether the Human may move it now. */
    readonly transfer: (target: AgentTeamMemberId) => Promise<void>;
}
/**
 * The Human's Task responsibility transfer, shared by the Thread page and the discussion panel. The Client offers a
 * target the Host already projected as a legal accountable and re-implements neither the authority rules nor the
 * fences: an unread or stale answer arrives as a typed outcome — the same control flow the accept, close, and reopen
 * buttons already model — and every refusal leaves the Task's current accountable on screen untouched.
 */
export declare function useTaskTransfer(transferTask: TransferWrite, request: {
    readonly workspaceId: WorkspaceId;
    readonly taskRef: AgentTeamTask['taskRef'];
    /** Read at call time: the caller's projection may have moved on since this render. */
    readonly revisionOf: () => number | undefined;
    /** Called with the committed result, so the caller merges the Host's own transfer activity row and re-reads. */
    readonly onCommitted: (committed: AgentTeamTransferTaskCommittedResult) => void | Promise<void>;
    /**
     * Called with the fence the Host answered, so the caller re-reads through its own recovery path. A
     * refusal is not a failure to swallow: the Task's projection moved on, so the surface must converge
     * on the Host's current state instead of leaving a stale one beside the message.
     */
    readonly onRefusal?: ((refusal: TransferRefusal) => void | Promise<void>) | undefined;
}): TaskTransferState;
//# sourceMappingURL=thread-actions.d.ts.map