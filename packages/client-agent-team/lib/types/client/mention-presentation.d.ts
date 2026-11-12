import type { AgentTeamClientMemberStatus, AgentTeamMemberId } from '@contexera/dsh-agent-team/types';
import type { TeamDraftKey, TeamDraftKind } from './drafts.ts';
/** The composer surfaces a mention can be written on; read from the draft key so it cannot be restated wrong. */
export type MentionSurface = TeamDraftKind;
export declare function mentionSurfaceOf(draftKey: TeamDraftKey): MentionSurface;
/**
 * How a candidate relates to what is being written. `owner` is a Project owner
 * (the Members who decide and can start work, so they lead the list); `thread`
 * is a follower of this Thread; `project` a Member taking part in this Project;
 * `other` a Workspace peer the Project does not yet carry — picking one enrolls
 * it into the Project, because a mention is a Project-membership fact.
 */
export type MentionGroupKey = 'owner' | 'thread' | 'project' | 'other';
export interface MentionGroup {
    readonly key: MentionGroupKey;
    readonly options: readonly AgentTeamClientMemberStatus[];
}
export interface MentionRoster {
    readonly followers?: ReadonlySet<AgentTeamMemberId> | undefined;
    readonly projectMembers?: ReadonlySet<AgentTeamMemberId> | undefined;
    readonly owners?: ReadonlySet<AgentTeamMemberId> | undefined;
}
/**
 * Every Member a mention can address, narrowed by the typed query. A Member
 * leaves the roster only by lifecycle (`inactive`/`archived` reject a mention
 * at the Host too); an offline Member stays — the mention is a durable marker
 * they read when they return.
 */
export declare function mentionCandidatesFor(members: readonly AgentTeamClientMemberStatus[], query: string): readonly AgentTeamClientMemberStatus[];
export declare function buildMentionGroups(members: readonly AgentTeamClientMemberStatus[], query: string, surface: MentionSurface, roster: MentionRoster): readonly MentionGroup[];
/**
 * Members a pick would enroll: notified, yet not already taking part in the
 * Project. Empty when the roster is unknown (an empty set) rather than claiming
 * everyone is new.
 */
export declare function enrollmentIds(notified: readonly AgentTeamMemberId[], projectMembers: ReadonlySet<AgentTeamMemberId> | undefined): readonly AgentTeamMemberId[];
//# sourceMappingURL=mention-presentation.d.ts.map