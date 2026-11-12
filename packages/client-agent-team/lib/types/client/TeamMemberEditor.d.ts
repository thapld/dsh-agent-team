import type { AgentTeamClientMemberStatus, AgentTeamModelSelection } from '@contexera/dsh-agent-team/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamSidebarProps } from './slots.ts';
/** Best-effort warm so pickers open with rows; failures belong to the picker's own error surface. */
export declare function warmModelCatalog(loadModels: TeamSidebarProps['loadModels']): void;
/**
 * Shared provider/model dropdown for the create and edit forms. Mounts open with the warmed value and revalidate behind it;
 * a refused or failed read with no warmed value renders a retryable error rather than stranding the field on "loading".
 */
export declare function ModelPickerField({ model, onModelChange, loadModels, disabled, t }: {
    readonly model: AgentTeamModelSelection | undefined;
    readonly onModelChange: (choice: AgentTeamModelSelection | undefined) => void;
    readonly loadModels: TeamSidebarProps['loadModels'];
    readonly disabled: boolean;
    readonly t: TeamSidebarProps['t'];
}): import("react").JSX.Element;
/**
 * One Member's reminders that can still fire, in Member detail. Read-only by construction: the
 * Human sees what the Member asked of itself and may withdraw a reminder, but never invents one —
 * a reminder has exactly one recipient, and only that Member creates its own. Every write re-reads
 * the list, so the rows are never an optimistic guess at what the Host stored.
 */
export declare function MemberRemindersSection({ workspaceId, memberId, loadMemberReminders, cancelMemberReminder, disabled, t }: {
    readonly workspaceId: WorkspaceId;
    readonly memberId: AgentTeamClientMemberStatus['member']['memberId'];
    readonly loadMemberReminders: TeamSidebarProps['loadMemberReminders'];
    readonly cancelMemberReminder: TeamSidebarProps['cancelMemberReminder'];
    readonly disabled: boolean;
    readonly t: TeamSidebarProps['t'];
}): import("react").JSX.Element;
/**
 * One Member's running Worker executions, read from the Host that owns them.
 * Read-only by construction: the Human sees what this Host holds and may ask it
 * to stop one, but a stop is only reported as done when the engine confirmed its
 * cleanup. A failed stop keeps its row and its sentence across refreshes rather
 * than disappearing into a shorter list.
 */
export declare function MemberWorkerRunsSection({ workspaceId, memberId, loadWorkerRuns, stopWorker, inspectWorker, disabled, t }: {
    readonly workspaceId: WorkspaceId;
    readonly memberId: AgentTeamClientMemberStatus['member']['memberId'];
    readonly loadWorkerRuns: TeamSidebarProps['loadWorkerRuns'];
    readonly stopWorker: TeamSidebarProps['stopWorker'];
    readonly inspectWorker: TeamSidebarProps['inspectWorker'];
    readonly disabled: boolean;
    readonly t: TeamSidebarProps['t'];
}): import("react").JSX.Element;
export declare function AgentEditorDialog({ status, updateMember, loadModels, loadMemberReminders, cancelMemberReminder, loadWorkerRuns, stopWorker, inspectWorker, onCommitted, onClose, t }: {
    readonly status: AgentTeamClientMemberStatus;
    readonly updateMember: TeamSidebarProps['updateMember'];
    readonly loadModels: TeamSidebarProps['loadModels'];
    readonly loadMemberReminders: TeamSidebarProps['loadMemberReminders'];
    readonly cancelMemberReminder: TeamSidebarProps['cancelMemberReminder'];
    readonly loadWorkerRuns: TeamSidebarProps['loadWorkerRuns'];
    readonly stopWorker: TeamSidebarProps['stopWorker'];
    readonly inspectWorker: TeamSidebarProps['inspectWorker'];
    readonly onCommitted: () => Promise<void> | void;
    readonly onClose: () => void;
    readonly t: TeamSidebarProps['t'];
}): import("react").JSX.Element;
export declare function sameModel(left: AgentTeamModelSelection | null | undefined, right: AgentTeamModelSelection | null | undefined): boolean;
//# sourceMappingURL=TeamMemberEditor.d.ts.map