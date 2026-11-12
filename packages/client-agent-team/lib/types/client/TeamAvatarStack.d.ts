import type { AgentTeamMemberId } from '@contexera/dsh-agent-team/types';
export interface TeamAvatarOwner {
    readonly memberId: AgentTeamMemberId;
    readonly name: string;
}
/** The Human is the one Member with a picture; that chip draws it and falls back to this name's initial. */
export interface TeamAvatarHuman {
    readonly memberId: AgentTeamMemberId;
    readonly name: string;
    readonly avatarUrl?: string | undefined;
}
/** The Client's Human identity outranks the Host-projected name, so a rename moves label and initial together. */
export declare function namedAvatarOwners(owners: readonly TeamAvatarOwner[], human: TeamAvatarHuman | undefined): readonly TeamAvatarOwner[];
/** The circles are presentational, so the stack is one `role="img"` whose label carries the whole roster. */
export declare function TeamAvatarStack({ owners, label, human }: {
    readonly owners: readonly TeamAvatarOwner[];
    readonly label: string;
    readonly human?: TeamAvatarHuman | undefined;
}): import("react").JSX.Element | null;
/**
 * One face at the size a row draws people, so a stack's circles and a seat's person are the same mark. Only the Human
 * consults an image; undecodable bytes keep the initial.
 */
export declare function TeamAvatarFace({ owner, human }: {
    readonly owner: TeamAvatarOwner;
    readonly human: TeamAvatarHuman | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=TeamAvatarStack.d.ts.map