/** Package-owned invariant companion for `@contexera/dsh-agent-team`. */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis companion plugin name. */
export declare const name = "agent-team-invariant";
/** Services required before validation; the check is self-hosted in this plugin's fiber, not registered into `@deepseek-ai/dsh-invariants`. */
export declare const inject: string[];
/** A violated Team ledger invariant, raised on the triggering frame (boot replay or the committing call). The Host's post-commit boundary re-raises it instead of logging. */
export declare class AgentTeamInvariantError extends Error {
    /** Stable failure code. */
    readonly code: "INVARIANT";
    /** Full npm package name that owns the violated invariant. */
    readonly packageName = "@contexera/dsh-agent-team";
    constructor(message: string);
}
/** Validates Team state at mount and after every commit. */
export declare const apply: (ctx: Context) => void;
//# sourceMappingURL=invariant.d.ts.map