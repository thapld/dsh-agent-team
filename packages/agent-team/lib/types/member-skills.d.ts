/**
 * Per-Member private skill provider: wraps the Harness filesystem provider so one Member discovers only the plugin's bundled read-only core skills plus its private `skills/` directory (default roots excluded), filtered by that Member's selection.
 * @module @contexera/dsh-agent-team/member-skills
 */
import type { Context } from '@deepseek-ai/cordis';
/** Handle to one mounted Member skill provider: the selection swap and the disposer. */
export interface MemberSkillProviderMount {
    /** Swaps the live selection filter and drops cached catalogs; `undefined` loads every discovered skill. */
    readonly swap: (allow: readonly string[] | undefined) => void;
    /** Unregister the provider. */
    readonly dispose: () => void;
}
/** Per-Member provider configuration; the private directory is provisioned before mounting. */
export interface MemberSkillsConfig {
    /** The Member's private skills directory; the writable self-install root. */
    readonly skillsDirectory: string;
    /** Read-only bundled skills shipped with the plugin (e.g. the meta skill). */
    readonly bundledSkillsDirectory: string | undefined;
    /** The selection this Member's provider starts with; `undefined` loads every discovered skill. */
    readonly initialSelection: readonly string[] | undefined;
}
/**
 * Registers the Member-private skill provider on one Member's agent scope and returns its disposer; no sibling Member or ordinary session sees the catalog.
 *
 * Registration goes through the traceable service resolved from the agent context (like `tools.restrict()`), never a plugin mount: a mount from Host activation lands on the Host's trace fiber instead of the agent scope, and a plugin `inject` would hold Member activation open. Without a skill registry the Member has no private catalog.
 */
export declare function mountMemberSkillProvider(agentCtx: Context, config: MemberSkillsConfig): MemberSkillProviderMount | undefined;
//# sourceMappingURL=member-skills.d.ts.map