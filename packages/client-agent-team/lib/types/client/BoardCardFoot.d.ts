import type { AgentTeamMemberId, AgentTeamTaskBoardItem } from '@contexera/dsh-agent-team/types';
import type { TeamConversationProps } from './slots.ts';
import { type TeamAvatarHuman } from './TeamAvatarStack.tsx';
/**
 * The one foot every Task card wears: who owns the outcome, who is executing it, and when.
 *
 * The two roles take two shapes because their counts differ: the accountable is exactly one person, drawn as the
 * `TeamOwnerSeat` every other face draws them with; executors are 0–N people read at a glance, so they are the avatar
 * stack under their own caption — the claimants other than the accountable, who is already drawn at the seat. Once the
 * Task is resolved nobody is executing it, so the executor slot is dropped rather than replaced with an "unassigned" word.
 */
export declare function BoardCardFoot({ item, human, humanMemberId, t }: {
    readonly item: AgentTeamTaskBoardItem;
    readonly human: TeamAvatarHuman | undefined;
    readonly humanMemberId: AgentTeamMemberId | undefined;
    readonly t: TeamConversationProps['t'];
}): import("react").JSX.Element;
//# sourceMappingURL=BoardCardFoot.d.ts.map