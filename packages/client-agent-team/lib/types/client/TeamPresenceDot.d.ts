import type { AgentTeamClientMemberStatus } from '@contexera/dsh-agent-team/types';
import type { TeamSidebarProps } from './slots.ts';
import type { TeamStateDotState } from './TeamStateDot.tsx';
export declare function presenceLabel(status: AgentTeamClientMemberStatus, t: TeamSidebarProps['t']): string;
export declare function diagnosticText(status: Pick<AgentTeamClientMemberStatus, 'diagnostic'>): string;
export declare function restartOffered(status: AgentTeamClientMemberStatus): boolean;
export declare function presenceDotState(presence: AgentTeamClientMemberStatus['presence']): TeamStateDotState;
export declare function TeamPresenceDot({ status, t }: {
    readonly status: AgentTeamClientMemberStatus;
    readonly t: TeamSidebarProps['t'];
}): import("react").JSX.Element;
//# sourceMappingURL=TeamPresenceDot.d.ts.map