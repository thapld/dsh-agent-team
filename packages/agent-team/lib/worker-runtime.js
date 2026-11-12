/**
 * The Team-owned Worker provider: one OAR-backed external execution per delegation.
 *
 * The sequence follows the Harness OAR provider; Team owns its copy because a
 * Worker must expose its native identity, which a one-shot contract does not.
 * @module @contexera/dsh-agent-team/worker-runtime
 */
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { SessionId } from '@deepseek-ai/dsh-session';
import { assertUsableCwd, settleRunResult, subprocessRunHandle, } from '@deepseek-ai/dsh-subagent';
/** The registry name each engine's provider registers under. */
export const WORKER_PROVIDER_NAMES = Object.freeze({
    codex: 'team-worker-codex',
    claude: 'team-worker-claude',
});
const failureAdvice = {
    'engine-unavailable': 'The OAR library is not installed, so no Worker can start.',
    installation: 'Install and authenticate the selected engine before retrying.',
    startup: 'Check the engine installation, authentication, and launch settings.',
    turn: 'Check the selected engine and its account before retrying.',
    abort: 'The engine did not accept interruption; session disposal was requested.',
    dispose: 'The engine may still be active; check it before starting another task.',
};
export class WorkerFailure extends Error {
    stage;
    category;
    constructor(stage, category, options) {
        super(`Team Worker failure (stage: ${stage}; category: ${category}). ${failureAdvice[stage]}`, options);
        this.stage = stage;
        this.category = category;
        this.name = 'WorkerFailure';
    }
}
/**
 * The Team-private key the anchors ride on, so they travel with the one object
 * the Harness hands back instead of through a process-local map: a map would leak
 * an entry for every run whose ending never reaches the write (a sealed run, a
 * late result) and would need taking before anyone could read it. A symbol keeps
 * the property out of every ordinary view of the result — it is not enumerable
 * JSON, not a field a notice reads, and not something another provider can set by
 * accident.
 */
const WORKER_ANCHORS = Symbol('@contexera/dsh-agent-team/worker-anchors');
/** The anchors one run carried on its own result, validated so a foreign object cannot shape them. */
export function workerAnchorsOf(result) {
    const carried = result[WORKER_ANCHORS];
    if (carried === null || typeof carried !== 'object')
        return undefined;
    const anchors = carried;
    if (typeof anchors.nativeSessionId !== 'string' || anchors.nativeSessionId === '')
        return undefined;
    return Object.freeze({ nativeSessionId: anchors.nativeSessionId,
        ...(typeof anchors.nativeTurnId === 'string' && anchors.nativeTurnId !== '' ? { nativeTurnId: anchors.nativeTurnId } : {}),
        ...(Array.isArray(anchors.nativeTurnIds)
            ? { nativeTurnIds: Object.freeze(anchors.nativeTurnIds.filter((id) => typeof id === 'string' && id !== '')) }
            : {}),
        ...(Array.isArray(anchors.nativeInputIds)
            ? { nativeInputIds: Object.freeze(anchors.nativeInputIds.filter((id) => typeof id === 'string' && id !== '')) }
            : {}),
        ...(typeof anchors.nativeStorage === 'string' && anchors.nativeStorage !== '' ? { nativeStorage: anchors.nativeStorage } : {}) });
}
/**
 * Attach what the engine said about its own record to the result it produced.
 * Capturing is a diagnostic aid: a runtime that cannot answer costs the look-up
 * and never the run's own outcome, so every failure here returns the result
 * exactly as the engine settled it.
 */
export function carryWorkerAnchors(outcome, anchors) {
    if (anchors === undefined)
        return outcome;
    try {
        const carried = { ...outcome };
        // A spread keeps every field the Harness settled with; the symbol key is
        // invisible to JSON, `Object.keys`, and any notice that reads the result.
        Object.defineProperty(carried, WORKER_ANCHORS, { value: anchors, enumerable: false });
        return carried;
    }
    catch {
        return outcome;
    }
}
/** How long a native turn id may be before this Team refuses to carry it. */
const WORKER_TURN_ID_MAX_CHARACTERS = 256;
/**
 * The turn the engine said it steered into, taken from its own acknowledgement.
 * An id this Team will not carry is dropped rather than shortened: a cut id names
 * a turn that does not exist.
 */
function steeredTurnId(native) {
    if (native === null || typeof native !== 'object')
        return undefined;
    const turnId = native.turnId;
    return typeof turnId === 'string' && turnId !== '' && turnId.length <= WORKER_TURN_ID_MAX_CHARACTERS ? turnId : undefined;
}
/**
 * The Team-private key one run's steer channel rides on, for the same reason the
 * anchors do: the channel belongs to the run, so it travels on the object that
 * run published instead of through a map keyed by a session that outlives it.
 */
const WORKER_STEER = Symbol('@contexera/dsh-agent-team/worker-steer');
/** One run's delivery channel, or nothing when its provider published no control. */
export function workerSteerOf(run) {
    const carried = run[WORKER_STEER];
    return typeof carried === 'function' ? carried : undefined;
}
/**
 * The native record's own path, taken from the frame in which the engine
 * reported it. Codex states it on `thread/start` and repeats it on
 * `thread/started`, and restates it when `thread/resume` reopens an existing
 * thread; a runtime that names no path yields none, and the look-up then says
 * so instead of guessing a location.
 */
function nativeThreadPath(body) {
    if (body.type !== 'thread/start' && body.type !== 'thread/started' && body.type !== 'thread/resume')
        return undefined;
    const native = body.native;
    if (native === null || typeof native !== 'object')
        return undefined;
    const thread = native.thread;
    if (thread === null || typeof thread !== 'object')
        return undefined;
    const path = thread.path;
    return typeof path === 'string' && path !== '' ? path : undefined;
}
/**
 * The working directory the released Claude Code CLI reports for the session it
 * opened. It is the directory the CLI named the session's project by, which is
 * what its record path is derived from; a session that has not reported one yet
 * falls back to the directory the run was opened in.
 */
function nativeClaudeCwd(body) {
    if (body.type !== 'system/init')
        return undefined;
    const native = body.native;
    if (native === null || typeof native !== 'object')
        return undefined;
    const cwd = native.cwd;
    return typeof cwd === 'string' && cwd !== '' ? cwd : undefined;
}
/**
 * The environment the engine's child process actually receives: OAR starts it
 * from the Host's own environment with the row's overlay applied, where a null
 * removes a name. Claude derives its record directory from `CLAUDE_CONFIG_DIR`
 * and `HOME`, so the anchors have to read the same values the child did — the
 * Host's own `process.env` is only one half of that.
 */
function effectiveEnvironment(env) {
    const merged = { ...process.env };
    for (const [name, value] of Object.entries(env)) {
        if (value === null)
            delete merged[name];
        else
            merged[name] = value;
    }
    return merged;
}
/** The spelling Node selects for one environment name, which Windows makes case-insensitive. */
function environmentValue(env, name) {
    if (process.platform !== 'win32')
        return env[name];
    const key = Object.keys(env).filter(entry => entry.toUpperCase() === name).sort()[0];
    return key === undefined ? undefined : env[key];
}
/**
 * Where the released Claude Code CLI keeps one session's own record. The CLI
 * names the project directory after its working directory (every character
 * outside `[A-Za-z0-9]` becomes `-`) and the file after the session id, under
 * `CLAUDE_CONFIG_DIR` or `$HOME/.claude`. The path is derived, not reported: the
 * CLI's stream carries no record location, so the derivation reads the same
 * environment the child was opened with. A wrong guess reads nothing and the
 * look-up says the record is missing rather than searching for another file.
 */
function claudeRecordPath(cwd, sessionId, env) {
    const home = environmentValue(env, process.platform === 'win32' ? 'USERPROFILE' : 'HOME');
    const configured = environmentValue(env, 'CLAUDE_CONFIG_DIR');
    const config = configured === undefined || configured.trim() === ''
        ? join(home === undefined || home === '' ? homedir() : resolve(cwd, home), '.claude')
        : resolve(cwd, configured);
    return join(config, 'projects', cwd.replaceAll(/[^A-Za-z0-9]/gu, '-'), `${sessionId}.jsonl`);
}
/**
 * Read one open session's anchors off its own record stream, bound to the input
 * this run submitted. Codex associates each proven root span with an owned input;
 * without input evidence only a single unambiguous root span is usable. Multiple
 * unproven spans are not this execution's turns merely because they came later.
 * Claude has no turn
 * object: its record names the turn by the prompting user message, which OAR
 * writes with the input id this run generated, so that id is the turn anchor.
 */
function anchorsOf(session, inputSeq, engine, cwd, inputId, inputIds, env) {
    let nativeStorage;
    let reportedCwd;
    const evidence = new Map();
    const ownedInputs = new Set(inputIds);
    for (const record of session.records()) {
        if (record.sessionId !== session.id || record.agentPath.length !== 0)
            continue;
        if (record.kind === 'frame') {
            if (engine === 'codex')
                nativeStorage ??= nativeThreadPath(record.body);
            else
                reportedCwd ??= nativeClaudeCwd(record.body);
            for (const event of record.body.events) {
                if (event.kind !== 'user_message' || event.inputId === undefined || !ownedInputs.has(event.inputId))
                    continue;
                if (record.spanId === undefined || record.spanId === '')
                    continue;
                const inputs = evidence.get(record.spanId) ?? new Set();
                inputs.add(event.inputId);
                evidence.set(record.spanId, inputs);
            }
        }
    }
    if (engine === 'claude')
        nativeStorage = claudeRecordPath(reportedCwd ?? cwd, session.id, env);
    const fallbackCodexTurns = new Set();
    if (engine === 'codex' && inputSeq !== undefined) {
        for (const record of session.records()) {
            if (record.sessionId !== session.id || record.agentPath.length !== 0 || record.seq <= inputSeq
                || record.spanId === undefined || record.spanId === '')
                continue;
            fallbackCodexTurns.add(record.spanId);
        }
    }
    const nativeTurnIds = engine === 'claude' ? inputIds
        : evidence.size > 0 ? [...evidence.keys()] : fallbackCodexTurns.size === 1 ? [...fallbackCodexTurns] : [];
    const turn = engine === 'claude'
        ? (inputSeq === undefined ? undefined : inputId)
        : nativeTurnIds.length === 1 ? nativeTurnIds[0] : undefined;
    return Object.freeze({ nativeSessionId: session.id,
        ...(turn === undefined ? {} : { nativeTurnId: turn }),
        ...(nativeTurnIds.length === 0 ? {} : { nativeTurnIds: Object.freeze(nativeTurnIds) }),
        ...(inputIds.length === 0 ? {} : { nativeInputIds: Object.freeze([...inputIds]) }),
        ...(nativeStorage === undefined ? {} : { nativeStorage }) });
}
/**
 * The one diagnostic a Worker hands the Harness when the engine could not
 * confirm its own disposal. The Harness waits for teardown but keeps the result
 * it captured for the parent, so this text has to ride that result: Team reads
 * it back to report the stop as unconfirmed instead of as stopped.
 */
export const WORKER_CLEANUP_UNCONFIRMED_DIAGNOSTIC = new WorkerFailure('dispose', 'unknown').message;
/**
 * OAR is loaded on demand: the Host boots, and every ordinary Session works,
 * without the library or the Node version it requires.
 */
let observeModule;
async function awaitTurnEndOf() {
    observeModule ??= await import('@botiverse/oar/observe');
    return observeModule.awaitTurnEnd;
}
export async function engineRuntime(engine) {
    let oar;
    try {
        oar = await import('@botiverse/oar');
    }
    catch (error) {
        throw new WorkerFailure('engine-unavailable', 'unsupported', { cause: error });
    }
    return engine === 'codex' ? oar.codexRuntime : oar.claudeRuntime;
}
/** The task text, refused before a native session exists when it is not plain text. */
export function textTask(prompt) {
    if (prompt.length === 0)
        throw new Error('team-worker: the task must not be empty');
    const texts = [];
    for (const block of prompt) {
        if (block.type !== 'text')
            throw new Error('team-worker: the task must contain only text');
        texts.push(block.text);
    }
    if (texts.every(text => text.trim().length === 0))
        throw new Error('team-worker: the task must not be empty');
    return texts.join('');
}
function cancellationFailure() {
    return new WorkerFailure('startup', 'cancelled');
}
function completedTurn(outcome, output) {
    switch (outcome.kind) {
        case 'completed': return { output, stopReason: 'completed' };
        case 'aborted': return { output, stopReason: 'aborted' };
        case 'failed': return { output, stopReason: 'error', diagnostic: new WorkerFailure('turn', outcome.failure).message };
    }
}
// Native cleanup must confirm before publication, but cannot pin the Host forever.
const WORKER_CLEANUP_DEADLINE_MS = 5_000;
async function disposeSession(session, spec) {
    let timer;
    try {
        await Promise.race([
            session.dispose(),
            new Promise((_resolve, reject) => {
                timer = setTimeout(() => { reject(new Error('Native cleanup did not confirm before its deadline.')); }, WORKER_CLEANUP_DEADLINE_MS);
            }),
        ]);
    }
    catch (error) {
        const failure = new WorkerFailure('dispose', 'unknown', { cause: error });
        spec.onError?.(failure, 'error');
        throw failure;
    }
    finally {
        clearTimeout(timer);
    }
}
function publishRun(session, prompt, request, spec, cwd) {
    const stopped = Promise.withResolvers();
    const messages = new Map();
    let streamedText = '';
    let phase = 'running';
    let disposal;
    // The anchors this run owns, captured while its session is still open: an
    // engine closes its record stream as it tears down, so a capture taken after
    // the abort or the cleanup would find nothing left to read.
    let inputSeq;
    let promptInputId;
    // The native conversation is known as soon as the session opens, even if its
    // record stream is empty or a later capture fails. Turn and storage evidence
    // still comes only from `anchorsOf`; neither is guessed from the external id.
    let anchors = Object.freeze({ nativeSessionId: session.id });
    const ownedInputIds = [];
    const acceptedInputs = new Map();
    const inputTurnIds = new Map();
    let latestAcceptedTurnOutcome;
    let followUpFailure;
    let deliveriesInFlight = 0;
    const deliveryWaiters = new Set();
    // The environment this run's engine was opened with, read once: the anchors
    // derive Claude's record directory from it after the session is gone.
    const childEnv = effectiveEnvironment(spec.env);
    const captureAnchors = () => {
        try {
            anchors = anchorsOf(session, inputSeq, spec.engine, cwd, promptInputId, ownedInputIds, childEnv);
        }
        catch {
            // A session that cannot answer costs the look-up, never the run's ending.
        }
    };
    const noteDeliverySettled = () => {
        deliveriesInFlight -= 1;
        if (deliveriesInFlight !== 0)
            return;
        for (const wake of deliveryWaiters)
            wake();
        deliveryWaiters.clear();
    };
    const waitForDeliveries = async () => {
        if (deliveriesInFlight === 0)
            return;
        await new Promise(resolve => { deliveryWaiters.add(resolve); });
    };
    /**
     * The public stream is the evidence for which of this execution's inputs the
     * native turn actually consumed. A steer that landed in the running turn and
     * one that opened a later turn therefore leave the same kind of receipt.
     */
    const consumeInputEvidence = (afterSeq) => {
        let through = afterSeq;
        for (const record of session.records()) {
            if (record.seq <= afterSeq || record.sessionId !== session.id || record.agentPath.length !== 0)
                continue;
            through = Math.max(through, record.seq);
            if (record.kind !== 'frame')
                continue;
            for (const event of record.body.events) {
                if (event.kind === 'user_message' && event.inputId !== undefined) {
                    const accepted = acceptedInputs.get(event.inputId);
                    const turnId = event.turnId ?? record.spanId;
                    if (turnId !== undefined) {
                        inputTurnIds.set(event.inputId, turnId);
                        if (accepted !== undefined)
                            acceptedInputs.set(event.inputId, { ...accepted, turnId });
                    }
                    continue;
                }
                if (event.kind === 'input_dropped') {
                    if (event.inputId !== undefined)
                        acceptedInputs.delete(event.inputId);
                    followUpFailure ??= 'The native session dropped an accepted follow-up instruction.';
                    continue;
                }
                if (event.kind === 'turn_ended') {
                    let consumedAccepted = false;
                    if (event.inputId !== undefined && acceptedInputs.delete(event.inputId))
                        consumedAccepted = true;
                    for (const inputId of event.inputIds ?? []) {
                        if (acceptedInputs.delete(inputId))
                            consumedAccepted = true;
                    }
                    if (record.spanId !== undefined) {
                        for (const [inputId, accepted] of acceptedInputs) {
                            if (accepted.turnId === record.spanId) {
                                acceptedInputs.delete(inputId);
                                consumedAccepted = true;
                            }
                        }
                    }
                    if (consumedAccepted)
                        latestAcceptedTurnOutcome = event.outcome;
                }
            }
            // Claude reports command lifecycles as native frames even when OAR's
            // prompt-input projection does not recognize a steer UUID.
            const native = record.body.native;
            if (native !== null && typeof native === 'object') {
                const lifecycle = native;
                if (lifecycle.type === 'command_lifecycle' && lifecycle.state === 'cancelled'
                    && typeof lifecycle.command_uuid === 'string' && acceptedInputs.delete(lifecycle.command_uuid)) {
                    followUpFailure ??= 'The native session cancelled an accepted follow-up instruction.';
                }
            }
        }
        return through;
    };
    const collectOutput = () => {
        let answer = streamedText;
        for (const text of messages.values()) {
            if (text.length > 0)
                answer = text;
        }
        return answer.length === 0 ? [] : [{ type: 'text', text: answer }];
    };
    const dispose = () => disposal ??= disposeSession(session, spec);
    const interrupt = (reason) => {
        if (phase !== 'running')
            return;
        // Before the abort and the disposal below: this is the last moment the
        // engine's own record stream is still there to answer.
        captureAnchors();
        phase = reason;
        stopped.resolve({
            output: collectOutput(),
            stopReason: reason === 'cancelled' ? 'aborted' : 'error',
            ...reason === 'timeout' ? { diagnostic: 'The Worker exceeded its execution timeout.' } : {},
        });
        void session.abort().catch(() => { });
        void dispose().catch(() => { });
    };
    const onAbort = () => { interrupt('cancelled'); };
    /**
     * OAR's public delivery chooses steer, queue or a new prompt from the native
     * status and retries across the status race. Team supplies its own UUID because
     * the Team request id is not a native identity, and records every accepted id
     * so the monitor knows which later turn still belongs to this execution.
     */
    const steer = async (instruction, inputId) => {
        if (phase !== 'running') {
            return { kind: 'unavailable', code: 'no_active_turn', delivery: 'rejected', reason: 'the run is no longer running' };
        }
        deliveriesInFlight += 1;
        try {
            const answer = await session.deliver(instruction, { inputId, when: 'now', origin: { kind: 'user' } });
            if (answer.landed !== 'rejected') {
                if (!ownedInputIds.includes(inputId))
                    ownedInputIds.push(inputId);
                const turnId = answer.result.kind === 'accepted'
                    ? steeredTurnId(answer.result.response.body.kind === 'accepted' ? answer.result.response.body.native : undefined)
                    : undefined;
                acceptedInputs.set(inputId, { landed: answer.landed, ...(turnId === undefined ? {} : { turnId }) });
                return { kind: 'submitted', inputId, landed: answer.landed,
                    ...(turnId === undefined ? {} : { turnId }) };
            }
            return { kind: 'unavailable', code: answer.code, delivery: 'rejected', reason: answer.reason };
        }
        catch (error) {
            return { kind: 'unavailable', code: 'error', delivery: 'unknown',
                reason: error instanceof Error ? error.message : String(error) };
        }
        finally {
            noteDeliverySettled();
        }
    };
    Object.defineProperty(steer, 'hold', { enumerable: false, value: () => {
            if (phase !== 'running')
                return undefined;
            deliveriesInFlight += 1;
            let released = false;
            return () => {
                if (released)
                    return;
                released = true;
                noteDeliverySettled();
            };
        } });
    const unsubscribe = session.events((event) => {
        if (event.sessionId !== session.id || event.agentPath.length !== 0 || event.kind !== 'text_delta')
            return;
        streamedText += event.text;
        if (event.messageId !== undefined)
            messages.set(event.messageId, (messages.get(event.messageId) ?? '') + event.text);
    }, { cursor: { sessionId: session.id, afterSeq: -1 } });
    request.signal.addEventListener('abort', onAbort, { once: true });
    if (request.signal.aborted)
        onAbort();
    const timer = spec.timeoutMs === undefined ? undefined : setTimeout(() => { interrupt('timeout'); }, spec.timeoutMs);
    const runTurn = async () => {
        promptInputId = randomUUID();
        ownedInputIds.push(promptInputId);
        const admitted = await session.prompt(prompt, { inputId: promptInputId });
        if (admitted.kind === 'rejected') {
            return { output: collectOutput(), stopReason: 'error', diagnostic: new WorkerFailure('turn', admitted.code).message };
        }
        // The turn this run drives is the one after its own input, so the capture
        // reads the record from here on and never another root turn's span.
        inputSeq = admitted.seq;
        const awaitTurnEnd = await awaitTurnEndOf();
        let waitAfter = admitted.seq;
        let evidenceAfter = admitted.seq;
        const turnIdFor = (inputId) => {
            const known = inputTurnIds.get(inputId);
            if (known !== undefined)
                return known;
            for (const record of session.records()) {
                if (record.sessionId !== session.id || record.agentPath.length !== 0 || record.kind !== 'frame')
                    continue;
                for (const event of record.body.events) {
                    if (event.kind === 'user_message' && event.inputId === inputId) {
                        const turnId = event.turnId ?? record.spanId;
                        if (turnId !== undefined) {
                            inputTurnIds.set(inputId, turnId);
                            return turnId;
                        }
                    }
                }
            }
            return undefined;
        };
        const matchingTurnEnd = (afterSeq, inputId) => {
            const turnId = turnIdFor(inputId);
            for (const record of session.records()) {
                if (record.seq <= afterSeq || record.sessionId !== session.id || record.agentPath.length !== 0
                    || record.kind !== 'frame')
                    continue;
                for (const event of record.body.events) {
                    if (event.kind !== 'turn_ended')
                        continue;
                    if (event.inputId === inputId || event.inputIds?.includes(inputId) === true
                        || (turnId !== undefined && record.spanId === turnId)) {
                        return { seq: record.seq, outcome: event.outcome };
                    }
                }
            }
            return undefined;
        };
        const lastTurnEndSeq = (afterSeq) => {
            let found;
            for (const record of session.records()) {
                if (record.seq <= afterSeq || record.sessionId !== session.id || record.agentPath.length !== 0
                    || record.kind !== 'frame')
                    continue;
                if (record.body.events.some(event => event.kind === 'turn_ended'))
                    found = record.seq;
            }
            return found;
        };
        const nativeEndReason = () => {
            for (const record of session.records()) {
                if (record.seq <= (inputSeq ?? 0) || record.sessionId !== session.id || record.agentPath.length !== 0
                    || record.kind !== 'response')
                    continue;
                if (record.body.kind === 'released')
                    return 'the native session was released';
                if (record.body.kind === 'exited')
                    return record.body.reason ?? 'the native runtime exited';
            }
            return undefined;
        };
        const awaitEnd = async (inputId) => {
            const already = matchingTurnEnd(waitAfter, inputId);
            if (already !== undefined) {
                waitAfter = already.seq;
                return already.outcome;
            }
            let outcome = await awaitTurnEnd(session, waitAfter, inputId);
            // A native handled receipt is not a turn end: keep waiting for the turn it belongs to.
            while (outcome.kind === 'handled') {
                waitAfter = Math.max(waitAfter, outcome.seq);
                outcome = await awaitTurnEnd(session, waitAfter, inputId);
            }
            const matched = matchingTurnEnd(waitAfter, inputId);
            if (matched !== undefined)
                waitAfter = matched.seq;
            else {
                // Release/exited can end a wait without a native turn frame. Advance over
                // the last recorded end only when there is no input-scoped match; never
                // skip a later owned end that was already in the retained log.
                waitAfter = lastTurnEndSeq(waitAfter) ?? Math.max(waitAfter, session.records().at(-1)?.seq ?? waitAfter);
            }
            return outcome;
        };
        let outcome = await awaitEnd(promptInputId);
        // Every accepted follow-up is part of this one execution. A turn may have
        // consumed some in-turn; anything left owns a later native turn.
        while (phase === 'running') {
            // Do not await a resolved "nothing in flight" promise here: the check and
            // the closing assignment below must be one synchronous window. A steer
            // that starts in the preceding microtask has already incremented the
            // counter, so it is either awaited or refused after the window closes.
            if (deliveriesInFlight > 0) {
                await waitForDeliveries();
                continue;
            }
            // Native events can precede their delivery acknowledgment. Do not advance
            // this cursor until every in-flight input is known: otherwise its ending
            // could be consumed before acceptedInputs contains the input it completes.
            evidenceAfter = consumeInputEvidence(evidenceAfter);
            if (acceptedInputs.size === 0)
                break;
            const ended = nativeEndReason();
            if (ended !== undefined) {
                acceptedInputs.clear();
                followUpFailure ??= `The native session ended before confirming an accepted follow-up instruction (${ended}).`;
                break;
            }
            const nextInputId = acceptedInputs.keys().next().value;
            if (nextInputId === undefined)
                break;
            outcome = await awaitEnd(nextInputId);
        }
        // A closing window is the linearization point between the final accepted
        // turn and a later steer. Once it is taken, no input can be acknowledged
        // after this execution has decided it has nothing left to await.
        if (phase === 'running')
            phase = 'closing';
        if (latestAcceptedTurnOutcome !== undefined)
            outcome = latestAcceptedTurnOutcome;
        const turn = completedTurn(outcome, collectOutput());
        if (followUpFailure !== undefined && turn.stopReason !== 'aborted') {
            return { output: turn.output, stopReason: 'error', diagnostic: followUpFailure };
        }
        captureAnchors();
        return turn;
    };
    const settled = settleRunResult({
        attempt: async () => {
            if (phase !== 'running')
                return stopped.promise;
            try {
                return await Promise.race([runTurn(), stopped.promise]);
            }
            catch (error) {
                throw new WorkerFailure('turn', 'unknown', { cause: error });
            }
        },
        collectOutput,
        collectDiagnostic: () => new WorkerFailure('turn', 'unknown').message,
        cancelled: () => phase === 'cancelled',
        ...spec.onError === undefined ? {} : { onError: spec.onError },
        signal: request.signal,
        onAbort,
    }).finally(() => {
        clearTimeout(timer);
        unsubscribe();
        if (phase === 'running' || phase === 'closing')
            phase = 'settled';
        // Every settlement path passes here, and it is still before the Harness's
        // teardown: a turn whose own wait threw, a prompt the engine refused, and a
        // transport that failed all keep the native identities the session could
        // still name. The cancel path captured earlier, and this is idempotent.
        captureAnchors();
    });
    // The Harness preserves the result even if its later teardown fails. Confirm
    // cleanup before every terminal result, including natural completion, so a
    // resumed execution can never trust an ending whose old process may be alive.
    const result = settled.then(async (outcome) => {
        try {
            await dispose();
            return outcome;
        }
        catch {
            return { output: outcome.output, stopReason: 'error',
                diagnostic: outcome.diagnostic === undefined
                    ? WORKER_CLEANUP_UNCONFIRMED_DIAGNOSTIC
                    : `${outcome.diagnostic} ${WORKER_CLEANUP_UNCONFIRMED_DIAGNOSTIC}` };
        }
    });
    const handle = subprocessRunHandle({
        // Harness catalog identity belongs to this external execution, not to the
        // native conversation. A continuation reuses the latter as a new child.
        id: SessionId(randomUUID()),
        // The snapshot this run took while its session was open rides the result the
        // Harness hands back to the Host; nothing is read after teardown.
        result: result.then(outcome => carryWorkerAnchors(outcome, anchors)),
        signal: request.signal,
        onAbort,
        requestCancel: onAbort,
        teardown: async () => {
            await dispose();
            await settled;
        },
    });
    // The control belongs to this run and dies with it: the provider offers it only
    // while the session is open, and the symbol keeps it off every ordinary view of
    // the handle.
    Object.defineProperty(handle, WORKER_STEER, { value: steer, enumerable: false });
    return handle;
}
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
export async function withCodexSandbox(env, open) {
    const sandbox = env.OAR_CODEX_SANDBOX;
    if (typeof sandbox !== 'string' || sandbox === '')
        return open();
    const previous = process.env.OAR_CODEX_SANDBOX;
    process.env.OAR_CODEX_SANDBOX = sandbox;
    let opened;
    try {
        // OAR reads this setting synchronously before its first await. Hold the
        // overlay only across that call, never across another provider's open.
        opened = open();
    }
    finally {
        if (previous === undefined)
            delete process.env.OAR_CODEX_SANDBOX;
        else
            process.env.OAR_CODEX_SANDBOX = previous;
    }
    return opened;
}
/**
 * Open one native session and return a one-shot run. OAR cannot interrupt session
 * startup, so a cancellation during that await disposes the session before rejecting.
 */
export async function startWorkerRun(request, spec) {
    const prompt = textTask(request.prompt);
    if (request.signal.aborted)
        throw cancellationFailure();
    const cwd = assertUsableCwd('team-worker', 'worker cwd', request.cwd);
    const runtime = await engineRuntime(spec.engine);
    if (request.signal.aborted)
        throw cancellationFailure();
    let installation;
    try {
        installation = await runtime.installation?.({ env: spec.env });
    }
    catch (error) {
        const failure = new WorkerFailure('installation', 'unknown', { cause: error });
        spec.onError?.(failure, 'error');
        throw failure;
    }
    if (request.signal.aborted)
        throw cancellationFailure();
    if (installation === undefined || installation.kind === 'unsupported')
        throw new WorkerFailure('installation', 'unsupported');
    if (installation.kind === 'not_found')
        throw new WorkerFailure('installation', 'not-found');
    let session;
    try {
        session = await withCodexSandbox(spec.env, () => runtime.session(installation, {
            cwd,
            ...spec.model === undefined ? {} : { model: spec.model },
            ...spec.resume === undefined ? {} : { resume: spec.resume },
            env: spec.env,
            launchArgs: spec.launchArgs,
        }));
    }
    catch (error) {
        if (request.signal.aborted)
            throw cancellationFailure();
        const failure = new WorkerFailure('startup', 'unknown', { cause: error });
        spec.onError?.(failure, 'error');
        throw failure;
    }
    if (spec.resume !== undefined && session.id !== spec.resume) {
        const mismatch = new WorkerFailure('startup', 'unsupported', {
            cause: new Error(`The resumed engine opened native session '${session.id}', not '${spec.resume}'.`),
        });
        await disposeSession(session, spec);
        throw mismatch;
    }
    if (request.signal.aborted) {
        await disposeSession(session, spec);
        throw cancellationFailure();
    }
    return publishRun(session, prompt, request, spec, cwd);
}
export class TeamWorkerProvider {
    name;
    spec;
    sink;
    capabilities = Object.freeze({ agentOptions: false, agentPreset: false, outputSchema: false, depthLimit: false });
    inheritsParentContext = false;
    /**
     * @param name - the registry name the Host registered the provider under.
     * @param spec - reads the settings row as it stands when a session opens, so a
     * saved executable, engine switch, or policy reaches the next delegation.
     * @param sink - the Host's live-run registry, told when a session opens and closes.
     */
    constructor(name, spec, sink) {
        this.name = name;
        this.spec = spec;
        this.sink = sink;
    }
    async start(request) {
        const run = await startWorkerRun(request, this.spec());
        // The control rides the run this provider just published; the registry holds
        // it exactly as long as that run's session lives.
        this.sink.opened(run.id, workerSteerOf(run));
        void run.result.then(() => { this.sink.closed(run.id); }, () => { this.sink.closed(run.id); });
        return run;
    }
}
