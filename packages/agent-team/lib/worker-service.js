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
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { truncateToCharacters } from "./text.js";
import { DEFAULT_WORKER_SANDBOX, WORKER_DIAGNOSTIC_MAX_CHARACTERS, WORKER_ENGINES, WORKER_OUTPUT_MAX_CHARACTERS, WORKER_TASK_PREVIEW_MAX_CHARACTERS } from "./worker-settings.js";
import { TeamWorkerProvider, WORKER_CLEANUP_UNCONFIRMED_DIAGNOSTIC, WORKER_PROVIDER_NAMES, WorkerFailure, workerAnchorsOf, } from "./worker-runtime.js";
import { readWorkerHistory } from "./worker-inspection.js";
export const DEFAULT_WORKER_CONFIG = Object.freeze({
    enabled: false,
    defaultEngine: 'codex',
    engines: Object.freeze({
        codex: Object.freeze({ enabled: false, executable: '', sandbox: DEFAULT_WORKER_SANDBOX }),
        claude: Object.freeze({ enabled: false, executable: '', sandbox: '' }),
    }),
    timeoutMs: 0,
});
/** The settlement schema bounds these anchor arrays; keep the newest evidence when a very long run exceeds it. */
const WORKER_NATIVE_ANCHOR_LIMIT = 128;
export class WorkerRefusal extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'WorkerRefusal';
    }
}
const nowIso = () => new Date().toISOString();
/** How long an engine's own refusal sentence may be before this Team reports its own. */
const WORKER_STEER_REASON_MAX_CHARACTERS = 300;
/**
 * One engine refusal, bounded. The sentence is the engine's own words about a
 * control it declined — never a native record — and a report may not carry an
 * unbounded value into the Thread.
 */
function boundedSteerReason(reason) {
    const text = reason.trim();
    return text === '' ? 'the engine gave no reason' : truncateToCharacters(text, WORKER_STEER_REASON_MAX_CHARACTERS);
}
/**
 * How long an unloading Host waits for an engine to report its ending before it
 * lets go. A run that outlasts it keeps its recorded start with no ending, which
 * the next read reports as unconfirmed rather than holding the Host open — and
 * the run is sealed so a late ending is never written after storage closes.
 */
const WORKER_SETTLE_DEADLINE_MS = 5_000;
/** How long one stop request waits for cleanup before it reports that the run is still stopping. */
const WORKER_STOP_DEADLINE_MS = 10_000;
/** Resolve to `undefined` when `promise` has not settled within `ms`; the timer never holds the process open. */
const within = (promise, ms) => Promise.race([
    promise,
    new Promise(resolve => {
        const timer = setTimeout(() => { resolve(undefined); }, ms);
        timer.unref?.();
    }),
]);
/** The text of an engine's final answer; any other content block is not an answer to carry. */
const answerTextOf = (output) => {
    const text = output.filter(block => block.type === 'text' && typeof block.text === 'string')
        .map(block => block.text ?? '').join('\n').trim();
    return text === '' ? undefined : truncateToCharacters(text, WORKER_OUTPUT_MAX_CHARACTERS);
};
const delegationOf = (caller, request, resolved) => Object.freeze({
    initiator: caller.actor.memberId, workspaceId: request.workspaceId, projectRef: request.projectRef,
    ...(request.threadRef === undefined ? {} : { threadRef: request.threadRef }),
    ...(request.taskRef === undefined ? {} : { taskRef: request.taskRef }),
    engine: resolved.engine, task: request.task, cwd: resolved.cwd,
});
/**
 * Refuse a request id reused for a different delegation. A Worker run answers only
 * the request and the Member that started it, so an id never becomes a handle to
 * somebody else's execution, and a changed task under an old id is refused rather
 * than silently answered with the run that id already made.
 */
const assertSameDelegation = (admitted, caller, request) => {
    const engine = request.engine ?? admitted.engine;
    if (admitted.initiator === caller.actor.memberId && admitted.workspaceId === request.workspaceId
        && admitted.projectRef === request.projectRef && admitted.threadRef === request.threadRef
        && admitted.taskRef === request.taskRef && admitted.task === request.task && engine === admitted.engine
        && (request.cwd === undefined || request.cwd === admitted.cwd))
        return;
    throw new WorkerRefusal('worker_request_conflict', `Request id '${request.requestId}' already opened a `
        + `${admitted.engine} run for another delegation; a Worker run answers only the request that started it, `
        + 'so delegate again with a new request id.');
};
/** Whether this Host still holds the entry: a sealed run was released without a confirmed ending. */
function held(entry) {
    return !entry.sealed;
}
/** Executions this Host started, plus the request ids already admitted. */
export class WorkerRegistry {
    ctx;
    deps;
    runs = new Map();
    byRequest = new Map();
    /** The ref one request id started, held before the write so a retry opens that run, not a twin. */
    attempts = new Map();
    /** The start each request id is opening right now, so a concurrent resend joins it. */
    starting = new Map();
    /**
     * One in-flight resumption per native conversation. The ledger remains the
     * durable authority; this map only joins calls that arrive before the first
     * successor's opening record exists.
     */
    continuations = new Map();
    /**
     * A continuation's opening promise by its new execution. A request that reaches
     * the linked execution after its record exists but before its native handle
     * opens waits for that same opening instead of refusing a transient state.
     */
    continuationOpenings = new Map();
    providers = new Map();
    /**
     * The delivery control of every session this Host still holds, by the engine's
     * own session id. This is live state, not a record: an entry exists only while
     * its session does, it is removed when that run ends, and unloading clears what
     * is left. Nothing outside this registry can reach an engine session.
     */
    sessions = new Map();
    /** Durable writes still in flight, so unloading the Host waits for them. */
    writes = new Set();
    /**
     * Live joins for steer requests whose durable admission or outcome is still
     * being written. The ledger remains the authority; these maps only keep two
     * calls that arrive together from each sending native input.
     */
    steeringByRequest = new Map();
    steeringByText = new Map();
    /** Every steer call still deciding, admitting, delivering, or persisting its outcome. */
    steerCalls = new Set();
    /** Set once unloading lets go of persistence; no steer admission or outcome may start after it. */
    steerPersistenceClosed = false;
    stopped = false;
    constructor(ctx, deps) {
        this.ctx = ctx;
        this.deps = deps;
    }
    list() {
        return [...this.runs.values()].filter(held).map(entry => entry.run);
    }
    /** Every run one Member started, in start order: the Member's own stop surface. */
    runsOf(memberId) {
        return [...this.runs.values()].filter(held).filter(entry => entry.run.initiatedBy === memberId).map(entry => entry.run);
    }
    get(workerRef) {
        const entry = this.runs.get(workerRef);
        return entry === undefined || !held(entry) ? undefined : entry.run;
    }
    /** Whether this Host still holds the run: `running` with no live entry here is a previous Host's. */
    isLive(workerRef) {
        const entry = this.runs.get(workerRef);
        return entry !== undefined && held(entry) && entry.run.state === 'running';
    }
    /** How a run this Host holds stands right now, or `undefined` when it holds no live execution. */
    liveState(workerRef) {
        const entry = this.runs.get(workerRef);
        if (entry === undefined || !held(entry) || entry.run.state !== 'running')
            return undefined;
        return entry.stopping ? 'stopping' : 'running';
    }
    /**
     * Start one delegation, or return the execution a resent request already made.
     * Every refusal precedes any write, and the opening record precedes the process.
     * A request id answers the Member and delegation that opened it, never another's.
     */
    async start(caller, request) {
        // A resend that arrives while the first call is still opening joins that start:
        // one request id never opens two engines, not even concurrently.
        const opening = this.starting.get(request.requestId);
        if (opening !== undefined) {
            assertSameDelegation(opening.delegation, caller, request);
            return opening.started;
        }
        const replayedRef = this.byRequest.get(request.requestId);
        const replayed = replayedRef === undefined ? undefined : this.runs.get(replayedRef);
        if (replayed !== undefined) {
            // A resend answers with the run this Host admitted, and only when it asks the
            // same thing of the same Member: a request id is an idempotency key, not a
            // handle one caller can use to collect another's execution.
            assertSameDelegation(replayed.delegation, caller, request);
            return replayed.run;
        }
        const config = this.deps.config();
        if (this.stopped)
            throw new WorkerRefusal('worker_unavailable', 'The Team is unloading, so no Worker can start.');
        if (!config.enabled)
            throw new WorkerRefusal('worker_disabled', 'Worker delegation is switched off in the Team settings.');
        if (!this.deps.projectExists(request.projectRef))
            throw new WorkerRefusal('worker_project_unknown', `${request.projectRef} is not a Project in this Team.`);
        if (!this.deps.projectOwners(request.projectRef).includes(caller.actor.memberId)) {
            throw new WorkerRefusal('worker_owner_required', `Only a current owner of ${request.projectRef} may delegate a Worker, so the target of this delegation belongs to no Project you own.`);
        }
        const engine = request.engine ?? config.defaultEngine;
        if (!WORKER_ENGINES.includes(engine))
            throw new WorkerRefusal('worker_engine_unknown', `'${engine}' is not a Worker engine; use one of ${WORKER_ENGINES.join(', ')}.`);
        const engineConfig = config.engines[engine];
        if (!engineConfig.enabled)
            throw new WorkerRefusal('worker_engine_disabled', `Engine '${engine}' is not enabled in the Team settings.`);
        if (request.task.trim() === '')
            throw new WorkerRefusal('worker_task_required', 'A delegation needs the task text the Worker should carry out.');
        const cwd = request.cwd;
        if (cwd === undefined || !isAbsolute(cwd))
            throw new WorkerRefusal('worker_cwd_required', 'A delegation needs an absolute working directory; this Session has none to inherit.');
        const subagents = this.subagents();
        if (subagents === undefined)
            throw new WorkerRefusal('worker_unavailable', 'The Harness subagent service is not mounted, so no Worker can start.');
        const provider = this.providerFor(engine, subagents);
        const workerRef = this.attempts.get(request.requestId) ?? `worker:${randomUUID()}`;
        this.attempts.set(request.requestId, workerRef);
        const delegation = delegationOf(caller, request, { engine, cwd });
        const started = this.open(caller, request, { workerRef, engine, cwd, provider, subagents, delegation });
        // Registered before anything awaits, so the second of two concurrent calls finds
        // this start and joins it instead of writing a second opening and opening a
        // second engine under one request id.
        this.starting.set(request.requestId, { delegation, started });
        try {
            return await started;
        }
        finally {
            this.starting.delete(request.requestId);
        }
    }
    /** Open one admitted run: the durable binding first, the engine process second. */
    async open(caller, request, admitted) {
        const { workerRef, engine, cwd, provider, subagents } = admitted;
        // Written before the process opens: a Host that dies here leaves a run the
        // Thread reports as unconfirmed, not one nobody can see.
        const started = await this.deps.recordStarted({
            requestId: request.requestId, actor: caller.actor, workspaceId: request.workspaceId,
            execution: Object.freeze({ workerRef, projectRef: request.projectRef,
                ...(request.threadRef === undefined ? {} : { threadRef: request.threadRef }),
                ...(request.taskRef === undefined ? {} : { taskRef: request.taskRef }),
                initiatedBy: caller.actor.memberId, engine, task: request.task, cwd, startedAt: nowIso(),
                ...(admitted.continuedFrom === undefined ? {} : { continuedFrom: admitted.continuedFrom }) }),
        });
        const entry = {
            settleRequestId: `${request.requestId}:settled`,
            delegation: admitted.delegation,
            startup: new AbortController(),
            terminated: Promise.withResolvers(),
            stopping: false,
            sealed: false,
            cleanupUnconfirmed: false,
            run: Object.freeze({ workerRef, projectRef: started.projectRef, engine, state: 'running',
                startedAt: started.startedAt, cwd: started.cwd, initiatedBy: started.initiatedBy,
                ...(started.threadRef === undefined ? {} : { threadRef: started.threadRef }),
                ...(started.taskRef === undefined ? {} : { taskRef: started.taskRef }),
                ...(started.continuedFrom === undefined ? {} : { continuedFrom: started.continuedFrom }) }),
        };
        this.runs.set(workerRef, entry);
        this.byRequest.set(request.requestId, workerRef);
        if (this.stopped) {
            // The Host began unloading while this run was writing its opening record:
            // no engine opens, and the record stays running for a later read to report
            // as unconfirmed instead of receiving an ending after storage closes.
            this.seal(entry);
            throw new WorkerRefusal('worker_unavailable', 'The Team released this Worker before it opened its engine.');
        }
        let admissionFailureStage;
        try {
            try {
                admitted.assertAdmitted?.();
            }
            catch (error) {
                admissionFailureStage = 'startup';
                throw error;
            }
            const activation = await subagents.startActivation({
                provider: provider.name,
                label: `${engine} worker`,
                parent: caller.parent, prompt: [{ type: 'text', text: request.task }], cwd,
                // A stop asked for during startup cancels through this signal; once the
                // activation is published, its own disposal is the channel.
                signal: entry.startup.signal,
                // A bound run's result belongs to its Thread and its initiator's Inbox,
                // so the parent Session must not also receive a full copy of it.
                delivery: entry.run.threadRef === undefined ? 'parent' : 'caller',
            });
            if (entry.sealed) {
                // The Host released this run before its engine opened: clean the late
                // handle up and never let it publish a start the Host no longer holds.
                const disposal = entry.stopDisposal ??= activation.dispose();
                void disposal.catch(() => { });
                throw new WorkerRefusal('worker_unavailable', 'The Team released this Worker while it was still starting.');
            }
            entry.activation = activation;
            try {
                admitted.assertAdmitted?.();
            }
            catch (error) {
                admissionFailureStage = 'startup';
                await this.discardActivationBeforeStart(entry, activation, error);
            }
            // Live controls belong to this external activation. The native conversation
            // identity is separate evidence carried by its result, including on resume.
            entry.sessionId = activation.childId;
            if (entry.stopping) {
                const disposal = entry.stopDisposal ??= activation.dispose();
                void disposal.catch(() => { });
            }
            void activation.result.then((result) => this.finish(entry, result), (error) => this.finish(entry, { output: [], stopReason: 'error',
                diagnostic: error instanceof WorkerFailure ? error.message : 'The Worker ended with an unreported failure.' }));
            return this.require(workerRef);
        }
        catch (error) {
            const stage = error instanceof WorkerFailure ? undefined : admissionFailureStage;
            await this.finishFromStartFailure(entry, error, stage);
            // A start cancelled by its own stop answers with the run it recorded
            // instead of an error: the caller asked for this ending and needs the ref.
            if (entry.stopping && entry.run.state !== 'running')
                return entry.run;
            throw error;
        }
    }
    /**
     * Stop one execution this Host holds. Only the Member who delegated it and the
     * Human may ask; the settings switch and current ownership are start conditions
     * and are deliberately not re-checked here. A run that already ended answers
     * with its real terminal state instead of stopping it twice.
     */
    async stop(workerRef, stopper) {
        const entry = this.runs.get(workerRef);
        if (entry === undefined)
            throw new WorkerRefusal('worker_unknown', `No Worker '${workerRef}' was started by this Host.`);
        this.assertMayStop(entry, stopper);
        if (entry.run.state !== 'running')
            return entry.run;
        const transaction = entry.stop ??= this.stopRun(entry);
        // The transaction outlives this wait: a caller that gave up must not cancel
        // the cleanup the engine is already carrying out.
        const done = await within(transaction.then(() => true), WORKER_STOP_DEADLINE_MS);
        if (done === undefined || entry.run.state === 'running') {
            throw new WorkerRefusal('worker_stop_pending', `Worker '${workerRef}' was asked to stop, but the engine has not confirmed `
                + `its cleanup within ${WORKER_STOP_DEADLINE_MS}ms; it is still stopping. Check the engine's process before starting another task.`);
        }
        if (entry.cleanupUnconfirmed) {
            throw new WorkerRefusal('worker_stop_unconfirmed', `Worker '${workerRef}' was asked to stop, but the engine did not `
                + 'confirm its cleanup, so it cannot be confirmed stopped. Check the engine\'s process before starting another task.');
        }
        try {
            await entry.record;
        }
        catch {
            throw new WorkerRefusal('worker_stop_unrecorded', `Worker '${workerRef}' stopped, but its ending could not be recorded; `
                + 'the Thread reports the result as unconfirmed.');
        }
        return entry.run;
    }
    /**
     * Deliver one instruction to a run's same native session. Only the Member who
     * delegated the run may ask; nothing here opens another native session or
     * reaches another run. A run that ended, is stopping, or has not opened its
     * engine session answers with that state instead of sending anything, and a
     * resent request id answers with the receipt the first call produced.
     */
    async steer(workerRef, steerer, request) {
        const instruction = request.instruction.trim();
        if (instruction === '')
            throw new WorkerRefusal('worker_steer_required', 'A steer needs the instruction the Worker should take on.');
        // The idempotency answer comes before the state checks: a resend answers with
        // the receipt the first call produced whether the run is still going or has
        // ended, and a changed instruction, another Member, or another Worker under
        // that id is refused either way.
        if (this.steeringByRequest.has(request.requestId) || this.deps.steerRequest(request.requestId) !== undefined) {
            const receipt = await this.steerReceipt([workerRef], steerer, request);
            if (receipt !== undefined)
                return receipt;
        }
        const entry = this.runs.get(workerRef);
        if (entry === undefined)
            throw new WorkerRefusal('worker_unknown', `No Worker '${workerRef}' was started by this Host.`);
        this.assertMaySteer(entry, steerer);
        if (this.stopped)
            throw new WorkerRefusal('worker_unavailable', 'The Team is unloading, so nothing was sent to the Worker.');
        const work = this.steerNew(entry, steerer, request, instruction);
        this.steerCalls.add(work);
        try {
            return await work;
        }
        finally {
            this.steerCalls.delete(work);
        }
    }
    async steerNew(entry, steerer, request, instruction) {
        const workerRef = entry.run.workerRef;
        const opening = entry.sessionId === undefined ? this.continuationOpenings.get(workerRef) : undefined;
        if (opening !== undefined)
            await opening;
        const textKey = this.steerTextKey(workerRef, entry.run.initiatedBy, instruction);
        const pendingText = this.steeringByText.get(textKey);
        if (pendingText !== undefined) {
            if (pendingText.requestId === request.requestId)
                return pendingText.outcome;
            const joined = await this.joinPendingText(steerer, request, pendingText.requestId, pendingText.outcome);
            if (joined !== undefined)
                return joined;
        }
        const alias = await this.steerTextAlias(steerer, request, { workerRef, initiatedBy: entry.run.initiatedBy, allowSubmitted: true });
        if (alias !== undefined)
            return alias;
        // The durable alias read may yield. A call that registered its canonical
        // admission in the meantime is the one native intent this text gets.
        const nowPending = this.steeringByText.get(textKey);
        if (nowPending !== undefined) {
            if (nowPending.requestId === request.requestId)
                return nowPending.outcome;
            const joined = await this.joinPendingText(steerer, request, nowPending.requestId, nowPending.outcome);
            if (joined !== undefined)
                return joined;
        }
        if (entry.run.state !== 'running') {
            throw new WorkerRefusal('worker_steer_ended', `Worker '${workerRef}' already ended: ${entry.run.state}; there is no live native `
                + 'session to deliver to.');
        }
        if (entry.stopping) {
            throw new WorkerRefusal('worker_steer_stopping', `Worker '${workerRef}' is stopping, so nothing was sent: a turn that is ending `
                + 'will not carry another instruction.');
        }
        const outcome = this.steerCanonical(entry, steerer, instruction, request.requestId);
        const pending = { instruction, workerRef, initiatedBy: entry.run.initiatedBy, outcome };
        this.steeringByRequest.set(request.requestId, pending);
        this.steeringByText.set(textKey, { requestId: request.requestId, outcome });
        try {
            return await outcome;
        }
        finally {
            if (this.steeringByRequest.get(request.requestId) === pending)
                this.steeringByRequest.delete(request.requestId);
            if (this.steeringByText.get(textKey)?.requestId === request.requestId)
                this.steeringByText.delete(textKey);
        }
    }
    /**
     * The receipt one request already earned somewhere in a continuation chain.
     * This is checked before deciding whether an ended tail should continue, so a
     * request-id retry answers the original submission and a changed instruction
     * still conflicts instead of accidentally opening a successor. Text dedupe
     * stays on the target execution: a fresh request id may intentionally repeat
     * an instruction in a later linked execution.
     */
    async steerReceipt(workerRefs, steerer, request) {
        const instruction = request.instruction.trim();
        const pending = this.steeringByRequest.get(request.requestId);
        if (pending !== undefined) {
            if (pending.instruction !== instruction)
                throw this.steerConflict(request.requestId);
            if (steerer.kind !== 'member' || steerer.memberId !== pending.initiatedBy
                || !workerRefs.includes(pending.workerRef))
                throw this.steerConflict(request.requestId);
            return pending.outcome;
        }
        const durable = this.deps.steerRequest(request.requestId);
        if (durable === undefined)
            return undefined;
        if (durable.kind === 'conflict')
            throw this.steerConflict(request.requestId);
        const memberId = steerer.kind === 'member' ? steerer.memberId : undefined;
        if (durable.instruction !== instruction || durable.initiatedBy !== memberId
            || (!workerRefs.includes(durable.workerRef)
                && (durable.continuedFrom === undefined || !workerRefs.includes(durable.continuedFrom)))) {
            throw this.steerConflict(request.requestId);
        }
        const outcome = this.deps.steerOutcome(request.requestId);
        if (outcome?.kind === 'submitted')
            return outcome.result;
        if (outcome?.kind === 'refused' || outcome?.kind === 'ambiguous') {
            throw new WorkerRefusal(outcome.refusal.code, outcome.refusal.message);
        }
        throw new WorkerRefusal('worker_steer_unconfirmed', `Request id '${request.requestId}' was admitted, but no steer outcome `
            + 'was confirmed before that Host ended. It will not be sent again automatically; start a new Worker if the instruction '
            + 'must run.');
    }
    steerConflict(requestId) {
        return new WorkerRefusal('worker_steer_conflict', `Request id '${requestId}' already carried another instruction `
            + 'to this Worker; send a changed instruction under a new request id.');
    }
    /**
     * Join an admitted instruction on one execution or one continuation source
     * under a fresh request id. This is the replay path: it reserves the alias in
     * the ledger and never reads native history or reaches an engine.
     */
    async steerTextAlias(steerer, request, query) {
        const instruction = request.instruction.trim();
        const canonical = this.deps.steerAdmissionsForText({ ...query, instruction })
            .find(admission => admission.outcome === undefined || admission.outcome.kind === 'ambiguous'
            || (query.allowSubmitted && admission.outcome.kind === 'submitted'));
        if (canonical === undefined)
            return undefined;
        if (steerer.kind !== 'member' || steerer.memberId !== canonical.initiatedBy) {
            throw this.steerConflict(request.requestId);
        }
        const pending = this.steeringByRequest.get(canonical.requestId)?.outcome
            ?? this.continuationOpenings.get(canonical.workerRef);
        if (pending !== undefined) {
            return this.joinPendingText(steerer, request, canonical.requestId, pending);
        }
        return this.aliasDurable(canonical.workspaceId, steerer, { requestId: request.requestId, instruction }, canonical);
    }
    steerTextKey(workerRef, initiatedBy, instruction) {
        return JSON.stringify([workerRef, initiatedBy, instruction]);
    }
    /**
     * Join a live same-text admission and reserve this request id as its durable
     * alias. An explicit refusal took nothing, so the caller may fall through and
     * make a fresh canonical admission under its own id.
     */
    async joinPendingText(steerer, request, canonicalRequestId, outcome) {
        try {
            await outcome;
        }
        catch {
            const canonical = this.deps.steerRequest(canonicalRequestId);
            if (canonical === undefined || canonical.kind === 'conflict')
                return undefined;
            if (this.deps.steerOutcome(canonicalRequestId)?.kind === 'refused')
                return undefined;
            return this.aliasDurable(canonical.workspaceId, steerer, request, canonical);
        }
        const canonical = this.deps.steerRequest(canonicalRequestId);
        if (canonical === undefined || canonical.kind === 'conflict')
            return undefined;
        return this.aliasDurable(canonical.workspaceId, steerer, request, canonical);
    }
    /** Reserve a same-text request id as a durable alias; this path never reaches the engine. */
    async aliasDurable(workspaceId, steerer, request, canonical) {
        let alias;
        try {
            alias = await this.admitSteer({
                requestId: request.requestId,
                actor: steerer,
                workspaceId,
                workerRef: canonical.workerRef,
                instruction: canonical.instruction,
                initiatedBy: canonical.initiatedBy,
                ...(canonical.continuedFrom === undefined ? {} : { continuedFrom: canonical.continuedFrom }),
                aliasOf: canonical.requestId,
            });
        }
        catch (error) {
            if (error instanceof WorkerRefusal)
                throw error;
            throw this.admissionFailure(request.requestId, canonical.instruction, canonical.workerRef, canonical.initiatedBy, `Request id '${request.requestId}' could not be recorded as an alias of the earlier steer; `
                + 'nothing was sent again.');
        }
        const outcome = this.deps.steerOutcome(alias.requestId) ?? this.deps.steerOutcome(canonical.requestId);
        if (outcome?.kind === 'submitted')
            return outcome.result;
        if (outcome?.kind === 'refused' || outcome?.kind === 'ambiguous') {
            throw new WorkerRefusal(outcome.refusal.code, outcome.refusal.message);
        }
        throw new WorkerRefusal('worker_steer_unconfirmed', `Request id '${request.requestId}' now aliases steer `
            + `'${canonical.requestId}', whose outcome was not confirmed before that Host ended. It will not be sent again automatically.`);
    }
    /**
     * Resume one cleanly ended execution as a new linked execution. This is the
     * only path that opens a native session after the source process is gone, and
     * it rechecks every current permission instead of inheriting the old grant.
     */
    async continueFrom(caller, source, request) {
        this.assertContinuationAllowed(caller, source);
        const resumeAnchors = this.deps.workerResumeAnchors(source.workerRef);
        if (resumeAnchors.length === 0) {
            throw new WorkerRefusal('worker_continuation_unavailable', `Worker '${source.workerRef}' recorded no resumable native session.`);
        }
        const key = resumeAnchors[0].nativeSessionId;
        const existing = this.continuations.get(key);
        if (existing !== undefined) {
            if (existing.requestId === request.requestId && existing.instruction !== request.instruction) {
                throw new WorkerRefusal('worker_steer_conflict', `Request id '${request.requestId}' already started a continuation with another `
                    + 'instruction.');
            }
            const joined = await existing.started;
            if (existing.requestId === request.requestId)
                return joined;
            return this.steer(joined.workerRef, caller.actor, request);
        }
        const workerRef = `worker:${randomUUID()}`;
        const opening = this.continueFromAdmitted(caller, source, request, workerRef, resumeAnchors);
        // Registered before the first await. Unload waits this promise even while
        // history is still being read or the opening record is still being written.
        this.continuationOpenings.set(workerRef, opening);
        this.continuations.set(key, { requestId: request.requestId, instruction: request.instruction, started: opening });
        try {
            return await opening;
        }
        finally {
            if (this.continuations.get(key)?.started === opening)
                this.continuations.delete(key);
            if (this.continuationOpenings.get(workerRef) === opening)
                this.continuationOpenings.delete(workerRef);
        }
    }
    /** Recheck the continuation's whole current grant after every asynchronous opening boundary. */
    assertContinuationAllowed(caller, source) {
        if (this.stopped)
            throw new WorkerRefusal('worker_unavailable', 'The Team is unloading, so no Worker can continue.');
        const config = this.deps.config();
        if (!config.enabled)
            throw new WorkerRefusal('worker_disabled', 'Worker delegation is switched off in the Team settings.');
        if (!this.deps.projectExists(source.projectRef)) {
            throw new WorkerRefusal('worker_project_unknown', `${source.projectRef} is not a Project in this Team.`);
        }
        if (!this.deps.projectActive(source.projectRef)) {
            throw new WorkerRefusal('worker_project_archived', `${source.projectRef} is archived, so it cannot receive a continued Worker.`);
        }
        if (!this.deps.memberEnabled(caller.actor.memberId)) {
            throw new WorkerRefusal('worker_member_unavailable', `Member '${caller.actor.memberId}' is not enabled, so it cannot continue a Worker.`);
        }
        if (!this.deps.projectOwners(source.projectRef).includes(caller.actor.memberId)) {
            throw new WorkerRefusal('worker_owner_required', `Only a current owner of ${source.projectRef} may continue Worker `
                + `'${source.workerRef}'.`);
        }
        const engineConfig = config.engines[source.engine];
        if (!engineConfig.enabled) {
            throw new WorkerRefusal('worker_engine_disabled', `Engine '${source.engine}' is not enabled in the Team settings.`);
        }
        if (source.state === 'running') {
            throw new WorkerRefusal('worker_unconfirmed', `Worker '${source.workerRef}' has no live handle in this Host, so its ending is `
                + 'unconfirmed and it cannot be continued.');
        }
        if (source.stage === 'dispose' || source.diagnostic?.includes(WORKER_CLEANUP_UNCONFIRMED_DIAGNOSTIC) === true) {
            throw new WorkerRefusal('worker_continuation_unclean', `Worker '${source.workerRef}' did not confirm its cleanup, so its native `
                + 'session cannot be resumed safely.');
        }
    }
    async continueFromAdmitted(caller, source, request, workerRef, resumeAnchors) {
        let resumeAnchor;
        let historyKind;
        for (const anchor of resumeAnchors) {
            const history = await readWorkerHistory({ engine: source.engine, ...anchor });
            historyKind = history.kind;
            if (history.kind === 'read') {
                resumeAnchor = anchor;
                break;
            }
        }
        if (resumeAnchor === undefined) {
            throw new WorkerRefusal('worker_continuation_unavailable', `Worker '${source.workerRef}' has no readable native record with `
                + `the expected session and turn (${historyKind ?? 'unpersisted'}).`);
        }
        const nativeSessionId = resumeAnchor.nativeSessionId;
        this.assertContinuationAllowed(caller, source);
        const existingRequest = this.deps.workerStartedByRequest(request.requestId);
        if (existingRequest !== undefined) {
            if (existingRequest.continuedFrom !== source.workerRef || existingRequest.task !== request.instruction
                || existingRequest.initiatedBy !== caller.actor.memberId) {
                throw new WorkerRefusal('worker_steer_conflict', `Request id '${request.requestId}' already started another execution; `
                    + 'use a new request id for this instruction.');
            }
            const live = this.runs.get(existingRequest.workerRef);
            if (live === undefined && existingRequest.state === 'running') {
                throw new WorkerRefusal('worker_unconfirmed', `Worker '${existingRequest.workerRef}' was started by a Host that no longer `
                    + 'holds its handle, so it cannot be steered.');
            }
            return Object.freeze({ workerRef: existingRequest.workerRef, engine: existingRequest.engine, state: 'started',
                continuedFrom: source.workerRef, runState: live === undefined ? existingRequest.state : this.liveState(existingRequest.workerRef) ?? existingRequest.state });
        }
        const workspaceId = this.deps.projectWorkspace(source.projectRef);
        if (workspaceId === undefined) {
            throw new WorkerRefusal('worker_project_unknown', `${source.projectRef} is not a Project in this Workspace.`);
        }
        const subagents = this.subagents();
        if (subagents === undefined)
            throw new WorkerRefusal('worker_unavailable', 'The Harness subagent service is not mounted, so no Worker can continue.');
        // No await may separate this final admission from registering the provider
        // and publishing the opening promise, so unload sees one or the other.
        this.assertContinuationAllowed(caller, source);
        let admission;
        try {
            admission = await this.admitSteer({
                requestId: request.requestId, actor: caller.actor, workspaceId, workerRef, instruction: request.instruction,
                initiatedBy: caller.actor.memberId, continuedFrom: source.workerRef,
            });
        }
        catch (error) {
            if (error instanceof WorkerRefusal)
                throw error;
            throw this.admissionFailure(request.requestId, request.instruction, workerRef, caller.actor.memberId, `Request id '${request.requestId}' could not be admitted durably, so the native session was not resumed.`);
        }
        if (this.stopped) {
            await this.recordSteerRefusal(admission.requestId, 'worker_unavailable', 'The Team began unloading before the native session could be resumed; nothing was delivered.');
        }
        let provider;
        let providerRelease;
        try {
            this.assertContinuationAllowed(caller, source);
            const providerName = `${WORKER_PROVIDER_NAMES[source.engine]}:resume:${randomUUID()}`;
            provider = new TeamWorkerProvider(providerName, () => ({ ...workerRunSpec(source.engine, this.deps.config(), this.deps.warn), resume: nativeSessionId }), { opened: (sessionId, steer) => { this.sessions.set(sessionId, steer); },
                closed: (sessionId) => { this.sessions.delete(sessionId); } });
            providerRelease = subagents.registerProvider(provider);
        }
        catch (error) {
            const code = error instanceof WorkerRefusal ? error.code : 'worker_unavailable';
            const message = error instanceof Error
                ? truncateToCharacters(error.message, 2000)
                : 'The resumed Worker could not be prepared; nothing was delivered.';
            return this.recordSteerRefusal(admission.requestId, code, message);
        }
        const startRequest = { requestId: request.requestId, workspaceId,
            projectRef: source.projectRef, ...(source.threadRef === undefined ? {} : { threadRef: source.threadRef }),
            ...(source.taskRef === undefined ? {} : { taskRef: source.taskRef }), engine: source.engine,
            task: request.instruction, cwd: source.cwd };
        const delegation = { initiator: caller.actor.memberId, workspaceId, projectRef: source.projectRef,
            ...(source.threadRef === undefined ? {} : { threadRef: source.threadRef }),
            ...(source.taskRef === undefined ? {} : { taskRef: source.taskRef }), engine: source.engine,
            task: request.instruction, cwd: source.cwd };
        const opened = this.open(caller, startRequest, { workerRef, engine: source.engine, cwd: source.cwd,
            provider, subagents, delegation, continuedFrom: source.workerRef,
            assertAdmitted: () => this.assertContinuationAllowed(caller, source),
        }).finally(providerRelease);
        const started = opened.then(async (run) => {
            const result = Object.freeze({ workerRef: run.workerRef, engine: run.engine, state: 'started',
                continuedFrom: source.workerRef, runState: this.liveState(run.workerRef) ?? run.state });
            await this.recordSteerOutcome(admission.requestId, { kind: 'submitted', result });
            return result;
        }, async (error) => {
            const message = error instanceof Error
                ? truncateToCharacters(error.message, 2000)
                : 'The resumed Worker did not confirm whether its opening instruction was delivered.';
            await this.recordSteerOutcome(admission.requestId, { kind: 'ambiguous',
                refusal: { code: 'worker_steer_unconfirmed', message } });
            throw error;
        });
        this.continuationOpenings.set(workerRef, started);
        try {
            const result = await started;
            return result;
        }
        finally {
            if (this.continuationOpenings.get(workerRef) === started)
                this.continuationOpenings.delete(workerRef);
        }
    }
    /**
     * The one live steer transaction: durable admission, then native input, then
     * durable outcome. A failure to store the outcome is reported as unconfirmed
     * even when the engine said it accepted, because a later Host must not send
     * the same instruction again on the strength of a lost receipt.
     */
    async steerCanonical(entry, steerer, instruction, requestId) {
        const { workerRef, engine } = entry.run;
        const workspaceId = this.deps.projectWorkspace(entry.run.projectRef);
        if (workspaceId === undefined)
            throw new WorkerRefusal('worker_project_unknown', `${entry.run.projectRef} is not a Project in this Workspace.`);
        // Durable admission may yield while the native turn is closing. Hold that
        // closing window before the first ledger await; delivery still happens only
        // after admission, and the hold is released on every outcome path.
        const initialSteer = entry.sessionId === undefined ? undefined : this.sessions.get(entry.sessionId);
        const releaseHold = initialSteer?.hold?.();
        try {
            let admission;
            try {
                admission = await this.admitSteer({ requestId, actor: steerer,
                    workspaceId, workerRef, instruction, initiatedBy: entry.run.initiatedBy });
            }
            catch (error) {
                if (error instanceof WorkerRefusal)
                    throw error;
                throw this.admissionFailure(requestId, instruction, workerRef, entry.run.initiatedBy, `Request id '${requestId}' could not be admitted durably, so nothing was sent to the Worker.`);
            }
            if (this.stopped) {
                return this.recordSteerRefusal(admission.requestId, 'worker_unavailable', 'The Team began unloading before the instruction could be sent; nothing was delivered.');
            }
            if (!held(entry) || entry.run.state !== 'running') {
                return this.recordSteerRefusal(admission.requestId, 'worker_steer_ended', `Worker '${workerRef}' ended before the admitted instruction could be sent; nothing was delivered.`);
            }
            const sessionId = entry.sessionId;
            if (sessionId === undefined) {
                return this.recordSteerRefusal(admission.requestId, 'worker_steer_not_ready', `Worker '${workerRef}' has not opened its engine session yet, so nothing was delivered.`);
            }
            if (!this.sessions.has(sessionId)) {
                return this.recordSteerRefusal(admission.requestId, 'worker_steer_no_active_turn', `Worker '${workerRef}' holds no live engine session any more, so nothing was delivered.`);
            }
            const steer = this.sessions.get(sessionId);
            if (steer === undefined) {
                return this.recordSteerRefusal(admission.requestId, 'worker_steer_unavailable', `Worker '${workerRef}' has no live delivery control, so nothing was delivered.`);
            }
            if (this.stopped) {
                return this.recordSteerRefusal(admission.requestId, 'worker_unavailable', 'The Team began unloading before the instruction could be sent; nothing was delivered.');
            }
            const outcome = await steer(instruction, randomUUID());
            if (outcome.kind === 'unavailable') {
                const reason = boundedSteerReason(outcome.reason);
                const message = `Worker '${workerRef}' did not take the instruction over (${outcome.code}): ${reason}`;
                if (outcome.delivery === 'unknown') {
                    return this.recordSteerAmbiguous(admission.requestId, message);
                }
                return this.recordSteerRefusal(admission.requestId, 'worker_steer_refused', message);
            }
            const result = Object.freeze({ workerRef, engine, state: 'submitted', landed: outcome.landed,
                ...(outcome.turnId === undefined ? {} : { turnId: outcome.turnId }),
                runState: this.liveState(workerRef) ?? entry.run.state });
            await this.recordSteerOutcome(admission.requestId, { kind: 'submitted', result });
            return result;
        }
        finally {
            releaseHold?.();
        }
    }
    async recordSteerRefusal(admissionRequestId, code, message) {
        await this.recordSteerOutcome(admissionRequestId, { kind: 'refused', refusal: { code, message } });
        throw new WorkerRefusal(code, message);
    }
    /** Distinguish a request-id collision found by a failed admission from a storage failure. */
    admissionFailure(requestId, instruction, workerRef, initiatedBy, message) {
        const existing = this.deps.steerRequest(requestId);
        if (existing?.kind === 'conflict' || (existing !== undefined
            && (existing.instruction !== instruction || existing.workerRef !== workerRef
                || existing.initiatedBy !== initiatedBy)))
            return this.steerConflict(requestId);
        return new WorkerRefusal('worker_unavailable', message);
    }
    async recordSteerAmbiguous(admissionRequestId, message) {
        await this.recordSteerOutcome(admissionRequestId, { kind: 'ambiguous',
            refusal: { code: 'worker_steer_unconfirmed', message } });
        throw new WorkerRefusal('worker_steer_unconfirmed', message);
    }
    async recordSteerOutcome(admissionRequestId, outcome) {
        if (this.steerPersistenceClosed) {
            throw new WorkerRefusal('worker_steer_unconfirmed', `Steer '${admissionRequestId}' could not be recorded before `
                + 'the Host closed its storage; its outcome is unconfirmed.');
        }
        try {
            await this.trackWrite(this.deps.recordSteerRecorded({ admissionRequestId, outcome }));
        }
        catch {
            throw new WorkerRefusal('worker_steer_unconfirmed', `Steer '${admissionRequestId}' may have reached the engine, but `
                + 'its outcome could not be recorded; it will not be sent again automatically.');
        }
    }
    /** Admit one steer before its native side effect, but never after unloading closes persistence. */
    admitSteer(write) {
        if (this.steerPersistenceClosed) {
            return Promise.reject(new WorkerRefusal('worker_unavailable', 'The Team began unloading before the steer could be admitted durably; nothing was delivered.'));
        }
        return this.trackWrite(this.deps.recordSteerAdmitted(write));
    }
    /** Keep one durable write visible to unload until it settles, whatever its verdict. */
    trackWrite(write) {
        const tracked = write.then(() => undefined, () => undefined);
        this.writes.add(tracked);
        void tracked.finally(() => { this.writes.delete(tracked); });
        return write;
    }
    /** Refuse a steer by anyone but the Member who delegated the run. */
    assertMaySteer(entry, steerer) {
        if (steerer.kind === 'member' && steerer.memberId === entry.run.initiatedBy)
            return;
        throw new WorkerRefusal('worker_steer_forbidden', `Only the Member who delegated Worker '${entry.run.workerRef}' may add an `
            + 'instruction to it.');
    }
    /**
     * Release the Team: refuse new starts, cancel every start still opening, stop
     * the runs this provider holds, wait for their endings, then release the
     * providers. A run that cannot confirm its ending within the deadline stays
     * `running` — which a later read reports as unconfirmed — and is sealed so no
     * late ending is written after the Host closes its storage.
     */
    async dispose() {
        this.stopped = true;
        // A start still writing its opening record is not in `runs` yet, so the
        // request is made twice: once now, and once after those writes land.
        this.requestStops();
        // A continuation's history read or opening-record write is an admission
        // boundary too. Wait those promises with ordinary starts so every late
        // handle is disposed while its provider is still registered and no durable
        // opening or ending is written after this Host closes storage.
        const opening = [
            ...[...this.starting.values()].map(start => start.started),
            ...this.continuationOpenings.values(),
            ...[...this.steeringByRequest.values()].map(pending => pending.outcome),
            ...this.steerCalls,
        ];
        await within(Promise.allSettled(opening), WORKER_SETTLE_DEADLINE_MS);
        // A steer call that outlasted the wait is left unconfirmed: from here no
        // later outcome may begin a write before storage closes below.
        this.steerPersistenceClosed = true;
        this.requestStops();
        // A start that lands after this snapshot is sealed by `open` itself: it opens
        // no engine, so it needs no disposal here.
        const held = [...this.runs.values()];
        for (const entry of held) {
            if (entry.run.state !== 'running' || entry.sealed)
                continue;
            const activation = entry.activation;
            if (activation !== undefined) {
                const disposal = entry.stopDisposal ??= activation.dispose();
                void disposal.catch(() => { });
            }
            const ended = await within(entry.terminated.promise.then(() => true), WORKER_SETTLE_DEADLINE_MS);
            if (ended === undefined && entry.run.state === 'running')
                this.seal(entry);
        }
        await Promise.allSettled(this.writes);
        for (const { release } of this.providers.values())
            release();
        this.providers.clear();
        // Nothing this Host held can be steered after it releases its runs.
        this.sessions.clear();
    }
    /** Ask every run this Host still holds to stop; a sealed run already has its one ending decided. */
    requestStops() {
        for (const entry of this.runs.values()) {
            if (entry.run.state !== 'running' || entry.sealed)
                continue;
            entry.stopping = true;
            entry.startup.abort();
        }
    }
    /** Refuse a stop by anyone but the Member who delegated the run and the Human. */
    assertMayStop(entry, stopper) {
        if (stopper.kind === 'human')
            return;
        if (stopper.kind === 'member' && stopper.memberId === entry.run.initiatedBy)
            return;
        throw new WorkerRefusal('worker_stop_forbidden', `Only the Member who delegated Worker '${entry.run.workerRef}' `
            + 'or the Human may stop it.');
    }
    /**
     * The one stop transaction: cancel a startup that has not published, dispose a
     * published activation, and wait for the settlement its own evidence decides.
     */
    async stopRun(entry) {
        entry.stopping = true;
        // Before publication the request signal is the only cancellation channel.
        entry.startup.abort();
        const activation = entry.activation;
        if (activation !== undefined) {
            const disposal = entry.stopDisposal ??= activation.dispose();
            // The result handler awaits this same promise for its verdict; a natural
            // ending that landed first does not need to surface it a second time.
            void disposal.catch(() => { });
        }
        await entry.terminated.promise;
    }
    /** Seal a run the Host released without an ending: its start stays, and no later write may claim one. */
    seal(entry) {
        if (entry.sealed)
            return;
        entry.sealed = true;
        this.deps.warn(`worker (${entry.run.engine}) ${entry.run.workerRef} was released without a confirmed ending; `
            + 'it stays unconfirmed and no late ending will be written after the Host closed its storage');
        entry.terminated.resolve();
    }
    /**
     * Decide one run's ending from the engine's own result. A stop that the engine
     * did not confirm is not reported as stopped: an aborted result whose disposal
     * rejected is the existing `failed` state with a reason that says what is
     * unknown, and a natural completion or failure that landed first keeps its
     * real state.
     */
    async finish(entry, result) {
        if (entry.sealed) {
            entry.terminated.resolve();
            return;
        }
        const output = answerTextOf(result.output);
        let state = result.stopReason === 'completed'
            ? 'completed' : result.stopReason === 'aborted' ? 'stopped' : 'failed';
        let diagnostic = result.stopReason === 'completed' || typeof result.diagnostic !== 'string' ? undefined : result.diagnostic;
        // The engine opened a session here, so a failure is either the turn itself or
        // the cleanup that followed it — never a start that never happened.
        const cleanupUnconfirmed = diagnostic?.includes(WORKER_CLEANUP_UNCONFIRMED_DIAGNOSTIC) === true;
        let stage = state === 'failed'
            ? cleanupUnconfirmed ? 'dispose' : 'turn'
            : undefined;
        if (cleanupUnconfirmed)
            entry.cleanupUnconfirmed = true;
        if (state === 'stopped' && entry.stopping && await this.disposalFailed(entry)) {
            state = 'failed';
            stage = 'dispose';
            entry.cleanupUnconfirmed = true;
            diagnostic = 'The stop was requested, but the engine did not confirm its cleanup, so the run cannot be '
                + 'confirmed stopped. Check the engine\'s process before starting another task.'
                + (diagnostic === undefined ? '' : ` (${diagnostic})`);
        }
        // The run's own anchors ride its ending: what a later read-only look-up needs
        // to find the engine's record, and where that record failed if it did. They
        // came back on the result object itself, so a run whose ending never reaches
        // this write leaves nothing behind to collect.
        const anchors = workerAnchorsOf(result);
        await this.settle(entry, state, {
            ...(anchors?.nativeSessionId === undefined ? {} : { nativeSessionId: anchors.nativeSessionId }),
            ...(anchors?.nativeTurnId === undefined ? {} : { nativeTurnId: anchors.nativeTurnId }),
            ...(anchors?.nativeTurnIds === undefined ? {} : { nativeTurnIds: anchors.nativeTurnIds }),
            ...(anchors?.nativeInputIds === undefined ? {} : { nativeInputIds: anchors.nativeInputIds }),
            ...(anchors?.nativeStorage === undefined ? {} : { nativeStorage: anchors.nativeStorage }),
            ...(stage === undefined ? {} : { stage }),
            ...(output === undefined ? {} : { output }),
            ...(diagnostic === undefined ? {} : { diagnostic }),
        })?.catch(() => { });
    }
    /** Decide the ending of a run whose engine never published: a cancelled start is a stop, everything else its real failure. */
    async finishFromStartFailure(entry, error, stage) {
        if (entry.sealed) {
            entry.terminated.resolve();
            return;
        }
        const cancelled = error instanceof WorkerFailure && error.stage === 'startup' && error.category === 'cancelled';
        const aborted = error instanceof Error && error.name === 'AbortError';
        const diagnostic = error instanceof Error ? error.message : 'The Worker could not start.';
        if (cancelled) {
            await this.settle(entry, 'stopped', {})?.catch(() => { });
            return;
        }
        // The manager can reject with the abort reason after rolling back a start it
        // owns; the engine may have opened, so a stop is not confirmed from that alone.
        const uncertain = entry.stopping && aborted;
        if (uncertain)
            entry.cleanupUnconfirmed = true;
        // The ending carries no native identity — a start that failed this way is
        // never handed one — so it names the stage it came apart in. A read can then
        // say the record holds no native session instead of guessing one back out of
        // the sentence, and it never claims the engine opened nothing.
        const failureStage = uncertain ? { stage: 'dispose' }
            : stage !== undefined ? { stage }
                : error instanceof WorkerFailure ? { stage: error.stage } : {};
        await this.settle(entry, 'failed', {
            ...failureStage,
            diagnostic: uncertain
                ? `${diagnostic} The stop was requested while the Worker was starting, but the Host could not confirm `
                    + `the engine stopped. ${WORKER_CLEANUP_UNCONFIRMED_DIAGNOSTIC}`
                : diagnostic,
        })?.catch(() => { });
    }
    /** Whether the cleanup a stop asked for ended in a rejection: the one piece of evidence that a stop is unconfirmed. */
    async disposalFailed(entry) {
        const disposal = entry.stopDisposal;
        if (disposal === undefined)
            return false;
        try {
            await disposal;
            return false;
        }
        catch {
            return true;
        }
    }
    /** Dispose an activation this execution may not keep, preserving a cleanup failure as its own verdict. */
    async discardActivationBeforeStart(entry, activation, reason) {
        const disposal = entry.stopDisposal ??= activation.dispose();
        void activation.result.catch(() => { });
        const cleanupFailure = await disposal.then(() => undefined, (error) => error);
        this.sessions.delete(activation.childId);
        if (cleanupFailure !== undefined) {
            entry.cleanupUnconfirmed = true;
            throw new WorkerFailure('dispose', 'unknown', { cause: new AggregateError([
                    reason instanceof Error ? reason : new Error(String(reason)),
                    cleanupFailure,
                ]) });
        }
        throw reason;
    }
    /**
     * Record one run's ending: the live view first, so the run stops reading as
     * live immediately, then the durable fact. A failed write leaves the record
     * `running`, which is exactly what a later read reports as unconfirmed.
     */
    settle(entry, state, facts) {
        if (entry.sealed) {
            entry.terminated.resolve();
            return undefined;
        }
        if (entry.run.state !== 'running')
            return undefined;
        const settledAt = nowIso();
        // The record's own ceilings are what the schema admits; a failure summary the
        // provider did not bound is cut here rather than refused on write.
        const diagnostic = facts.diagnostic === undefined
            ? undefined : truncateToCharacters(facts.diagnostic, WORKER_DIAGNOSTIC_MAX_CHARACTERS);
        const anchors = {
            ...facts.nativeSessionId === undefined ? {} : { nativeSessionId: facts.nativeSessionId },
            ...facts.nativeTurnId === undefined ? {} : { nativeTurnId: facts.nativeTurnId },
            ...facts.nativeTurnIds === undefined ? {} : { nativeTurnIds: Object.freeze([...facts.nativeTurnIds].slice(-WORKER_NATIVE_ANCHOR_LIMIT)) },
            ...facts.nativeInputIds === undefined ? {} : { nativeInputIds: Object.freeze([...facts.nativeInputIds].slice(-WORKER_NATIVE_ANCHOR_LIMIT)) },
            ...facts.nativeStorage === undefined ? {} : { nativeStorage: facts.nativeStorage },
            ...facts.stage === undefined ? {} : { stage: facts.stage },
        };
        entry.run = Object.freeze({
            ...entry.run, state, settledAt, ...anchors,
            ...diagnostic === undefined ? {} : { diagnostic },
        });
        const settlement = Object.freeze({ workerRef: entry.run.workerRef, state, settledAt, ...anchors,
            ...(facts.output === undefined ? {} : { output: facts.output }),
            ...(diagnostic === undefined ? {} : { diagnostic }) });
        const write = this.deps.recordSettled({ requestId: entry.settleRequestId, settlement });
        entry.record = write;
        const guarded = write.catch((error) => {
            this.deps.warn(`worker (${entry.run.engine}) ${entry.run.workerRef} ended without a recorded result: `
                + `${error instanceof Error ? error.message : String(error)}; the Thread reports it as unconfirmed`);
        });
        this.writes.add(guarded);
        void guarded.finally(() => {
            this.writes.delete(guarded);
            entry.terminated.resolve();
        });
        return write;
    }
    require(workerRef) {
        const entry = this.runs.get(workerRef);
        if (entry === undefined)
            throw new WorkerRefusal('worker_unknown', `No Worker '${workerRef}' was started by this Host.`);
        return entry.run;
    }
    subagents() {
        return this.ctx.get('subagents');
    }
    providerFor(engine, subagents) {
        const existing = this.providers.get(engine);
        if (existing !== undefined)
            return existing.provider;
        // The row is read when a session opens, not when the provider registers: a
        // saved executable, engine switch, or policy must reach the next delegation.
        const provider = new TeamWorkerProvider(WORKER_PROVIDER_NAMES[engine], () => workerRunSpec(engine, this.deps.config(), this.deps.warn), {
            opened: (sessionId, steer) => { this.sessions.set(sessionId, steer); },
            closed: (sessionId) => { this.sessions.delete(sessionId); },
        });
        const release = subagents.registerProvider(provider);
        this.providers.set(engine, { release, provider });
        return provider;
    }
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
export const WORKER_RUN_LIST_LIMIT = 5;
/**
 * The window of one Member's ended runs the Human's list shows: the newest
 * endings, not the newest starts. A run that began early and failed only now is
 * exactly the record the Human is looking for, so it must outrank a short run
 * that started later and ended long before it.
 */
export function newestEndedRuns(executions, limit) {
    return Object.freeze([...executions]
        .sort((left, right) => endingAt(right) - endingAt(left))
        .slice(0, limit));
}
/** When a run ended. A settled record always carries it; the start is only a fallback for one that does not. */
function endingAt(execution) {
    return Date.parse(execution.settledAt ?? execution.startedAt);
}
/** A single-line, bounded preview of a run's task for the Human's run list; the record keeps the full text. */
export function workerTaskPreview(task) {
    return truncateToCharacters(task.replaceAll(/\s+/gu, ' ').trim(), WORKER_TASK_PREVIEW_MAX_CHARACTERS);
}
/** The run one delegation starts on an engine, read from the row as it stands at that open. */
export function workerRunSpec(engine, config, warn) {
    return {
        engine,
        env: workerEnvironment(engine, config.engines[engine]),
        launchArgs: [],
        ...config.timeoutMs > 0 ? { timeoutMs: config.timeoutMs } : {},
        onError: (error, stopReason) => { warn(`worker (${engine}) ${stopReason}: ${error.message}`); },
    };
}
/** What the Worker's launch carries: the executable OAR resolves the installation by, and the Codex policy the runtime provider applies at open. */
export function workerEnvironment(engine, config) {
    const env = {};
    if (config.executable.trim() !== '')
        env[engine === 'codex' ? 'OAR_CODEX_BIN' : 'OAR_CLAUDE_BIN'] = config.executable.trim();
    if (engine === 'codex' && config.sandbox.trim() !== '')
        env.OAR_CODEX_SANDBOX = config.sandbox.trim();
    return Object.freeze(env);
}
