import type { AgentTeamAddMemberRequest, AgentTeamClientMemberStatus } from '@contexera/dsh-agent-team/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamSidebarProps } from './slots.ts';
interface TeamAgentsPanelProps {
    readonly workspaceId: WorkspaceId;
    readonly loadMembers: TeamSidebarProps['loadMembers'];
    readonly subscribeChanges: TeamSidebarProps['subscribeChanges'];
    readonly addMember: TeamSidebarProps['addMember'];
    readonly updateMember: TeamSidebarProps['updateMember'];
    readonly recoverMember: TeamSidebarProps['recoverMember'];
    readonly archiveMember: TeamSidebarProps['archiveMember'];
    readonly joinWorkspace: TeamSidebarProps['joinWorkspace'];
    readonly leaveWorkspace: TeamSidebarProps['leaveWorkspace'];
    readonly loadModels: TeamSidebarProps['loadModels'];
    /** Member detail's reminder surface: read the Member's own reminders, withdraw one on its behalf. */
    readonly loadMemberReminders: TeamSidebarProps['loadMemberReminders'];
    readonly cancelMemberReminder: TeamSidebarProps['cancelMemberReminder'];
    /** Member detail's Worker surface: the Member's runs and the Human's stop of one. */
    readonly loadWorkerRuns: TeamSidebarProps['loadWorkerRuns'];
    readonly stopWorker: TeamSidebarProps['stopWorker'];
    readonly inspectWorker: TeamSidebarProps['inspectWorker'];
    readonly memberSessionId?: AgentTeamClientMemberStatus['member']['sessionId'];
    readonly openMemberSession: TeamSidebarProps['openMemberSession'];
    readonly onCreatingChange: (request: AgentTeamAddMemberRequest, creating: boolean) => void;
    readonly t: TeamSidebarProps['t'];
}
export declare function TeamAgentsPanel({ workspaceId, loadMembers, subscribeChanges, addMember, updateMember, recoverMember, archiveMember, joinWorkspace, leaveWorkspace, loadModels, loadMemberReminders, cancelMemberReminder, loadWorkerRuns, stopWorker, inspectWorker, memberSessionId, openMemberSession, onCreatingChange, t }: TeamAgentsPanelProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=TeamAgentsPanel.d.ts.map