import type { AgentTeamInboxActor, AgentTeamMainThreadCard, AgentTeamMemberId } from '@contexera/dsh-agent-team/types';
import type { TeamConversationProps } from './slots.ts';
import { type TeamAvatarHuman } from './TeamAvatarStack.tsx';
/**
 * One Thread as a card: the current state of the Thread at the place its anchor was written, rebuilt from the Host's
 * projection on every read. It is the door itself, so it carries no separate row.
 *
 * One component serves every face that shows this projection — the Project's Main stream, a taskless discussion's side
 * panel, and the discussion's own Thread page — because a Task's status, owners or reply count must not depend on which
 * surface the reader happened to open it from.
 */
export declare function TeamThreadCard({ card, unread, human, humanMemberId, accountableOwner, t, onOpen }: {
    readonly card: AgentTeamMainThreadCard;
    readonly unread: boolean;
    readonly human: TeamAvatarHuman | undefined;
    readonly humanMemberId: AgentTeamMemberId | undefined;
    /** The board's own person, resolved by the caller's roster: a Task's card names who holds it. */
    readonly accountableOwner: AgentTeamInboxActor | undefined;
    readonly t: TeamConversationProps['t'];
    readonly onOpen: () => void;
}): import("react").JSX.Element;
//# sourceMappingURL=TeamThreadCard.d.ts.map