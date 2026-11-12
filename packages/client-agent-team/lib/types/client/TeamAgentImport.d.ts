import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamSidebarProps } from './slots.ts';
export declare function TeamAgentImport({ workspaceId, loadMembers, joinWorkspace, onJoined, onPending, t }: {
    readonly workspaceId: WorkspaceId;
    readonly loadMembers: TeamSidebarProps['loadMembers'];
    readonly joinWorkspace: TeamSidebarProps['joinWorkspace'];
    readonly onJoined: () => Promise<void>;
    readonly onPending: (pending: boolean) => void;
    readonly t: TeamSidebarProps['t'];
}): import("react").JSX.Element;
//# sourceMappingURL=TeamAgentImport.d.ts.map