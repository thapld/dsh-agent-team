import type { AgentTeamProjectRef, AgentTeamTaskRef, AgentTeamThreadRef } from '@contexera/dsh-agent-team/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamConversationProps } from './slots.ts';
import type { TeamDraftStore } from './drafts.ts';
interface TeamThreadPageProps {
    readonly workspaceId: WorkspaceId;
    readonly humanName: string;
    readonly humanAvatarUrl?: string | undefined;
    readonly projectRef?: AgentTeamProjectRef;
    readonly taskRef?: AgentTeamTaskRef;
    readonly threadRef: AgentTeamThreadRef;
    readonly taskNumber?: number;
    readonly backToWorkspace: TeamConversationProps['backToWorkspace'];
    readonly loadProjects: TeamConversationProps['loadProjects'];
    readonly readThread: TeamConversationProps['readThread'];
    readonly loadThreadHistory: TeamConversationProps['loadThreadHistory'];
    readonly threadObservations: TeamConversationProps['threadObservations'];
    readonly subscribeChanges: TeamConversationProps['subscribeChanges'];
    readonly loadMembers: TeamConversationProps['loadMembers'];
    readonly drafts: TeamDraftStore;
    readonly getAttachment: TeamConversationProps['getAttachment'];
    readonly reply: TeamConversationProps['reply'];
    readonly changeAttention: TeamConversationProps['changeAttention'];
    readonly transferTask: TeamConversationProps['transferTask'];
    readonly changeTask: TeamConversationProps['changeTask'];
    readonly promoteThread: TeamConversationProps['promoteThread'];
    readonly putAttachment: TeamConversationProps['putAttachment'];
    readonly selectProject: TeamConversationProps['selectProject'];
    readonly selectThread: TeamConversationProps['selectThread'];
    readonly selectDiscussion: TeamConversationProps['selectDiscussion'];
    readonly resolveTaskRefs: TeamConversationProps['resolveTaskRefs'];
    readonly resolveThreadRefs: TeamConversationProps['resolveThreadRefs'];
    readonly resolveMessageRefs: TeamConversationProps['resolveMessageRefs'];
    readonly openMemberSession: TeamConversationProps['openMemberSession'];
    readonly t: TeamConversationProps['t'];
}
export declare function TeamThreadPage(props: TeamThreadPageProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=TeamThreadPage.d.ts.map