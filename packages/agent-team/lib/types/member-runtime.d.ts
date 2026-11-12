/**
 * Per-Member runtime state split out of the Host service: the maps and methods that must dispose together across activation, edit, suspend, and removal (tool-policy restriction, private skill mounts, capability warnings, private-memory provisioning). Host-side by design: the turn-boundary wait subscribes to Host-level agent events. The service keeps orchestration (ledger, handles, notifications, recovery).
 * @module @contexera/dsh-agent-team/member-runtime
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent';
import type { AgentTeamAgentMember, AgentTeamCapabilityWarning, AgentTeamMemberCapabilities, AgentTeamMemberId } from './types.ts';
/** Result of waiting for a turn boundary: `waited` if a running turn had to finish first, `idle` if the Member was already between turns. */
export type TurnBoundary = 'waited' | 'idle';
/** The one Team tool a Host switch can withdraw from a Member's declared surface. */
export declare const WORKER_TOOL_NAME = "team_worker";
/** Model-facing capabilities every Team-enabled preset must publish. */
export declare const AGENT_TEAM_TOOL_NAMES: readonly ["team_inbox", "team_thread", "team_attention", "team_message", "team_dm", "team_task", "team_view", "team_subscription", "team_reminder", "team_worker"];
/** Copy a Remote-supplied capability overlay into owned frozen storage. */
export declare function deepCopyCapabilities(capabilities: AgentTeamMemberCapabilities): AgentTeamMemberCapabilities;
/** Directory segment for a Member's private memory. The `member:<uuid>` ref must never appear in a path: Windows rejects `:` in a path segment (NTFS reads it as an Alternate Data Stream separator). */
export declare function memberMemoryDirectoryName(memberId: AgentTeamMemberId): string;
/** The sanitized absolute private-memory path for one Member, regardless of what the ledger recorded. */
export declare function memberMemoryDirectoryPath(member: Pick<AgentTeamAgentMember, 'memberId' | 'privateMemoryPath'>): string;
/** Everything the runtime needs from its owning Host service. */
export interface MemberRuntimeDeps {
    /** Host context for agent events, tool schemas, and the workspace registry. */
    readonly ctx: Context;
    /** Resolve one Member's live agent context, or throw when it has none. */
    readonly liveMemberContext: (memberId: AgentTeamMemberId) => Context;
    /** Agent ids with a turn in flight; shared by reference with the service. */
    readonly runningAgents: ReadonlySet<SessionId>;
}
/** One Member's durable policy intent at the instant its next turn opens. */
export interface MemberToolPolicySnapshot {
    readonly member: AgentTeamAgentMember;
    readonly workerEnabled: boolean;
    readonly grants: readonly string[];
}
/** Read the current intent synchronously: this runs from `session/event`, which cannot await. */
export type MemberToolPolicyReader = () => MemberToolPolicySnapshot;
/** Whether one tool name is owned by the Team baseline and cannot be reopened by a profile grant. */
export declare function isReservedToolName(name: string): boolean;
/** Per-Member runtime state: every map here is keyed by Member and released together with that Member. */
export declare class MemberRuntime {
    private readonly deps;
    /** Per-Member tool restriction disposers: activation registers, disposal releases, edits swap at a turn boundary. */
    private readonly memberRestrictions;
    /** The allow-list enforced behind `memberRestrictions`: the rollback source when a swap fails, so a failed apply never leaves the Member less restricted. */
    private readonly enforcedToolAllow;
    private readonly memberToolBindings;
    /** The exact extra names frozen for this Member's current turn; a settings edit waits for the next `turn/start`. */
    private readonly turnToolGrants;
    /** A synchronous turn-start or pre-step refresh failure; `agent/pre-step` turns it into a fail-closed step, i.e. no model request. */
    private readonly turnToolPolicyFailures;
    /** The last successfully read durable intent, used to tighten to the Member baseline if the next synchronous read fails. */
    private readonly lastToolPolicy;
    /** Capability intent the live surface is known to reflect: presence is the proof, a stored `undefined` means applied with no capabilities. Never persisted; absent when unprovable, so an unknown surface re-applies. */
    private readonly appliedCapabilities;
    /** Capability warnings, recomputed at every activation and never persisted: stored ones would lie after a Host restart or a Harness upgrade that renames tools. */
    private readonly capabilityWarnings;
    /** Per-Member skill provider mounts. One entry holds the selection swap and the disposer, so a catalog re-filter and the unmount never disagree about which provider is live. */
    private readonly skillProviderMounts;
    constructor(deps: MemberRuntimeDeps);
    /** Tool names supplied by activated Member presets, rather than discovered foreign registrations. */
    baselineToolNames(): ReadonlySet<string>;
    /** Foreign own-scope registrations remain visible despite restriction; name exactly those still denied by the Member guard. */
    visibleUngrantedToolNames(agentCtx: Context, memberId: AgentTeamMemberId): readonly string[];
    /** One Member's live capability warnings, if any; runtime-derived, never persisted. */
    capabilityWarningsFor(memberId: AgentTeamMemberId): readonly AgentTeamCapabilityWarning[] | undefined;
    /**
     * Restrict every Member to its preset tools plus the profile's exact name
     * grants. The stored Member allow-list narrows the baseline; an explicit
     * non-reserved grant can reopen a baseline name. `workerEnabled` stays the
     * Host's own switch: while it is off, `team_worker` is not declared at all,
     * so a grant cannot recreate a tool the Host would refuse.
     */
    applyMemberToolPolicy(agentCtx: Context, member: AgentTeamAgentMember, workerEnabled: boolean, grants?: readonly string[]): void;
    /**
     * Install the per-turn restriction synchronously from `turn/start`. The
     * session event itself is observe-only (the Harness contains its exceptions
     * and does not await it), so failure is recorded here and rejected later by
     * `agent/pre-step`; it must never be mistaken for asynchronous turn blocking.
     */
    observeMemberToolPolicyTurns(agentCtx: Context, agent: Agent, memberId: AgentTeamMemberId, readPolicy: MemberToolPolicyReader): void;
    /**
     * Whether this turn's policy installation or per-step refresh failed.
     * `agent/pre-step` uses it only to refuse the step and spend no model
     * request; it never selects tools.
     */
    turnToolPolicyFailure(memberId: AgentTeamMemberId): string | undefined;
    private freezeMemberToolPolicyForTurn;
    /**
     * Re-materialize the current turn's restriction against the tool names that
     * exist now. `tools.restrict()` snapshots global names when installed, so a
     * selected name first registered after turn start would otherwise stay hidden.
     * This runs from `agent/pre-step`, after the Harness resolved this step's
     * tools but before it can send the model request: the current step keeps its
     * assembly, a successful refresh serves the following step, and a failed
     * baseline is still visible to the existing pre-step failure gate.
     */
    refreshMemberToolPolicyForStep(agentCtx: Context, memberId: AgentTeamMemberId): void;
    /**
     * Derive and install one complete restriction. A failed grant-bearing apply
     * tightens to the current Member baseline, never to the previous restriction
     * which may still contain a revoked grant. A failed baseline leaves no
     * old-grant restore behind.
     */
    private installMemberToolPolicy;
    /** Swap one scoped restriction, recording exactly what it permits. */
    private installRestriction;
    /** The names `tools.restrict()` can mask: inherited global and ancestor registrations. */
    private inheritedToolNames;
    private mountMemberToolBindings;
    /** Whether the live surface is known to reflect exactly this capability intent; an absent record never matches. */
    appliedCapabilitiesMatch(memberId: AgentTeamMemberId, capabilities: AgentTeamMemberCapabilities | undefined): boolean;
    /** Record the capability intent the live surface now reflects; callers invoke it only after every effect of the apply succeeded. */
    recordAppliedCapabilities(memberId: AgentTeamMemberId, capabilities: AgentTeamMemberCapabilities | undefined): void;
    /** Swaps a live Member's tool policy at a turn boundary; a failed swap leaves the no-grants baseline, never the previous grant-bearing restriction. */
    reapplyMemberToolPolicy(member: AgentTeamAgentMember, workerEnabled: boolean, grants?: readonly string[]): void;
    /** Release one Member's restriction disposer and warning state; safe to call twice. */
    releaseMemberToolPolicy(memberId: AgentTeamMemberId): void;
    private setCapabilityWarnings;
    /** Outstanding boundary waits, held so Host shutdown can release them all. */
    private readonly turnWaitResolvers;
    /** Waits until a live Member's current turn ends or its Session is disposed; returns whether a running turn had to be awaited. The running turn keeps its schemas and catalog; the swap happens once idle so the next step sees the new restriction and skill selection on the same Session. Suspend/remove resolves the wait (the disposed handle already released the restriction); Host shutdown resolves every wait through `releaseTurnWaits`. */
    awaitTurnBoundary(active: AgentHandle): Promise<TurnBoundary>;
    /** Host-shutdown exit: resolves every boundary wait so the Member's lifecycle chain drains; `settle` removes each wait's listeners, so nothing survives shutdown. */
    releaseTurnWaits(): void;
    /** Registers the Member-private skill provider on the created agent's exact scope layer (the traceable-service seam, like the tool restriction): bundled core skills plus the Member's private directory. Without a skill registry nothing is registered. The sanitized directory is authoritative; activateMember migrates any legacy colon directory onto it first. */
    mountMemberSkillProvider(member: AgentTeamAgentMember, agentCtx: Context, initialSelection: readonly string[] | undefined): void;
    /** Live-apply a capability edit to a mounted provider; a no-op when this Member has none. */
    swapSkillSelection(memberId: AgentTeamMemberId, allow: readonly string[] | undefined): void;
    /**
     * Provisions a Member's private memory namespace: notes/, skills/, and a first-run memory.md scaffold. The per-Member skill provider scans exactly this root.
     *
     * `privateMemoryPath` is a durable Member fact that cannot be rewritten, so a legacy colon directory recorded in the ledger is renamed onto the sanitized path once (same-parent, atomic) rather than orphaning existing memory. A recorded path in a different DSH home is never acted on (see `migrateLegacyMemoryDirectory`).
     *
     * A colon-form twin directory is merged too: the branded `member:<uuid>` ref shown by every Team tool result leads Members to hand-assemble colon paths, which Linux accepts silently (two directories for one Member) and Windows rejects. `memory.md` cannot merge, so the sanitized copy wins and twin-only notes/skills move in without overwriting.
     */
    initializePrivateMemory(path: string, legacyPath?: string): Promise<void>;
    /** Irreversibly remove one Member: archive its Session and delete its private namespace. */
    cleanupRemovedMember(member: AgentTeamAgentMember): Promise<void>;
    /** Drop one Member's transient selection/disposer state after its handle is gone; safe to call twice. */
    forgetMember(memberId: AgentTeamMemberId): void;
    /** Every Member id any per-Member map holds, so a release path cannot miss one only a single map knows. */
    private trackedMemberIds;
    /** Dispose every registered per-Member seam; service shutdown only. */
    disposeAll(): void;
}
//# sourceMappingURL=member-runtime.d.ts.map