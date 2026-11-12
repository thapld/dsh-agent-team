import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { AgentTeamClaim, AgentTeamClientMemberStatus, AgentTeamMemberId, AgentTeamMessageRef, AgentTeamOperationReceipt, AgentTeamRequestId, AgentTeamStaleRevision, AgentTeamTask, AgentTeamTaskActivity, AgentTeamTaskRef, AgentTeamThread, AgentTeamThreadFact, AgentTeamThreadReadFact, AgentTeamThreadReadResult, AgentTeamThreadRef, AgentTeamThreadTaskCard, AgentTeamUnreadRequired, AgentTeamWorkerRef, AgentTeamWorkerStateView } from '@contexera/dsh-agent-team/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamConversationProps } from './slots.ts';
import type { TeamDraftKey, TeamDraftStore } from './drafts.ts';
import type { ReplyTarget } from './TeamComposer.tsx';
import { type TimelineScroll } from './timeline-scroll.ts';
export interface TeamThreadControllerOptions {
    readonly workspaceId: WorkspaceId;
    readonly threadRef: AgentTeamThreadRef;
    readonly taskRef?: AgentTeamTaskRef | undefined;
    readonly readThread: TeamConversationProps['readThread'];
    readonly loadThreadHistory: TeamConversationProps['loadThreadHistory'];
    readonly threadObservations: TeamConversationProps['threadObservations'];
    readonly subscribeChanges: TeamConversationProps['subscribeChanges'];
    readonly resolveMessageRefs: TeamConversationProps['resolveMessageRefs'];
    readonly reply: TeamConversationProps['reply'];
    readonly drafts: TeamDraftStore;
    readonly putAttachment: TeamConversationProps['putAttachment'];
    /** The Project's roster at send time, for the optimistic mention chips a committed reply merges before the Host's own facts land. */
    readonly projectMembers: () => readonly AgentTeamClientMemberStatus[];
    /** One Member's display name, for the composer's quote banner. */
    readonly memberName: (memberId: AgentTeamMemberId) => string;
    readonly t: TeamConversationProps['t'];
    /** A durable read committed: the surface's unread statement can answer without waiting for another read. */
    readonly onRead?: (() => void) | undefined;
    /** Re-reads the surface-owned state a write moved (roster, Project view); the Thread itself is already re-read. */
    readonly afterWrite?: (() => void | Promise<void>) | undefined;
    /** Where the first read opens: a Message to centre, or undefined for the latest fact. */
    readonly openingTarget?: ((facts: readonly AgentTeamThreadReadFact[]) => AgentTeamMessageRef | undefined) | undefined;
}
/** One durable Thread write, run under the surface's shared busy gate with a requestId that a retry replays. */
export interface ThreadWrite<TCommitted extends {
    readonly kind: 'committed';
}> {
    /** Cache key for the requestId; one in-flight write per key at a time. */
    readonly key: string;
    readonly write: (requestId: AgentTeamRequestId) => Promise<RemoteResult<TCommitted | AgentTeamUnreadRequired | AgentTeamStaleRevision>>;
    readonly onCommitted: (committed: TCommitted) => void | Promise<void>;
}
/** The fields every committed Task write carries, so one merge serves promote, accept, close, reopen, and transfer. */
export interface CommittedTaskWrite {
    readonly receipt: AgentTeamOperationReceipt;
    readonly activity: AgentTeamTaskActivity;
    readonly task: AgentTeamTask;
    readonly thread: AgentTeamThread;
    readonly claims?: readonly AgentTeamClaim[] | undefined;
}
export interface TeamThreadController {
    readonly projection: AgentTeamThreadReadResult | undefined;
    readonly task: AgentTeamTask | undefined;
    readonly thread: AgentTeamThread | undefined;
    readonly currentFacts: readonly AgentTeamThreadFact[];
    /** Flags from the read that produced the projection; opening a Thread acknowledges them. */
    readonly readFacts: readonly AgentTeamThreadReadFact[];
    readonly olderFacts: readonly AgentTeamThreadFact[];
    readonly taskCards: readonly AgentTeamThreadTaskCard[];
    /** How each Worker run these facts name stands, merged across every read and page, so a window never decides a run's state. */
    readonly workerStates: ReadonlyMap<AgentTeamWorkerRef, AgentTeamWorkerStateView>;
    readonly followerIds: ReadonlySet<AgentTeamMemberId>;
    readonly historyHasMore: boolean;
    readonly loading: boolean;
    readonly error: string | undefined;
    /** The surface's shared busy gate: a reply send and every Task write hold it. */
    readonly pending: boolean;
    readonly autoReadExhausted: boolean;
    readonly newFactsCount: number;
    readonly replyTarget: AgentTeamMessageRef | undefined;
    /** The composer's quote banner, resolved through the Host and read at render time. */
    readonly replyTo: ReplyTarget | undefined;
    readonly pendingFiles: readonly File[];
    readonly draftKey: TeamDraftKey;
    readonly flashedMessage: AgentTeamMessageRef | undefined;
    readonly timelineRef: TimelineScroll['ref'];
    readonly readCurrent: (newRequest?: boolean) => Promise<boolean>;
    readonly loadOlder: () => Promise<void>;
    readonly refreshAfterFence: () => Promise<void>;
    readonly refreshPassiveFacts: () => Promise<void>;
    readonly retryAutoRead: () => void;
    readonly onTimelineScroll: () => void;
    readonly jumpToNewest: () => void;
    readonly flashMessage: (messageRef: AgentTeamMessageRef) => void;
    readonly setReplyTarget: (messageRef: AgentTeamMessageRef | undefined) => void;
    readonly setPendingFiles: (files: readonly File[]) => void;
    readonly clearSendState: () => void;
    readonly reportError: (message: string) => void;
    readonly sendReply: () => Promise<void>;
    /** Runs one durable write and converges on the Host's answer for either fence. */
    readonly commit: <TCommitted extends {
        readonly kind: 'committed';
    }>(spec: ThreadWrite<TCommitted>) => Promise<void>;
    /** Merges one committed Task write's projection and activity row, then re-reads the Thread. */
    readonly applyTaskCommit: (committed: CommittedTaskWrite) => Promise<void>;
}
/**
 * One page instance's read/write coordination for a single Thread: the bounded read and its unread
 * drain, history paging, passive and follower refreshes, the sequence guards that keep a late answer
 * from overwriting a newer one, fact merging, message-ref resolution, and the reply lifecycle.
 *
 * It owns no durable authority. The Host projection and ledger stay the single source of truth, and
 * the copy held here is only what this mount renders from. Both Thread faces drive it and keep their
 * own layout, navigation, and Task controls.
 */
export declare function useTeamThreadController(options: TeamThreadControllerOptions): TeamThreadController;
//# sourceMappingURL=thread-controller.d.ts.map