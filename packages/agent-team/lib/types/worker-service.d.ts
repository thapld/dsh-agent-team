/**
 * Delegations the Host starts, tracks, and stops: the Team side of one Worker run.
 *
 * Team owns authorization, the execution record, the result destination, and the
 * stop transaction; the Harness subagent service owns admission, capacity, the
 * parent notice, and the engine handle. A bound run writes its binding to the
 * ledger before any process exists and keeps its answer private; an unbound run
 * stays the direct parent result it was. One run has exactly one terminal fact,
 * and a stop only writes it after the engine confirmed its cleanup.
 * @module @contexera/dsh-agent-team/worker-service
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace';
import type { AgentTeamActor, AgentTeamMemberActor, AgentTeamMemberId, AgentTeamProjectRef, AgentTeamRequestId, AgentTeamTaskRef, AgentTeamThreadRef, AgentTeamWorkerRef, AgentTeamWorkerExecution, AgentTeamWorkerStartRecord, AgentTeamWorkerStartWrite, AgentTeamWorkerSteerAdmission, AgentTeamWorkerSteerAdmissionWrite, AgentTeamWorkerSteerResult, AgentTeamWorkerSteerRequestState, AgentTeamWorkerSteerStoredOutcome, AgentTeamWorkerSettleWrite } from './types.ts';
import { type WorkerEngine } from './worker-settings.ts';
import { type WorkerRunSpec } from './worker-runtime.ts';
import type { WorkerResumeAnchor } from './ledger.ts';
export interface WorkerEngineConfig {
    readonly enabled: boolean;
    /** Absolute executable path; empty keeps the engine's own discovery. */
    readonly executable: string;
    /** Codex sandbox policy; the engine's own default is never inherited silently. */
    readonly sandbox: string;
}
export interface WorkerConfig {
    readonly enabled: boolean;
    readonly defaultEngine: WorkerEngine;
    readonly engines: Readonly<Record<WorkerEngine, WorkerEngineConfig>>;
    /** Turn deadline in milliseconds; 0 means no deadline. */
    readonly timeoutMs: number;
}
export declare const DEFAULT_WORKER_CONFIG: WorkerConfig;
export interface AgentTeamWorkerRun {
    readonly workerRef: AgentTeamWorkerRef;
    readonly projectRef: AgentTeamProjectRef;
    /** The Thread the run reports into; absent on a Project-only delegation. */
    readonly threadRef?: AgentTeamThreadRef | undefined;
    readonly taskRef?: AgentTeamTaskRef | undefined;
    readonly engine: WorkerEngine;
    readonly state: 'running' | 'completed' | 'failed' | 'stopped' | 'unconfirmed';
    readonly startedAt: string;
    readonly settledAt?: string | undefined;
    /** The engine's own session identity, once one opened. */
    readonly nativeSessionId?: string | undefined;
    readonly cwd: string;
    /** A safe summary of a failure, never the native cause. */
    readonly diagnostic?: string | undefined;
    /** The Member whose delegation opened this run: the only Member who may stop it. */
    readonly initiatedBy: AgentTeamMemberId;
    /** Present when this execution resumed an earlier execution's native conversation. */
    readonly continuedFrom?: AgentTeamWorkerRef | undefined;
}
/**
 * Whether this Host still holds a run, and whether a stop has been asked for
 * but not confirmed. Derived from the live registry, never stored.
 */
export type WorkerLiveState = 'running' | 'stopping';
export interface WorkerStartRequest {
    readonly requestId: AgentTeamRequestId;
    /** The Workspace the resolved target lives in; the ledger re-checks it on write. */
    readonly workspaceId: WorkspaceId;
    /** Derived from the Thread or Task the delegation was bound to, never a caller's claim. */
    readonly projectRef: AgentTeamProjectRef;
    readonly threadRef?: AgentTeamThreadRef | undefined;
    readonly taskRef?: AgentTeamTaskRef | undefined;
    readonly engine?: WorkerEngine | undefined;
    readonly task: string;
    /** Absolute working directory the Worker runs in; the caller's own directory when omitted. */
    readonly cwd?: string | undefined;
}
/** What one delegation asks for before the Host resolves it: a target, and the task text. */
export interface WorkerDelegationRequest {
    readonly requestId: AgentTeamRequestId;
    readonly projectRef?: AgentTeamProjectRef | undefined;
    readonly threadRef?: AgentTeamThreadRef | undefined;
    readonly taskRef?: AgentTeamTaskRef | undefined;
    readonly engine?: WorkerEngine | undefined;
    readonly task: string;
    /** Absolute working directory the Worker runs in; the caller's own directory when omitted. */
    readonly cwd?: string | undefined;
}
/** Who delegates and whose session would have received the result on an unbound run. */
export interface WorkerCaller {
    readonly actor: AgentTeamMemberActor;
    readonly parent: Agent;
}
export interface WorkerRegistryDeps {
    /** The settings as they stand when the delegation is requested. */
    readonly config: () => WorkerConfig;
    /** Whether the named Project exists; the ledger re-checks it on write. */
    readonly projectExists: (projectRef: AgentTeamProjectRef) => boolean;
    /** Whether the Project is still active enough to receive a newly opened execution. */
    readonly projectActive: (projectRef: AgentTeamProjectRef) => boolean;
    /** The Workspace the Project belongs to, for the continuation start write. */
    readonly projectWorkspace: (projectRef: AgentTeamProjectRef) => WorkspaceId | undefined;
    /** Whether the initiating Member is still enabled, independently of this Host's live handle. */
    readonly memberEnabled: (memberId: AgentTeamMemberId) => boolean;
    /** Resolve a Project's current Agent owners. */
    readonly projectOwners: (projectRef: AgentTeamProjectRef) => readonly string[];
    /**
     * Write a run's opening binding. It must be durable before any process
     * starts, and it resolves the record as the ledger holds it.
     */
    readonly recordStarted: (write: AgentTeamWorkerStartWrite) => Promise<AgentTeamWorkerStartRecord>;
    /** Write a run's one terminal fact. */
    readonly recordSettled: (write: AgentTeamWorkerSettleWrite) => Promise<void>;
    /** Admit one steer request before any native input is sent. */
    readonly recordSteerAdmitted: (write: AgentTeamWorkerSteerAdmissionWrite) => Promise<AgentTeamWorkerSteerAdmission>;
    /** Store one steer outcome before the Host reports it. */
    readonly recordSteerRecorded: (write: {
        readonly admissionRequestId: AgentTeamRequestId;
        readonly outcome: AgentTeamWorkerSteerStoredOutcome;
    }) => Promise<void>;
    /** What a request id already means for steering, if anything. */
    readonly steerRequest: (requestId: AgentTeamRequestId) => AgentTeamWorkerSteerRequestState | undefined;
    /** The effective outcome of an admission, following an alias to its canonical request. */
    readonly steerOutcome: (requestId: AgentTeamRequestId) => AgentTeamWorkerSteerStoredOutcome | undefined;
    /**
     * Canonical admissions for one exact text on one receiving execution. A
     * continuation admission names its not-yet-recorded execution, so its source
     * is the durable identity a retry can still match after reconstruction.
     */
    readonly steerAdmissionsForText: (query: {
        readonly workerRef?: AgentTeamWorkerRef | undefined;
        readonly instruction: string;
        readonly initiatedBy: AgentTeamMemberId;
        readonly continuedFrom?: AgentTeamWorkerRef | undefined;
    }) => readonly AgentTeamWorkerSteerAdmission[];
    /** The execution one request id already opened, if any. */
    readonly workerStartedByRequest: (requestId: AgentTeamRequestId) => AgentTeamWorkerExecution | undefined;
    /** Complete native-record anchors in one execution's continuation chain, nearest first. */
    readonly workerResumeAnchors: (workerRef: AgentTeamWorkerRef) => readonly WorkerResumeAnchor[];
    /** Log one safe line; the native cause never reaches it. */
    readonly warn: (message: string) => void;
}
export declare class WorkerRefusal extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** Executions this Host started, plus the request ids already admitted. */
export declare class WorkerRegistry {
    private readonly ctx;
    private readonly deps;
    private readonly runs;
    private readonly byRequest;
    /** The ref one request id started, held before the write so a retry opens that run, not a twin. */
    private readonly attempts;
    /** The start each request id is opening right now, so a concurrent resend joins it. */
    private readonly starting;
    /**
     * One in-flight resumption per native conversation. The ledger remains the
     * durable authority; this map only joins calls that arrive before the first
     * successor's opening record exists.
     */
    private readonly continuations;
    /**
     * A continuation's opening promise by its new execution. A request that reaches
     * the linked execution after its record exists but before its native handle
     * opens waits for that same opening instead of refusing a transient state.
     */
    private readonly continuationOpenings;
    private readonly providers;
    /**
     * The delivery control of every session this Host still holds, by the engine's
     * own session id. This is live state, not a record: an entry exists only while
     * its session does, it is removed when that run ends, and unloading clears what
     * is left. Nothing outside this registry can reach an engine session.
     */
    private readonly sessions;
    /** Durable writes still in flight, so unloading the Host waits for them. */
    private readonly writes;
    /**
     * Live joins for steer requests whose durable admission or outcome is still
     * being written. The ledger remains the authority; these maps only keep two
     * calls that arrive together from each sending native input.
     */
    private readonly steeringByRequest;
    private readonly steeringByText;
    /** Every steer call still deciding, admitting, delivering, or persisting its outcome. */
    private readonly steerCalls;
    /** Set once unloading lets go of persistence; no steer admission or outcome may start after it. */
    private steerPersistenceClosed;
    private stopped;
    constructor(ctx: Context, deps: WorkerRegistryDeps);
    list(): readonly AgentTeamWorkerRun[];
    /** Every run one Member started, in start order: the Member's own stop surface. */
    runsOf(memberId: AgentTeamMemberId): readonly AgentTeamWorkerRun[];
    get(workerRef: AgentTeamWorkerRef): AgentTeamWorkerRun | undefined;
    /** Whether this Host still holds the run: `running` with no live entry here is a previous Host's. */
    isLive(workerRef: AgentTeamWorkerRef): boolean;
    /** How a run this Host holds stands right now, or `undefined` when it holds no live execution. */
    liveState(workerRef: AgentTeamWorkerRef): WorkerLiveState | undefined;
    /**
     * Start one delegation, or return the execution a resent request already made.
     * Every refusal precedes any write, and the opening record precedes the process.
     * A request id answers the Member and delegation that opened it, never another's.
     */
    start(caller: WorkerCaller, request: WorkerStartRequest): Promise<AgentTeamWorkerRun>;
    /** Open one admitted run: the durable binding first, the engine process second. */
    private open;
    /**
     * Stop one execution this Host holds. Only the Member who delegated it and the
     * Human may ask; the settings switch and current ownership are start conditions
     * and are deliberately not re-checked here. A run that already ended answers
     * with its real terminal state instead of stopping it twice.
     */
    stop(workerRef: AgentTeamWorkerRef, stopper: AgentTeamActor): Promise<AgentTeamWorkerRun>;
    /**
     * Deliver one instruction to a run's same native session. Only the Member who
     * delegated the run may ask; nothing here opens another native session or
     * reaches another run. A run that ended, is stopping, or has not opened its
     * engine session answers with that state instead of sending anything, and a
     * resent request id answers with the receipt the first call produced.
     */
    steer(workerRef: AgentTeamWorkerRef, steerer: AgentTeamActor, request: {
        readonly requestId: AgentTeamRequestId;
        readonly instruction: string;
    }): Promise<AgentTeamWorkerSteerResult>;
    private steerNew;
    /**
     * The receipt one request already earned somewhere in a continuation chain.
     * This is checked before deciding whether an ended tail should continue, so a
     * request-id retry answers the original submission and a changed instruction
     * still conflicts instead of accidentally opening a successor. Text dedupe
     * stays on the target execution: a fresh request id may intentionally repeat
     * an instruction in a later linked execution.
     */
    steerReceipt(workerRefs: readonly AgentTeamWorkerRef[], steerer: AgentTeamActor, request: {
        readonly requestId: AgentTeamRequestId;
        readonly instruction: string;
    }): Promise<AgentTeamWorkerSteerResult | undefined>;
    private steerConflict;
    /**
     * Join an admitted instruction on one execution or one continuation source
     * under a fresh request id. This is the replay path: it reserves the alias in
     * the ledger and never reads native history or reaches an engine.
     */
    steerTextAlias(steerer: AgentTeamActor, request: {
        readonly requestId: AgentTeamRequestId;
        readonly instruction: string;
    }, query: {
        readonly workerRef?: AgentTeamWorkerRef | undefined;
        readonly initiatedBy: AgentTeamMemberId;
        readonly continuedFrom?: AgentTeamWorkerRef | undefined;
        readonly allowSubmitted: boolean;
    }): Promise<AgentTeamWorkerSteerResult | undefined>;
    private steerTextKey;
    /**
     * Join a live same-text admission and reserve this request id as its durable
     * alias. An explicit refusal took nothing, so the caller may fall through and
     * make a fresh canonical admission under its own id.
     */
    private joinPendingText;
    /** Reserve a same-text request id as a durable alias; this path never reaches the engine. */
    private aliasDurable;
    /**
     * Resume one cleanly ended execution as a new linked execution. This is the
     * only path that opens a native session after the source process is gone, and
     * it rechecks every current permission instead of inheriting the old grant.
     */
    continueFrom(caller: WorkerCaller, source: AgentTeamWorkerExecution, request: {
        readonly requestId: AgentTeamRequestId;
        readonly instruction: string;
    }): Promise<AgentTeamWorkerSteerResult>;
    /** Recheck the continuation's whole current grant after every asynchronous opening boundary. */
    private assertContinuationAllowed;
    private continueFromAdmitted;
    /**
     * The one live steer transaction: durable admission, then native input, then
     * durable outcome. A failure to store the outcome is reported as unconfirmed
     * even when the engine said it accepted, because a later Host must not send
     * the same instruction again on the strength of a lost receipt.
     */
    private steerCanonical;
    private recordSteerRefusal;
    /** Distinguish a request-id collision found by a failed admission from a storage failure. */
    private admissionFailure;
    private recordSteerAmbiguous;
    private recordSteerOutcome;
    /** Admit one steer before its native side effect, but never after unloading closes persistence. */
    private admitSteer;
    /** Keep one durable write visible to unload until it settles, whatever its verdict. */
    private trackWrite;
    /** Refuse a steer by anyone but the Member who delegated the run. */
    private assertMaySteer;
    /**
     * Release the Team: refuse new starts, cancel every start still opening, stop
     * the runs this provider holds, wait for their endings, then release the
     * providers. A run that cannot confirm its ending within the deadline stays
     * `running` — which a later read reports as unconfirmed — and is sealed so no
     * late ending is written after the Host closes its storage.
     */
    dispose(): Promise<void>;
    /** Ask every run this Host still holds to stop; a sealed run already has its one ending decided. */
    private requestStops;
    /** Refuse a stop by anyone but the Member who delegated the run and the Human. */
    private assertMayStop;
    /**
     * The one stop transaction: cancel a startup that has not published, dispose a
     * published activation, and wait for the settlement its own evidence decides.
     */
    private stopRun;
    /** Seal a run the Host released without an ending: its start stays, and no later write may claim one. */
    private seal;
    /**
     * Decide one run's ending from the engine's own result. A stop that the engine
     * did not confirm is not reported as stopped: an aborted result whose disposal
     * rejected is the existing `failed` state with a reason that says what is
     * unknown, and a natural completion or failure that landed first keeps its
     * real state.
     */
    private finish;
    /** Decide the ending of a run whose engine never published: a cancelled start is a stop, everything else its real failure. */
    private finishFromStartFailure;
    /** Whether the cleanup a stop asked for ended in a rejection: the one piece of evidence that a stop is unconfirmed. */
    private disposalFailed;
    /** Dispose an activation this execution may not keep, preserving a cleanup failure as its own verdict. */
    private discardActivationBeforeStart;
    /**
     * Record one run's ending: the live view first, so the run stops reading as
     * live immediately, then the durable fact. A failed write leaves the record
     * `running`, which is exactly what a later read reports as unconfirmed.
     */
    private settle;
    private require;
    private subagents;
    private providerFor;
}
/**
 * The most runs one Member's surface lists. The record keeps every run; the list
 * is a window, so a Member with months of delegations still gets one bounded
 * read. Five is what a reader scans without scrolling the dialog, and the ledger
 * still holds every record. A live run takes a seat in the window rather than
 * being added on top of it, and is never dropped for an ended one — it is the
 * only row that can still be stopped — so more than five live runs make the list
 * longer than the window.
 */
export declare const WORKER_RUN_LIST_LIMIT = 5;
/**
 * The window of one Member's ended runs the Human's list shows: the newest
 * endings, not the newest starts. A run that began early and failed only now is
 * exactly the record the Human is looking for, so it must outrank a short run
 * that started later and ended long before it.
 */
export declare function newestEndedRuns<T extends {
    readonly startedAt: string;
    readonly settledAt?: string | undefined;
}>(executions: readonly T[], limit: number): readonly T[];
/** A single-line, bounded preview of a run's task for the Human's run list; the record keeps the full text. */
export declare function workerTaskPreview(task: string): string;
/** The run one delegation starts on an engine, read from the row as it stands at that open. */
export declare function workerRunSpec(engine: WorkerEngine, config: WorkerConfig, warn: (message: string) => void): WorkerRunSpec;
/** What the Worker's launch carries: the executable OAR resolves the installation by, and the Codex policy the runtime provider applies at open. */
export declare function workerEnvironment(engine: WorkerEngine, config: WorkerEngineConfig): Readonly<Record<string, string | null>>;
//# sourceMappingURL=worker-service.d.ts.map