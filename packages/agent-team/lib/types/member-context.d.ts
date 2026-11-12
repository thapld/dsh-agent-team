import type { Context } from '@deepseek-ai/cordis';
import { type ContextFormed } from '@deepseek-ai/dsh-llm';
import type { AgentTeamAgentMember, AgentTeamProject } from './types.ts';
export declare const name = "contexera-agent-team-member-context";
/** The plugin name this producer wrote under before the identity rename; its V3 history and older V4 rows carry it, so reads must accept it. */
export declare const LEGACY_NAME = "wowyuarm-agent-team-member-context";
/** Every producer name whose rows this module authored, current first. */
export declare const PRODUCER_NAMES: readonly ["contexera-agent-team-member-context", "wowyuarm-agent-team-member-context"];
/**
 * Which injected block this message carries. Identity, ownership, and
 * participation are current-state lists; memory separates the complete
 * baseline from a notice that an earlier copy is stale, so a surviving
 * notice is never mistaken for a complete index.
 */
export type MemberContextTag = {
    readonly category: 'identity' | 'ownership' | 'workspaces';
} | {
    readonly category: 'memory';
    readonly variant: 'baseline' | 'update' | 'unavailable';
    readonly digest: string;
    readonly textDigest: string;
};
/** This producer's attribution; `kind` must be producer-owned (Session format V4). The `plugin:` member of each pair is the read-side rename of that producer's released V3 history. */
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'contexera-agent-team-member-context': {
            kind: 'contexera-agent-team-member-context';
            readonly memberContext?: MemberContextTag;
        } & ContextFormed;
        'plugin:contexera-agent-team-member-context': {
            kind: 'plugin:contexera-agent-team-member-context';
            readonly memberContext?: MemberContextTag;
        } & ContextFormed;
        /** Pre-rename producer name; read-side only, and only ever in history. */
        'wowyuarm-agent-team-member-context': {
            kind: 'wowyuarm-agent-team-member-context';
            readonly memberContext?: MemberContextTag;
        } & ContextFormed;
        'plugin:wowyuarm-agent-team-member-context': {
            kind: 'plugin:wowyuarm-agent-team-member-context';
            readonly memberContext?: MemberContextTag;
        } & ContextFormed;
    }
}
export declare function apply(ctx: Context): void;
export declare function renderMemberIdentity(member: Pick<AgentTeamAgentMember, 'handle' | 'description'>): string;
/** Rendered even when empty, so a withdrawn ownership replaces the earlier list instead of lingering in context. */
export declare function renderMemberOwnership(projects: readonly Pick<AgentTeamProject, 'projectRef' | 'name' | 'workspaceId'>[]): string;
/** Rendered at every count, so a later list can replace one Workspace, or none, as clearly as it replaces several. */
export declare function renderMemberWorkspaces(workspaces: readonly {
    readonly workspaceId: string;
    readonly path: string | undefined;
    readonly default: boolean;
}[]): string;
export declare function renderMemberMemory(raw: Buffer, privateMemoryPath?: string): string;
//# sourceMappingURL=member-context.d.ts.map