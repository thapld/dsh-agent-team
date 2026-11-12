/**
 * The Team-owned Worker provider: one OAR-backed external execution per delegation.
 *
 * The sequence follows the Harness OAR provider; Team owns its copy because a
 * Worker must expose its native identity, which a one-shot contract does not.
 * @module @contexera/dsh-agent-team/worker-runtime
 */
import type { FailureClass, RejectionCode, Runtime } from '@botiverse/oar';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { type ResolvedSubagentStartRequest, type SubagentProvider, type SubagentResult, type SubagentRun, type SubagentStopReason } from '@deepseek-ai/dsh-subagent';
import type { AgentTeamWorkerStage } from './types/entities.ts';
import type { WorkerEngine } from './worker-settings.ts';
/** The registry name each engine's provider registers under. */
export declare const WORKER_PROVIDER_NAMES: Readonly<Record<WorkerEngine, string>>;
/** The stages a Worker run can come apart in; the ledger records the same vocabulary. */
type FailureStage = AgentTeamWorkerStage;
type FailureCategory = FailureClass | RejectionCode | 'not-found' | 'unsupported' | 'cancelled' | 'timeout';
export declare class WorkerFailure extends Error {
    readonly stage: FailureStage;
    readonly category: FailureCategory;
    constructor(stage: FailureStage, category: FailureCategory, options?: ErrorOptions);
}
/**
 * What the engine itself said about one run's own record, captured while the
 * session is still open: the identity a later read-only look-up needs, and
 * nothing else. The native record is never copied into the Team's ledger — the
 * settlement write carries these three facts and the record stays where the
 * engine put it.
 */
export interface WorkerAnchors {
    /** The engine's own session identity. */
    readonly nativeSessionId: string;
    /** The engine's own identity for the turn this run drove. */
    readonly nativeTurnId?: string | undefined;
    /** Every native turn this execution drove, including accepted follow-up turns. */
    readonly nativeTurnIds?: readonly string[] | undefined;
    /** Every native input UUID this execution submitted, in submission order. */
    readonly nativeInputIds?: readonly string[] | undefined;
    /** The absolute path of the engine's own record: reported by Codex, derived from the cwd Claude reported and the environment the run opened with. */
    readonly nativeStorage?: string | undefined;
}
/** The anchors one run carried on its own result, validated so a foreign object cannot shape them. */
export declare function workerAnchorsOf(result: object): WorkerAnchors | undefined;
/**
 * Attach what the engine said about its own record to the result it produced.
 * Capturing is a diagnostic aid: a runtime that cannot answer costs the look-up
 * and never the run's own outcome, so every failure here returns the result
 * exactly as the engine settled it.
 */
export declare function carryWorkerAnchors(outcome: SubagentResult, anchors: WorkerAnchors | undefined): SubagentResult;
/**
 * What one instruction came to. `submitted` is OAR's own deliberately weak
 * promise: the input was accepted into the session, not a claim that the model
 * read it or that it landed in a fixed turn. `unavailable` distinguishes a typed
 * native refusal from a transport error whose delivery is unknown.
 */
export type WorkerSteerOutcome = {
    readonly kind: 'submitted';
    readonly inputId: string;
    readonly landed: 'steered' | 'queued' | 'prompted';
    readonly turnId?: string | undefined;
} | {
    readonly kind: 'unavailable';
    readonly code: RejectionCode | 'error';
    readonly reason: string;
    readonly delivery: 'rejected' | 'unknown';
};
/** One run's live control: deliver an instruction into the engine's same native session. */
export type WorkerSteer = ((instruction: string, inputId: string) => Promise<WorkerSteerOutcome>) & {
    /** Hold the closing window across the Host's durable admission; release exactly once. */
    readonly hold?: () => (() => void) | undefined;
};
/** One run's delivery channel, or nothing when its provider published no control. */
export declare function workerSteerOf(run: object): WorkerSteer | undefined;
/**
 * The one diagnostic a Worker hands the Harness when the engine could not
 * confirm its own disposal. The Harness waits for teardown but keeps the result
 * it captured for the parent, so this text has to ride that result: Team reads
 * it back to report the stop as unconfirmed instead of as stopped.
 */
export declare const WORKER_CLEANUP_UNCONFIRMED_DIAGNOSTIC: string;
export interface WorkerRunSpec {
    readonly engine: WorkerEngine;
    /** Native model id; omitted to keep the engine's own setting. */
    readonly model?: string | undefined;
    /** Explicit environment, applied after the shared credential scrub. */
    readonly env: Readonly<Record<string, string | null>>;
    /** Native process arguments; OAR validates the ones it owns. */
    readonly launchArgs: readonly string[];
    /** A previous native session id to resume, used only by an explicit Team continuation. */
    readonly resume?: string | undefined;
    /** Optional turn deadline in milliseconds; OAR starts counting once the session opens. */
    readonly timeoutMs?: number | undefined;
    /** Safe summaries only; native causes can carry credentials. */
    readonly onError?: ((error: Error, stopReason: SubagentStopReason) => void) | undefined;
}
export declare function engineRuntime(engine: WorkerEngine): Promise<Runtime>;
/** The task text, refused before a native session exists when it is not plain text. */
export declare function textTask(prompt: readonly ContentBlock[]): string;
/**
 * OAR 0.95.1 reads Codex's permission mode from the Host's own
 * `OAR_CODEX_SANDBOX` when a session opens — `SessionOptions.env` only reaches
 * the child process — and the pinned library exposes no per-session channel. So
 * the row's policy rides the open call and is restored before the run goes on,
 * which bounds the one window in which another Codex open could see it.
 * @param env - the Worker's launch environment, which names the policy.
 * @param open - the runtime's session open, run while the policy is in place.
 * @returns whatever the open resolves to.
 */
export declare function withCodexSandbox<T>(env: Readonly<Record<string, string | null>>, open: () => Promise<T>): Promise<T>;
/**
 * Open one native session and return a one-shot run. OAR cannot interrupt session
 * startup, so a cancellation during that await disposes the session before rejecting.
 */
export declare function startWorkerRun(request: ResolvedSubagentStartRequest, spec: WorkerRunSpec): Promise<SubagentRun>;
/**
 * What the Host's live-run registry is told about a session as it opens and
 * closes. The provider holds no table of its own: the registry that owns every
 * live execution owns the control that belongs to them, so one unload, one
 * ending, and one place to look are all the same place.
 */
export interface WorkerSessionSink {
    /** The session opened, with the delivery control it carries or nothing when it has none. */
    opened(sessionId: SessionId, steer: WorkerSteer | undefined): void;
    /** The session is gone: its run ended, was released, or the provider closed it. */
    closed(sessionId: SessionId): void;
}
export declare class TeamWorkerProvider implements SubagentProvider {
    readonly name: string;
    private readonly spec;
    private readonly sink;
    readonly capabilities: Readonly<{
        agentOptions: false;
        agentPreset: false;
        outputSchema: false;
        depthLimit: false;
    }>;
    readonly inheritsParentContext = false;
    /**
     * @param name - the registry name the Host registered the provider under.
     * @param spec - reads the settings row as it stands when a session opens, so a
     * saved executable, engine switch, or policy reaches the next delegation.
     * @param sink - the Host's live-run registry, told when a session opens and closes.
     */
    constructor(name: string, spec: () => WorkerRunSpec, sink: WorkerSessionSink);
    start(request: ResolvedSubagentStartRequest): Promise<SubagentRun>;
}
export {};
//# sourceMappingURL=worker-runtime.d.ts.map