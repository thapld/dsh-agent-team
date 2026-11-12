import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
export type TeamSidebarSectionKind = 'projects' | 'agents';
/** `false` only when this browser explicitly collapsed it. */
export declare function useSidebarSectionOpen(workspaceId: WorkspaceId | undefined, kind: TeamSidebarSectionKind): boolean;
/** The only mutation path. Unknown keys (missing workspace) no-op so an unloaded workspace never persists a phantom preference. */
export declare function setSidebarSectionOpen(workspaceId: WorkspaceId | undefined, kind: TeamSidebarSectionKind, open: boolean): void;
//# sourceMappingURL=sidebar-sections.d.ts.map