import type { AgentTeamClientMemberStatus } from '@contexera/dsh-agent-team/types';
import type { TeamSidebarProps } from './slots.ts';
export interface TeamMemberAction {
    readonly label: string;
    /** Names the action for assistive tech when the visible label alone does not say which Member it acts on. */
    readonly ariaLabel?: string;
    readonly onSelect: () => void;
    readonly disabled?: boolean;
}
/**
 * The one place a Member's identity is drawn, so identity, tone and truncation cannot drift between surfaces. A fragment, not a
 * row: each surface owns its row element and grid and places this in the first two tracks. The handle spelling is the surface's call.
 */
export declare function TeamMemberIdentity({ status, name, className, t }: {
    readonly status: AgentTeamClientMemberStatus;
    readonly name?: string | undefined;
    readonly className?: string | undefined;
    readonly t: TeamSidebarProps['t'];
}): import("react").JSX.Element;
/** The action is the row's only chrome; a row without one collapses the trailing track, handing its width to the description. */
export declare function TeamMemberRow({ status, action, error, className, t }: {
    readonly status: AgentTeamClientMemberStatus;
    readonly action?: TeamMemberAction | undefined;
    readonly error?: string | undefined;
    readonly className?: string | undefined;
    readonly t: TeamSidebarProps['t'];
}): import("react").JSX.Element;
//# sourceMappingURL=TeamMemberRow.d.ts.map