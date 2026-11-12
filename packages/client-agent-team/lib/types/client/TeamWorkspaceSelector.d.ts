import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
export interface TeamWorkspaceChoice {
    readonly workspaceId: WorkspaceId;
    readonly title: string;
    readonly path: string;
}
/**
 * The single-line Workspace selector scoping the Team sidebar: Projects and Agents belong to one Workspace, so a selector
 * reads as "you are in X". Cross-Workspace unread is summarized by the Inbox entry, which stays outside the selector.
 *
 * The trigger is a field, not a row, so it does not read as the first Projects entry; its accessible name states the shown
 * Workspace. The menu is the only way to switch, so it takes focus on open and returns it to the trigger on Escape.
 */
export declare function TeamWorkspaceSelector({ workspaces, selectedId, current, onSelect, t }: {
    readonly workspaces: readonly TeamWorkspaceChoice[];
    readonly selectedId: WorkspaceId | undefined;
    readonly current: boolean;
    readonly onSelect: (workspaceId: WorkspaceId) => void;
    readonly t: (key: 'empty' | 'workspaceSelectorWithValue', params?: {
        title: string;
    }) => string;
}): import("react").JSX.Element;
//# sourceMappingURL=TeamWorkspaceSelector.d.ts.map