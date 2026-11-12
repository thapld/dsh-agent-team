import type { ComponentProps } from 'react';
import type { AgentTeamClientMemberStatus, AgentTeamMemberId, AgentTeamProjectRef, AgentTeamTaskRef, AgentTeamThreadRef } from '@contexera/dsh-agent-team/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamConversationProps } from './slots.ts';
import type { TeamDraftStore } from './drafts.ts';
import { TeamMessage } from './TeamMessage.tsx';
type MessageProps = ComponentProps<typeof TeamMessage>;
interface TeamMainStreamProps {
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly humanName: string;
    readonly humanAvatarUrl?: string | undefined;
    readonly humanMemberId?: AgentTeamMemberId | undefined;
    readonly members: readonly AgentTeamClientMemberStatus[];
    readonly projectMemberIds: ReadonlySet<AgentTeamMemberId>;
    readonly projectOwnerIds: ReadonlySet<AgentTeamMemberId>;
    readonly drafts: TeamDraftStore;
    readonly mainStreamHistory: TeamConversationProps['mainStreamHistory'];
    readonly readMainStream: TeamConversationProps['readMainStream'];
    readonly postMainMessage: TeamConversationProps['postMainMessage'];
    readonly startThread: TeamConversationProps['startThread'];
    readonly putAttachment: TeamConversationProps['putAttachment'];
    readonly getAttachment: TeamConversationProps['getAttachment'];
    readonly subscribeChanges: TeamConversationProps['subscribeChanges'];
    readonly openRef: (ref: string) => void;
    readonly onResolveTaskRefs: MessageProps['onResolveTaskRefs'];
    readonly onResolveThreadRefs: MessageProps['onResolveThreadRefs'];
    readonly projectNameOf: MessageProps['projectNameOf'];
    readonly memberOf: MessageProps['memberOf'];
    readonly openMemberSession: TeamConversationProps['openMemberSession'];
    readonly onOpenDiscussion: (threadRef: AgentTeamThreadRef) => void;
    readonly onOpenTask: (threadRef: AgentTeamThreadRef, taskRef: AgentTeamTaskRef, taskNumber: number) => void;
    /** A committed Task start: the board is where it lands, and the Task's own card is the landing target. */
    readonly onTaskStarted: (taskRef: AgentTeamTaskRef | undefined) => void;
    readonly t: TeamConversationProps['t'];
}
/** Rules version 2 Project reading: the Main stream timeline and its composer. Message, activity and card entries arrive from the Host already ordered. */
export declare function TeamMainStream({ workspaceId, projectRef, humanName, humanAvatarUrl, humanMemberId, members, projectMemberIds, projectOwnerIds, drafts, mainStreamHistory, readMainStream, postMainMessage, startThread, putAttachment, getAttachment, subscribeChanges, openRef, onResolveTaskRefs, onResolveThreadRefs, projectNameOf, memberOf, openMemberSession, onOpenDiscussion, onOpenTask, onTaskStarted, t, }: TeamMainStreamProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=TeamMainStream.d.ts.map