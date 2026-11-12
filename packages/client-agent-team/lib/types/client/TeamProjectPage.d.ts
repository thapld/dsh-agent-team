import type { AgentTeamProjectRef, AgentTeamThreadRef } from '@contexera/dsh-agent-team/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamConversationProps } from './slots.ts';
import type { TeamDiscussionAnchor } from './navigation.ts';
import type { TeamDraftStore } from './drafts.ts';
interface TeamProjectPageProps {
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly humanName: string;
    readonly humanAvatarUrl?: string | undefined;
    readonly loadProjects: TeamConversationProps['loadProjects'];
    readonly subscribeChanges: TeamConversationProps['subscribeChanges'];
    readonly loadMembers: TeamConversationProps['loadMembers'];
    /** The Human's own unread per Thread: the Host's three-class judgement, never a Client guess. */
    readonly loadInbox: TeamConversationProps['loadInbox'];
    readonly loadTaskBoard: TeamConversationProps['loadTaskBoard'];
    readonly loadSubscriptions: TeamConversationProps['loadSubscriptions'];
    readonly loadSubscriptionLogs: TeamConversationProps['loadSubscriptionLogs'];
    readonly pauseSubscription: TeamConversationProps['pauseSubscription'];
    readonly resumeSubscription: TeamConversationProps['resumeSubscription'];
    readonly deleteSubscription: TeamConversationProps['deleteSubscription'];
    readonly drafts: TeamDraftStore;
    readonly getAttachment: TeamConversationProps['getAttachment'];
    readonly putAttachment: TeamConversationProps['putAttachment'];
    readonly postMainMessage: TeamConversationProps['postMainMessage'];
    readonly startThread: TeamConversationProps['startThread'];
    readonly readMainStream: TeamConversationProps['readMainStream'];
    readonly mainStreamHistory: TeamConversationProps['mainStreamHistory'];
    readonly readThread: TeamConversationProps['readThread'];
    readonly loadThreadHistory: TeamConversationProps['loadThreadHistory'];
    readonly threadObservations: TeamConversationProps['threadObservations'];
    readonly reply: TeamConversationProps['reply'];
    readonly promoteThread: TeamConversationProps['promoteThread'];
    readonly changeAttention: TeamConversationProps['changeAttention'];
    readonly selectThread: TeamConversationProps['selectThread'];
    readonly selectDiscussion: TeamConversationProps['selectDiscussion'];
    readonly closeDiscussion: TeamConversationProps['closeDiscussion'];
    readonly selectProject: TeamConversationProps['selectProject'];
    /** The open discussion panel, from the persisted navigation fact; a reload reopens the same panel. */
    readonly discussionRef?: AgentTeamThreadRef | undefined;
    /** Why that panel was opened, so an Inbox entry lands on its first unread Message naming the Human. */
    readonly discussionAnchor?: TeamDiscussionAnchor | undefined;
    readonly resolveTaskRefs: TeamConversationProps['resolveTaskRefs'];
    readonly resolveThreadRefs: TeamConversationProps['resolveThreadRefs'];
    readonly resolveMessageRefs: TeamConversationProps['resolveMessageRefs'];
    readonly openMemberSession: TeamConversationProps['openMemberSession'];
    readonly t: TeamConversationProps['t'];
}
export declare function TeamProjectPage({ workspaceId, projectRef, humanName, humanAvatarUrl, loadProjects, loadTaskBoard, loadSubscriptions, loadSubscriptionLogs, pauseSubscription, resumeSubscription, deleteSubscription, subscribeChanges, loadMembers, loadInbox, drafts, putAttachment, getAttachment, postMainMessage, startThread, readMainStream, mainStreamHistory, readThread, loadThreadHistory, threadObservations, reply, promoteThread, changeAttention, selectThread, selectDiscussion, closeDiscussion, selectProject, discussionRef, discussionAnchor, resolveTaskRefs, resolveThreadRefs, resolveMessageRefs, openMemberSession, t }: TeamProjectPageProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=TeamProjectPage.d.ts.map