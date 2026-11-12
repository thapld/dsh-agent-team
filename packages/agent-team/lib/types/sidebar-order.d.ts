/**
 * The Human's personal Team sidebar row order, as a Host setting.
 *
 * Presentation only: it is written by the Human's own drag on the sidebar and
 * read by no Agent tool, so it lives on the Team Host row (beside the Human's
 * name and avatar) rather than in the Team ledger, which records shared facts.
 * One versioned map keeps both lists of every Workspace: `<workspaceId>|projects`
 * and `<workspaceId>|agents` to the refs in the order the Human put them.
 * @module @contexera/dsh-agent-team/sidebar-order
 */
import z from '@deepseek-ai/schemastery';
/** The two sidebar lists a Human can reorder; a new list is a new kind, never a guessed key. */
export declare const SIDEBAR_ORDER_KINDS: readonly ["projects", "agents"];
export type TeamSidebarListKind = typeof SIDEBAR_ORDER_KINDS[number];
/** Shape version of the stored map; a future change must migrate, not reinterpret. */
export declare const SIDEBAR_ORDER_VERSION = 1;
/** Bounds on one stored list, so a broken client cannot grow the settings document without limit. */
export declare const SIDEBAR_ORDER_MAX_REFS = 500;
export declare const SIDEBAR_ORDER_MAX_REF_LENGTH = 200;
export interface SidebarOrderConfig {
    readonly version: number;
    readonly lists: Readonly<Record<string, readonly string[]>>;
}
export declare const DEFAULT_SIDEBAR_ORDER: SidebarOrderConfig;
/** The value form the migration validates a carried group with: a partial group arrives complete. */
export declare const SIDEBAR_ORDER_VALUE_SCHEMA: z<Schemastery.ObjectS<NoInfer<{
    version: z<number, number, "defined">;
    lists: z<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    version: z<number, number, "defined">;
    lists: z<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
}>>, "defined">;
/** The settings form derives one volatile group, and a write to it reaches the running Host without a remount. */
export declare const SIDEBAR_ORDER_SETTINGS_SCHEMA: z<NoInfer<Schemastery.ObjectS<NoInfer<{
    version: z<number, number, "defined">;
    lists: z<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
}>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    version: z<number, number, "defined">;
    lists: z<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
}>>>, "volatile-defined">;
/** The one key form both the Host write and the Client read agree on. */
export declare function sidebarOrderKey(workspaceId: string, kind: TeamSidebarListKind): string;
/** Why a stored list key is unusable, or `undefined` when it names one Workspace's one list. */
export declare function sidebarOrderKeyProblem(key: unknown): string | undefined;
/** The refs a Client asked to store, or a thrown refusal: an array of short non-empty strings, bounded in count. */
export declare function sanitizeSidebarOrderRefs(refs: unknown): readonly string[];
/**
 * The lists the Client may read: stored entries whose key names one Workspace's
 * one list. A hand-edited settings document cannot smuggle an unexpected key
 * into the Client, and an unusable entry is dropped rather than failing the read.
 */
export declare function readableSidebarOrders(lists: Readonly<Record<string, readonly string[]>>): Readonly<Record<string, readonly string[]>>;
//# sourceMappingURL=sidebar-order.d.ts.map