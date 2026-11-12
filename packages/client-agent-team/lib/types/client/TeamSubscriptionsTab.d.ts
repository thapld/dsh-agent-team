import type { AgentTeamMemberId, AgentTeamProjectRef, AgentTeamSubscriptionListEntry } from '@contexera/dsh-agent-team/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamConversationProps } from './slots.ts';
type TeamSubscriptionHost = Pick<TeamConversationProps, 'loadSubscriptionLogs' | 'pauseSubscription' | 'resumeSubscription' | 'deleteSubscription'>;
export interface TeamSubscriptionsTabProps {
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly host: TeamSubscriptionHost;
    readonly entries: readonly AgentTeamSubscriptionListEntry[] | undefined;
    readonly loading: boolean;
    readonly error: string | undefined;
    readonly onRetry: () => void;
    /** A committed write re-reads the Host list; nothing is added optimistically. */
    readonly onChanged: () => void;
    readonly canManage: boolean;
    readonly memberOf: (memberId: AgentTeamMemberId) => {
        readonly handle: string;
    } | undefined;
    readonly panelId: string;
    readonly labelledBy: string;
    readonly t: TeamConversationProps['t'];
}
/**
 * The Project's subscription tab. A Project owner arms and maintains a
 * subscription through `team_subscription`, so the Human's surface reads what is
 * armed and may only stop or remove what an owner started.
 */
export declare function TeamSubscriptionsTab({ workspaceId, projectRef, host, entries, loading, error, onRetry, onChanged, canManage, memberOf, panelId, labelledBy, t, }: TeamSubscriptionsTabProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=TeamSubscriptionsTab.d.ts.map