import type { TeamChangeListener, TeamChangeScope } from './team-changes.ts';
import type { TeamChangeStream } from './team-changes.ts';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
/** The scope kinds a rule can name; `scopeLess` is the stream without a scope, whose deliveries already woke every Workspace. */
export type TeamQueryScopeKind = 'workspace' | 'presence' | 'project' | 'thread' | 'scopeLess';
/**
 * A query's invalidation policy in comparable form. `covers` closures are rebuilt on every render, so the rule that
 * decides them carries its own identity: two reads of one key must name the same kinds and the same Workspace.
 */
export interface TeamQueryRule {
    readonly kinds: readonly TeamQueryScopeKind[];
    /** The Workspace whose `workspace` and `presence` scopes the rule admits; other kinds are not Workspace-scoped. */
    readonly workspaceId: WorkspaceId | undefined;
}
/**
 * The stable identity of a rule: what it admits, not which closure computed it. Sorted so the order a factory lists
 * kinds in cannot make two equivalent rules look different.
 */
export declare function describeRule(rule: TeamQueryRule): string;
/** `key` is what concurrent consumers agree on to share an in-flight read; `rule` names the change scopes that can change its data. */
export interface TeamQueryIdentity<Result> {
    readonly key: TeamQueryKey<Result>;
    readonly rule: TeamQueryRule;
}
declare const teamQueryResult: unique symbol;
/**
 * A query key branded with the result type it reads. The brand exists only at compile time — at runtime the key is the
 * plain string consumers agree on — so a key typed for one result cannot be read through a loader that returns another.
 */
export type TeamQueryKey<Result> = string & {
    readonly [teamQueryResult]: Result;
};
/** The only way to brand a key: the production query factories call this, so every key's result type is stated once. */
export declare function teamQueryKey<Result>(key: string): TeamQueryKey<Result>;
export type WorkspaceScopeKind = 'workspace' | 'presence';
/**
 * Whether a change scope names one of the query's scope kinds in its Workspace. The scope-less stream is excluded:
 * every delivery touching such data has already woken the Workspace scope, so admitting it only adds redundant reads.
 */
export declare function coversWorkspaceScope(scope: TeamChangeScope, workspaceId: WorkspaceId | undefined, kind: WorkspaceScopeKind): boolean;
/** Whether a rule admits a change scope. Derived from the rule, so no per-read closure can disagree with it. */
export declare function coversRule(scope: TeamChangeScope, rule: TeamQueryRule): boolean;
/** Per-query read counters. Diagnostics record identity and counts only — never response bodies. */
export interface TeamQueryCounters {
    readonly issued: number;
    /** Requests that joined a read instead of starting their own. */
    readonly shared: number;
    /** Invalidations that made a read no longer joinable. */
    readonly superseded: number;
    /** Responses dropped because a newer response for the same query already landed. */
    readonly droppedStale: number;
    /** Responses dropped because an invalidation superseded the read before it landed. */
    readonly droppedSuperseded: number;
    /** Reads that failed in any shape (rejected, error result, error payload); delivery is unchanged and the consumer renders its own `result.ok` face. */
    readonly failed: number;
}
/**
 * The Client's one owner for Team data reads, with per-query counters so duplicate reads and stale drops are observable.
 *
 * - A request joins the read for its key unless a wake it predates has invalidated it. A landed response stays joinable
 *   through the rest of the microtask drain; the next task reads Host state fresh.
 * - Each change dispatch invalidates once per (scope, version); a stream-opening baseline always invalidates.
 * - A superseded response never applies: waiters join its replacement, or the owner issues one, so an invalidation
 *   always ends in fresh data.
 * - The response lands on the microtask that resolves it; the issuance guard drops any older response arriving later.
 */
export declare class TeamQueries {
    private readonly changes;
    private readonly states;
    private readonly inFlight;
    /** Dispatches already folded into invalidations, so co-subscribers of one dispatch mark once. */
    private readonly folded;
    private issuance;
    private disposed;
    constructor(changes: Pick<TeamChangeStream, 'subscribe'>);
    read<Result>(identity: TeamQueryIdentity<Result>, load: () => Promise<Result>): Promise<Result>;
    private issue;
    /**
     * Folds each dispatch into invalidations before the consumer's own listener runs, so the first requesting consumer
     * issues the shared read and the rest join it.
     */
    subscribeChanges(scope: TeamChangeScope, listener: TeamChangeListener): () => void;
    /**
     * A new generation restarts the presence epoch and supersedes every read, pending or landed; otherwise a low presence
     * version would collide with the old watermark and a pre-reset response could reach a post-reset reader.
     */
    newGeneration(): void;
    diagnostics(): Record<string, Readonly<TeamQueryCounters>>;
    dispose(): void;
    /**
     * The state for a key, registering its rule on first use. A later read that names a different rule is a programming
     * error the type system cannot catch — the rule is data, not a type — so it fails here instead of silently replacing
     * the policy every later invalidation would then follow.
     */
    private state;
    private invalidate;
    private supersede;
    private settle;
    /** The stale payload is dropped whole, failure included, so an old error never masks newer data. */
    private dropStale;
    /**
     * An invalidation superseded this read: its payload must never become the query's state. Waiters move to the
     * replacement read; when the wake left none, issue it here so the invalidation still ends in fresh data.
     */
    private deliverSuperseded;
    private logDrop;
    private deliver;
}
export {};
//# sourceMappingURL=team-queries.d.ts.map