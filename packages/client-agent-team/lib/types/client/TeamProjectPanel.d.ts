import type { AgentTeamProjectRef, AgentTeamClientMemberStatus, AgentTeamMemberId, AgentTeamTaskRef, AgentTeamThreadRef } from '@contexera/dsh-agent-team/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamConversationProps } from './slots.ts';
import type { TeamDiscussionAnchor } from './navigation.ts';
import type { TeamDraftStore } from './drafts.ts';
import { type ResolvedMemberRef } from './refs.ts';
interface TeamProjectPanelProps {
    /** The surface this panel is seated in: it owns the width the handle writes. */
    readonly surface: HTMLElement | null;
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly threadRef: AgentTeamThreadRef;
    /** Why this discussion was opened: `unread` lands on the first unread Message naming the Human, like the full page. */
    readonly anchor?: TeamDiscussionAnchor | undefined;
    readonly projectName: string;
    readonly humanName: string;
    readonly humanAvatarUrl?: string | undefined;
    readonly humanMemberId?: AgentTeamMemberId | undefined;
    /** The Project page's roster: the panel reads it instead of pulling its own copy. */
    readonly members: readonly AgentTeamClientMemberStatus[];
    readonly projectMemberIds: ReadonlySet<AgentTeamMemberId>;
    readonly projectOwnerIds: ReadonlySet<AgentTeamMemberId>;
    readonly drafts: TeamDraftStore;
    readonly getAttachment: TeamConversationProps['getAttachment'];
    readonly putAttachment: TeamConversationProps['putAttachment'];
    readonly readThread: TeamConversationProps['readThread'];
    readonly loadThreadHistory: TeamConversationProps['loadThreadHistory'];
    readonly threadObservations: TeamConversationProps['threadObservations'];
    readonly reply: TeamConversationProps['reply'];
    readonly promoteThread: TeamConversationProps['promoteThread'];
    readonly changeAttention: TeamConversationProps['changeAttention'];
    readonly subscribeChanges: TeamConversationProps['subscribeChanges'];
    readonly selectThread: TeamConversationProps['selectThread'];
    readonly selectDiscussion: TeamConversationProps['selectDiscussion'];
    readonly selectProject: TeamConversationProps['selectProject'];
    readonly resolveTaskRefs: TeamConversationProps['resolveTaskRefs'];
    readonly resolveThreadRefs: TeamConversationProps['resolveThreadRefs'];
    readonly resolveMessageRefs: TeamConversationProps['resolveMessageRefs'];
    readonly openMemberSession: TeamConversationProps['openMemberSession'];
    readonly projectNameOf: (ref: AgentTeamProjectRef) => string | undefined;
    readonly memberOf: (ref: AgentTeamMemberId) => ResolvedMemberRef | undefined;
    /** Task number for one ref, from the Project projection; undefined stays 「…」. */
    readonly taskNumberOf: (taskRef: AgentTeamTaskRef) => number | undefined;
    /** A durable read committed: the feed's unread badge clears without waiting for the Inbox. */
    readonly onRead: (threadRef: AgentTeamThreadRef) => void;
    /** This Thread is a Task now — the Project closes the panel and walks the reader into it. */
    readonly onPromoted: (taskRef: AgentTeamTaskRef) => void;
    readonly onClose: () => void;
    readonly t: TeamConversationProps['t'];
}
/** A taskless Thread's whole face beside its feed. Claims and acceptance stay on the Thread page. */
export declare function TeamProjectPanel({ surface, workspaceId, projectRef, threadRef, anchor, projectName, humanName, humanAvatarUrl, humanMemberId, members, projectMemberIds, projectOwnerIds, drafts, getAttachment, putAttachment, readThread, loadThreadHistory, threadObservations, reply, promoteThread, changeAttention, subscribeChanges, selectThread, selectDiscussion, selectProject, resolveTaskRefs, resolveThreadRefs, resolveMessageRefs, openMemberSession, projectNameOf, memberOf, taskNumberOf, onRead, onPromoted, onClose, t }: TeamProjectPanelProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=TeamProjectPanel.d.ts.map