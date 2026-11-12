import AgentTeam from '@contexera/dsh-agent-team/host';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
/** The Agent shape every Team tool receives. */
export type TeamToolAgent = NonNullable<Parameters<AgentTeam['memberForAgent']>[0]>;
/** Resolve the Team Host service, or reject the tool call. */
export declare function service(agent: TeamToolAgent): AgentTeam;
/** Resolve the calling Team Member, or reject the tool call. */
export declare function member(agent: TeamToolAgent): import("@contexera/dsh-agent-team/types").AgentTeamAgentMember;
/** Projects were called Channels, and Agents still cite the `channel:` refs their history shows. */
export declare function projectRefOf(ref: string): string;
/** A collaboration address, never a cwd or Session switch. */
export declare const workspaceParam: {
    type: "string";
    description: string;
};
export declare function workspaceOf(args: {
    workspace?: string | undefined;
}, agent: TeamToolAgent): WorkspaceId;
//# sourceMappingURL=host-access.d.ts.map