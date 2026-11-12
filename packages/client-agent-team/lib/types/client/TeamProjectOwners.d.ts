import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { AgentTeamClientMemberStatus, AgentTeamMemberId, AgentTeamProject, AgentTeamProjectOwnerRequest, AgentTeamProjectOwnerResult } from '@contexera/dsh-agent-team/types';
import type { TeamSidebarProps } from './slots.ts';
type OwnerWrite = (request: AgentTeamProjectOwnerRequest) => Promise<RemoteResult<AgentTeamProjectOwnerResult>>;
/** The Human owns every Project and is fixed; Agent owners are written through the Host and appear only after the projection refresh. */
export declare function TeamProjectOwners({ project, members, ownerIds, addProjectOwner, removeProjectOwner, humanIdentity, onCommitted, t }: {
    readonly project: AgentTeamProject;
    readonly members: readonly AgentTeamClientMemberStatus[];
    readonly ownerIds: ReadonlySet<AgentTeamMemberId>;
    readonly addProjectOwner: OwnerWrite;
    readonly removeProjectOwner: OwnerWrite;
    readonly humanIdentity: TeamSidebarProps['humanIdentity'];
    readonly onCommitted: () => Promise<void> | void;
    readonly t: TeamSidebarProps['t'];
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=TeamProjectOwners.d.ts.map