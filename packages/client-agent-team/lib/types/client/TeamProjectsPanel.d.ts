import type { AgentTeamAddMemberRequest, AgentTeamProjectRef } from '@contexera/dsh-agent-team/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamSidebarProps } from './slots.ts';
interface TeamProjectsPanelProps {
    readonly workspaceId: WorkspaceId;
    readonly loadMembers: TeamSidebarProps['loadMembers'];
    readonly loadProjects: TeamSidebarProps['loadProjects'];
    readonly subscribeChanges: TeamSidebarProps['subscribeChanges'];
    readonly createProject: TeamSidebarProps['createProject'];
    readonly updateProject: TeamSidebarProps['updateProject'];
    readonly archiveProject: TeamSidebarProps['archiveProject'];
    readonly addProjectOwner: TeamSidebarProps['addProjectOwner'];
    readonly removeProjectOwner: TeamSidebarProps['removeProjectOwner'];
    readonly humanIdentity: TeamSidebarProps['humanIdentity'];
    readonly creatingAgents: readonly AgentTeamAddMemberRequest[];
    readonly selectedProjectRef?: AgentTeamProjectRef;
    readonly selectProject: TeamSidebarProps['selectProject'];
    readonly t: TeamSidebarProps['t'];
}
export declare function TeamProjectsPanel(props: TeamProjectsPanelProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=TeamProjectsPanel.d.ts.map