import type { AgentTeamInboxActor, AgentTeamMemberId } from '@contexera/dsh-agent-team/types';
import type { TeamConversationProps } from './slots.ts';
import { type TeamAvatarHuman } from './TeamAvatarStack.tsx';
/**
 * One Task's accountable as the card, the board and the Thread page draw them: the 18px face the stack draws, then the
 * role word alone — `负责`, the reader as `你负责`, a suspended owner as `负责 · 已暂停` — because the face beside the
 * word already names the person, and a handle there made one Task's responsibility a third size of text on every line.
 *
 * The seat is one `role="img"`: the face is decoration and the short word is not a sentence, so the label carries the
 * full `负责人 @handle` that `accountableLabel` states and the same sentence is the hover `title`. A card's own
 * accessible name sets the same fact from the same function, so the short line never becomes the only description.
 */
export declare function TeamOwnerSeat({ owner, human, humanMemberId, t }: {
    readonly owner: AgentTeamInboxActor;
    readonly human: TeamAvatarHuman | undefined;
    readonly humanMemberId: AgentTeamMemberId | undefined;
    readonly t: TeamConversationProps['t'];
}): import("react").JSX.Element;
//# sourceMappingURL=TeamOwnerSeat.d.ts.map