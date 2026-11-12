import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { formatTeamTimestamp } from "./time-format.js";
import { resolveBodyMentions } from "./mentions.js";
import { recoveryFor } from "./recovery-hints.js";
import { planTaskReminders } from "./task-reminders.js";
import { characterLength, truncateToCharacters } from "./text.js";
import { isScriptHash, SUBSCRIPTION_EVENT_DETAIL_MAX_CHARACTERS, SUBSCRIPTION_EVENT_ID_MAX_CHARACTERS, SUBSCRIPTION_EVENT_TITLE_MAX_CHARACTERS, SUBSCRIPTION_MAX_PER_PROJECT, SUBSCRIPTION_PENDING_MAX, subscriptionDefinitionProblem, } from "./subscriptions.js";
import { mintWebhookToken, sameWebhookTokenHash, webhookTokenHash } from "./subscription-webhook.js";
import { WORKER_REASON_MAX_CHARACTERS } from "./worker-settings.js";
import { MAX_ACTIVE_REMINDERS_PER_MEMBER, MAX_REMINDER_NOTE_CHARACTERS, nextOccurrenceAt, nextReminderWakeAt, parseReminderNote, parseReminderSchedule, planMemberReminders, reminderRefIsStorable, reminderScheduleIsSound, sameReminderIntent } from "./member-reminders.js";
/** Stable Human Member identity shared by every replay of one dshHome Team. */
export const AGENT_TEAM_HUMAN_MEMBER_ID = 'member:human';
/**
 * The handle the Human is addressed by in Message bodies. The body parser and
 * the Member directory both read this one constant, so a configurable display
 * name has a single place to land instead of a hard-coded literal per surface.
 */
export const AGENT_TEAM_HUMAN_HANDLE = 'human';
/** Idempotency identity of the one Host bootstrap operation. */
export const AGENT_TEAM_INITIALIZE_REQUEST_ID = 'agent-team:initialize:v1';
const HUMAN_ACTOR = Object.freeze({
    kind: 'human',
    memberId: AGENT_TEAM_HUMAN_MEMBER_ID,
    handle: AGENT_TEAM_HUMAN_HANDLE,
});
/** Resolve the one Human authority owned by this Team. */
export function agentTeamHumanActor() {
    return HUMAN_ACTOR;
}
const HOST_ACTOR = Object.freeze({ kind: 'host', handle: 'agent-team' });
/** Finished Tasks the board keeps per Project. */
export const TASK_BOARD_FINISHED_PER_PROJECT = 5;
/**
 * Highest validation-rules version this build implements; a ledger segment without a marker is version 1.
 * Version 3 widens Task responsibility without rewriting history: a transfer target may be any enabled Project
 * member, a Task's own accountable may verify it, and losing an owner grant returns responsibility only when
 * that grant was the Member's last Project participation. Version 4 lets a closed Task's Thread be followed:
 * closing ends every Attention row, so refusing the follow left a finished Task with no follower to hand it to.
 * Version 5 addresses published subscription events to the members a subscription names. Version 6 adds the two
 * delegated-Worker records: a build that implements them declares it, so an older build refuses such a ledger by name
 * instead of failing on an unknown operation kind mid-replay. Version 7 adds continuation links and the native turn /
 * input arrays settled with a Worker; version-6 Worker records stay valid without those fields.
 */
export const AGENT_TEAM_RULES_VERSION = 7;
/**
 * The bounded, single-line reason a finished run gives its Thread. It is derived
 * from the provider's own safe diagnostic — the Harness declares that text free of
 * tool inputs, file contents, environment values and credentials, which is what
 * makes it publishable — never from the private record's other fields. A run that
 * ends without saying anything still owes the Thread a sentence, and the answer it
 * produced is never part of this: the reason is public, the answer is not.
 */
function workerRunReasonOf(settlement) {
    if (settlement.state === 'completed')
        return undefined;
    const said = settlement.diagnostic?.replaceAll(/\s+/gu, ' ').trim() ?? '';
    const fallback = settlement.state === 'stopped'
        ? 'The run was stopped before it reported a result.'
        : 'The Worker ended with an unreported failure.';
    const text = said === '' ? fallback : said;
    return characterLength(text) <= WORKER_REASON_MAX_CHARACTERS
        ? text : `${truncateToCharacters(text, WORKER_REASON_MAX_CHARACTERS - 1)}…`;
}
function freezeActor(actor) {
    if (actor.kind === 'host')
        return Object.freeze({ kind: 'host', handle: actor.handle });
    if (actor.kind === 'human')
        return Object.freeze({ kind: 'human', memberId: actor.memberId, handle: actor.handle });
    return Object.freeze({ kind: 'member', memberId: actor.memberId, handle: actor.handle });
}
export function agentTeamHostActor() {
    return HOST_ACTOR;
}
/** Kinds a rules-version-1 segment rejects (owner operations carry their own check), and the one kind version 2 stops writing. */
const V2_ONLY_KINDS = ['team/main-message-posted', 'team/main-stream-read', 'team/thread-started', 'team/task-accountable-changed', 'team/reminder-raised',
    'team/member-reminder-created', 'team/member-reminder-raised', 'team/member-reminder-consumed', 'team/member-reminder-cancelled'];
const REPLACED_AT_V2_KINDS = ['team/message-sent'];
/** Kinds only a rules-version-6 segment may carry: a build that never adopted version 6 cannot write them. */
const V6_ONLY_KINDS = ['team/worker-started', 'team/worker-settled'];
/** Steer receipts extend the version-7 Worker ledger; a pre-7 segment never carries one. */
const V7_ONLY_KINDS = ['team/worker-steer-admitted', 'team/worker-steer-recorded'];
/** Version 7 extends the version-6 Worker records without changing the kinds themselves. */
function workerVersion7Problem(execution, rulesVersion) {
    if (rulesVersion >= 7)
        return undefined;
    if (execution.continuedFrom !== undefined) {
        return `continued Worker '${execution.workerRef}' needs rules version 7; its segment runs version ${rulesVersion}`;
    }
    if (execution.nativeTurnIds === undefined && execution.nativeInputIds === undefined)
        return undefined;
    return `native Worker anchors in '${execution.workerRef}' need rules version 7; its segment runs version ${rulesVersion}`;
}
/** Entries a Main stream read answers with; the read still acknowledges everything through its sequence. */
const MAIN_READ_PAGE_SIZE = 20;
/** The Task lifecycle actions that resolve a Task and derive its visible status. */
function taskResolutionForAction(action) {
    switch (action) {
        case 'accept': return 'accepted';
        case 'close': return 'closed';
        case 'reopen': return 'open';
        default: throw new Error(`invalid Task change action '${action}'`);
    }
}
/** One marker per Member and reminder: the key that makes a replacement a replacement. */
function memberReminderMarkerKey(marker) {
    return `${marker.memberId}|${marker.reminderRef}`;
}
/**
 * Operation kinds whose durable record is history alone: they must replay, but
 * they move no projection state, so replay skips them after indexing the
 * operation itself. The predicate form is load-bearing — the exhaustiveness
 * assert at the end of `applyTo` only accepts the kinds this excludes if the
 * check narrows the operation itself, not merely its `kind`.
 */
const AUDIT_ONLY_KINDS = [
    'team/member-session-restarted',
    'team/member-context-cleared',
    'team/dm-sent',
];
function isAuditOnlyOperation(operation) {
    return AUDIT_ONLY_KINDS.includes(operation.kind);
}
function emptyProjection() {
    return { byRequest: new Map(), byOperation: new Map(), ordered: [], occurredAtBySequence: new Map(), projects: new Map(), members: new Map(), participations: new Map(), memberships: new Map(),
        claims: new Map(), tasks: new Map(), threads: new Map(), attention: new Map(), directMarkers: new Map(), activityMarkers: new Map(),
        reminderMarkers: new Map(), reminderEpisodes: new Map(), taskStatusBaselines: new Map(), orderedFacts: [], claimsByTask: new Map(), claimCreatedSequenceByRef: new Map(), factsByThread: new Map(), projectRefByThread: new Map(), mentionsByMessage: new Map(), messageCountByThread: new Map(),
        memberReminders: new Map(), memberReminderOccurrences: new Map(), memberReminderMarkers: new Map(), memberReminderMarkersByMember: new Map(),
        messagesByRef: new Map(),
        attentionByThread: new Map(), sessionTransitions: new Map(),
        anchorByThread: new Map(), taskNumberByTask: new Map(), taskCountByProject: new Map(), attentionThreadsByMember: new Map(),
        threadsByWriter: new Map(),
        directMarkersByMember: new Map(), activityMarkersByMember: new Map(), reminderMarkersByMember: new Map(), observationsByThread: new Map(), rulesVersion: 1, owners: new Map(), mentionedByProject: new Map(),
        mainSourcesByProject: new Map(), mainSourceByRef: new Map(), mainMarkers: new Map(), mainMarkersByMember: new Map(), mainAttention: new Map(), humanMainWatermarks: new Map(),
        subscriptions: new Map(), subscriptionsByProject: new Map(), subscriptionBaselines: new Map(), subscriptionEvents: new Map(), acceptedEventsBySequence: new Map(),
        subscriptionScriptHistory: new Map(), subscriptionResumeSequences: new Map(), workerExecutions: new Map(), workerSteerRequests: new Map() };
}
/** Exhaustiveness guard for the closed operation union: adding a kind must update every dispatch. */
function assertUnhandledKind(operation) {
    throw new Error(`agent-team ledger does not handle operation kind '${operation.kind}'`);
}
/**
 * Opening-line gist: the first non-empty line, trimmed, then bounded as a wire
 * guard. The bound stays far above any display width: the Client projects the
 * line's Markdown away and then bounds it per surface, and a bound applied here
 * would cut inside `**…**`, leaving a marker pair that never closes.
 */
function boundedOpeningLine(body, max) {
    const firstLine = body.split('\n').map(line => line.trim()).find(line => line !== '') ?? '';
    return characterLength(firstLine) > max ? `${truncateToCharacters(firstLine, max - 1)}…` : firstLine;
}
/**
 * The one-line gist source guard shared by the Inbox row, the Thread card and chip title, the Task title, and a quote's
 * excerpt. It bounds what crosses the wire, not what the reader sees: the Client owns the display bound, because only
 * text it has already projected to plain can be cut without splitting a marker pair.
 */
const GIST_SOURCE_MAX_CHARACTERS = 2048;
/**
 * How many Threads one Workspace's 「最近活跃」 slice may carry. It bounds what
 * the Host hands over, not what the reader sees: the Client merges every
 * visible Workspace's slice and trims the merged list to its own visible bound
 * (`RECENT_ROWS_LIMIT`), which must stay at or below this one so no Workspace
 * is cut short before the merge. The unread slice keeps its own `limit`
 * request field.
 */
const RECENT_INBOX_LIMIT = 10;
/**
 * Whether one operation's Inbox delta would change nothing. A read that finds
 * no unread fact for its reader and no marker to consume produces exactly this
 * delta, which is why such a read is a no-op rather than a durable operation.
 */
function isEmptyInboxDelta(delta) {
    return delta.attention.set.length === 0 && delta.attention.removed.length === 0
        && delta.directMarkers.added.length === 0 && delta.directMarkers.removed.length === 0
        && delta.activityMarkers.added.length === 0 && delta.activityMarkers.removed.length === 0
        && (delta.reminderMarkers === undefined || (delta.reminderMarkers.added.length === 0 && delta.reminderMarkers.removed.length === 0))
        && (delta.mainMarkers === undefined || (delta.mainMarkers.added.length === 0 && delta.mainMarkers.removed.length === 0));
}
/** One triggers value, frozen so a caller cannot mutate what the ledger holds. */
function freezeSubscriptionTriggers(triggers) {
    return Object.freeze({ ...(triggers.interval === undefined ? {} : { interval: Object.freeze({ ...triggers.interval }) }),
        ...(triggers.webhook === true ? { webhook: true } : {}) });
}
function freezeSubscriptionCredentials(credentials) {
    return Object.freeze(credentials.map(credential => Object.freeze({ ...credential })));
}
/** Why a batch of event ids cannot be stored as such, or `undefined` when it can. */
function subscriptionIdsProblem(ids) {
    const seen = new Set();
    for (const id of ids) {
        if (id === '')
            return 'an event id cannot be empty';
        if (characterLength(id) > SUBSCRIPTION_EVENT_ID_MAX_CHARACTERS) {
            return `id '${id}' is longer than ${SUBSCRIPTION_EVENT_ID_MAX_CHARACTERS} characters`;
        }
        if (seen.has(id))
            return `id '${id}' appears twice in the same batch`;
        seen.add(id);
    }
    return undefined;
}
/** Why one run's events cannot be accepted, or `undefined` when they can. */
function subscriptionRunEventsProblem(events, known) {
    if (events.length === 0)
        return 'a run that produced no events has nothing to accept';
    const ids = subscriptionIdsProblem(events.map(event => event.id));
    if (ids !== undefined)
        return ids;
    const repeated = events.find(event => known.has(event.id));
    if (repeated !== undefined)
        return `id '${repeated.id}' is already known to this subscription`;
    for (const event of events) {
        if (characterLength(event.title) > SUBSCRIPTION_EVENT_TITLE_MAX_CHARACTERS) {
            return `title of '${event.id}' is longer than ${SUBSCRIPTION_EVENT_TITLE_MAX_CHARACTERS} characters`;
        }
        if (event.detail !== undefined && characterLength(event.detail) > SUBSCRIPTION_EVENT_DETAIL_MAX_CHARACTERS) {
            return `detail of '${event.id}' is longer than ${SUBSCRIPTION_EVENT_DETAIL_MAX_CHARACTERS} characters`;
        }
        if (event.url !== undefined && !/^https?:\/\/\S+$/i.test(event.url))
            return `url of '${event.id}' is not an http(s) address`;
    }
    return undefined;
}
function reminderMarkerKey(marker) {
    return `${marker.memberId}|${marker.taskRef}|${marker.kind}|${marker.baselineSequence}`;
}
function reminderEpisodeKey(taskRef, kind, recipient, baselineSequence) {
    return `${taskRef}|${kind}|${recipient}|${baselineSequence}`;
}
function mainMarkerKey(marker) {
    return `${marker.memberId}|${marker.projectRef}|${mainMarkerSourceRef(marker)}`;
}
/** The Main stream source one marker addresses: a Message, an Activity, or a published event. */
function mainMarkerSourceRef(marker) {
    if ('messageRef' in marker)
        return marker.messageRef;
    return 'activityRef' in marker ? marker.activityRef : marker.eventRef;
}
/** One Main stream Attention period's identity, as the projection's flat key. */
function mainAttentionKey(memberId, projectRef) {
    return `${memberId}|${projectRef}`;
}
export function isThreadReadSnapshot(data) {
    return 'thread' in data;
}
/** The Thread and optional Task one read targeted, whichever form the record holds. */
export function threadReadTargetOf(data) {
    return isThreadReadSnapshot(data)
        ? { threadRef: data.thread.threadRef, ...(data.task === undefined ? {} : { taskRef: data.task.taskRef }) }
        : { threadRef: data.threadRef, ...(data.taskRef === undefined ? {} : { taskRef: data.taskRef }) };
}
/** Deep-freeze a Member capability overlay; absent stays absent. */
function freezeCapabilities(capabilities) {
    if (capabilities === undefined)
        return {};
    const freezeAllow = (allow) => allow === undefined ? {} : { allow: Object.freeze([...allow]) };
    return {
        capabilities: Object.freeze({
            ...(capabilities.tools === undefined ? {} : { tools: Object.freeze(freezeAllow(capabilities.tools.allow)) }),
            ...(capabilities.skills === undefined ? {} : { skills: Object.freeze(freezeAllow(capabilities.skills.allow)) }),
        }),
    };
}
/** Replay and append logic behind the Agent Team service interface. */
export class AgentTeamLedger {
    table;
    /** Live projection; record validation replays build independent Projection values instead. */
    state = emptyProjection();
    createOperationId;
    createOccurredAt;
    createRef;
    /** How a write that arms a webhook address obtains its token; the default is the platform CSPRNG. */
    createWebhookToken;
    /** Host-supplied surface visibility probe; absent means no write is ever exempt. */
    areFactsVisible;
    areMainEntriesVisible;
    rulesVersion;
    /** A one-call read set lets notificationFacts and mainNotificationFacts reuse material memberInbox already derived. */
    notificationReadSet;
    operationTail = Promise.resolve();
    /**
     * Runtime human display name. Durable identity stays `member:human`; only
     * the handle read by @ matching and handle-uniqueness follows this value.
     * The Host syncs it from the `agent-team-human` settings namespace; the
     * ledger never persists it, so a rename affects only later resolutions.
     */
    humanHandle = AGENT_TEAM_HUMAN_HANDLE;
    /**
     * Head of the durable records the constructor's record-level replay
     * validated, adoptable once by the invariant mount. See `validateAtMount`.
     */
    bootValidation;
    /**
     * Sequence of the newest committed record that invalidated the shared
     * projection — the durable position the Client's change cursors compare
     * against, rebuilt by replay like every other index.
     *
     * Records whose commit is private read progress or audit-only
     * (`changeScopesOf` derives no scope for them) never move it, so one
     * Member's Thread read cannot make a parked Client believe that something it
     * watches changed. Being a ledger position rather than a process counter, it
     * also stays monotone across a restart.
     */
    projectionVersion = 0;
    constructor(table, options = {}) {
        this.table = table;
        this.createOperationId = options.operationId ?? (() => `operation:${randomUUID()}`);
        this.createOccurredAt = options.occurredAt ?? (() => new Date().toISOString());
        this.createRef = options.ref ?? (kind => `${kind}:${randomUUID()}`);
        this.areFactsVisible = options.areFactsVisible;
        this.areMainEntriesVisible = options.areMainEntriesVisible;
        this.rulesVersion = options.rulesVersion ?? AGENT_TEAM_RULES_VERSION;
        this.createWebhookToken = options.webhookToken ?? mintWebhookToken;
        this.replay();
        const head = this.state.ordered.at(-1);
        this.bootValidation = Object.freeze({
            records: this.state.ordered.length,
            lastSequence: head?.sequence ?? 0,
            lastOperationId: head?.operationId ?? null,
        });
    }
    /** Current human display name for @ matching and uniqueness checks. */
    humanDisplayHandle() {
        return this.humanHandle;
    }
    /** Read-only inputs for one event-evaluated reminder pass. */
    reminderFacts() {
        return Object.freeze([...this.state.tasks.values()].filter(task => task.resolution === 'open').map(task => {
            const latest = this.state.factsByThread.get(task.threadRef)?.at(-1);
            const statusBaseline = this.state.taskStatusBaselines.get(task.taskRef);
            if (latest === undefined || statusBaseline === undefined)
                throw new Error('invalid Task reminder baseline');
            return Object.freeze({ task, projectActive: this.state.projects.get(task.projectRef)?.state === 'active',
                statusBaselineSequence: statusBaseline.sequence,
                statusBaselineOccurredAt: this.state.occurredAtBySequence.get(statusBaseline.sequence) ?? '',
                latestPublicSequence: latest.sequence,
                latestPublicOccurredAt: latest.occurredAt,
                claims: Object.freeze((this.state.claimsByTask.get(task.taskRef) ?? []).map(claim => Object.freeze({ claim,
                    createdSequence: this.state.claimCreatedSequenceByRef.get(claim.claimRef) ?? latest.sequence }))),
            });
        }));
    }
    heldTaskClaim(taskRef, memberId) {
        return this.heldTaskClaimFrom(this.state, taskRef, memberId);
    }
    reminderEpisodeExists(taskRef, kind, recipient, baselineSequence) {
        return this.state.reminderEpisodes.has(reminderEpisodeKey(taskRef, kind, recipient, baselineSequence));
    }
    hasUnreadResponsibility(taskRef, recipient) {
        const threadRef = this.state.tasks.get(taskRef)?.threadRef;
        return threadRef !== undefined && this.activityMarkersForFrom(this.state, recipient, threadRef).length > 0;
    }
    planReminders(nowMs, idleMs, taskRef) {
        return planTaskReminders({ nowMs, tasks: this.reminderFacts().filter(facts => taskRef === undefined || facts.task.taskRef === taskRef),
            verifierOf: task => this.verifierOfFrom(this.state, task),
            isAvailable: memberId => memberId === AGENT_TEAM_HUMAN_MEMBER_ID || this.getMember(memberId)?.state === 'enabled',
            idleMs,
            episodeExists: (taskRef, kind, recipient, baselineSequence) => this.reminderEpisodeExists(taskRef, kind, recipient, baselineSequence),
            hasUnreadResponsibility: (taskRef, recipient) => this.hasUnreadResponsibility(taskRef, recipient) });
    }
    /** Recheck the whole condition after earlier writes in the queue; a stale baseline or recipient is not committable. */
    raiseReminder(candidate, nowMs, idleMs) {
        return this.enqueue(async () => {
            const { taskRef, kind, recipient, baselineSequence } = candidate;
            const candidateKey = reminderEpisodeKey(taskRef, kind, recipient, baselineSequence);
            if (!this.planReminders(nowMs, idleMs, taskRef).some(current => reminderEpisodeKey(current.taskRef, current.kind, current.recipient, current.baselineSequence) === candidateKey))
                return undefined;
            const task = this.state.tasks.get(taskRef);
            const project = task === undefined ? undefined : this.state.projects.get(task.projectRef);
            if (task === undefined || project === undefined || project.state !== 'active'
                || (kind === 'review-backlog' ? task.status !== 'in_review' : task.status !== 'in_progress'))
                return undefined;
            const sequence = this.nextSequence();
            const marker = Object.freeze({ memberId: recipient, threadRef: task.threadRef, taskRef, kind, baselineSequence, sequence });
            const requestId = `agent-team:reminder:${taskRef}:${kind}:${recipient}:${baselineSequence}`;
            const operation = Object.freeze({
                ...this.operationBase({ requestId, actor: HOST_ACTOR }, sequence), kind: 'team/reminder-raised',
                data: Object.freeze({ workspaceId: project.workspaceId, taskRef, kind, recipient, baselineSequence,
                    inbox: this.inboxDelta([], [], [], [], [], [], [], [], [marker]) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.receipt(operation);
        });
    }
    // ── Delegated Worker runs ─────────────────────────────────────────────────
    /**
     * Record one delegated Worker run as started, before any native process exists.
     * This write is the run's whole binding: nothing later recomputes which Thread
     * its result belongs to. The record is private; only a bound target has a fact.
     */
    recordWorkerStarted(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameWorkerStart(existing, request);
                return this.resolved(this.workerStartedRecorded(existing));
            }
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            if (actor.kind !== 'member')
                throw new Error('a delegated Worker run belongs to a Member');
            const project = this.requireActiveProject(request.workspaceId, request.execution.projectRef);
            if (!this.isProjectOwnerFrom(this.state, project.projectRef, actor.memberId)) {
                throw new Error(`only a current owner of ${project.projectRef} may delegate a Worker`);
            }
            if (request.execution.initiatedBy !== actor.memberId)
                throw new Error('a delegated Worker run belongs to the Member that recorded it');
            if (this.state.workerExecutions.has(request.execution.workerRef)) {
                throw new Error(`Worker '${request.execution.workerRef}' is already recorded`);
            }
            this.assertWorkerBindingFrom(this.state, project.projectRef, request.execution);
            const workerVersionProblem = workerVersion7Problem(request.execution, this.state.rulesVersion);
            if (workerVersionProblem !== undefined)
                throw new Error(workerVersionProblem);
            this.assertWorkerContinuationFrom(this.state, request.execution);
            const base = this.operationBase({ requestId: request.requestId, actor }, this.nextSequence());
            const execution = Object.freeze({ ...request.execution, startedAt: base.occurredAt });
            const activity = this.workerStartedActivityFor(execution, base.sequence);
            const operation = Object.freeze({
                ...base, kind: 'team/worker-started',
                data: Object.freeze({ workspaceId: project.workspaceId, execution,
                    ...(activity === undefined ? {} : { activity }) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.workerStartedRecorded(operation));
        });
    }
    /**
     * Record the one terminal fact of a delegated Worker run: at most once, with a
     * marker naming the fact it wrote in the same operation. A Project-only run
     * projects nothing public.
     */
    recordWorkerSettled(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameWorkerSettle(existing, request);
                return this.resolved(this.workerSettledRecorded(existing));
            }
            const prior = this.state.workerExecutions.get(request.settlement.workerRef);
            if (prior === undefined)
                throw new Error(`Worker '${request.settlement.workerRef}' was never recorded by this Team`);
            if (prior.state !== 'running')
                throw new Error(`Worker '${prior.workerRef}' already ended: ${prior.state}`);
            // The Workspace is the one the run's own Project holds, never a caller's
            // restatement: the binding written at start already fixed it.
            const project = this.state.projects.get(prior.projectRef);
            if (project === undefined)
                throw new Error(`Worker '${prior.workerRef}' belongs to no Project this Team holds`);
            this.assertWorkerSettlementFrom(this.state, prior, request.settlement);
            const workerVersionProblem = workerVersion7Problem(request.settlement, this.state.rulesVersion);
            if (workerVersionProblem !== undefined)
                throw new Error(workerVersionProblem);
            const base = this.operationBase({ requestId: request.requestId, actor: HOST_ACTOR }, this.nextSequence());
            const execution = Object.freeze({ ...request.settlement, settledAt: base.occurredAt });
            const activity = this.workerSettledActivityFor(prior, execution, base.sequence);
            // A departed initiator keeps the Thread fact but gets no wake: their Inbox
            // can no longer reach a Project they left.
            const marker = activity === undefined || !this.isProjectMemberFrom(this.state, prior.projectRef, prior.initiatedBy)
                ? undefined
                : Object.freeze({ memberId: prior.initiatedBy, threadRef: activity.threadRef, activityRef: activity.activityRef, sequence: base.sequence });
            const operation = Object.freeze({
                ...base, kind: 'team/worker-settled',
                data: Object.freeze({ workspaceId: project.workspaceId, execution,
                    ...(activity === undefined ? {} : { activity }),
                    inbox: this.inboxDelta([], [], [], [], marker === undefined ? [] : [marker], []) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.workerSettledRecorded(operation));
        });
    }
    /**
     * Admit one steer request before the Host reaches the engine. A canonical
     * admission reserves a receiving execution and instruction (after an explicit
     * refusal, a fresh request id may reserve the same text again); an alias
     * reserves a fresh id for a request that already did. Neither writes a public
     * Worker fact or changes the execution record.
     */
    recordWorkerSteerAdmitted(request) {
        return this.enqueue(async () => {
            const existing = this.state.workerSteerRequests.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameWorkerSteerAdmission(existing, request);
                return this.resolved(existing);
            }
            const existingOperation = this.state.byRequest.get(`agent-team:worker-steer-admitted:${request.requestId}`);
            if (existingOperation !== undefined) {
                if (existingOperation.kind !== 'team/worker-steer-admitted')
                    this.throwRequestCollision(request.requestId);
                this.assertSameWorkerSteerAdmission(this.workerSteerAdmissionOf(existingOperation), request);
                return this.resolved(this.workerSteerAdmissionOf(existingOperation));
            }
            if (this.state.byRequest.has(request.requestId))
                this.throwRequestCollision(request.requestId);
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            if (actor.kind !== 'member')
                throw new Error('a Worker steer belongs to a Member');
            if (request.initiatedBy !== actor.memberId)
                throw new Error('a Worker steer belongs to the Member that asked for it');
            if (request.instruction.trim() === '' || request.instruction !== request.instruction.trim()) {
                throw new Error('a Worker steer instruction must be non-empty and normalized');
            }
            if (request.aliasOf !== undefined && request.aliasOf === request.requestId) {
                throw new Error('a Worker steer request cannot alias itself');
            }
            this.workerSteerReceivingExecution(request, this.state);
            const alias = request.aliasOf === undefined ? undefined : this.workerSteerAliasTarget(request, this.state);
            if (alias !== undefined) {
                if (alias.outcome?.kind === 'refused')
                    throw new Error('a refused Worker steer request cannot be aliased');
            }
            else {
                const prior = this.workerSteerCanonicalAdmissionsFor(request, this.state);
                if (prior.some(candidate => candidate.outcome?.kind !== 'refused')) {
                    throw new Error(`Worker '${request.workerRef}' already admitted this steer instruction under another request id`);
                }
            }
            const operation = Object.freeze({
                ...this.operationBase({ requestId: `agent-team:worker-steer-admitted:${request.requestId}`, actor }, this.nextSequence()),
                kind: 'team/worker-steer-admitted',
                data: Object.freeze({
                    requestId: request.requestId,
                    workspaceId: request.workspaceId,
                    workerRef: request.workerRef,
                    instruction: request.instruction,
                    initiatedBy: request.initiatedBy,
                    ...(request.continuedFrom === undefined ? {} : { continuedFrom: request.continuedFrom }),
                    ...(request.aliasOf === undefined ? {} : { aliasOf: request.aliasOf }),
                }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.workerSteerAdmissionOf(operation));
        });
    }
    /**
     * Write the one outcome of an admitted steer. The caller must wait for this
     * record before reporting success; a missing outcome after replay is
     * unconfirmed, never an invitation to send the instruction again.
     */
    recordWorkerSteerRecorded(request) {
        return this.enqueue(async () => {
            const recordRequestId = `agent-team:worker-steer-recorded:${request.admissionRequestId}`;
            const existing = this.state.byRequest.get(recordRequestId);
            if (existing !== undefined) {
                if (existing.kind !== 'team/worker-steer-recorded'
                    || existing.data.admissionRequestId !== request.admissionRequestId
                    || !isDeepStrictEqual(existing.data.outcome, request.outcome))
                    this.throwRequestCollision(recordRequestId);
                return this.resolved({ receipt: this.receipt(existing), outcome: this.workerSteerOutcomeOfOperation(existing) });
            }
            const admission = this.state.workerSteerRequests.get(request.admissionRequestId);
            if (admission === undefined)
                throw new Error(`Worker steer request '${request.admissionRequestId}' was never admitted`);
            if (admission.aliasOf !== undefined)
                throw new Error('a Worker steer alias has no separate outcome');
            if (admission.outcome !== undefined) {
                if (!isDeepStrictEqual(admission.outcome, request.outcome))
                    this.throwRequestCollision(recordRequestId);
                const recorded = this.state.byRequest.get(recordRequestId);
                if (recorded?.kind !== 'team/worker-steer-recorded')
                    throw new Error('Worker steer outcome has no recorded receipt');
                return this.resolved({ receipt: this.receipt(recorded), outcome: admission.outcome });
            }
            this.assertWorkerSteerOutcome(admission, request.outcome, this.state);
            const operation = Object.freeze({
                ...this.operationBase({ requestId: recordRequestId, actor: HOST_ACTOR }, this.nextSequence()),
                kind: 'team/worker-steer-recorded',
                data: Object.freeze({ admissionRequestId: request.admissionRequestId,
                    outcome: this.freezeWorkerSteerOutcome(request.outcome) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed({ receipt: this.receipt(operation), outcome: operation.data.outcome });
        });
    }
    /**
     * What one request id means for steering: an admitted steer, a non-steer
     * operation it collides with, or nothing. A legacy `worker-started` request is
     * left to `workerStartedByRequest`, so a continuation retry from a ledger
     * written before steer receipts still answers as it always did.
     */
    workerSteerRequest(requestId) {
        const admission = this.state.workerSteerRequests.get(requestId);
        if (admission !== undefined)
            return admission;
        const operation = this.state.byRequest.get(requestId);
        if (operation === undefined || operation.kind === 'team/worker-started')
            return undefined;
        return Object.freeze({ kind: 'conflict', requestId });
    }
    /** The effective outcome of an admission, following an alias to its canonical request. */
    workerSteerOutcome(requestId) {
        const admission = this.state.workerSteerRequests.get(requestId);
        if (admission === undefined)
            return undefined;
        return admission.outcome ?? (admission.aliasOf === undefined
            ? undefined : this.state.workerSteerRequests.get(admission.aliasOf)?.outcome);
    }
    /**
     * Canonical admissions for one exact text on one receiving execution, oldest
     * first. A continuation admission is matchable through its source before the
     * new execution has opened, when its generated ref is not yet discoverable.
     * Aliases are excluded: they reserve an id, not another native intent.
     */
    workerSteerAdmissionsForText(query) {
        return Object.freeze([...this.state.workerSteerRequests.values()].filter(admission => admission.aliasOf === undefined
            && ((query.workerRef !== undefined && admission.workerRef === query.workerRef)
                || (query.continuedFrom !== undefined && admission.continuedFrom === query.continuedFrom))
            && admission.instruction === query.instruction && admission.initiatedBy === query.initiatedBy));
    }
    /** Whether this Host recorded the run and has not recorded its ending. */
    workerRunState(workerRef) {
        return this.state.workerExecutions.get(workerRef)?.state;
    }
    /** One run's whole durable record, for the Host's stop authorization. */
    workerExecution(workerRef) {
        return this.state.workerExecutions.get(workerRef);
    }
    /** The one execution directly continued from this run, if any. */
    workerSuccessor(workerRef) {
        for (const execution of this.state.workerExecutions.values()) {
            if (execution.continuedFrom === workerRef)
                return execution;
        }
        return undefined;
    }
    /**
     * The newest execution in one native conversation. A running continuation
     * inherits the session id through its predecessor until its own settlement, so
     * this remains the durable way to join an alias ref to work already underway.
     */
    workerLatestInNativeSession(nativeSessionId) {
        let latest;
        for (const execution of this.state.workerExecutions.values()) {
            if (this.workerNativeSessionFrom(this.state, execution) === nativeSessionId)
                latest = execution;
        }
        return latest;
    }
    /** The native conversation one execution belongs to, inherited through its continuation chain. */
    workerNativeSessionOf(workerRef) {
        const execution = this.state.workerExecutions.get(workerRef);
        return execution === undefined ? undefined : this.workerNativeSessionFrom(this.state, execution);
    }
    /**
     * The native-record anchors this execution's chain can resume, nearest first.
     * A cleanly failed continuation may have no anchor of its own; its predecessor
     * still identifies the same native conversation for an explicit later try.
     */
    workerResumeAnchors(workerRef) {
        const execution = this.state.workerExecutions.get(workerRef);
        return execution === undefined ? [] : this.workerResumeAnchorsFrom(this.state, execution);
    }
    /** The execution one request id opened, for a continuation retry that outlives its Host. */
    workerStartedByRequest(requestId) {
        const operation = this.state.byRequest.get(requestId);
        return operation?.kind === 'team/worker-started' ? this.state.workerExecutions.get(operation.data.execution.workerRef) : undefined;
    }
    /** Every run one Member initiated, newest start first: the record keeps runs that no live execution backs any more. */
    workerExecutionsOfMember(memberId) {
        const executions = [];
        for (const execution of this.state.workerExecutions.values()) {
            if (execution.initiatedBy !== memberId)
                continue;
            executions.push(execution);
        }
        return Object.freeze(executions.sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt)));
    }
    /**
     * Every Worker run bound to one Thread with the durable state each ended in.
     * It reads the execution records, not the facts: a read answers for a window of
     * a long Thread, and a run whose facts fall outside it still stands as recorded.
     * `running` here means a start with no ending, which is what a restart finds.
     */
    threadWorkerStates(threadRef) {
        const states = [];
        for (const execution of this.state.workerExecutions.values()) {
            if (execution.threadRef !== threadRef)
                continue;
            states.push(Object.freeze({ workerRef: execution.workerRef, state: execution.state }));
        }
        return Object.freeze(states);
    }
    /**
     * What a delegation target names, for the Host to bind and authorize before it
     * writes or starts anything. Existence only: the start write re-derives the
     * binding, so a target that changed in between is refused, not misrecorded.
     */
    delegationTarget(request) {
        const { projectRef, threadRef, taskRef } = request;
        // An archived Project takes no new work, so its Threads and Tasks name no
        // delegation target either.
        const liveProject = (ref) => {
            const project = this.state.projects.get(ref);
            return project === undefined || project.state === 'archived' ? undefined : project;
        };
        const projectOfThread = (ref) => {
            const projectRefOfThread = this.projectRefForThreadFrom(this.state, ref);
            return projectRefOfThread === undefined ? undefined : liveProject(projectRefOfThread);
        };
        /** The Thread a Task names, or nothing when the Task is not this Team's. */
        const threadOfTask = (ref) => {
            const task = this.state.tasks.get(ref);
            return task === undefined ? undefined : this.state.threads.get(task.threadRef);
        };
        if (taskRef !== undefined) {
            const thread = threadOfTask(taskRef);
            const project = thread === undefined ? undefined : projectOfThread(thread.threadRef);
            if (thread === undefined || project === undefined)
                return Object.freeze({ kind: 'task-unknown', taskRef });
            if (threadRef !== undefined && threadRef !== thread.threadRef) {
                return Object.freeze({ kind: 'target-conflict', taskRef, threadRef });
            }
            if (projectRef !== undefined && projectRef !== project.projectRef) {
                return Object.freeze({ kind: 'project-conflict', projectRef, threadRef: thread.threadRef });
            }
            return Object.freeze({ kind: 'thread', workspaceId: project.workspaceId, projectRef: project.projectRef,
                threadRef: thread.threadRef, taskRef });
        }
        if (threadRef !== undefined) {
            const thread = this.state.threads.get(threadRef);
            const project = projectOfThread(threadRef);
            if (thread === undefined || project === undefined)
                return Object.freeze({ kind: 'thread-unknown', threadRef });
            if (projectRef !== undefined && projectRef !== project.projectRef) {
                return Object.freeze({ kind: 'project-conflict', projectRef, threadRef });
            }
            return Object.freeze({ kind: 'thread', workspaceId: project.workspaceId, projectRef: project.projectRef,
                threadRef, ...(thread.taskRef === undefined ? {} : { taskRef: thread.taskRef }) });
        }
        if (projectRef === undefined)
            return Object.freeze({ kind: 'target-required' });
        const project = liveProject(projectRef);
        if (project === undefined)
            return Object.freeze({ kind: 'project-unknown', projectRef });
        return Object.freeze({ kind: 'project', workspaceId: project.workspaceId, projectRef: project.projectRef });
    }
    /**
     * What one Worker run handed back, for the Member who delegated it or the Human:
     * the only reader of a record's private half, which never projects into a Thread.
     */
    workerAnswerFor(memberId, workerRef) {
        const execution = this.state.workerExecutions.get(workerRef);
        if (execution === undefined || (execution.initiatedBy !== memberId && memberId !== AGENT_TEAM_HUMAN_MEMBER_ID))
            return undefined;
        return Object.freeze({ workerRef, ...(execution.output === undefined ? {} : { output: execution.output }),
            ...(execution.diagnostic === undefined ? {} : { diagnostic: execution.diagnostic }) });
    }
    /** The public fact a run's start contributes to its Thread, or nothing on a Project-only run. */
    workerStartedActivityFor(execution, sequence) {
        if (execution.threadRef === undefined)
            return undefined;
        return Object.freeze({ activityRef: this.ref('activity'), threadRef: execution.threadRef, actor: execution.initiatedBy, sequence,
            kind: 'worker_started', projectRef: execution.projectRef, workerRef: execution.workerRef, engine: execution.engine,
            ...(execution.taskRef === undefined ? {} : { taskRef: execution.taskRef }) });
    }
    /** The public fact a run's ending contributes to its Thread; the reason is what a participant needs and the answer never is. */
    workerSettledActivityFor(prior, settlement, sequence) {
        if (prior.threadRef === undefined)
            return undefined;
        const reason = workerRunReasonOf(settlement);
        return Object.freeze({ activityRef: this.ref('activity'), threadRef: prior.threadRef, actor: prior.initiatedBy, sequence,
            kind: 'worker_settled', projectRef: prior.projectRef, workerRef: prior.workerRef, engine: prior.engine,
            ...(prior.taskRef === undefined ? {} : { taskRef: prior.taskRef }),
            state: settlement.state, ...(reason === undefined ? {} : { reason }) });
    }
    /** A run's target exists, belongs to the Project it names, and its Thread and Task agree about each other. */
    assertWorkerBindingFrom(projection, projectRef, binding) {
        if (binding.threadRef === undefined) {
            if (binding.taskRef !== undefined)
                throw new Error("a Worker run bound to a Task is bound to that Task's Thread");
            return;
        }
        const thread = projection.threads.get(binding.threadRef);
        if (thread === undefined || this.projectRefForThreadFrom(projection, binding.threadRef) !== projectRef) {
            throw new Error(`Thread '${binding.threadRef}' is not in Project '${projectRef}'`);
        }
        if (thread.taskRef !== binding.taskRef) {
            throw new Error(`Task '${binding.taskRef ?? 'none'}' does not belong to Thread '${binding.threadRef}'`);
        }
    }
    /**
     * A continued execution keeps the source execution's attribution while adding
     * one new Team execution. The native session must already be anchored, every
     * fixed binding must match, and no execution in that native conversation may
     * still be running. The ledger is the concurrency authority, not the live map.
     */
    assertWorkerContinuationFrom(projection, execution) {
        const priorRef = execution.continuedFrom;
        if (priorRef === undefined)
            return;
        const prior = projection.workerExecutions.get(priorRef);
        if (prior === undefined)
            throw new Error(`Worker '${priorRef}' was never recorded by this Team`);
        if (prior.state === 'running')
            throw new Error(`Worker '${priorRef}' has not ended, so it cannot be continued`);
        if (prior.stage === 'dispose')
            throw new Error(`Worker '${priorRef}' did not confirm cleanup, so it cannot be continued`);
        const nativeSessionId = this.workerNativeSessionFrom(projection, prior);
        if (nativeSessionId === undefined) {
            throw new Error(`Worker '${priorRef}' has no native session in its continuation chain to resume`);
        }
        if (prior.initiatedBy !== execution.initiatedBy || prior.projectRef !== execution.projectRef
            || prior.threadRef !== execution.threadRef || prior.taskRef !== execution.taskRef
            || prior.engine !== execution.engine || prior.cwd !== execution.cwd) {
            throw new Error(`Worker '${execution.workerRef}' changed the binding of Worker '${priorRef}'`);
        }
        for (const existing of projection.workerExecutions.values()) {
            if (existing.continuedFrom === priorRef) {
                throw new Error(`Worker '${priorRef}' already has continuation '${existing.workerRef}'`);
            }
        }
        for (const existing of projection.workerExecutions.values()) {
            if (existing.state !== 'running')
                continue;
            if (this.workerNativeSessionFrom(projection, existing) === nativeSessionId) {
                throw new Error(`native session '${nativeSessionId}' already has a running Worker: ${existing.workerRef}`);
            }
        }
    }
    /** Resolve a chain's native session from the terminal predecessor that recorded it. */
    workerNativeSessionFrom(projection, start) {
        let current = start;
        const seen = new Set();
        while (current !== undefined && !seen.has(current.workerRef)) {
            if (current.nativeSessionId !== undefined)
                return current.nativeSessionId;
            seen.add(current.workerRef);
            current = current.continuedFrom === undefined ? undefined : projection.workerExecutions.get(current.continuedFrom);
        }
        return undefined;
    }
    /** Every complete native-record anchor in a continuation chain, direct predecessor first. */
    workerResumeAnchorsFrom(projection, start) {
        const anchors = [];
        let current = start;
        const seen = new Set();
        while (current !== undefined && !seen.has(current.workerRef)) {
            seen.add(current.workerRef);
            if (current.nativeSessionId !== undefined && current.nativeStorage !== undefined) {
                anchors.push(Object.freeze({
                    nativeSessionId: current.nativeSessionId,
                    nativeStorage: current.nativeStorage,
                    ...(current.nativeTurnId === undefined ? {} : { nativeTurnId: current.nativeTurnId }),
                    ...(current.nativeTurnIds === undefined ? {} : { nativeTurnIds: current.nativeTurnIds }),
                    ...(current.nativeInputIds === undefined ? {} : { nativeInputIds: current.nativeInputIds }),
                }));
            }
            current = current.continuedFrom === undefined ? undefined : projection.workerExecutions.get(current.continuedFrom);
        }
        return Object.freeze(anchors);
    }
    /** A resumed execution may settle only against the native conversation its chain started with. */
    assertWorkerSettlementFrom(projection, prior, settlement) {
        if (prior.continuedFrom === undefined)
            return;
        const expected = this.workerNativeSessionFrom(projection, prior);
        // A continuation can fail before resume opens a native session. That ending
        // has no session identity to compare; once one is present it must be the
        // conversation the chain started with.
        if (settlement.nativeSessionId === undefined)
            return;
        if (expected !== settlement.nativeSessionId) {
            throw new Error(`Worker '${prior.workerRef}' resumed native session '${expected ?? 'none'}', not `
                + `'${settlement.nativeSessionId ?? 'none'}'`);
        }
    }
    /**
     * Validate an admission against the receiving execution. A live steer names
     * an execution the ledger already holds; a continuation admission may name a
     * not-yet-recorded execution and therefore proves its ownership through the
     * source it resumes.
     */
    workerSteerReceivingExecution(request, projection) {
        const source = request.continuedFrom === undefined
            ? undefined : projection.workerExecutions.get(request.continuedFrom);
        const target = projection.workerExecutions.get(request.workerRef);
        if (request.continuedFrom === undefined) {
            if (target === undefined)
                throw new Error(`Worker '${request.workerRef}' was never recorded by this Team`);
            const project = projection.projects.get(target.projectRef);
            if (project === undefined || project.workspaceId !== request.workspaceId)
                throw new Error('Worker steer Workspace does not own its execution');
            if (target.initiatedBy !== request.initiatedBy)
                throw new Error('a Worker steer belongs to the run initiator');
            return target;
        }
        if (source === undefined)
            throw new Error(`Worker '${request.continuedFrom}' was never recorded by this Team`);
        if (source.state === 'running')
            throw new Error(`Worker '${source.workerRef}' has not ended, so it cannot be continued by a steer`);
        if (source.initiatedBy !== request.initiatedBy)
            throw new Error('a Worker steer belongs to the run initiator');
        const project = projection.projects.get(source.projectRef);
        if (project === undefined || project.workspaceId !== request.workspaceId)
            throw new Error('Worker steer Workspace does not own its execution');
        if (target !== undefined) {
            if (target.continuedFrom !== request.continuedFrom || target.initiatedBy !== request.initiatedBy
                || target.projectRef !== source.projectRef || target.engine !== source.engine) {
                throw new Error('a continued Worker steer names a different execution');
            }
        }
        return target;
    }
    /** Resolve and validate the canonical request an alias joins. */
    workerSteerAliasTarget(request, projection) {
        const target = request.aliasOf === undefined ? undefined : projection.workerSteerRequests.get(request.aliasOf);
        if (target === undefined)
            throw new Error(`Worker steer alias '${request.aliasOf}' was never admitted`);
        if (target.aliasOf !== undefined)
            throw new Error('a Worker steer alias must name a canonical request');
        if (target.workerRef !== request.workerRef || target.instruction !== request.instruction
            || target.initiatedBy !== request.initiatedBy || target.continuedFrom !== request.continuedFrom
            || target.workspaceId !== request.workspaceId) {
            throw new Error('a Worker steer alias must repeat its canonical request exactly');
        }
        return target;
    }
    workerSteerCanonicalAdmissionsFor(request, projection) {
        return [...projection.workerSteerRequests.values()].filter(admission => admission.aliasOf === undefined
            && admission.workerRef === request.workerRef && admission.instruction === request.instruction
            && admission.initiatedBy === request.initiatedBy);
    }
    workerSteerAdmissionOf(operation) {
        return Object.freeze({
            kind: 'admitted',
            requestId: operation.data.requestId,
            operationId: operation.operationId,
            workspaceId: operation.data.workspaceId,
            workerRef: operation.data.workerRef,
            instruction: operation.data.instruction,
            initiatedBy: operation.data.initiatedBy,
            ...(operation.data.continuedFrom === undefined ? {} : { continuedFrom: operation.data.continuedFrom }),
            ...(operation.data.aliasOf === undefined ? {} : { aliasOf: operation.data.aliasOf }),
        });
    }
    workerSteerOutcomeOfOperation(operation) {
        return operation.data.outcome;
    }
    freezeWorkerSteerOutcome(outcome) {
        if (outcome.kind === 'submitted')
            return Object.freeze({ kind: 'submitted',
                result: Object.freeze({ ...outcome.result }) });
        return Object.freeze({ kind: outcome.kind, refusal: Object.freeze({ ...outcome.refusal }) });
    }
    assertWorkerSteerOutcome(admission, outcome, projection) {
        if (outcome.kind !== 'submitted') {
            if (outcome.refusal.code.trim() === '' || outcome.refusal.message.trim() === '') {
                throw new Error('invalid Worker steer refusal');
            }
            return;
        }
        const { result } = outcome;
        if (result.workerRef !== admission.workerRef)
            throw new Error('Worker steer result names another execution');
        const execution = projection.workerExecutions.get(admission.workerRef);
        if (admission.continuedFrom === undefined) {
            if (execution === undefined || execution.engine !== result.engine || result.state !== 'submitted'
                || result.continuedFrom !== undefined)
                throw new Error('invalid submitted Worker steer result');
            return;
        }
        const source = projection.workerExecutions.get(admission.continuedFrom);
        if (source === undefined || result.state !== 'started' || result.continuedFrom !== admission.continuedFrom
            || result.engine !== source.engine)
            throw new Error('invalid started Worker steer result');
        if (execution !== undefined && (execution.continuedFrom !== admission.continuedFrom
            || execution.engine !== result.engine))
            throw new Error('started Worker steer result names another execution');
    }
    assertSameWorkerSteerAdmission(existing, request) {
        const same = existing.requestId === request.requestId
            && existing.workspaceId === request.workspaceId
            && existing.workerRef === request.workerRef
            && existing.instruction === request.instruction
            && existing.initiatedBy === request.initiatedBy
            && existing.continuedFrom === request.continuedFrom
            && existing.aliasOf === request.aliasOf;
        if (!same)
            this.throwRequestCollision(request.requestId);
    }
    workerStartedRecorded(operation) {
        if (operation.kind !== 'team/worker-started')
            throw new Error('not a Worker start record');
        return Object.freeze({ receipt: this.receipt(operation), execution: operation.data.execution,
            ...(operation.data.activity === undefined ? {} : { activity: operation.data.activity }) });
    }
    workerSettledRecorded(operation) {
        if (operation.kind !== 'team/worker-settled')
            throw new Error('not a Worker settlement record');
        const { workerRef, state, settledAt } = operation.data.execution;
        return Object.freeze({ receipt: this.receipt(operation), workerRef, state, settledAt,
            ...(operation.data.activity === undefined ? {} : { activity: operation.data.activity }) });
    }
    assertSameWorkerStart(existing, request) {
        const expected = { ...request.execution, startedAt: existing.occurredAt };
        if (existing.kind !== 'team/worker-started' || !isDeepStrictEqual(existing.data.execution, expected)) {
            this.throwRequestCollision(request.requestId);
        }
    }
    assertSameWorkerSettle(existing, request) {
        const expected = { ...request.settlement, settledAt: existing.occurredAt };
        if (existing.kind !== 'team/worker-settled' || !isDeepStrictEqual(existing.data.execution, expected)) {
            this.throwRequestCollision(request.requestId);
        }
    }
    // ── Project subscriptions ─────────────────────────────────────────────────
    /** Every subscription, deleted ones included: a ref stays resolvable after the terminal state. */
    subscriptions() {
        return Object.freeze([...this.state.subscriptions.values()]);
    }
    /** One Project's subscriptions in creation order. */
    subscriptionsOfProject(projectRef) {
        return Object.freeze((this.state.subscriptionsByProject.get(projectRef) ?? [])
            .flatMap(subscriptionRef => {
            const subscription = this.state.subscriptions.get(subscriptionRef);
            return subscription === undefined ? [] : [subscription];
        }));
    }
    subscription(subscriptionRef) {
        return this.state.subscriptions.get(subscriptionRef);
    }
    subscriptionResumeSequence(subscriptionRef) {
        return this.state.subscriptionResumeSequences.get(subscriptionRef) ?? 0;
    }
    /**
     * The subscription a posted token's address names, or `undefined`: a reset, a dropped
     * trigger or a deletion leave the old token naming nothing. The scan is constant-time
     * over every armed subscription and not a hash index, so the search tells nothing.
     */
    subscriptionByWebhookToken(token) {
        const hash = webhookTokenHash(token);
        for (const subscription of this.state.subscriptions.values()) {
            const arm = subscription.webhook;
            if (arm !== undefined && sameWebhookTokenHash(arm.tokenHash, hash))
                return subscription;
        }
        return undefined;
    }
    /** The ids one subscription must never publish again: its baseline plus everything it accepted. */
    subscriptionKnownIds(subscriptionRef) {
        const known = new Set(this.state.subscriptionBaselines.get(subscriptionRef) ?? []);
        for (const entry of this.state.subscriptionEvents.get(subscriptionRef) ?? [])
            known.add(entry.event.id);
        return known;
    }
    /** Accepted events still waiting for publication, oldest first — the queue a publisher drains. */
    pendingSubscriptionEvents(subscriptionRef) {
        return Object.freeze((this.state.subscriptionEvents.get(subscriptionRef) ?? []).filter(entry => entry.publishedSequence === undefined));
    }
    /** Every accepted event of one subscription in accept order, published ones included. */
    subscriptionEvents(subscriptionRef) {
        return Object.freeze([...(this.state.subscriptionEvents.get(subscriptionRef) ?? [])]);
    }
    /** Durable creation of one subscription, with the ids its trial run asked to ignore. */
    createSubscription(request, requestIntent) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                if (requestIntent !== undefined && existing.data !== undefined && 'request' in existing.data
                    && existing.data.request !== undefined && !isDeepStrictEqual(existing.data.request, requestIntent)) {
                    this.throwRequestCollision(existing.requestId);
                }
                this.assertSameSubscriptionWrite(existing, request);
                return this.resolved(this.subscriptionChangeOf(existing));
            }
            this.activeProject(request.projectRef, request.workspaceId);
            this.requireProjectOwnerActor(request.actor, request.projectRef);
            const problem = subscriptionDefinitionProblem(request);
            if (problem !== undefined)
                throw new Error(`this subscription cannot be created: ${problem}`);
            const baselineProblem = subscriptionIdsProblem(request.baselineIds);
            if (baselineProblem !== undefined)
                throw new Error(`this subscription cannot be created: ${baselineProblem}`);
            const createdBy = this.actorMemberOf(request.actor);
            const notifyProblem = this.subscriptionNotifyProblem(request.projectRef, request.notify);
            if (notifyProblem !== undefined)
                throw new Error(`this subscription cannot be created: ${notifyProblem}`);
            const notify = this.subscriptionNotifyOf(request.notify, createdBy);
            const live = this.subscriptionsOfProject(request.projectRef).filter(entry => entry.state !== 'deleted');
            if (live.length >= SUBSCRIPTION_MAX_PER_PROJECT) {
                throw new Error(`Project '${request.projectRef}' already has ${SUBSCRIPTION_MAX_PER_PROJECT} subscriptions`);
            }
            const sequence = this.nextSequence();
            const base = this.operationBase({ requestId: request.requestId, actor: request.actor }, sequence);
            const armed = this.armedWebhook(undefined, request.triggers, base.occurredAt);
            const subscription = Object.freeze({
                subscriptionRef: this.ref('subscription'),
                projectRef: request.projectRef,
                name: request.name,
                triggers: freezeSubscriptionTriggers(request.triggers),
                script: Object.freeze({ ...request.script }),
                credentials: freezeSubscriptionCredentials(request.credentials),
                revision: 1,
                state: 'active',
                ...(armed.webhook === undefined ? {} : { webhook: armed.webhook }),
                createdBy,
                notify,
                createdAt: base.occurredAt,
            });
            const activity = this.subscriptionActivity(subscription, 'subscription-created', request.actor, sequence, base.occurredAt);
            const operation = Object.freeze({ ...base, kind: 'team/subscription-created',
                data: Object.freeze({ workspaceId: request.workspaceId, subscription, activity, baselineIds: Object.freeze([...request.baselineIds]),
                    ...(requestIntent === undefined ? {} : { request: Object.freeze({ ...requestIntent,
                            scriptSource: Object.freeze({ ...requestIntent.scriptSource }) }) }) }) });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.subscriptionChangeOf(operation, armed.token));
        });
    }
    /** Replace the editable parts of one subscription; every edit is a new revision. */
    updateSubscription(request, requestIntent) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                if (requestIntent !== undefined && existing.data !== undefined && 'request' in existing.data
                    && existing.data.request !== undefined && !isDeepStrictEqual(existing.data.request, requestIntent)) {
                    this.throwRequestCollision(existing.requestId);
                }
                this.assertSameSubscriptionWrite(existing, request);
                return this.resolved(this.subscriptionChangeOf(existing));
            }
            const prior = this.ownedSubscription(request, request.subscriptionRef);
            if (prior.revision !== request.expectedRevision)
                throw new Error(this.subscriptionStaleRevision(prior, request.expectedRevision));
            const problem = subscriptionDefinitionProblem(request);
            if (problem !== undefined)
                throw new Error(`this update cannot be stored: ${problem}`);
            const notifyProblem = request.notify === undefined
                ? undefined : this.subscriptionNotifyProblem(request.projectRef, request.notify);
            if (notifyProblem !== undefined)
                throw new Error(`this update cannot be stored: ${notifyProblem}`);
            const notify = request.notify === undefined ? prior.notify : this.subscriptionNotifyOf(request.notify, prior.createdBy);
            const sequence = this.nextSequence();
            const base = this.operationBase({ requestId: request.requestId, actor: request.actor }, sequence);
            const armed = this.armedWebhook(prior.webhook, request.triggers, base.occurredAt);
            const subscription = Object.freeze({
                ...prior,
                name: request.name,
                triggers: freezeSubscriptionTriggers(request.triggers),
                script: Object.freeze({ ...request.script }),
                credentials: freezeSubscriptionCredentials(request.credentials),
                revision: prior.revision + 1,
                webhook: armed.webhook,
                notify,
            });
            const activity = this.subscriptionActivity(subscription, 'subscription-updated', request.actor, sequence, base.occurredAt);
            const operation = Object.freeze({ ...base, kind: 'team/subscription-updated',
                data: Object.freeze({ workspaceId: request.workspaceId, subscription, previousRevision: prior.revision, activity,
                    ...(requestIntent === undefined ? {} : { request: Object.freeze({ ...requestIntent,
                            scriptSource: Object.freeze({ ...requestIntent.scriptSource }) }) }) }) });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.subscriptionChangeOf(operation, armed.token));
        });
    }
    pauseSubscription(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameSubscriptionWrite(existing, request);
                return this.resolved(this.subscriptionChangeOf(existing));
            }
            if (request.actor.kind === 'host' && request.reason !== 'failures')
                throw new Error('only the failures a run reported may pause a subscription without an owner');
            const prior = this.ownedSubscription(request, request.subscriptionRef, { hostMayPause: true });
            if (prior.revision !== request.expectedRevision)
                throw new Error(this.subscriptionStaleRevision(prior, request.expectedRevision));
            if (prior.state !== 'active')
                throw new Error(`subscription '${prior.subscriptionRef}' is already ${prior.state === 'deleted' ? 'deleted' : 'paused'}`);
            const subscription = Object.freeze({ ...prior, state: 'paused', pausedReason: request.reason });
            return this.commitSubscriptionState('team/subscription-paused', request, subscription, 'subscription-paused', request.reason);
        });
    }
    resumeSubscription(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameSubscriptionWrite(existing, request);
                return this.resolved(this.subscriptionChangeOf(existing));
            }
            const prior = this.ownedSubscription(request, request.subscriptionRef);
            if (prior.revision !== request.expectedRevision)
                throw new Error(this.subscriptionStaleRevision(prior, request.expectedRevision));
            if (prior.state !== 'paused')
                throw new Error(`subscription '${prior.subscriptionRef}' is not paused`);
            const subscription = Object.freeze({ ...prior, state: 'active', pausedReason: undefined });
            return this.commitSubscriptionState('team/subscription-resumed', request, subscription, 'subscription-resumed');
        });
    }
    deleteSubscription(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameSubscriptionWrite(existing, request);
                return this.resolved(this.subscriptionChangeOf(existing));
            }
            const prior = this.ownedSubscription(request, request.subscriptionRef);
            if (prior.revision !== request.expectedRevision)
                throw new Error(this.subscriptionStaleRevision(prior, request.expectedRevision));
            const subscription = Object.freeze({ ...prior, state: 'deleted', pausedReason: undefined });
            return this.commitSubscriptionState('team/subscription-deleted', request, subscription, 'subscription-deleted');
        });
    }
    /**
     * Replace one subscription's webhook address. Like pause it is a state transition, so
     * the revision does not move: accepted deliveries keep their version and only the old
     * address stops resolving. The new token is returned once, never stored in the clear.
     */
    resetSubscriptionWebhook(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameSubscriptionWrite(existing, request);
                return this.resolved(this.subscriptionChangeOf(existing));
            }
            const prior = this.ownedSubscription(request, request.subscriptionRef);
            if (prior.revision !== request.expectedRevision)
                throw new Error(this.subscriptionStaleRevision(prior, request.expectedRevision));
            const armed = prior.webhook;
            if (armed === undefined) {
                throw new Error(`subscription '${prior.subscriptionRef}' has no webhook address to reset; enable the webhook trigger first`);
            }
            const sequence = this.nextSequence();
            const base = this.operationBase({ requestId: request.requestId, actor: request.actor }, sequence);
            const token = this.createWebhookToken();
            const subscription = Object.freeze({ ...prior,
                webhook: Object.freeze({ tokenHash: webhookTokenHash(token), generation: armed.generation + 1, armedAt: base.occurredAt }) });
            const activity = this.subscriptionActivity(subscription, 'subscription-webhook-reset', request.actor, sequence, base.occurredAt);
            const operation = Object.freeze({ ...base, kind: 'team/subscription-webhook-reset',
                data: Object.freeze({ workspaceId: request.workspaceId, subscription, previousGeneration: armed.generation, activity }) });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.subscriptionChangeOf(operation, token));
        });
    }
    /** Append ids to the deduplication waterline; nothing already recorded is removed. */
    baselineSubscription(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameSubscriptionWrite(existing, request);
                return this.resolved(this.receipt(existing));
            }
            const prior = this.ownedSubscription(request, request.subscriptionRef);
            const problem = subscriptionIdsProblem(request.ids);
            if (problem !== undefined)
                throw new Error(`this baseline cannot be stored: ${problem}`);
            if (request.ids.length === 0)
                throw new Error('a baseline needs at least one id to ignore');
            const known = this.subscriptionKnownIds(prior.subscriptionRef);
            const repeated = request.ids.find(id => known.has(id));
            if (repeated !== undefined)
                throw new Error(`id '${repeated}' is already known to this subscription; a baseline only appends`);
            const operation = Object.freeze({
                ...this.operationBase({ requestId: request.requestId, actor: request.actor }, this.nextSequence()),
                kind: 'team/subscription-baseline',
                data: Object.freeze({ workspaceId: request.workspaceId, projectRef: prior.projectRef,
                    subscriptionRef: prior.subscriptionRef, ids: Object.freeze([...request.ids]) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.receipt(operation));
        });
    }
    /**
     * Accept one run's validated output as durable facts. Deduplication and the
     * backlog ceiling are rechecked here, against the projection rather than the
     * caller's view: two runs that finish together must not both cross 500.
     */
    acceptSubscriptionEvents(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameSubscriptionWrite(existing, request);
                return this.resolved(this.subscriptionAcceptOf(existing));
            }
            this.activeProject(request.projectRef, request.workspaceId);
            const subscription = this.state.subscriptions.get(request.subscriptionRef);
            if (subscription === undefined || subscription.projectRef !== request.projectRef) {
                throw new Error(`subscription '${request.subscriptionRef}' does not belong to Project '${request.projectRef}'`);
            }
            if (subscription.state === 'deleted')
                throw new Error(`subscription '${subscription.subscriptionRef}' is deleted (subscription_deleted)`);
            if (request.subscriptionRevision < 1 || request.subscriptionRevision > subscription.revision) {
                throw new Error(`run revision ${request.subscriptionRevision} is not a revision of '${subscription.subscriptionRef}' (current ${subscription.revision})`);
            }
            if (!isScriptHash(request.scriptHash))
                throw new Error('a run must name the script hash it executed');
            const ranRevision = this.state.subscriptionScriptHistory.get(subscription.subscriptionRef)?.get(request.subscriptionRevision);
            if (ranRevision !== request.scriptHash) {
                throw new Error(`run revision ${request.subscriptionRevision} of '${subscription.subscriptionRef}' ran script '${request.scriptHash}', `
                    + `which is not the script that revision carries (subscription_script_mismatch)`);
            }
            const pending = this.pendingSubscriptionEvents(subscription.subscriptionRef).length;
            if (pending + request.events.length > SUBSCRIPTION_PENDING_MAX) {
                throw new Error(`this run would leave ${pending + request.events.length} unpublished events for '${subscription.subscriptionRef}'; the ceiling is ${SUBSCRIPTION_PENDING_MAX} (subscription_backlog_full)`);
            }
            const known = this.subscriptionKnownIds(subscription.subscriptionRef);
            const problem = subscriptionRunEventsProblem(request.events, known);
            if (problem !== undefined)
                throw new Error(`this run cannot be accepted: ${problem}`);
            const operation = Object.freeze({
                ...this.operationBase({ requestId: request.requestId, actor: request.actor }, this.nextSequence()),
                kind: 'team/subscription-events-accepted',
                data: Object.freeze({ workspaceId: request.workspaceId, projectRef: request.projectRef, subscriptionRef: subscription.subscriptionRef,
                    subscriptionRevision: request.subscriptionRevision, scriptHash: request.scriptHash, events: Object.freeze(request.events.map(event => Object.freeze({ ...event }))) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.subscriptionAcceptOf(operation));
        });
    }
    /**
     * Publish one accepted event. The recipients are frozen here, at the publish
     * commit: the subscription's own `notify` set, minus anyone who has left the
     * Project since. Ownership never substitutes for it — an event is addressed
     * intelligence, so a subscription whose recipients are all gone reaches nobody.
     */
    publishSubscriptionEvent(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameSubscriptionWrite(existing, request);
                return this.resolved(this.subscriptionPublishOf(existing));
            }
            this.activeProject(request.projectRef, request.workspaceId);
            const subscription = this.state.subscriptions.get(request.subscriptionRef);
            if (subscription === undefined || subscription.projectRef !== request.projectRef) {
                throw new Error(`subscription '${request.subscriptionRef}' does not belong to Project '${request.projectRef}'`);
            }
            if (subscription.state === 'deleted')
                throw new Error(`subscription '${subscription.subscriptionRef}' is deleted (subscription_deleted)`);
            const accepted = (this.state.subscriptionEvents.get(subscription.subscriptionRef) ?? [])
                .find(entry => entry.acceptedSequence === request.acceptedSequence && entry.event.id === request.eventId);
            if (accepted === undefined)
                throw new Error(`event '${request.eventId}' was never accepted by '${subscription.subscriptionRef}'`);
            if (accepted.publishedSequence !== undefined)
                throw new Error(`event '${request.eventId}' was already published`);
            const sequence = this.nextSequence();
            const eventRef = `event:${sequence}`;
            const markers = this.state.rulesVersion >= 5
                ? subscription.notify
                    .filter(memberId => this.notifyRecipientIsLive(subscription.projectRef, memberId))
                    .map(memberId => Object.freeze({ memberId, projectRef: subscription.projectRef, eventRef, sequence }))
                : [AGENT_TEAM_HUMAN_MEMBER_ID, ...this.projectOwnerIds(subscription.projectRef)]
                    .map(memberId => Object.freeze({ memberId, projectRef: subscription.projectRef, eventRef, sequence }));
            const operation = Object.freeze({
                ...this.operationBase({ requestId: request.requestId, actor: request.actor }, sequence),
                kind: 'team/subscription-event-published',
                data: Object.freeze({ workspaceId: request.workspaceId, projectRef: subscription.projectRef,
                    subscriptionRef: subscription.subscriptionRef, subscriptionName: subscription.name,
                    acceptedSequence: accepted.acceptedSequence, eventId: accepted.event.id,
                    inbox: this.inboxDelta([], [], [], [], [], [], markers) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.subscriptionPublishOf(operation));
        });
    }
    /** Commit one non-deleting lifecycle transition with its Main stream line. */
    async commitSubscriptionState(kind, request, subscription, activityKind, reason) {
        const sequence = this.nextSequence();
        const base = this.operationBase({ requestId: request.requestId, actor: request.actor }, sequence);
        const activity = this.subscriptionActivity(subscription, activityKind, request.actor, sequence, base.occurredAt, reason);
        // The Host's own pause is the one lifecycle line nobody asked for: it
        // carries a marker per owner, the Human and the unfollowed included, so the
        // news reaches them the way a published event does.
        const inbox = reason === 'failures'
            ? this.inboxDelta([], [], [], [], [], [], [AGENT_TEAM_HUMAN_MEMBER_ID, ...this.projectOwnerIds(subscription.projectRef)]
                .map(memberId => Object.freeze({ memberId, projectRef: subscription.projectRef, activityRef: activity.activityRef, sequence })))
            : undefined;
        const operation = Object.freeze({ ...base, kind,
            data: Object.freeze({ workspaceId: request.workspaceId, subscription, activity, ...(inbox === undefined ? {} : { inbox }) }) });
        await this.table.put(operation.operationId, operation);
        this.applyAndAdvanceProjectionVersion(operation);
        return this.committed(this.subscriptionChangeOf(operation));
    }
    subscriptionActivity(subscription, kind, actor, sequence, occurredAt, reason) {
        return Object.freeze({ activityRef: this.ref('activity'), projectRef: subscription.projectRef,
            kind, subscriptionRef: subscription.subscriptionRef, subscriptionName: subscription.name, revision: subscription.revision,
            ...(reason === undefined ? {} : { reason }), ...(actor.kind === 'host' ? {} : { actor: actor.memberId }), sequence, occurredAt });
    }
    activeProject(projectRef, workspaceId) {
        const project = this.state.projects.get(projectRef);
        if (project === undefined || project.workspaceId !== workspaceId) {
            throw new Error(`Project '${projectRef}' is not in Workspace '${workspaceId}'`);
        }
        if (project.state !== 'active')
            throw new Error(`Project '${projectRef}' is archived; its subscriptions cannot change`);
        return project;
    }
    /**
     * Resolve one subscription its caller may edit: same Project, not deleted,
     * and the caller owns that Project. Only the Host's own automatic pause may
     * act without an owner behind it.
     */
    ownedSubscription(request, subscriptionRef, options) {
        if (request.actor.kind === 'host') {
            if (options?.hostMayPause !== true)
                throw new Error('a subscription write needs a Human or Agent Member actor');
        }
        else {
            this.requireProjectOwnerActor(request.actor, request.projectRef);
        }
        const subscription = this.state.subscriptions.get(subscriptionRef);
        if (subscription === undefined || subscription.projectRef !== request.projectRef) {
            throw new Error(`subscription '${subscriptionRef}' does not belong to Project '${request.projectRef}'`);
        }
        if (subscription.state === 'deleted')
            throw new Error(`subscription '${subscriptionRef}' is deleted (subscription_deleted)`);
        return this.subscriptionCarriedForward(subscription);
    }
    /**
     * The prior subscription as a write may store it again. Every lifecycle
     * record copies the whole subscription forward, and replay requires each
     * stored recipient to belong to the Project at its own commit, so an address
     * that can no longer receive is dropped here — at the write, never tolerated
     * in validation, which would let a real corruption through with it.
     */
    subscriptionCarriedForward(subscription) {
        const live = subscription.notify.filter(memberId => this.notifyRecipientIsLive(subscription.projectRef, memberId));
        if (live.length === subscription.notify.length)
            return subscription;
        return Object.freeze({ ...subscription, notify: Object.freeze(live) });
    }
    subscriptionStaleRevision(prior, expected) {
        return `subscription '${prior.subscriptionRef}' is at revision ${prior.revision}, not ${expected} (stale_revision)`;
    }
    actorMemberOf(actor) {
        if (actor.kind === 'host')
            throw new Error('a subscription write needs a Human or Agent Member actor');
        return actor.memberId;
    }
    /**
     * The webhook arm a write leaves behind. Enabling mints a token the caller receives
     * once; an edit that keeps the trigger keeps the address, so only a reset or dropping
     * the trigger moves it. `generation` counts addresses armed under this trigger, so two
     * resets stay distinguishable without either token.
     */
    armedWebhook(prior, triggers, armedAt) {
        if (triggers.webhook !== true)
            return {};
        if (prior !== undefined)
            return { webhook: prior };
        const token = this.createWebhookToken();
        return { token, webhook: Object.freeze({ tokenHash: webhookTokenHash(token), generation: 1, armedAt }) };
    }
    subscriptionChangeOf(operation, webhookToken) {
        if (operation.kind !== 'team/subscription-created' && operation.kind !== 'team/subscription-updated'
            && operation.kind !== 'team/subscription-paused' && operation.kind !== 'team/subscription-resumed'
            && operation.kind !== 'team/subscription-deleted' && operation.kind !== 'team/subscription-webhook-reset') {
            throw new Error(`operation ${operation.kind} is not a subscription write`);
        }
        return Object.freeze({ receipt: this.receipt(operation), subscription: operation.data.subscription, activity: operation.data.activity,
            ...(webhookToken === undefined ? {} : { webhookToken }) });
    }
    subscriptionAcceptOf(operation) {
        if (operation.kind !== 'team/subscription-events-accepted')
            throw new Error(`operation ${operation.kind} is not an event acceptance`);
        const accepted = (this.state.subscriptionEvents.get(operation.data.subscriptionRef) ?? [])
            .filter(entry => entry.acceptedSequence === operation.sequence);
        return Object.freeze({ receipt: this.receipt(operation), subscriptionRef: operation.data.subscriptionRef, accepted: Object.freeze(accepted) });
    }
    subscriptionPublishOf(operation) {
        if (operation.kind !== 'team/subscription-event-published')
            throw new Error(`operation ${operation.kind} is not an event publication`);
        const accepted = (this.state.subscriptionEvents.get(operation.data.subscriptionRef) ?? [])
            .find(entry => entry.acceptedSequence === operation.data.acceptedSequence && entry.event.id === operation.data.eventId);
        if (accepted === undefined)
            throw new Error('a published event lost its acceptance');
        return Object.freeze({ receipt: this.receipt(operation), published: Object.freeze({
                eventRef: `event:${operation.sequence}`,
                projectRef: operation.data.projectRef, subscriptionRef: operation.data.subscriptionRef,
                subscriptionName: operation.data.subscriptionName, event: accepted.event,
                acceptedSequence: accepted.acceptedSequence, sequence: operation.sequence, occurredAt: operation.occurredAt
            }) });
    }
    /**
     * A retry under the same request id must be the same write. The stored
     * operation is the only durable copy of what the first call asked for, so
     * every field the caller supplied is compared against it — a second call that
     * only renames the target, moves the revision it expects, or names other
     * event ids is a collision, not a resolved retry.
     */
    /**
     * The write a request id already committed, so its Remote retry can answer
     * from the ledger without running the script again. A create's baseline came
     * from its trial, which a retry must not re-run, so the committed baseline
     * stands and every other field is still compared.
     */
    subscriptionWriteReplay(request) {
        const existing = this.state.byRequest.get(request.requestId);
        if (existing === undefined)
            return undefined;
        if ('kind' in request && (request.kind === 'create' || request.kind === 'update')) {
            this.assertSameSubscriptionReplay(existing, request);
        }
        else if (existing.kind === 'team/subscription-created') {
            const created = request;
            this.assertSameSubscriptionWrite(existing, { ...created, baselineIds: existing.data.baselineIds });
        }
        else {
            this.assertSameSubscriptionWrite(existing, request);
        }
        return Object.freeze({ value: this.subscriptionChangeOf(existing), addressArmed: this.subscriptionWriteArmedAddress(existing) });
    }
    assertSameSubscriptionReplay(existing, request) {
        const data = existing.data;
        if (!this.sameActor(existing.actor, request.actor) || data.workspaceId !== request.workspaceId
            || (existing.kind !== 'team/subscription-created' && existing.kind !== 'team/subscription-updated')) {
            this.throwRequestCollision(existing.requestId);
        }
        const stored = existing.data.subscription;
        const credentials = Object.freeze([...(request.credentials ?? [])]);
        const common = request.projectRef === stored.projectRef && request.name.trim() === stored.name
            && isDeepStrictEqual(credentials, stored.credentials) && this.sameAskedNotify(request.notify, stored.notify);
        if (!common)
            this.throwRequestCollision(existing.requestId);
        if ('scriptContent' in request.script && request.script.scriptContent !== stored.script.content) {
            this.throwRequestCollision(existing.requestId);
        }
        if (existing.data.request === undefined && 'scriptPath' in request.script) {
            throw new Error(`agent-team cannot verify a legacy script path for request id '${existing.requestId}'; read committed subscription '${stored.subscriptionRef}' before starting a new request`);
        }
        if (existing.kind === 'team/subscription-created') {
            if (request.kind !== 'create')
                this.throwRequestCollision(existing.requestId);
            const intent = this.createSubscriptionRequestIntent(request);
            if (existing.data.request !== undefined) {
                if (!isDeepStrictEqual(existing.data.request, intent))
                    this.throwRequestCollision(existing.requestId);
            }
            else if (!this.sameLegacyCreateReplay(existing, request)) {
                this.throwRequestCollision(existing.requestId);
            }
            return;
        }
        if (request.kind !== 'update' || request.subscriptionRef !== stored.subscriptionRef
            || request.expectedRevision !== existing.data.previousRevision) {
            this.throwRequestCollision(existing.requestId);
        }
        const intent = this.updateSubscriptionRequestIntent(request);
        if (existing.data.request !== undefined) {
            if (!isDeepStrictEqual(existing.data.request, intent))
                this.throwRequestCollision(existing.requestId);
        }
        else if (!this.sameLegacyUpdateReplay(existing, request)) {
            this.throwRequestCollision(existing.requestId);
        }
    }
    /**
     * Whether a retry asks for the recipients the committed write stored. An
     * omitted set asks for nothing of its own — on a create that is the
     * Creating Member, on an update the set already stored — so it can never
     * contradict the first answer.
     */
    sameAskedNotify(asked, stored) {
        return asked === undefined || isDeepStrictEqual(Object.freeze([...new Set(asked)].sort()), stored);
    }
    createSubscriptionRequestIntent(request) {
        return Object.freeze({ ...this.updateSubscriptionRequestIntent(request), baseline: request.baseline ?? 'current-output' });
    }
    updateSubscriptionRequestIntent(request) {
        return Object.freeze({ ...(request.intervalMinutes === undefined ? {} : { intervalMinutes: request.intervalMinutes }),
            ...(request.webhook === undefined ? {} : { webhook: request.webhook }),
            scriptSource: Object.freeze('scriptPath' in request.script
                ? { kind: 'path', path: request.script.scriptPath }
                : { kind: 'content' }) });
    }
    /** Old creates carry no source or baseline intent; compare every fact their operation did retain. */
    sameLegacyCreateReplay(existing, request) {
        const triggers = Object.freeze({ ...(request.intervalMinutes === undefined ? {} : { interval: Object.freeze({ minutes: request.intervalMinutes }) }),
            ...(request.webhook === true ? { webhook: true } : {}) });
        if (!isDeepStrictEqual(triggers, existing.data.subscription.triggers))
            return false;
        return !(request.baseline === 'ignore-history' && existing.data.baselineIds.length > 0);
    }
    /** Old updates lack the caller's omitted-or-explicit trigger intent, so compare the effects they did record. */
    sameLegacyUpdateReplay(existing, request) {
        const stored = existing.data.subscription;
        if ((request.intervalMinutes === undefined ? undefined : request.intervalMinutes) !== stored.triggers.interval?.minutes)
            return false;
        if (request.webhook === true && stored.triggers.webhook !== true)
            return false;
        if (request.webhook === false && stored.triggers.webhook === true)
            return false;
        return true;
    }
    subscriptionWriteArmedAddress(operation) {
        if (operation.kind === 'team/subscription-created')
            return operation.data.subscription.webhook !== undefined;
        if (operation.kind === 'team/subscription-webhook-reset')
            return true;
        if (operation.kind !== 'team/subscription-updated' || operation.data.subscription.webhook === undefined)
            return false;
        let priorWebhook;
        let found = false;
        for (let index = this.state.ordered.length - 1; index >= 0; index -= 1) {
            const candidate = this.state.ordered[index];
            if (candidate.sequence >= operation.sequence || candidate.kind !== 'team/subscription-created'
                && candidate.kind !== 'team/subscription-updated' && candidate.kind !== 'team/subscription-paused'
                && candidate.kind !== 'team/subscription-resumed' && candidate.kind !== 'team/subscription-deleted'
                && candidate.kind !== 'team/subscription-webhook-reset')
                continue;
            if (candidate.data.subscription.subscriptionRef !== operation.data.subscription.subscriptionRef
                || candidate.data.subscription.revision !== operation.data.previousRevision)
                continue;
            priorWebhook = candidate.data.subscription.webhook;
            found = true;
            break;
        }
        return found && priorWebhook === undefined;
    }
    assertSameSubscriptionWrite(existing, request) {
        const data = existing.data;
        if (!this.sameActor(existing.actor, request.actor) || data.workspaceId !== request.workspaceId) {
            this.throwRequestCollision(existing.requestId);
        }
        if (!this.sameSubscriptionRequest(existing, request))
            this.throwRequestCollision(existing.requestId);
    }
    /** The per-kind payload comparison behind {@link assertSameSubscriptionWrite}. */
    sameSubscriptionRequest(existing, request) {
        switch (existing.kind) {
            case 'team/subscription-created': {
                const asked = request;
                const stored = existing.data.subscription;
                return asked.projectRef === stored.projectRef && asked.name === stored.name
                    && isDeepStrictEqual(asked.triggers, stored.triggers) && isDeepStrictEqual(asked.script, stored.script)
                    && isDeepStrictEqual(asked.credentials, stored.credentials)
                    && this.sameAskedNotify(asked.notify, stored.notify)
                    && isDeepStrictEqual(asked.baselineIds, existing.data.baselineIds);
            }
            case 'team/subscription-updated': {
                const asked = request;
                const stored = existing.data.subscription;
                return asked.projectRef === stored.projectRef && asked.subscriptionRef === stored.subscriptionRef
                    && asked.expectedRevision === existing.data.previousRevision && asked.name === stored.name
                    && isDeepStrictEqual(asked.triggers, stored.triggers) && isDeepStrictEqual(asked.script, stored.script)
                    && isDeepStrictEqual(asked.credentials, stored.credentials)
                    && this.sameAskedNotify(asked.notify, stored.notify);
            }
            case 'team/subscription-paused': {
                const asked = request;
                const stored = existing.data.subscription;
                // The pause is the one transition that carries a reason, and the Host's
                // own failure pause is the one that carries none of its own.
                return asked.projectRef === stored.projectRef && asked.subscriptionRef === stored.subscriptionRef
                    && asked.expectedRevision === stored.revision && asked.reason === stored.pausedReason;
            }
            case 'team/subscription-resumed':
            case 'team/subscription-deleted':
            case 'team/subscription-webhook-reset': {
                const asked = request;
                const stored = existing.data.subscription;
                return asked.projectRef === stored.projectRef && asked.subscriptionRef === stored.subscriptionRef
                    && asked.expectedRevision === stored.revision;
            }
            case 'team/subscription-baseline': {
                const asked = request;
                return asked.projectRef === existing.data.projectRef && asked.subscriptionRef === existing.data.subscriptionRef
                    && isDeepStrictEqual(asked.ids, existing.data.ids);
            }
            case 'team/subscription-events-accepted': {
                const asked = request;
                return asked.projectRef === existing.data.projectRef && asked.subscriptionRef === existing.data.subscriptionRef
                    && asked.subscriptionRevision === existing.data.subscriptionRevision && asked.scriptHash === existing.data.scriptHash
                    && isDeepStrictEqual(asked.events, existing.data.events);
            }
            case 'team/subscription-event-published': {
                const asked = request;
                return asked.projectRef === existing.data.projectRef && asked.subscriptionRef === existing.data.subscriptionRef
                    && asked.acceptedSequence === existing.data.acceptedSequence && asked.eventId === existing.data.eventId;
            }
            default:
                return false;
        }
    }
    /** Every reminder one Member owns, newest creation first, with the occurrence facts a surface renders. */
    memberRemindersOf(memberId) {
        return this.memberRemindersOfFrom(this.state, memberId);
    }
    memberRemindersOfFrom(projection, memberId) {
        const member = projection.members.get(memberId);
        // An archived or removed Member's reminders are all cancelled: the lifecycle
        // rule is derived, so replay never depends on a second cleanup write.
        const lifecycleState = member?.state;
        const reminders = [...projection.memberReminders.values()]
            .filter(reminder => reminder.memberId === memberId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.reminderRef.localeCompare(left.reminderRef));
        return Object.freeze(reminders.map(reminder => {
            const occurrence = projection.memberReminderOccurrences.get(reminder.reminderRef);
            const cancelled = member === undefined || lifecycleState === 'archived' || lifecycleState === 'inactive';
            const state = cancelled ? 'cancelled' : reminder.state;
            const pending = occurrence?.consumedSequence === undefined ? occurrence : undefined;
            const next = state === 'active'
                ? nextOccurrenceAt(reminder.schedule, occurrence === undefined ? Date.parse(reminder.createdAt) : Date.parse(occurrence.scheduledAt))
                : undefined;
            return Object.freeze({
                reminder: state === reminder.state ? reminder : { ...reminder, state },
                ...(pending === undefined ? {} : { pendingOccurrenceAt: pending.scheduledAt }),
                ...(occurrence === undefined ? {} : { lastOccurrenceAt: occurrence.scheduledAt }),
                ...(next === undefined || !Number.isFinite(next) ? {} : { nextOccurrenceAt: new Date(next).toISOString() }),
            });
        }));
    }
    /** Active reminders one Member carries; the create ceiling compares against this. */
    activeMemberReminderCount(memberId) {
        return this.activeMemberReminderCountFrom(this.state, memberId);
    }
    activeMemberReminderCountFrom(projection, memberId) {
        const member = projection.members.get(memberId);
        if (member !== undefined && (member.state === 'archived' || member.state === 'inactive'))
            return 0;
        return [...projection.memberReminders.values()].filter(reminder => reminder.memberId === memberId && reminder.state === 'active').length;
    }
    /** Unconsumed occurrences of one Member's reminders: the private Inbox unread that wakes them. */
    unreadMemberRemindersFor(memberId) {
        const member = this.state.members.get(memberId);
        // Archived and removed Members have every reminder cancelled, so the private
        // unread an earlier occurrence left behind is withdrawn with them.
        if (member !== undefined && (member.state === 'archived' || member.state === 'inactive'))
            return [];
        const markers = this.state.memberReminderMarkersByMember.get(memberId);
        if (markers === undefined || markers.size === 0)
            return [];
        const unread = [];
        for (const bucket of markers.values()) {
            for (const marker of bucket) {
                const reminder = this.state.memberReminders.get(marker.reminderRef);
                const occurrence = this.state.memberReminderOccurrences.get(marker.reminderRef);
                if (reminder === undefined || occurrence === undefined || occurrence.consumedSequence !== undefined)
                    continue;
                unread.push(Object.freeze({ reminder, scheduledAt: occurrence.scheduledAt, sequence: marker.sequence }));
            }
        }
        return Object.freeze(unread.sort((left, right) => left.sequence - right.sequence));
    }
    /** A Member's own reminders, as the tool renders them. */
    memberReminderList(memberId) {
        return this.memberRemindersOf(memberId);
    }
    /**
     * A Member creates a reminder for itself. The schedule and note are validated
     * here rather than at the caller so one authority decides what is committable,
     * and the per-Member ceiling counts the reminders that are still active.
     */
    createMemberReminder(request) {
        return this.enqueue(async () => {
            // A ref the durable schema cannot parse back would leave a record that
            // fails on replay, so the create boundary refuses it rather than the next
            // Host start.
            if (!reminderRefIsStorable(request.reminderRef)) {
                throw new Error(`Reminder ref '${request.reminderRef}' is not storable: it must be 'reminder:' followed by a value with no further colon`);
            }
            // Normalized first, so an idempotent replay compares the promise itself
            // rather than the spelling of it, and a changed schedule or note under a
            // reused request id is a collision instead of a silent original.
            const schedule = parseReminderSchedule(request.schedule);
            if (!schedule.ok)
                throw new Error(schedule.reason);
            const note = parseReminderNote(request.note);
            if (!note.ok)
                throw new Error(note.reason);
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                if (existing.kind !== 'team/member-reminder-created')
                    this.throwRequestCollision(request.requestId);
                if (existing.data.workspaceId !== request.workspaceId || existing.data.reminder.reminderRef !== request.reminderRef
                    || existing.data.reminder.memberId !== request.actor.memberId
                    || !sameReminderIntent(existing.data.reminder, schedule.schedule, note.note)) {
                    this.throwRequestCollision(request.requestId);
                }
                return this.resolved({ receipt: this.receipt(existing), workspaceId: existing.data.workspaceId, reminder: existing.data.reminder,
                    activeCount: this.activeMemberReminderCount(existing.data.reminder.memberId) });
            }
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            const member = this.state.members.get(actor.memberId);
            if (member === undefined || member.state !== 'enabled')
                throw new Error(`Member '${actor.memberId}' cannot create a reminder while it is ${member?.state ?? 'unknown'}`);
            if (this.state.memberReminders.has(request.reminderRef))
                throw new Error(`Reminder '${request.reminderRef}' already exists`);
            const activeCount = this.activeMemberReminderCount(actor.memberId);
            if (activeCount >= MAX_ACTIVE_REMINDERS_PER_MEMBER) {
                throw new Error(`Member '${actor.memberId}' already carries ${activeCount} active reminders, the maximum of ${MAX_ACTIVE_REMINDERS_PER_MEMBER}; cancel one before creating another`);
            }
            const reminder = Object.freeze({
                reminderRef: request.reminderRef, memberId: actor.memberId, schedule: schedule.schedule, note: note.note,
                state: 'active', createdAt: this.createOccurredAt(),
            });
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/member-reminder-created',
                data: Object.freeze({ workspaceId: request.workspaceId, reminder }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed({ receipt: this.receipt(operation), workspaceId: request.workspaceId, reminder, activeCount: activeCount + 1 });
        });
    }
    /**
     * Withdraw one reminder. The Member that owns it withdraws its own; the Human
     * may withdraw any, because the Human sees them in Member detail.
     */
    cancelMemberReminder(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                if (existing.kind !== 'team/member-reminder-cancelled')
                    this.throwRequestCollision(request.requestId);
                if (existing.data.workspaceId !== request.workspaceId || existing.data.reminderRef !== request.reminderRef
                    || existing.data.memberId !== (request.actor.kind === 'member' ? request.actor.memberId : existing.data.memberId)) {
                    this.throwRequestCollision(request.requestId);
                }
                return this.resolved({ receipt: this.receipt(existing), workspaceId: existing.data.workspaceId, reminder: existing.data.reminder });
            }
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            const current = this.state.memberReminders.get(request.reminderRef);
            if (current === undefined)
                throw new Error(`Reminder '${request.reminderRef}' does not exist`);
            if (actor.kind === 'member' && current.memberId !== actor.memberId) {
                throw new Error(`Reminder '${request.reminderRef}' belongs to Member '${current.memberId}', not to '${actor.memberId}'`);
            }
            if (current.state !== 'active')
                throw new Error(`Reminder '${request.reminderRef}' is already ${current.state}`);
            const marker = this.state.memberReminderMarkers.get(`${current.memberId}|${current.reminderRef}`);
            const reminder = { ...current, state: 'cancelled' };
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/member-reminder-cancelled',
                data: Object.freeze({ workspaceId: request.workspaceId, memberId: current.memberId, reminderRef: request.reminderRef, reminder,
                    inbox: this.memberReminderInboxDelta([], marker === undefined ? [] : [marker]) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed({ receipt: this.receipt(operation), workspaceId: request.workspaceId, reminder });
        });
    }
    /** Every active reminder as the planner sees it: durable facts plus the Member lifecycle that still governs it. */
    memberReminderPlanEntries() {
        return [...this.state.memberReminders.values()].filter(reminder => reminder.state === 'active').map(reminder => {
            const occurrence = this.state.memberReminderOccurrences.get(reminder.reminderRef);
            return Object.freeze({
                reminderRef: reminder.reminderRef,
                memberId: reminder.memberId,
                schedule: reminder.schedule,
                state: reminder.state,
                memberState: this.state.members.get(reminder.memberId)?.state ?? 'inactive',
                createdAtMs: Date.parse(reminder.createdAt),
                lastOccurrenceAtMs: occurrence === undefined ? undefined : Date.parse(occurrence.scheduledAt),
            });
        });
    }
    /** Occurrences due now, at most one per reminder. */
    planMemberReminders(nowMs) {
        return planMemberReminders({ nowMs, reminders: this.memberReminderPlanEntries() });
    }
    /** The instant the Host must next wake for, or undefined while nothing is pending. */
    nextMemberReminderWakeAt(nowMs) {
        return nextReminderWakeAt(this.memberReminderPlanEntries(), nowMs);
    }
    /**
     * Raise one occurrence. Replanned first, exactly as a Task reminder is, so a
     * baseline that moved while the write waited is not committed.
     */
    raiseMemberReminder(candidate) {
        return this.enqueue(async () => {
            const reminderRef = candidate.reminderRef;
            const stillDue = this.planMemberReminders(Date.now()).some(planned => planned.reminderRef === candidate.reminderRef);
            if (!stillDue)
                return undefined;
            const reminder = this.state.memberReminders.get(reminderRef);
            if (reminder === undefined || reminder.state !== 'active')
                return undefined;
            const member = this.state.members.get(reminder.memberId);
            if (member === undefined || (member.state !== 'enabled' && member.state !== 'suspended'))
                return undefined;
            const previous = this.state.memberReminderMarkers.get(`${reminder.memberId}|${reminderRef}`);
            const sequence = this.nextSequence();
            const marker = Object.freeze({ memberId: reminder.memberId, reminderRef, sequence });
            const requestId = `agent-team:member-reminder:${reminderRef}:${sequence}`;
            const operation = Object.freeze({
                ...this.operationBase({ requestId, actor: HOST_ACTOR }, sequence), kind: 'team/member-reminder-raised',
                data: Object.freeze({ workspaceId: member.workspaceId, memberId: reminder.memberId, reminderRef, scheduledAt: candidate.scheduledAt,
                    inbox: this.memberReminderInboxDelta([marker], previous === undefined ? [] : [previous]) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.receipt(operation);
        });
    }
    /**
     * Record that these occurrences reached their Member's context, consuming
     * their markers. Consumption is by occurrence identity, not by reminder: a
     * notice that named an older occurrence must not consume the newer one that
     * replaced it while the notice waited unread. A Host that restarts before this
     * write leaves the markers unconsumed, so the next wake redelivers the same
     * occurrence: at least once.
     */
    consumeMemberReminders(memberId, occurrences) {
        return this.enqueue(async () => {
            const receipts = [];
            for (const occurrence of occurrences) {
                const marker = this.state.memberReminderMarkers.get(`${memberId}|${occurrence.reminderRef}`);
                const raised = this.state.memberReminderOccurrences.get(occurrence.reminderRef);
                const member = this.state.members.get(memberId);
                // The marker still stored is the one this occurrence delivered: a newer
                // occurrence has replaced it, so this one is already superseded and the
                // newer one has never entered a turn.
                if (marker === undefined || marker.sequence !== occurrence.sequence)
                    continue;
                if (raised === undefined || raised.consumedSequence !== undefined || member === undefined)
                    continue;
                const sequence = this.nextSequence();
                const requestId = `agent-team:member-reminder-consumed:${memberId}:${occurrence.reminderRef}:${sequence}`;
                const operation = Object.freeze({
                    ...this.operationBase({ requestId, actor: HOST_ACTOR }, sequence), kind: 'team/member-reminder-consumed',
                    data: Object.freeze({ workspaceId: member.workspaceId, memberId, reminderRef: occurrence.reminderRef,
                        inbox: this.memberReminderInboxDelta([], [marker]) }),
                });
                await this.table.put(operation.operationId, operation);
                this.applyAndAdvanceProjectionVersion(operation);
                receipts.push(this.receipt(operation));
            }
            return receipts;
        });
    }
    /**
     * Sync the runtime human display name from Host settings. Never persisted:
     * a rename affects only later @ resolutions and handle checks.
     */
    setHumanDisplayHandle(handle) {
        const name = handle.normalize('NFKC').trim();
        if (name !== '')
            this.humanHandle = name;
    }
    initialize(request = {
        requestId: AGENT_TEAM_INITIALIZE_REQUEST_ID,
        actor: HUMAN_ACTOR,
        humanMemberId: AGENT_TEAM_HUMAN_MEMBER_ID,
    }) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameInitialization(existing, request);
                await this.adoptRulesVersion();
                return this.resolved(this.receipt(existing));
            }
            if (this.state.ordered.length !== 0)
                throw new Error('agent-team ledger has operations but no initialization request');
            const operation = Object.freeze({
                sequence: 1,
                operationId: this.createOperationId(),
                requestId: request.requestId,
                occurredAt: this.createOccurredAt(),
                actor: Object.freeze({ ...request.actor }),
                previousOperationId: null,
                kind: 'team/initialized',
                data: Object.freeze({ humanMemberId: request.humanMemberId }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            await this.adoptRulesVersion();
            return this.committed(this.receipt(operation));
        });
    }
    /**
     * Append the marker for a rules version this build implements but the ledger has not adopted.
     * It runs inside initialize's queued task, so it precedes every later write — startup recovery's included.
     */
    async adoptRulesVersion() {
        if (this.state.rulesVersion >= this.rulesVersion)
            return;
        const operation = Object.freeze({
            ...this.operationBase({ requestId: `agent-team:rules-version-${this.rulesVersion}`, actor: HOST_ACTOR }, this.nextSequence()),
            kind: 'team/rules-version-adopted',
            actor: HOST_ACTOR,
            data: Object.freeze({ version: this.rulesVersion }),
        });
        await this.table.put(operation.operationId, operation);
        this.applyAndAdvanceProjectionVersion(operation);
    }
    createProject(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameProjectCreation(existing, request, this.normalizeUnique(request.memberIds, 'initial Project members'));
                return this.resolved(this.projectResult(existing));
            }
            this.assertHumanActor(request.actor);
            const name = request.name.trim();
            const description = request.description.trim();
            if (name === '')
                throw new Error('project name must not be empty');
            const memberIds = this.normalizeUnique(request.memberIds, 'initial Project members');
            for (const memberId of memberIds)
                this.assertJoinableMember(request.workspaceId, memberId);
            const sequence = this.nextSequence();
            const project = Object.freeze({
                projectRef: this.ref('project'), workspaceId: request.workspaceId, name, description, createdAtSequence: sequence, state: 'active',
            });
            const operation = Object.freeze({
                ...this.operationBase(request, sequence), kind: 'team/project-created',
                data: Object.freeze({ workspaceId: request.workspaceId, project, memberIds }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.projectResult(operation));
        });
    }
    /** Human rename of one Project's display facts; identity refs are immutable. */
    updateProject(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameProjectUpdate(existing, request);
                return this.resolved(this.projectUpdateResult(existing));
            }
            this.assertHumanActor(request.actor);
            const name = request.name.trim();
            const description = request.description.trim();
            if (name === '')
                throw new Error('project name must not be empty');
            const project = Object.freeze({ ...this.requireActiveProject(request.workspaceId, request.projectRef), name, description });
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/project-updated',
                data: Object.freeze({ workspaceId: request.workspaceId, project }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.projectUpdateResult(operation));
        });
    }
    addProjectOwner(request) {
        return this.changeProjectOwner(request, 'team/project-owner-added');
    }
    removeProjectOwner(request) {
        return this.changeProjectOwner(request, 'team/project-owner-removed');
    }
    changeProjectOwner(request, kind) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                if (existing.kind !== kind || !this.sameActor(existing.actor, request.actor) || existing.data.workspaceId !== request.workspaceId
                    || existing.data.projectRef !== request.projectRef || existing.data.memberId !== request.memberId)
                    this.throwRequestCollision(request.requestId);
                return this.resolved(this.projectOwnerResult(existing));
            }
            this.assertHumanActor(request.actor);
            const base = { workspaceId: request.workspaceId, projectRef: request.projectRef, memberId: request.memberId };
            const problem = this.projectOwnerChangeProblem(this.state, kind, base);
            if (problem !== undefined)
                throw new Error(problem);
            const sequence = this.nextSequence();
            const envelope = this.operationBase(request, sequence);
            const activity = Object.freeze({ activityRef: this.ref('activity'), projectRef: request.projectRef,
                kind: kind === 'team/project-owner-added' ? 'owner-added' : 'owner-removed',
                memberId: request.memberId, actor: request.actor.memberId, sequence, occurredAt: envelope.occurredAt });
            const returned = kind === 'team/project-owner-removed' ? this.accountabilityReturnsFrom(this.state, request.memberId, sequence, new Set([request.projectRef]), this.state.rulesVersion >= 3)
                : { transfers: [], tasks: [], threads: [], markers: [] };
            const ownerInbox = this.ownerActivityInboxDelta(activity);
            // An owner's default attention is the Main stream, never every Thread: the
            // grant starts following the stream from here, so it inherits no backlog.
            // A Member already following the stream keeps its own row — that following
            // is its own choice and its read progress, not the grant's to reset.
            const grantedMainAttention = kind === 'team/project-owner-added'
                && this.mainAttentionForFrom(this.state, request.memberId, request.projectRef) === undefined
                ? [this.startMainAttention(request.memberId, request.projectRef, sequence, 'project-owner')] : [];
            // The withdrawal ends the row the grant itself started, so a Member removed
            // as owner stops receiving ordinary updates. A row the Member started on its
            // own is not the grant's to end: that following and its read progress stay.
            const endedMainAttention = kind === 'team/project-owner-removed'
                ? this.grantedMainAttentionEnds(this.state, request.memberId, request.projectRef) : [];
            const inbox = this.inboxDelta([], [], [], [], returned.markers, [], ownerInbox.mainMarkers?.added ?? [], [], [], [], grantedMainAttention, endedMainAttention);
            const data = Object.freeze({ ...base, activity, inbox,
                ...(kind === 'team/project-owner-removed' ? { transfers: returned.transfers, tasks: returned.tasks, threads: returned.threads } : {}) });
            const operation = Object.freeze({
                ...envelope, kind, data,
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.projectOwnerResult(operation));
        });
    }
    /** The one owner-change rule, judged against the live projection on write and the replay projection on load. */
    projectOwnerChangeProblem(projection, kind, data) {
        if (projection.rulesVersion < 2)
            return `Project owners need rules version 2; this ledger runs version ${projection.rulesVersion}`;
        const project = projection.projects.get(data.projectRef);
        if (project === undefined || project.workspaceId !== data.workspaceId)
            return `unknown Project '${data.projectRef}' in Workspace '${data.workspaceId}'`;
        if (project.state === 'archived')
            return `Project '${data.projectRef}' is archived and no longer accepts Team work`;
        if (data.memberId === AGENT_TEAM_HUMAN_MEMBER_ID) {
            return kind === 'team/project-owner-added' ? 'the Human already owns every Project' : 'the Human owns every Project and cannot be removed';
        }
        const owned = projection.owners.get(data.projectRef)?.has(data.memberId) === true;
        if (kind === 'team/project-owner-removed')
            return owned ? undefined : `Agent Member '${data.memberId}' does not own Project '${data.projectRef}'`;
        const member = projection.members.get(data.memberId);
        if (member === undefined)
            return `unknown Agent Member '${data.memberId}'`;
        if (member.state !== 'enabled' && member.state !== 'suspended')
            return `Agent Member '${member.handle}' is ${member.state} and cannot own a Project`;
        if (!this.participatesInFrom(projection, member.memberId, project.workspaceId))
            return `Agent Member '${member.handle}' does not participate in Workspace '${project.workspaceId}'`;
        if (owned)
            return `Agent Member '${member.handle}' already owns Project '${data.projectRef}'`;
        return undefined;
    }
    addMember(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameMemberAdd(existing, request);
                return this.resolved(this.memberResult(existing));
            }
            this.assertHumanActor(request.actor);
            const handle = request.handle.trim();
            const description = request.description.trim();
            const presetId = request.presetId.trim();
            if (handle === '')
                throw new Error('member handle must not be empty');
            if (presetId === '')
                throw new Error('member preset must not be empty');
            // Description and initial Projects are optional: a Member with neither is
            // still drivable through its DM view, and joins Projects later.
            const projectRefs = this.normalizeUnique(request.projectRefs, 'initial Member Projects');
            for (const projectRef of projectRefs)
                this.requireActiveProject(request.workspaceId, projectRef);
            this.assertHandleAvailable(request.workspaceId, handle);
            // Creation names a route. A Member without one wakes on whatever the Host default is at that moment, so the
            // model it runs changes under it between wakes; ledgers written before this contract still read and replay.
            if (request.member.model === undefined)
                throw new Error('creating a Member requires an explicit model selection');
            this.assertModelSelection(request.member.model);
            this.assertCapabilities(request.member.capabilities);
            const member = Object.freeze({
                ...request.member, handle, description, presetId, state: 'enabled',
                ...(request.member.model === undefined ? {} : { model: Object.freeze({ ...request.member.model }) }),
                ...freezeCapabilities(request.member.capabilities),
            });
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/member-added',
                data: Object.freeze({ member, projectRefs }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.memberResult(operation));
        });
    }
    /** Human edit of one Member's mutable facts; identity, preset, and lifecycle state are preserved. */
    updateMember(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameMemberUpdate(existing, request);
                return this.resolved(this.memberResult(existing));
            }
            this.assertHumanActor(request.actor);
            const prior = this.requireMember(request.memberId);
            if (prior.state === 'inactive')
                throw new Error(`Agent Member '${prior.memberId}' is inactive and can no longer be edited`);
            if (prior.state === 'archived')
                throw new Error(`Agent Member '${prior.memberId}' is archived and can no longer be edited`);
            const handle = request.handle.trim();
            const description = request.description.trim();
            if (handle === '')
                throw new Error('member handle must not be empty');
            if (handle !== prior.handle)
                for (const workspaceId of this.workspacesOf(prior.memberId))
                    this.assertHandleAvailable(workspaceId, handle, prior.memberId);
            // A Member always runs an explicit route: editing may replace the model, never clear it back to the default.
            if (request.model === null)
                throw new Error('a Member model cannot be cleared; name the route it should run');
            this.assertModelSelection(request.model);
            this.assertCapabilities(request.capabilities);
            const nextModel = request.model === undefined ? prior.model : Object.freeze({ ...request.model });
            const nextCapabilities = request.capabilities === undefined ? prior.capabilities
                : request.capabilities === null ? undefined : request.capabilities;
            // Both overlays come off `prior` before being re-added, or a cleared field
            // would survive in the spread and the null branch would do nothing.
            const { model: _priorModel, capabilities: _priorCapabilities, ...priorWithoutOverlays } = prior;
            const member = Object.freeze({
                ...priorWithoutOverlays, handle, description,
                ...(nextModel === undefined ? {} : { model: nextModel }),
                ...freezeCapabilities(nextCapabilities),
            });
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/member-updated',
                data: Object.freeze({ member }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.memberResult(operation));
        });
    }
    suspendMember(request) {
        return this.setMemberState(request, 'suspended');
    }
    resumeMember(request) {
        return this.setMemberState(request, 'enabled');
    }
    /** Move one enabled Member from a cold generation onto a fresh Session. */
    recycleMemberSession(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameMemberSessionRecycled(existing, request);
                return this.resolved(this.memberResult(existing));
            }
            if (request.actor.kind !== 'host')
                throw new Error('Member session recycling requires Host authority');
            if (request.inputFromSeq !== undefined && (!Number.isSafeInteger(request.inputFromSeq) || request.inputFromSeq < 0))
                throw new Error('Member session recycling requires a non-negative input log offset');
            const prior = this.requireMember(request.memberId);
            if (prior.state !== 'enabled')
                throw new Error(`Agent Member '${prior.handle}' is ${prior.state}; only enabled Members can recycle their Session`);
            if (prior.sessionId !== request.previousSessionId)
                throw new Error(`Agent Member '${prior.handle}' is no longer bound to Session '${request.previousSessionId}'`);
            if (request.newSessionId === request.previousSessionId)
                throw new Error(`Agent Member '${prior.handle}' already runs Session '${request.newSessionId}'`);
            const member = Object.freeze({ ...prior, sessionId: request.newSessionId });
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/member-session-recycled',
                actor: Object.freeze({ ...request.actor }),
                data: Object.freeze({ member, previousSessionId: request.previousSessionId, newSessionId: request.newSessionId,
                    ...(request.inputFromSeq === undefined ? {} : { inputFromSeq: request.inputFromSeq }) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.memberResult(operation));
        });
    }
    getMember(memberId) {
        return this.state.members.get(memberId);
    }
    /**
     * The retired Session this Member most recently left through a swap — the
     * lineage parent a crash between the durable binding commit and the new
     * Session's activation recreates the successor from. Read from the audit
     * projection; the Member record itself only names the current Session.
     */
    previousSessionForMember(memberId) {
        return this.state.sessionTransitions.get(memberId)?.previousSessionId;
    }
    /**
     * The latest session transition this Member committed: the retired Session
     * and the target it moved onto. Crash recovery binds carried-input
     * redelivery to the recorded target — the CURRENT Session being that target
     * proves the old generation's unconsumed input still belongs here.
     */
    lastTransitionForMember(memberId) {
        const transition = this.state.sessionTransitions.get(memberId);
        const member = this.state.members.get(memberId);
        if (transition === undefined || member === undefined)
            return undefined;
        return { ...transition, targetSessionId: member.sessionId };
    }
    listMembers() {
        return Object.freeze([...this.state.members.values()]);
    }
    /**
     * Join one Agent Member to one additional Workspace. Participation is a
     * pure relation — no Session is created or moved; the Member's Session
     * stays rooted in its default Workspace and collaboration in the joined
     * Workspace is ledger work addressed by the workspaceId.
     */
    joinWorkspace(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameWorkspaceJoin(existing, request);
                return this.resolved(this.workspaceJoinResult(existing));
            }
            this.assertHumanActor(request.actor);
            const member = this.requireMember(request.memberId);
            if (member.state === 'inactive')
                throw new Error(`Agent Member '${member.memberId}' is inactive and cannot join a Workspace`);
            if (member.state === 'archived')
                throw new Error(`Agent Member '${member.memberId}' is archived and cannot join a Workspace`);
            if (this.participatesIn(member.memberId, request.workspaceId))
                throw new Error(`Agent Member '${member.memberId}' already participates in Workspace '${request.workspaceId}'`);
            // Handles resolve per Workspace: a second live Member with the same
            // handle in the target would make mentions ambiguous there.
            this.assertHandleAvailable(request.workspaceId, member.handle);
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/member-workspace-joined',
                data: Object.freeze({ workspaceId: request.workspaceId, memberId: member.memberId }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.workspaceJoinResult(operation));
        });
    }
    /**
     * Withdraw one Agent Member from one of its non-default Workspaces. The
     * default Workspace cannot be left — ending it is the archive path. Every
     * active Claim the Member holds on the Workspace's Threads releases with
     * public Activities, its Attention and markers on those Threads clear, and
     * its Project memberships there end; identity, Session, and remaining
     * participations are untouched.
     */
    leaveWorkspace(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameWorkspaceLeave(existing, request);
                return this.resolved(this.workspaceLeaveResult(existing));
            }
            this.assertHumanActor(request.actor);
            const member = this.requireMember(request.memberId);
            if (member.state === 'inactive')
                throw new Error(`Agent Member '${member.memberId}' is already inactive`);
            if (member.state === 'archived')
                throw new Error(`Agent Member '${member.memberId}' is already archived`);
            if (request.workspaceId === member.workspaceId)
                throw new Error(`Agent Member '${member.memberId}' cannot leave its default Workspace '${request.workspaceId}'; archive the Member instead`);
            if (!this.participatesIn(member.memberId, request.workspaceId))
                throw new Error(`Agent Member '${member.memberId}' does not participate in Workspace '${request.workspaceId}'`);
            const threadRefs = this.workspaceThreadRefs(request.workspaceId);
            const releasedClaims = [...this.state.claims.values()]
                .filter(claim => claim.owner === member.memberId && claim.state === 'active' && threadRefs.has(claim.threadRef))
                .map(claim => Object.freeze({ ...claim, state: 'released' }));
            const projectedClaims = new Map(this.state.claims);
            for (const claim of releasedClaims)
                projectedClaims.set(claim.claimRef, claim);
            const sequence = this.nextSequence();
            const activities = this.releaseSummaries(releasedClaims, member.memberId, sequence);
            const snapshot = this.buildReleaseSnapshot({
                claims: releasedClaims, projected: projectedClaims, activities,
                memberId: member.memberId,
                projectRefs: this.workspaceProjectRefsFrom(this.state, request.workspaceId), sequence,
                cleanup: this.removeMemberThreadInbox(member.memberId, threadRefs, this.workspaceProjectRefsFrom(this.state, request.workspaceId)),
            });
            const operation = Object.freeze({
                ...this.operationBase(request, sequence), kind: 'team/member-workspace-left',
                data: Object.freeze({ workspaceId: request.workspaceId, memberId: member.memberId, ...snapshot }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.workspaceLeaveResult(operation));
        });
    }
    /**
     * Archive one Project: hidden from every surface, facts kept recoverable.
     * Every active Claim on the Project's Threads releases with one public
     * Activity per (owner, Thread), and every Member's Attention and markers
     * for those Threads clear — a hidden Project must not leave Tasks stuck in
     * progress behind it or phantom unread counts.
     */
    archiveProject(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameProjectArchival(existing, request);
                return this.resolved(this.projectArchivalResult(existing));
            }
            this.assertHumanActor(request.actor);
            const project = this.requireProject(request.workspaceId, request.projectRef);
            if (project.state === 'archived')
                throw new Error(`Project '${project.projectRef}' is already archived`);
            const nextProject = Object.freeze({ ...project, state: 'archived' });
            const threadRefs = this.projectThreadRefs(project.projectRef);
            const releasedClaims = [...this.state.claims.values()]
                .filter(claim => claim.state === 'active' && threadRefs.has(claim.threadRef))
                .map(claim => Object.freeze({ ...claim, state: 'released' }));
            const nextClaims = new Map(this.state.claims);
            for (const claim of releasedClaims)
                nextClaims.set(claim.claimRef, claim);
            const sequence = this.nextSequence();
            // Archiving a Project releases every owner's Claims, so one Activity per
            // (owner, Thread) with the owners sorted — the shape the validator
            // recomputes from the same projection.
            const owners = [...new Set(releasedClaims.map(claim => claim.owner))].sort();
            const activities = Object.freeze(owners.flatMap(owner => this.releaseSummaries(releasedClaims.filter(claim => claim.owner === owner), owner, sequence)));
            const snapshot = this.buildReleaseSnapshot({
                claims: releasedClaims, projected: nextClaims, activities,
                memberId: undefined, projectRefs: new Set([project.projectRef]), sequence,
                cleanup: this.projectArchivalInbox(threadRefs, project.projectRef),
            });
            const operation = Object.freeze({
                ...this.operationBase(request, sequence), kind: 'team/project-archived',
                data: Object.freeze({ workspaceId: request.workspaceId, project: nextProject, ...snapshot }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.projectArchivalResult(operation));
        });
    }
    reply(request) {
        return this.enqueue(async () => {
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            const { task, thread, projectRef } = this.threadContextForActor(actor, request.workspaceId, request);
            const v2 = this.state.rulesVersion >= 2;
            const body = request.body.trim();
            if (body === '')
                throw new Error('message body must not be empty');
            const project = this.requireProject(request.workspaceId, projectRef);
            const parent = this.requireReplyParent(request, thread.threadRef);
            // Answering a Member delivers to them the way a mention does: a reply the
            // recipient never learns about is not a reply. Before version 2 the Human
            // is skipped — they read the Thread directly — as is the author's own
            // Message.
            const answered = parent === undefined || parent.sender === actor.memberId || (!v2 && parent.sender === AGENT_TEAM_HUMAN_MEMBER_ID)
                ? []
                : [parent.sender];
            const recipients = this.deliveryRecipientsFor(actor.memberId, projectRef, body, answered);
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameReply(existing, request, recipients);
                return this.resolved(this.replyResult(existing, v2 ? [] : this.undeliverableRecipients(actor, thread.threadRef, recipients)));
            }
            this.assertMentionTargets(project, recipients);
            const deferred = this.deferredThreadWrite(actor.memberId, task, thread, request.baseRevision);
            if (deferred !== undefined)
                return this.resolved(deferred);
            if (task?.resolution === 'closed')
                throw new Error(`Task '${task.taskRef}' is closed; reopen it before replying`);
            // An Agent cannot invite into an existing Thread, so a body mention the
            // Thread has never carried is dropped and reported back rather than
            // failing the send. Version 2 delivers every addressable recipient.
            const undelivered = v2 ? Object.freeze([]) : this.undeliverableRecipients(actor, thread.threadRef, recipients);
            const delivered = undelivered.length === 0 ? recipients : recipients.filter(memberId => !undelivered.includes(memberId));
            // Version 2: a mention or an answer delivers one direct marker and never starts or resumes Attention.
            const unfollowedAgents = v2 ? [] : delivered.filter(memberId => this.state.members.has(memberId) && !this.isFollowing(thread.threadRef, memberId));
            const sequence = this.nextSequence();
            const base = this.operationBase(request, sequence);
            const message = Object.freeze({
                messageRef: this.ref('message'), projectRef, threadRef: thread.threadRef,
                ...(task === undefined ? {} : { taskRef: task.taskRef }), sender: request.actor.memberId, body,
                ...(request.resolvedAttachments === undefined ? {} : { attachments: request.resolvedAttachments }),
                ...(parent === undefined ? {} : { replyToMessageRef: parent.messageRef }),
                topLevel: false, sequence, occurredAt: base.occurredAt,
            });
            const nextThread = Object.freeze({ ...thread, revision: sequence });
            const started = unfollowedAgents.map(memberId => this.startAttention(memberId, thread.threadRef, sequence, 'mention'));
            const inbox = this.messageInboxDelta(message, request.actor.memberId, delivered, started);
            const operation = Object.freeze({
                ...base, kind: 'team/thread-replied',
                data: Object.freeze({ workspaceId: request.workspaceId, baseRevision: request.baseRevision,
                    mentions: delivered, message, ...(task === undefined ? {} : { task }), thread: nextThread, inbox }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.replyResult(operation, undelivered));
        });
    }
    /**
     * Post one Main stream Message: the Project-level conversation outside every Thread. Any Project member may write; a
     * writer holding Main stream unread (an owner's ordinary unread, or any Member's markers) reads first.
     */
    postMainMessage(request) {
        return this.enqueue(async () => {
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            const project = this.requireActiveProject(request.workspaceId, request.projectRef);
            const body = request.body.trim();
            if (body === '')
                throw new Error('message body must not be empty');
            const parent = this.requireMainReplyParent(request.replyToMessageRef, project.projectRef);
            const answered = parent === undefined || parent.sender === actor.memberId ? [] : [parent.sender];
            const recipients = this.deliveryRecipientsFor(actor.memberId, project.projectRef, body, answered);
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameMainMessage(existing, request, recipients);
                return this.resolved(this.mainPostResult(existing));
            }
            this.requireRulesVersion2('the Main stream');
            this.requireProjectMemberActor(actor, project.projectRef);
            this.assertMentionTargets(project, recipients);
            const unread = this.mainUnreadFrom(this.state, actor.memberId, project.projectRef);
            if (unread.length > 0 && !this.areMainEntriesVisible?.(actor.memberId, this.mainEntries(unread.map(item => item.source), unread), project.projectRef)) {
                return this.resolved(this.mainUnreadRequired(project.projectRef, unread));
            }
            const sequence = this.nextSequence();
            const base = this.operationBase(request, sequence);
            const message = Object.freeze({
                messageRef: this.ref('message'), projectRef: project.projectRef, scope: 'main', sender: actor.memberId, body,
                ...(request.resolvedAttachments === undefined ? {} : { attachments: request.resolvedAttachments }),
                ...(parent === undefined ? {} : { replyToMessageRef: parent.messageRef }), sequence, occurredAt: base.occurredAt,
            });
            const operation = Object.freeze({
                ...base, kind: 'team/main-message-posted',
                data: Object.freeze({ workspaceId: request.workspaceId, mentions: recipients, message,
                    inbox: this.mainMessageInboxDelta(message, recipients) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.mainPostResult(operation));
        });
    }
    /**
     * Acknowledge the Main stream through one sequence (default the head): an owner's watermark advances and the reader's
     * markers up to it are consumed. A read that changes neither writes nothing, like a Thread read.
     */
    readMainStream(request, select) {
        return this.enqueue(async () => {
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            const project = this.requireActiveProject(request.workspaceId, request.projectRef);
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameMainRead(existing, request, project.projectRef);
                return this.resolved(this.mainReadResult(actor.memberId, project.projectRef, existing.data.readThroughSequence, [], this.receipt(existing)));
            }
            this.requireRulesVersion2('the Main stream');
            this.requireProjectMemberActor(actor, project.projectRef);
            // Selection runs inside the queue against the state this write will
            // actually see, so an entry queued ahead of it is never skipped. The
            // preview derives the same bound without writing anything.
            const selected = select === undefined ? undefined : select(this.previewMainStreamRead({ ...request, actor }));
            const { readThrough, inbox, noOp, consumed } = this.planMainRead(actor.memberId, project.projectRef, request.readThroughSequence, selected);
            if (noOp) {
                return this.resolved(this.mainReadResult(actor.memberId, project.projectRef, readThrough, []));
            }
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/main-stream-read',
                data: Object.freeze({ workspaceId: request.workspaceId, projectRef: project.projectRef, memberId: actor.memberId,
                    readThroughSequence: readThrough, inbox }),
            });
            // The picture shows what the reader saw before this read, so it is taken ahead of the commit.
            const picture = this.mainReadPage(actor.memberId, project.projectRef, consumed, readThrough);
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(Object.freeze({ receipt: this.receipt(operation), projectRef: project.projectRef, readThroughSequence: readThrough,
                entries: picture, consumedMarkers: consumed, standing: this.mainStandingFrom(this.state, actor.memberId, project.projectRef) }));
        });
    }
    /**
     * Answer what a Main stream read would return right now without committing
     * or acknowledging anything: the same page, consumed markers and post-read
     * standing the read would produce.
     */
    previewMainStreamRead(request) {
        const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
        const project = this.requireActiveProject(request.workspaceId, request.projectRef);
        this.requireRulesVersion2('the Main stream');
        this.requireProjectMemberActor(actor, project.projectRef);
        const { readThrough, noOp, consumed } = this.planMainRead(actor.memberId, project.projectRef, request.readThroughSequence);
        const unread = this.mainUnreadFrom(this.state, actor.memberId, project.projectRef);
        const entries = new Map(this.mainReadPage(actor.memberId, project.projectRef, consumed, readThrough).map(entry => [entry.sequence, entry]));
        for (const entry of this.mainEntries(unread.filter(item => item.source.sequence <= readThrough).map(item => item.source), unread))
            entries.set(entry.sequence, entry);
        return Object.freeze({ projectRef: project.projectRef, readThroughSequence: readThrough,
            entries: Object.freeze([...entries.values()].sort((left, right) => left.sequence - right.sequence)), consumedMarkers: consumed,
            standing: noOp ? this.mainStandingFrom(this.state, actor.memberId, project.projectRef)
                : this.mainStandingAfterRead(actor.memberId, project.projectRef, readThrough) });
    }
    /**
     * The bound one Main stream read acknowledges, and the delta committing it
     * would write. An explicit bound wins; without one the read acknowledges only
     * the first page of unread, so a backlog is read page by page, never skipped.
     * `hasBacklog` distinguishes a bound already chosen from one still defaulted.
     */
    planMainRead(memberId, projectRef, requested, selected) {
        const head = this.mainHeadFrom(this.state, projectRef);
        const backlog = selected === undefined && requested === undefined
            ? this.mainUnreadFrom(this.state, memberId, projectRef) : [];
        const readThrough = selected ?? requested
            ?? (backlog.length > MAIN_READ_PAGE_SIZE ? backlog[MAIN_READ_PAGE_SIZE - 1].source.sequence : head);
        if (!Number.isInteger(readThrough) || readThrough < 0 || readThrough > head) {
            throw new Error(`readThroughSequence must be an integer from 0 to the Main stream head ${head}`);
        }
        const prepared = this.prepareMainReadFrom(this.state, memberId, projectRef, readThrough);
        const noOp = !prepared.advances && isEmptyInboxDelta(prepared.inbox);
        return { readThrough, inbox: prepared.inbox, noOp, consumed: noOp ? [] : prepared.consumed };
    }
    /** Start a discussion or Task Thread: a Project owner's act. Mentions deliver a direct marker only; the creator alone follows. */
    startThread(request) {
        return this.enqueue(async () => {
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            const project = this.requireActiveProject(request.workspaceId, request.projectRef);
            const body = request.body.trim();
            if (body === '')
                throw new Error('message body must not be empty');
            const recipients = this.deliveryRecipientsFor(actor.memberId, project.projectRef, body, []);
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameThreadStart(existing, request, recipients);
                return this.resolved(this.startThreadResult(existing));
            }
            this.requireRulesVersion2('starting a Thread');
            this.requireProjectMemberActor(actor, project.projectRef);
            this.requireProjectOwnerActor(actor, project.projectRef);
            this.assertMentionTargets(project, recipients);
            const sequence = this.nextSequence();
            const base = this.operationBase(request, sequence);
            const threadRef = this.ref('thread');
            const taskRef = request.kind === 'task' ? this.ref('task') : undefined;
            if (request.kind === 'task' && actor.kind === 'member' && request.accountable !== undefined && request.accountable !== actor.memberId) {
                throw new Error(`An Agent names itself accountable when starting a Task (accountable_target_invalid) — ${recoveryFor('accountable_target_invalid').sentence({})}`);
            }
            const accountable = request.kind === 'task' ? this.resolveAccountable(project.projectRef, actor, request.accountable) : undefined;
            if (request.kind !== 'task' && (request.accountable !== undefined || request.sourceThreadRefs !== undefined))
                throw new Error('only a Task accepts accountable and sourceThreadRefs');
            const sourceThreadRefs = request.kind === 'task' ? this.validateTaskSources(project.projectRef, request.sourceThreadRefs) : [];
            const task = taskRef === undefined || accountable === undefined ? undefined
                : Object.freeze({ taskRef, projectRef: project.projectRef, threadRef, status: 'todo', resolution: 'open', accountable, sourceThreadRefs });
            const taskActivity = task === undefined ? undefined : Object.freeze({ activityRef: this.ref('activity'), kind: 'promote',
                taskRef: task.taskRef, threadRef, actor: actor.memberId, sequence });
            const thread = Object.freeze({ threadRef, ...(taskRef === undefined ? {} : { taskRef }), revision: sequence });
            const anchor = Object.freeze({
                messageRef: this.ref('message'), projectRef: project.projectRef, threadRef, ...(taskRef === undefined ? {} : { taskRef }),
                sender: actor.memberId, body,
                ...(request.resolvedAttachments === undefined ? {} : { attachments: request.resolvedAttachments }),
                topLevel: true, sequence, occurredAt: base.occurredAt,
            });
            const inbox = taskActivity === undefined
                ? this.messageInboxDelta(anchor, actor.memberId, recipients, [this.startAttention(actor.memberId, threadRef, sequence, 'thread-author')])
                : this.inboxDeltaForTaskResponsibility(this.state, task, taskActivity, anchor, recipients);
            const operation = Object.freeze({
                ...base, kind: 'team/thread-started',
                data: Object.freeze({ workspaceId: request.workspaceId, projectRef: project.projectRef, kind: request.kind, mentions: recipients,
                    anchor, ...(task === undefined ? {} : { task }), ...(taskActivity === undefined ? {} : { activity: taskActivity }), thread, inbox }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.startThreadResult(operation));
        });
    }
    /** One page of a Project's Main stream, oldest first, with the reader's own standing. Never writes. */
    mainStreamHistory(actor, request) {
        this.requireRulesVersion2('the Main stream');
        const authorized = this.assertActorForWorkspace(actor, request.workspaceId);
        const project = this.requireActiveProject(request.workspaceId, request.projectRef);
        this.requireProjectMemberActor(authorized, project.projectRef);
        const limit = request.limit ?? 20;
        if (!Number.isInteger(limit) || limit < 1 || limit > 100)
            throw new Error('history limit must be an integer between 1 and 100');
        const sources = this.mainSourcesFrom(this.state, project.projectRef).filter(source => source.kind !== 'thread' || source.hidden !== true);
        const before = request.beforeSequence ?? (sources.at(-1)?.sequence ?? 0) + 1;
        if (!Number.isInteger(before) || before < 1)
            throw new Error('beforeSequence must be a positive integer');
        const older = sources.filter(source => source.sequence < before);
        const page = older.slice(-limit);
        const unread = this.mainUnreadFrom(this.state, authorized.memberId, project.projectRef);
        return Object.freeze({ projectRef: project.projectRef, entries: this.mainEntries(page, unread),
            cursor: page.length === 0 ? before : page[0].sequence, hasMore: older.length > page.length,
            standing: this.mainStandingFrom(this.state, authorized.memberId, project.projectRef) });
    }
    /** One Member's unread Main stream entries, per Project, for the Host's wake: an owner's ordinary unread and every reader's markers. */
    mainNotificationFacts(memberId) {
        const result = [];
        for (const project of this.state.projects.values()) {
            if (this.visibleProject(project) === undefined || !this.participatesIn(memberId, project.workspaceId))
                continue;
            // The Main stream is read and written only by Project members, so an
            // Attention row left behind by a departed Member delivers nothing. The
            // Human owns every Project, so membership never has to be asked of it.
            if (memberId !== AGENT_TEAM_HUMAN_MEMBER_ID && !this.isProjectMemberFrom(this.state, project.projectRef, memberId))
                continue;
            const unread = this.mainUnreadForNotification(memberId, project.projectRef);
            if (unread.length > 0)
                result.push({ project, entries: this.mainEntries(unread.map(item => item.source), unread) });
        }
        return Object.freeze(result);
    }
    promoteThread(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSamePromotion(existing, request);
                return this.resolved(this.promotionResult(existing));
            }
            const v2 = this.state.rulesVersion >= 2;
            if (v2 && request.actor.kind === 'member')
                this.assertMemberActor(request.actor);
            else
                this.assertHumanActor(request.actor);
            const { task: existingTask, thread, projectRef } = this.threadContextForActor(request.actor, request.workspaceId, request);
            if (v2)
                this.requireProjectOwnerActor(request.actor, projectRef);
            if (existingTask !== undefined)
                throw new Error(`Thread '${thread.threadRef}' already has Task '${existingTask.taskRef}'`);
            const deferred = this.deferredThreadWrite(request.actor.memberId, undefined, thread, request.baseRevision);
            if (deferred !== undefined)
                return this.resolved(deferred);
            const sequence = this.nextSequence();
            const base = this.operationBase(request, sequence);
            const taskRef = this.ref('task');
            if (request.actor.kind === 'member' && request.accountable !== undefined && request.accountable !== request.actor.memberId) {
                throw new Error(`An Agent names itself accountable when promoting a Task (accountable_target_invalid) — ${recoveryFor('accountable_target_invalid').sentence({})}`);
            }
            const accountable = this.resolveAccountable(projectRef, request.actor, request.accountable);
            const task = Object.freeze({ taskRef, projectRef, threadRef: thread.threadRef, status: 'todo', resolution: 'open', accountable, sourceThreadRefs: [] });
            const nextThread = Object.freeze({ threadRef: thread.threadRef, taskRef, revision: sequence });
            const activity = Object.freeze({ activityRef: this.ref('activity'), kind: 'promote',
                taskRef, threadRef: thread.threadRef, actor: request.actor.memberId, sequence });
            const inbox = this.state.rulesVersion >= 2
                ? this.responsibilityInboxDeltaFrom(this.state, task, activity, request.actor.memberId, true)
                : this.promoteThreadInbox(activity, thread.threadRef);
            const operation = Object.freeze({
                ...base, kind: 'team/thread-promoted',
                data: Object.freeze({ workspaceId: request.workspaceId, baseRevision: request.baseRevision,
                    activity, task, thread: nextThread, inbox }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.promotionResult(operation));
        });
    }
    changeClaim(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameClaim(existing, request);
                return this.resolved(this.claimResult(existing));
            }
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            const { task, thread } = this.threadForActor(actor, request.workspaceId, request.taskRef);
            const deferred = this.deferredThreadWrite(actor.memberId, task, thread, request.baseRevision);
            if (deferred !== undefined)
                return this.resolved(deferred);
            if (task.resolution !== 'open')
                throw new Error(`Task '${task.taskRef}' is ${task.status}; reopen it before changing Claims`);
            if (actor.kind !== 'member')
                throw new Error('Human cannot change an Agent Claim');
            let claim;
            let kind;
            let activityKind;
            if (request.action === 'claim') {
                if (request.claimRef !== undefined)
                    throw new Error('claim action does not accept claimRef');
                const direction = request.direction?.trim() ?? '';
                const normalizedDirection = this.normalizeDirection(direction);
                if (normalizedDirection === '')
                    throw new Error('claim direction must not be empty');
                if ((this.state.claimsByTask.get(task.taskRef) ?? []).some(candidate => candidate.state === 'active' && candidate.normalizedDirection === normalizedDirection)) {
                    throw new Error(`Direction '${direction}' already has an active Claim`);
                }
                claim = Object.freeze({ claimRef: this.ref('claim'), taskRef: task.taskRef, threadRef: task.threadRef,
                    owner: actor.memberId, direction, normalizedDirection, state: 'active' });
                kind = 'team/claim-created';
                activityKind = 'claim';
            }
            else {
                if (request.direction !== undefined)
                    throw new Error(`${request.action} action does not accept direction`);
                const previous = request.claimRef === undefined ? undefined : this.state.claims.get(this.requireRefKey(this.state.claims, request.claimRef, 'claim', 'Claim'));
                if (previous === undefined) {
                    throw new Error(`unknown Claim '${request.claimRef ?? ''}'${request.claimRef === undefined ? '' : this.unknownRefHint(request.claimRef, 'claim', 'Claim')}`);
                }
                if (previous.taskRef !== task.taskRef || previous.owner !== actor.memberId) {
                    throw new Error(`Member can modify only its own Claim on this Task — ${recoveryFor('claim_owned_by_another').sentence({ refused: `claim ${previous.claimRef}` })}`);
                }
                if (previous.state !== 'active')
                    throw new Error(`Claim '${previous.claimRef}' is already ${previous.state}`);
                claim = Object.freeze({ ...previous, state: request.action === 'done' ? 'done' : 'released' });
                kind = request.action === 'done' ? 'team/claim-done' : 'team/claim-released';
                activityKind = request.action;
            }
            const sequence = this.nextSequence();
            const projected = new Map(this.state.claims).set(claim.claimRef, claim);
            const nextTask = Object.freeze({ ...task, status: this.deriveTaskStatus(task.taskRef, projected.values()) });
            const nextThread = Object.freeze({ ...thread, revision: sequence });
            const activity = Object.freeze({
                activityRef: this.ref('activity'), kind: activityKind, taskRef: task.taskRef,
                threadRef: task.threadRef, actor: actor.memberId, claimRef: claim.claimRef, sequence,
            });
            const ownAttention = request.action === 'claim' && actor.kind === 'member' && !this.isFollowing(thread.threadRef, actor.memberId)
                ? [this.startAttention(actor.memberId, thread.threadRef, sequence, 'claim')] : [];
            const inbox = this.inboxDelta(ownAttention, [], [], [], this.responsibilityActivityRecipientsFrom(this.state, nextTask, actor.memberId)
                .map(memberId => Object.freeze({ memberId, threadRef: thread.threadRef, activityRef: activity.activityRef, sequence })));
            const operation = Object.freeze({
                ...this.operationBase(request, sequence), kind,
                data: Object.freeze({ workspaceId: request.workspaceId, baseRevision: request.baseRevision,
                    activity, claim, task: nextTask, thread: nextThread, inbox }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.claimResult(operation));
        });
    }
    transferTask(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                if (existing.kind !== 'team/task-accountable-changed' || !this.sameActor(existing.actor, request.actor)
                    || existing.data.workspaceId !== request.workspaceId || existing.data.task.taskRef !== request.taskRef
                    || existing.data.task.accountable !== request.target || existing.data.baseRevision !== request.baseRevision)
                    this.throwRequestCollision(request.requestId);
                return this.resolved(this.transferTaskResult(existing));
            }
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            const { task, thread } = this.threadForActor(actor, request.workspaceId, request.taskRef);
            if (actor.kind === 'member' && (this.requireMember(actor.memberId).state !== 'enabled'
                || (task.resolution !== 'open' || task.accountable !== actor.memberId))) {
                throw new Error(`Only the current accountable can transfer an open Task (accountable_owner_required) — ${recoveryFor('accountable_owner_required').sentence({ taskRef: task.taskRef })}`);
            }
            const target = this.state.rulesVersion >= 3 && request.target !== AGENT_TEAM_HUMAN_MEMBER_ID
                ? this.resolveTransferTarget(task.projectRef, request.target)
                : this.resolveAccountable(task.projectRef, actor, request.target);
            if (target === task.accountable)
                throw new Error(`Task '${task.taskRef}' is already accountable to '${target}'`);
            const deferred = this.deferredThreadWrite(actor.memberId, task, thread, request.baseRevision);
            if (deferred !== undefined)
                return this.resolved(deferred);
            const sequence = this.nextSequence();
            const nextTask = Object.freeze({ ...task, accountable: target });
            const nextThread = Object.freeze({ ...thread, revision: sequence });
            const activity = Object.freeze({ activityRef: this.ref('activity'), kind: 'transfer', taskRef: task.taskRef,
                threadRef: thread.threadRef, actor: actor.memberId, from: task.accountable, to: target, sequence });
            const attention = target === actor.memberId || this.isFollowing(thread.threadRef, target) ? []
                : [this.followAttention(target, thread.threadRef, 'accountable')];
            const inbox = this.inboxDelta(attention, [], [], [], [{ memberId: target, threadRef: thread.threadRef, activityRef: activity.activityRef, sequence }]);
            const operation = Object.freeze({ ...this.operationBase(request, sequence), kind: 'team/task-accountable-changed',
                data: Object.freeze({ workspaceId: request.workspaceId, baseRevision: request.baseRevision, activity, task: nextTask, thread: nextThread, inbox }) });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.transferTaskResult(operation));
        });
    }
    changeTask(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameTask(existing, request);
                return this.resolved(this.taskResult(existing));
            }
            this.assertActorForWorkspace(request.actor, request.workspaceId);
            const { task, thread } = this.threadForActor(request.actor, request.workspaceId, request.taskRef);
            if (request.actor.kind === 'member') {
                const member = this.requireMember(request.actor.memberId);
                if (member.state !== 'enabled')
                    throw new Error(`Agent Member '${member.handle}' is ${member.state}`);
                if (request.action === 'accept') {
                    // A Task handed to a plain member is verified by that member; everybody else still needs the
                    // owner grant, and nobody who ever held a Claim may verify. The order keeps the two refusals distinct.
                    if (this.heldTaskClaimFrom(this.state, task.taskRef, request.actor.memberId))
                        throw new Error(`An Agent who held any Claim cannot accept this Task (self_acceptance_forbidden) — ${recoveryFor('self_acceptance_forbidden').sentence({ taskRef: task.taskRef })}`);
                    if (!this.isProjectOwnerFrom(this.state, task.projectRef, request.actor.memberId)
                        && !(this.state.rulesVersion >= 3 && task.accountable === request.actor.memberId))
                        throw new Error(`Only a Project owner or the accountable can accept this Task (project_owner_required) — ${recoveryFor('project_owner_required').sentence({ projectRef: task.projectRef })}`);
                }
                else if (task.accountable !== request.actor.memberId) {
                    throw new Error(`Only the accountable owner can ${request.action} this Task (accountable_owner_required) — ${recoveryFor('accountable_owner_required').sentence({ taskRef: task.taskRef })}`);
                }
            }
            if (request.action === 'reopen' && !this.accountableIsValidFrom(this.state, task))
                throw new Error(`The previous accountable no longer takes part in the Project (accountable_target_invalid) — ${recoveryFor('accountable_target_invalid').sentence({ taskRef: task.taskRef })}`);
            const deferred = this.deferredThreadWrite(request.actor.memberId, task, thread, request.baseRevision);
            if (deferred !== undefined)
                return this.resolved(deferred);
            if (request.action === 'accept' && task.resolution !== 'open')
                throw new Error(`Task '${task.taskRef}' is already ${task.resolution}`);
            if (request.action === 'close' && task.resolution === 'closed')
                throw new Error(`Task '${task.taskRef}' is already closed`);
            // Acceptance normally waits for every Claim to finish (in_review);
            // a Human may also accept early while work is in progress, which then
            // completes the still-active Claims inside the same atomic operation.
            // A never-claimed todo Task may be accepted directly as well: work
            // finished outside the ledger is declared complete by the Human.
            if (request.action === 'accept' && request.actor.kind === 'member' && task.status !== 'in_review') {
                throw new Error(`An Agent may accept only an in_review Task; current status is '${task.status}' (accept_requires_in_review) — ${recoveryFor('accept_requires_in_review').sentence({ taskRef: task.taskRef })}`);
            }
            if (request.action === 'accept' && task.status !== 'in_review' && task.status !== 'in_progress' && task.status !== 'todo') {
                throw new Error(`Task '${task.taskRef}' must be in_review, in_progress, or todo before acceptance`);
            }
            const priorActiveClaims = (this.state.claimsByTask.get(task.taskRef) ?? []).filter(claim => claim.state === 'active');
            if (request.action === 'accept' && task.status === 'in_progress' && priorActiveClaims.length === 0) {
                throw new Error(`Task '${task.taskRef}' has no active Claims to complete for early acceptance`);
            }
            if (request.action === 'reopen' && task.resolution === 'open')
                throw new Error(`Task '${task.taskRef}' is already open`);
            const sequence = this.nextSequence();
            const claims = (this.state.claimsByTask.get(task.taskRef) ?? []).map(claim => request.action === 'close' && claim.state === 'active' ? Object.freeze({ ...claim, state: 'released' })
                : request.action === 'accept' && claim.state === 'active' ? Object.freeze({ ...claim, state: 'done' })
                    : claim);
            const releasedClaims = claims.filter(claim => claim.state === 'released' && this.state.claims.get(claim.claimRef)?.state === 'active');
            const completedClaims = claims.filter(claim => claim.state === 'done' && this.state.claims.get(claim.claimRef)?.state === 'active');
            // Every done Claim at commit time, pre-finished and atomically
            // completed alike, is the acceptance discriminator and the list accept
            // markers deliver from. Sorted lexically so replay validation compares
            // stably regardless of claim-ref generation order.
            const acceptedClaims = request.action === 'accept'
                ? claims.filter(claim => claim.state === 'done').sort((left, right) => left.claimRef.localeCompare(right.claimRef))
                : [];
            const resolution = taskResolutionForAction(request.action);
            const status = this.deriveResolvedTaskStatus({ taskRef: task.taskRef, resolution }, claims);
            const nextTask = Object.freeze({ ...task, resolution, status });
            const nextThread = Object.freeze({ ...thread, revision: sequence });
            const activity = Object.freeze({ activityRef: this.ref('activity'), kind: request.action,
                taskRef: task.taskRef, threadRef: task.threadRef, actor: request.actor.memberId, sequence,
                ...(releasedClaims.length === 0 ? {} : { releasedClaimRefs: Object.freeze(releasedClaims.map(claim => claim.claimRef)) }),
                ...(completedClaims.length === 0 ? {} : { completedClaimRefs: Object.freeze(completedClaims.map(claim => claim.claimRef)) }),
                ...(request.action === 'accept' ? { acceptedClaimRefs: Object.freeze(acceptedClaims.map(claim => claim.claimRef)) } : {}),
                ...(request.action === 'reopen' && task.accountable !== request.actor.memberId && !this.isFollowing(thread.threadRef, task.accountable)
                    ? { refollowedMembers: Object.freeze([task.accountable]) } : request.action === 'reopen' ? { refollowedMembers: Object.freeze([]) } : {}) });
            const inbox = request.action === 'close'
                ? this.closeThreadInbox(activity, thread.threadRef)
                : request.action === 'reopen'
                    ? this.reopenThreadInbox(activity, thread.threadRef)
                    : this.withReminderCleanup(this.acceptThreadInbox(activity, thread.threadRef, acceptedClaims.map(claim => claim.owner)), this.state, thread.threadRef);
            const operation = Object.freeze({
                ...this.operationBase(request, sequence), kind: 'team/task-changed',
                data: Object.freeze({ workspaceId: request.workspaceId, baseRevision: request.baseRevision,
                    activity, task: nextTask, thread: nextThread, claims: Object.freeze(claims), inbox }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.taskResult(operation));
        });
    }
    removeMember(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameRemoval(existing, request);
                return this.resolved(this.removalResult(existing));
            }
            this.assertHumanActor(request.actor);
            const member = this.requireMember(request.memberId);
            if (member.state === 'inactive')
                throw new Error(`Agent Member '${member.memberId}' is already inactive`);
            const nextMember = Object.freeze({ ...member, state: 'inactive' });
            const releasedClaims = [...this.state.claims.values()].filter(claim => claim.owner === member.memberId && claim.state === 'active')
                .map(claim => Object.freeze({ ...claim, state: 'released' }));
            const projectedClaims = new Map(this.state.claims);
            for (const claim of releasedClaims)
                projectedClaims.set(claim.claimRef, claim);
            const sequence = this.nextSequence();
            const activities = this.releaseSummaries(releasedClaims, member.memberId, sequence);
            const snapshot = this.buildReleaseSnapshot({
                claims: releasedClaims, projected: projectedClaims, activities,
                memberId: member.memberId, projectRefs: undefined, sequence,
                cleanup: this.removeMemberThreadInbox(member.memberId, new Set(this.state.threads.keys())),
            });
            const operation = Object.freeze({
                ...this.operationBase(request, sequence), kind: 'team/member-removed',
                data: Object.freeze({ member: nextMember, ...snapshot }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.removalResult(operation));
        });
    }
    /**
     * Archive one Member: hidden from every surface, data kept recoverable.
     * The release shape matches removal — active Claims release with public
     * Activities and the Member's Attention/markers clear — because a hidden
     * Member must not leave Tasks stuck in progress or phantom unread counts.
     */
    archiveMember(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameArchival(existing, request);
                return this.resolved(this.archivalResult(existing));
            }
            this.assertHumanActor(request.actor);
            const member = this.requireMember(request.memberId);
            if (member.state === 'inactive')
                throw new Error(`Agent Member '${member.memberId}' is already inactive`);
            if (member.state === 'archived')
                throw new Error(`Agent Member '${member.memberId}' is already archived`);
            const nextMember = Object.freeze({ ...member, state: 'archived' });
            const releasedClaims = [...this.state.claims.values()].filter(claim => claim.owner === member.memberId && claim.state === 'active')
                .map(claim => Object.freeze({ ...claim, state: 'released' }));
            const projectedClaims = new Map(this.state.claims);
            for (const claim of releasedClaims)
                projectedClaims.set(claim.claimRef, claim);
            const sequence = this.nextSequence();
            const activities = this.releaseSummaries(releasedClaims, member.memberId, sequence);
            const snapshot = this.buildReleaseSnapshot({
                claims: releasedClaims, projected: projectedClaims, activities,
                memberId: member.memberId, projectRefs: undefined, sequence,
                cleanup: this.removeMemberThreadInbox(member.memberId, new Set(this.state.threads.keys())),
            });
            const operation = Object.freeze({
                ...this.operationBase(request, sequence), kind: 'team/member-archived',
                data: Object.freeze({ member: nextMember, ...snapshot }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.archivalResult(operation));
        });
    }
    changeAttention(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameAttention(existing, request);
                // Only the two Attention kinds can answer a replayed Attention request:
                // the assertion above already refused every other kind as a collision.
                if (existing.kind === 'team/main-attention-changed') {
                    return this.resolved(this.mainAttentionResult(existing, existing.data.inbox.mainAttention?.set[0]));
                }
                return this.resolved(this.attentionResult(existing));
            }
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            // One scope per request: the Main stream is addressed by its own Project
            // ref and a Thread by its Thread or Task ref. Accepting both would make
            // the same request shape mean two different scopes depending on commit
            // history, so the Remote refuses what the tool already refuses.
            if (request.projectRef !== undefined && (request.threadRef !== undefined || request.taskRef !== undefined)) {
                throw new Error('A Main stream Attention request takes projectRef or a Thread ref, never both');
            }
            if (request.projectRef !== undefined)
                return this.writeMainAttention(actor, request);
            const { task, thread } = this.threadContextForActor(actor, request.workspaceId, request);
            const current = this.attentionFor(actor.memberId, thread.threadRef);
            if (request.action === 'follow') {
                // A closed Thread takes one write besides its resolution: the follow that returns somebody to it. Closing
                // ended every Attention row, so without this the follower set could never offer a target again.
                if (task?.resolution === 'closed' && this.state.rulesVersion < 4)
                    throw new Error(`Task '${task.taskRef}' is closed; reopen it before following`);
                if (current !== undefined)
                    throw new Error(`Member is already following Thread '${thread.threadRef}'`);
                const attention = this.followAttention(actor.memberId, thread.threadRef, 'self');
                const operation = Object.freeze({
                    ...this.operationBase(request, this.nextSequence()), kind: 'team/thread-attention-changed',
                    data: Object.freeze({ workspaceId: request.workspaceId, action: 'follow', memberId: actor.memberId,
                        ...(task === undefined ? {} : { task }), thread, inbox: this.inboxDelta([attention]) }),
                });
                await this.table.put(operation.operationId, operation);
                this.applyAndAdvanceProjectionVersion(operation);
                return this.committed(this.attentionResult(operation));
            }
            if (current === undefined)
                throw new Error(`Member is already unfollowed from Thread '${thread.threadRef}'`);
            if (task !== undefined && this.hasActiveClaim(actor.memberId, task.taskRef))
                throw new Error(`Member cannot unfollow Thread '${thread.threadRef}' while owning an active Claim on Task '${task.taskRef}'; finish the work or release the Claim first`);
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/thread-attention-changed',
                data: Object.freeze({ workspaceId: request.workspaceId, action: 'unfollow', memberId: actor.memberId,
                    ...(task === undefined ? {} : { task }), thread, inbox: this.inboxDelta([], [{ memberId: actor.memberId, threadRef: thread.threadRef }], [], this.directMarkersFor(actor.memberId, thread.threadRef)) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.attentionResult(operation));
        });
    }
    /**
     * Follow or unfollow one Project's Main stream. Same shape as a Thread's
     * Attention: absent means the ordinary updates never reach this Member, present
     * means they do, and direct markers and responsibility Activities are untouched
     * either way. The Human's own row is derived, so the write is a no-op for them.
     */
    async writeMainAttention(actor, request) {
        const project = this.requireActiveProject(request.workspaceId, request.projectRef);
        // Reading and writing the Main stream both require Project membership, so
        // following one cannot be the door that gets a Member in.
        this.requireProjectMemberActor(actor, project.projectRef);
        const projectRef = project.projectRef;
        const current = this.mainAttentionForFrom(this.state, actor.memberId, projectRef);
        if (request.action === 'follow') {
            if (current !== undefined)
                throw new Error(`Member is already following the Main stream of Project '${projectRef}'`);
            const attention = this.startMainAttention(actor.memberId, projectRef, (this.mainSourcesFrom(this.state, projectRef).at(-1)?.sequence ?? 0) + 1, 'self');
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/main-attention-changed',
                data: Object.freeze({ workspaceId: request.workspaceId, action: 'follow', memberId: actor.memberId, project: project,
                    inbox: this.inboxDelta([], [], [], [], [], [], [], [], [], [], [attention], []) }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.mainAttentionResult(operation, attention));
        }
        if (current === undefined)
            throw new Error(`Member is already unfollowed from the Main stream of Project '${projectRef}'`);
        // The Human's Attention is derived from owning the Project, so it cannot
        // end: an unfollow would record an operation that changes nothing while
        // answering as though the row was gone, and the next unfollow would
        // commit again. Refuse it instead of recording a lie.
        if (actor.memberId === AGENT_TEAM_HUMAN_MEMBER_ID) {
            throw new Error(`The Human's Main stream Attention follows from owning Project '${projectRef}' and cannot be unfollowed; read the stream to acknowledge its updates`);
        }
        const stored = this.state.mainAttention.get(mainAttentionKey(actor.memberId, projectRef));
        const operation = Object.freeze({
            ...this.operationBase(request, this.nextSequence()), kind: 'team/main-attention-changed',
            data: Object.freeze({ workspaceId: request.workspaceId, action: 'unfollow', memberId: actor.memberId, project: project,
                inbox: this.inboxDelta([], [], [], [], [], [], [], [], [], [], [], stored === undefined ? [] : [{ memberId: actor.memberId, projectRef }]) }),
        });
        await this.table.put(operation.operationId, operation);
        this.applyAndAdvanceProjectionVersion(operation);
        return this.committed(this.mainAttentionResult(operation, undefined));
    }
    /**
     * Append one Member-to-Member direct message as an audit-only operation.
     * A DM is pure delivery: no Project, Thread, revision, attention, or
     * markers change, so apply() is a marker and no projection state moves.
     */
    sendDm(request) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameDm(existing, request);
                return this.resolved(this.dmResult(existing));
            }
            // Only an enabled Member in this Workspace may send a DM; the Human is
            // not a sendable peer, and Members in other Workspaces are unreachable.
            const sender = this.assertActorForWorkspace(request.actor, request.workspaceId);
            if (sender.kind !== 'member')
                throw new Error('agent-team DM requires Member authority');
            const body = request.body.trim();
            if (body === '')
                throw new Error('DM body must not be empty');
            const recipient = this.requireMember(request.recipientMemberId);
            if (!this.participatesIn(recipient.memberId, request.workspaceId))
                throw new Error(`Agent Member '${recipient.memberId}' is not in Workspace '${request.workspaceId}'`);
            if (recipient.state !== 'enabled')
                throw new Error(`Agent Member '${recipient.memberId}' is ${recipient.state}; DM delivery requires an enabled Member`);
            if (recipient.memberId === AGENT_TEAM_HUMAN_MEMBER_ID || !recipient.sessionId)
                throw new Error('DM recipient must be an Agent Member');
            if (recipient.memberId === sender.memberId)
                throw new Error('Members cannot DM themselves');
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/dm-sent',
                data: Object.freeze({ workspaceId: request.workspaceId, senderMemberId: sender.memberId,
                    recipientMemberId: recipient.memberId, body }),
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.dmResult(operation));
        });
    }
    /**
     * Bounded adjacent context for a DM relay: the truncated body of the most
     * recent earlier DM between the two sessions, newest first. Returns
     * undefined when this is their first exchange. `excluding` skips the
     * operation id of the DM being delivered right now, so the context line is
     * the adjacent prior exchange rather than a self-reference. Direction
     * labels are from the reader's perspective: the reader is the recipient of
     * the DM being delivered, so messages the reader sent are `you → them`.
     */
    dmHistoryBetween(senderSessionId, recipientMemberId, excluding) {
        const sender = [...this.state.members.values()].find(member => member.sessionId === senderSessionId);
        if (sender === undefined)
            return undefined;
        for (let index = this.state.ordered.length - 1; index >= 0; index -= 1) {
            const operation = this.state.ordered[index];
            if (operation.kind !== 'team/dm-sent' || operation.operationId === excluding)
                continue;
            const sentByOther = operation.data.senderMemberId === sender.memberId && operation.data.recipientMemberId === recipientMemberId;
            const sentByReader = operation.data.senderMemberId === recipientMemberId && operation.data.recipientMemberId === sender.memberId;
            if (!sentByOther && !sentByReader)
                continue;
            const direction = sentByOther ? 'them → you' : 'you → them';
            const truncated = characterLength(operation.data.body) > 160
                ? `${truncateToCharacters(operation.data.body, 160)}…` : operation.data.body;
            return `(${direction}, at ${formatTeamTimestamp(operation.occurredAt)}) ${truncated}`;
        }
        return undefined;
    }
    attentionStatus(actor, request) {
        const authorized = this.assertActorForWorkspace(actor, request.workspaceId);
        const { task, thread } = this.threadContextForActor(authorized, request.workspaceId, request);
        const attention = this.attentionFor(authorized.memberId, thread.threadRef);
        return Object.freeze({ ...(task === undefined ? {} : { task }), thread, ...(attention === undefined ? {} : { attention }) });
    }
    /** The reader's own Main stream Attention on one Project, answered without writing. */
    mainAttentionStatus(actor, request) {
        const authorized = this.assertActorForWorkspace(actor, request.workspaceId);
        const project = this.requireActiveProject(request.workspaceId, request.projectRef);
        this.requireProjectMemberActor(authorized, project.projectRef);
        const attention = this.mainAttentionForFrom(this.state, authorized.memberId, project.projectRef);
        return Object.freeze({ project, ...(attention === undefined ? {} : { attention }) });
    }
    inbox(actor, request) {
        const authorized = this.assertActorForWorkspace(actor, request.workspaceId);
        return this.inboxForWorkspaces(authorized, [request.workspaceId], request.limit);
    }
    memberInbox(actor, request) {
        const workspaces = this.workspacesOf(actor.memberId);
        for (const workspaceId of workspaces)
            this.assertActorForWorkspace(actor, workspaceId);
        return this.inboxForWorkspaces(actor, workspaces, request.limit);
    }
    inboxForWorkspaces(authorized, workspaceIds, requestedLimit) {
        const limit = requestedLimit ?? 50;
        if (!Number.isInteger(limit) || limit < 1 || limit > 100)
            throw new Error('inbox limit must be an integer between 1 and 100');
        const taskNumbers = new Map(workspaceIds.flatMap(workspaceId => [...this.taskNumbers(workspaceId)]));
        const unreadThreads = new Set();
        const candidates = [];
        for (const threadRef of this.inboxCandidateThreads(authorized.memberId)) {
            const thread = this.state.threads.get(threadRef);
            if (thread === undefined)
                continue;
            const projectRef = this.projectRefForThread(thread.threadRef);
            if (projectRef === undefined)
                continue;
            const project = this.state.projects.get(projectRef);
            if (project === undefined || !workspaceIds.includes(project.workspaceId))
                continue;
            if (this.visibleProject(project) === undefined)
                continue;
            const workspaceId = project.workspaceId;
            if (authorized.kind === 'member' && !this.isProjectMember(projectRef, authorized.memberId))
                continue;
            const unread = this.unreadFor(authorized.memberId, thread.threadRef);
            const reminders = this.remindersFor(authorized.memberId, thread.threadRef);
            if (unread.length === 0 && reminders.length === 0)
                continue;
            unreadThreads.add(thread.threadRef);
            const task = thread.taskRef === undefined ? undefined : this.state.tasks.get(thread.taskRef);
            const directCount = unread.filter(item => item.direct).length + reminders.length;
            const attention = this.attentionFor(authorized.memberId, thread.threadRef);
            const newest = unread.at(-1)?.fact;
            const latestReminder = reminders.at(-1);
            const reminderIsNewest = latestReminder !== undefined && latestReminder.sequence > (newest?.sequence ?? 0);
            const newestSequence = reminderIsNewest ? latestReminder.sequence : newest?.sequence ?? latestReminder?.sequence ?? 0;
            const newestOccurredAt = reminderIsNewest ? latestReminder.occurredAt : newest?.occurredAt ?? latestReminder?.occurredAt ?? '';
            const newestActor = reminderIsNewest || newest === undefined
                ? Object.freeze({ memberId: AGENT_TEAM_HUMAN_MEMBER_ID, name: 'Agent Team' }) : this.inboxActorFor(newest);
            const taskNumber = task === undefined ? undefined : taskNumbers.get(task.taskRef);
            candidates.push({ workspaceId, projectRef, projectName: project.name,
                ...(task === undefined ? {} : { task }), ...(taskNumber === undefined ? {} : { taskNumber }), thread,
                unreadCount: unread.length + reminders.length, directCount, newestSequence, newestOccurredAt, newestActor, reminders,
                ...(attention === undefined ? {} : { attention }) });
        }
        candidates.sort((left, right) => right.directCount - left.directCount || right.newestSequence - left.newestSequence || left.thread.threadRef.localeCompare(right.thread.threadRef));
        const selected = candidates.slice(0, limit).map(candidate => Object.freeze({ workspaceId: candidate.workspaceId, projectRef: candidate.projectRef,
            projectName: candidate.projectName, ...(candidate.task === undefined ? {} : { task: candidate.task }),
            ...(candidate.taskNumber === undefined ? {} : { taskNumber: candidate.taskNumber }), thread: candidate.thread,
            unreadCount: candidate.unreadCount, directCount: candidate.directCount, reminders: candidate.reminders,
            previewText: boundedOpeningLine(this.threadAnchor(candidate.thread.threadRef).body, GIST_SOURCE_MAX_CHARACTERS),
            newestSequence: candidate.newestSequence, newestOccurredAt: candidate.newestOccurredAt,
            newestActor: candidate.newestActor, liveClaimOwners: this.liveClaimOwners(candidate.task),
            ...(candidate.attention === undefined ? {} : { attention: candidate.attention }) }));
        const recent = authorized.kind === 'human'
            ? this.recentInboxItems(authorized.memberId, workspaceIds[0], unreadThreads, taskNumbers)
            : Object.freeze([]);
        const main = this.mainInboxItems(authorized.memberId, workspaceIds);
        return Object.freeze({ humanMemberId: this.initialization().data.humanMemberId,
            items: Object.freeze(selected), hasMore: candidates.length > selected.length, main, recent,
            totalUnreadCount: [...candidates, ...main].reduce((sum, item) => sum + item.unreadCount, 0),
            totalDirectCount: [...candidates, ...main].reduce((sum, item) => sum + item.directCount, 0) });
    }
    taskBoard(actor, request) {
        const authorized = this.assertActorForWorkspace(actor, request.workspaceId);
        return this.taskBoardFor(authorized, [request.workspaceId], request);
    }
    memberTaskBoard(actor, request) {
        const workspaces = this.workspacesOf(actor.memberId);
        for (const workspaceId of workspaces)
            this.assertActorForWorkspace(actor, workspaceId);
        return this.taskBoardFor(actor, workspaces, request);
    }
    taskBoardFor(authorized, workspaceIds, request) {
        const memberId = authorized.memberId;
        const finishedLimit = request.finishedLimit ?? TASK_BOARD_FINISHED_PER_PROJECT;
        if (!Number.isInteger(finishedLimit) || finishedLimit < 1 || finishedLimit > 100)
            throw new Error('finished limit must be an integer between 1 and 100');
        if (request.projectRef !== undefined) {
            const project = this.state.projects.get(request.projectRef);
            if (project === undefined || !workspaceIds.includes(project.workspaceId))
                throw new Error(`unknown Project ref '${request.projectRef}'`);
            this.requireActiveProject(project.workspaceId, request.projectRef);
            if (authorized.kind === 'member' && !this.isProjectMember(request.projectRef, memberId))
                throw new Error(`Agent Member '${memberId}' is not authorized for Project '${request.projectRef}'`);
        }
        const taskNumbers = new Map(workspaceIds.flatMap(workspaceId => [...this.taskNumbers(workspaceId)]));
        const open = [];
        const finishedByProject = new Map();
        for (const task of this.state.tasks.values()) {
            if (request.projectRef !== undefined && task.projectRef !== request.projectRef)
                continue;
            const project = this.visibleProject(this.state.projects.get(task.projectRef));
            if (project === undefined || !workspaceIds.includes(project.workspaceId))
                continue;
            if (authorized.kind === 'member' && !this.isProjectMember(task.projectRef, memberId))
                continue;
            const executor = this.hasActiveClaim(memberId, task.taskRef);
            const accountable = task.accountable === memberId;
            if (request.mine === true && !executor && !accountable)
                continue;
            const newest = (this.state.factsByThread.get(task.threadRef) ?? []).at(-1);
            if (newest === undefined)
                continue;
            const item = Object.freeze({ workspaceId: project.workspaceId, projectRef: project.projectRef, projectName: project.name,
                task, taskNumber: taskNumbers.get(task.taskRef) ?? 0, threadRef: task.threadRef,
                subject: boundedOpeningLine(this.threadAnchor(task.threadRef).body, GIST_SOURCE_MAX_CHARACTERS),
                liveClaimOwners: this.liveClaimOwners(task), accountableOwner: {
                    ...this.memberActor(task.accountable),
                    ...(this.state.members.get(task.accountable)?.state === undefined ? {} : { state: this.state.members.get(task.accountable).state }),
                },
                lastActivitySequence: newest.sequence, lastActivityAt: newest.occurredAt,
                relation: accountable ? 'accountable' : executor ? 'executor' : authorized.kind === 'human' || this.isProjectOwnerFrom(this.state, task.projectRef, memberId) ? 'project-owner' : 'none',
                needsAcceptance: task.status === 'in_review' && (authorized.kind === 'human' || this.canVerifyTaskFrom(this.state, task, memberId)) });
            if (task.status === 'done' || task.status === 'closed') {
                const finished = finishedByProject.get(task.projectRef) ?? [];
                finished.push(item);
                finishedByProject.set(task.projectRef, finished);
            }
            else {
                open.push(item);
            }
        }
        const newestFirst = (left, right) => right.lastActivitySequence - left.lastActivitySequence;
        const sortedByProject = [...finishedByProject.values()].map(items => items.sort(newestFirst));
        // A full page is not proof of an older one, and a Client that cannot tell a
        // page that ends here from a page the Host cut will offer a control that
        // changes nothing. Only the Host knows which it was, so it says so.
        const finishedTruncated = sortedByProject.some(items => items.length > finishedLimit);
        const finished = sortedByProject.flatMap(items => items.slice(0, finishedLimit)).sort(newestFirst);
        return Object.freeze({ humanMemberId: this.initialization().data.humanMemberId, open: Object.freeze(open.sort(newestFirst)),
            finished: Object.freeze(finished), finishedTruncated });
    }
    mainInboxItems(memberId, workspaceIds) {
        const rows = [];
        for (const project of this.state.projects.values()) {
            if (!workspaceIds.includes(project.workspaceId) || this.visibleProject(project) === undefined)
                continue;
            if (memberId !== AGENT_TEAM_HUMAN_MEMBER_ID && !this.isProjectMemberFrom(this.state, project.projectRef, memberId))
                continue;
            const unread = this.mainUnreadForNotification(memberId, project.projectRef);
            if (unread.length === 0)
                continue;
            const newest = unread.at(-1);
            const entry = this.mainEntry(newest.source, true, newest.direct);
            const previewText = entry.kind === 'message' ? boundedOpeningLine(entry.message.body, GIST_SOURCE_MAX_CHARACTERS)
                : entry.kind === 'thread-card' ? entry.card.anchor.preview : undefined;
            rows.push(Object.freeze({ workspaceId: project.workspaceId, projectRef: project.projectRef, projectName: project.name,
                unreadCount: unread.length, directCount: unread.filter(item => item.direct).length,
                ...(previewText === undefined ? {} : { previewText }), newestSequence: newest.source.sequence, newestOccurredAt: entry.occurredAt,
                newestActor: this.memberActor(this.mainProducerFrom(this.state, newest.source) ?? this.initialization().data.humanMemberId) }));
        }
        rows.sort((left, right) => right.directCount - left.directCount || right.newestSequence - left.newestSequence);
        return Object.freeze(rows);
    }
    inboxActorFor(fact) {
        return this.memberActor(fact.kind === 'message' ? fact.message.sender : fact.activity.actor);
    }
    /**
     * One Member as a row draws them: the id carries the identity hue, the handle
     * the initial. The Human is the one Member the Agent roster never holds, so
     * their row reads the runtime display name rather than falling back to the
     * durable `member:human` id — the same name every other seat and @ matching
     * already use.
     */
    memberActor(memberId) {
        if (memberId === this.initialization().data.humanMemberId)
            return Object.freeze({ memberId, name: this.humanHandle });
        return Object.freeze({ memberId, name: this.state.members.get(memberId)?.handle ?? memberId });
    }
    /**
     * The people a Task still has on it, resolved the way a row draws them: owners
     * of its live Claims, in claim order, deduped. A released Claim is not work,
     * and a done or closed Task keeps its Claims as history rather than as
     * presence — deliberately the same rule the Project feed applies to the same
     * Task, so 「谁在这个 Task 上」 never acquires a second definition.
     */
    liveClaimOwners(task) {
        if (task === undefined || (task.status !== 'in_progress' && task.status !== 'in_review'))
            return Object.freeze([]);
        const owners = [];
        for (const claim of this.claimsForTask(task.taskRef)) {
            if (claim.state === 'released' || owners.includes(claim.owner))
                continue;
            owners.push(claim.owner);
        }
        return Object.freeze(owners.map(owner => this.memberActor(owner)));
    }
    /**
     * The Human Inbox's 「最近活跃」 slice: the Threads this reader has written in, a
     * durable way back into work. Participation is the whole admission rule,
     * whether or not the reader follows the Thread; starting a Thread counts
     * because it writes its anchor. Attention plays no part: it decides what
     * notifies a reader, and a reply does not implicitly follow a Thread. A
     * Thread the reader later unfollowed stays, since unfollowing stops
     * notifications, not the record. Threads still holding unread are excluded
     * because the unread queue already carries them. Newest activity first,
     * bounded by `RECENT_INBOX_LIMIT`. Rows have the same shape as unread rows
     * with every count at zero.
     */
    recentInboxItems(memberId, workspaceId, unreadThreads, taskNumbers) {
        const recent = [];
        for (const threadRef of this.state.threadsByWriter.get(memberId) ?? []) {
            if (unreadThreads.has(threadRef))
                continue;
            const thread = this.state.threads.get(threadRef);
            if (thread === undefined)
                continue;
            const projectRef = this.projectRefForThread(thread.threadRef);
            if (projectRef === undefined)
                continue;
            const project = this.state.projects.get(projectRef);
            if (project === undefined || project.workspaceId !== workspaceId)
                continue;
            if (this.visibleProject(project) === undefined)
                continue;
            const facts = this.state.factsByThread.get(thread.threadRef) ?? [];
            const newest = facts.at(-1);
            if (newest === undefined)
                continue;
            const task = thread.taskRef === undefined ? undefined : this.state.tasks.get(thread.taskRef);
            const taskNumber = task === undefined ? undefined : taskNumbers.get(task.taskRef);
            recent.push(Object.freeze({ workspaceId, projectRef,
                projectName: this.state.projects.get(projectRef)?.name ?? '',
                ...(task === undefined ? {} : { task }), ...(taskNumber === undefined ? {} : { taskNumber }), thread,
                unreadCount: 0, directCount: 0,
                previewText: boundedOpeningLine(this.threadAnchor(thread.threadRef).body, GIST_SOURCE_MAX_CHARACTERS),
                newestSequence: newest.sequence, newestOccurredAt: newest.occurredAt,
                newestActor: this.inboxActorFor(newest), liveClaimOwners: this.liveClaimOwners(task), reminders: [] }));
        }
        recent.sort((left, right) => right.newestSequence - left.newestSequence || left.thread.threadRef.localeCompare(right.thread.threadRef));
        return Object.freeze(recent.slice(0, RECENT_INBOX_LIMIT));
    }
    /**
     * Threads that can hold unread facts for one reader, from the per-reader
     * derived indexes: Attention follows plus direct and activity markers.
     * Every unread source is covered — ordinary unread requires Attention, and
     * marker unread requires a marker — so no full Thread scan is needed.
     */
    inboxCandidateThreads(memberId) {
        const refs = new Set();
        for (const source of [this.state.attentionThreadsByMember.get(memberId), this.state.directMarkersByMember.get(memberId), this.state.activityMarkersByMember.get(memberId), this.state.reminderMarkersByMember.get(memberId)]) {
            for (const threadRef of source?.keys() ?? [])
                refs.add(threadRef);
        }
        return refs;
    }
    /** Model-visible notification material derived from the recipient's current durable unread state. */
    notificationFacts(memberId, request) {
        const member = this.requireMember(memberId);
        if (request !== undefined && !this.participatesIn(memberId, request.workspaceId))
            throw new Error('Member cannot inspect another Workspace');
        const actor = { kind: 'member', memberId, handle: member.handle };
        return this.withNotificationReadSet(memberId, () => {
            const inbox = request === undefined ? this.memberInbox(actor, {}) : this.inbox(actor, request);
            return Object.freeze(inbox.items.map(item => Object.freeze({ item,
                facts: this.notificationReadSet?.facts.get(item.thread.threadRef) ?? this.unreadFor(memberId, item.thread.threadRef), reminders: item.reminders })));
        });
    }
    /**
     * Thread, Main and Member-reminder notification material share one bounded
     * read set for one delivery attempt. A Member reminder is the third unread
     * source: it belongs to no Thread, so it rides the same private notice.
     */
    notificationSnapshot(memberId) {
        return this.withNotificationReadSet(memberId, () => {
            const threads = this.notificationFacts(memberId);
            // The answers behind the Worker facts this wake names. A notice carries
            // what the Worker said, which the Thread never holds, so the reader's own
            // run is the one thing the wake has to look up out of band.
            const workerRefs = new Set();
            for (const thread of threads) {
                for (const entry of thread.facts) {
                    const activity = entry.fact.kind === 'activity' ? entry.fact.activity : undefined;
                    if (entry.direct && activity?.kind === 'worker_settled')
                        workerRefs.add(activity.workerRef);
                }
            }
            const workers = [...workerRefs].flatMap(workerRef => {
                const answer = this.workerAnswerFor(memberId, workerRef);
                return answer === undefined ? [] : [answer];
            });
            return { threads, main: this.mainNotificationFacts(memberId), memberReminders: this.unreadMemberRemindersFor(memberId), workers };
        });
    }
    withNotificationReadSet(memberId, read) {
        const previous = this.notificationReadSet;
        if (previous?.memberId === memberId)
            return read();
        this.notificationReadSet = { memberId, facts: new Map(), main: new Map() };
        try {
            return read();
        }
        finally {
            this.notificationReadSet = previous;
        }
    }
    mainUnreadForNotification(memberId, projectRef) {
        const readSet = this.notificationReadSet;
        if (readSet?.memberId === memberId && readSet.main.has(projectRef))
            return readSet.main.get(projectRef);
        const unread = this.mainUnreadFrom(this.state, memberId, projectRef);
        if (readSet?.memberId === memberId)
            readSet.main.set(projectRef, unread);
        return unread;
    }
    /**
     * Answer what a read would return right now without committing or
     * acknowledging anything. The Host uses this to see the bounded batch it can
     * deliver before deciding which prefix it actually did deliver.
     */
    previewThreadRead(request) {
        const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
        return this.readPicture(this.prepareRead(actor.memberId, request.workspaceId, request));
    }
    readThread(request, select) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameThreadRead(existing, request);
                const selectedThroughSequence = isThreadReadSnapshot(existing.data) ? undefined : existing.data.selectedThroughSequence;
                const current = this.prepareRead(existing.data.memberId, existing.data.workspaceId, { ...request,
                    ...(selectedThroughSequence === undefined ? {} : { selectedThroughSequence: 0 }) });
                return Object.freeze({ value: Object.freeze({ receipt: this.receipt(existing), ...this.readPicture(current),
                        ...(selectedThroughSequence === undefined ? {} : { readThroughSequence: existing.data.readThroughSequence }) }), committed: false });
            }
            const actor = this.assertActorForWorkspace(request.actor, request.workspaceId);
            // Selection runs inside the queue against the state this write will
            // actually see, so a fact queued ahead of it is never skipped.
            const selectedThroughSequence = select === undefined
                ? request.selectedThroughSequence
                : select(this.previewThreadRead({ ...request, actor }));
            const prepared = this.prepareRead(actor.memberId, request.workspaceId, { ...request, selectedThroughSequence });
            // A read whose Inbox delta is empty writes nothing: the watermark does
            // not advance and no marker is consumed. It answers with the same picture
            // and no receipt, so the caller learns "no operation" from the result's
            // committed flag, never from a sequence this read did not write.
            if (isEmptyInboxDelta(prepared.inbox))
                return Object.freeze({ value: this.readPicture(prepared), committed: false });
            // The record carries progress, not the picture: the Thread, its facts,
            // the anchor and the reader's Attention are projection state every replay
            // already holds.
            const data = Object.freeze({ workspaceId: request.workspaceId, memberId: actor.memberId,
                threadRef: prepared.thread.threadRef, ...(prepared.task === undefined ? {} : { taskRef: prepared.task.taskRef }),
                readThroughSequence: prepared.readThroughSequence,
                ...(prepared.selectedThroughSequence === undefined ? {} : { selectedThroughSequence: prepared.selectedThroughSequence }),
                inbox: prepared.inbox });
            const operation = Object.freeze({
                ...this.operationBase(request, this.nextSequence()), kind: 'team/thread-read', data,
            });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return Object.freeze({ value: Object.freeze({ receipt: this.receipt(operation), ...this.readPicture(prepared) }), committed: true });
        });
    }
    threadObservations(actor, request) {
        this.assertHumanActor(actor);
        const { task, thread } = this.threadContextForActor(actor, request.workspaceId, request);
        const limit = request.limit ?? 50;
        if (!Number.isInteger(limit) || limit < 1 || limit > 100)
            throw new Error('observation limit must be an integer between 1 and 100');
        const threadRef = thread.threadRef;
        // Both slices are replay-derived: the observation log is appended by
        // committed Inbox deltas in ledger order, and the live follower set is
        // the same Attention index the follow history converges to.
        const log = this.state.observationsByThread.get(threadRef) ?? [];
        const observations = log.slice(-limit)
            .map(event => Object.freeze({ sequence: event.sequence, threadRef, ...(task === undefined ? {} : { taskRef: task.taskRef }),
            memberId: event.memberId, action: event.action }));
        return Object.freeze({ items: Object.freeze(observations), hasMore: log.length > observations.length,
            followers: Object.freeze([...this.state.attentionByThread.get(threadRef) ?? []]) });
    }
    /** Every operation carrying an inbox delta drives the Inbox projection; the payload shape decides, not a per-kind list. */
    attentionDelta(operation) {
        return 'inbox' in operation.data ? operation.data.inbox : undefined;
    }
    /** Attachment ids referenced by any stored Message — the GC's keep-set oracle. */
    referencedAttachmentIds() {
        const referenced = new Set();
        for (const fact of this.state.orderedFacts) {
            if (fact.kind !== 'message')
                continue;
            for (const attachment of fact.message.attachments ?? [])
                referenced.add(attachment.attachmentId);
        }
        for (const source of this.state.mainSourceByRef.values()) {
            if (source.kind !== 'message')
                continue;
            for (const attachment of source.message.attachments ?? [])
                referenced.add(attachment.attachmentId);
        }
        return referenced;
    }
    threadHistory(actor, request) {
        const authorized = this.assertActorForWorkspace(actor, request.workspaceId);
        const { task, thread } = this.threadContextForActor(authorized, request.workspaceId, request);
        const limit = request.limit ?? 20;
        if (!Number.isInteger(limit) || limit < 1 || limit > 100)
            throw new Error('history limit must be an integer between 1 and 100');
        const before = request.beforeSequence ?? this.currentTail(thread.threadRef) + 1;
        if (!Number.isInteger(before) || before < 1)
            throw new Error('beforeSequence must be a positive integer');
        const all = this.threadFacts(thread.threadRef).filter(fact => fact.sequence < before);
        const facts = all.slice(-limit);
        const anchor = this.threadAnchor(thread.threadRef);
        return Object.freeze({ ...(task === undefined ? {} : { task }), thread, anchor, anchorMentions: this.state.mentionsByMessage.get(anchor.messageRef) ?? [],
            claims: task === undefined ? Object.freeze([]) : this.claimsForTask(task.taskRef), facts: Object.freeze(facts),
            ...(task === undefined ? { taskCards: this.derivedTaskCards(thread.threadRef) } : {}),
            cursor: facts.length === 0 ? before : facts[0].sequence, hasMore: all.length > facts.length });
    }
    /**
     * The Tasks this discussion spawned, as the cards the Thread renders at their creation points. Each card is the Main
     * stream's own `mainThreadCard` projection of the Task's Thread, so the two faces cannot drift apart.
     */
    derivedTaskCards(threadRef) {
        const cards = [];
        for (const task of this.state.tasks.values()) {
            if (!task.sourceThreadRefs.includes(threadRef))
                continue;
            const anchor = this.state.anchorByThread.get(task.threadRef);
            if (anchor === undefined)
                continue;
            const card = this.mainThreadCard(task.threadRef);
            // The Task's own Thread always carries its taskRef, so the facet is present; the guard is what tells the type so.
            if (card.task === undefined)
                continue;
            cards.push(Object.freeze({ sequence: anchor.sequence, card: { ...card, task: card.task } }));
        }
        return Object.freeze(cards.sort((left, right) => left.sequence - right.sequence
            || left.card.task.taskRef.localeCompare(right.card.task.taskRef)));
    }
    listClaims(actor, request) {
        const authorized = this.assertActorForWorkspace(actor, request.workspaceId);
        const { task, thread } = this.threadForActor(authorized, request.workspaceId, request.taskRef);
        return Object.freeze({ task, thread, claims: this.claimsForTask(task.taskRef) });
    }
    getTask(taskRef) {
        return this.state.tasks.get(taskRef);
    }
    getClaim(claimRef) {
        return this.state.claims.get(claimRef);
    }
    /** Navigation facts for message-body Thread refs; unknown refs are omitted. */
    resolveThreadRefs(workspaceId, threadRefs) {
        const numbers = this.taskNumbers(workspaceId);
        const resolved = [];
        for (const threadRef of threadRefs) {
            const key = this.uniqueRefKey(this.state.threads, threadRef, 'thread');
            const thread = key === undefined ? undefined : this.state.threads.get(key);
            const projectRef = thread === undefined ? undefined : this.projectRefForThread(thread.threadRef);
            const project = projectRef === undefined ? undefined : this.state.projects.get(projectRef);
            if (thread === undefined || projectRef === undefined || project?.workspaceId !== workspaceId || this.visibleProject(project) === undefined)
                continue;
            const task = thread.taskRef === undefined ? undefined : this.state.tasks.get(thread.taskRef);
            resolved.push(Object.freeze({
                threadRef: thread.threadRef,
                projectRef,
                ...(task === undefined ? {} : { taskRef: task.taskRef, taskNumber: numbers.get(task.taskRef) ?? 0 }),
                title: boundedOpeningLine(this.threadAnchor(thread.threadRef).body, GIST_SOURCE_MAX_CHARACTERS),
            }));
        }
        return resolved;
    }
    /**
     * Context for Messages cited by `replyToMessageRef`; unknown refs are omitted.
     *
     * A reply stores only its parent's identity, so the author and the excerpt a
     * quote block renders are derived here from the recorded Message. Resolving
     * through the ledger rather than the reader's loaded window is what lets a
     * quote survive history paging — the parent may be far outside the facts the
     * reader currently holds.
     */
    resolveMessageRefs(workspaceId, messageRefs) {
        const resolved = [];
        for (const messageRef of messageRefs) {
            const main = this.state.mainSourceByRef.get(messageRef);
            if (main?.kind === 'message') {
                if (this.visibleProject(this.state.projects.get(main.message.projectRef))?.workspaceId !== workspaceId)
                    continue;
                resolved.push(Object.freeze({ messageRef, sender: main.message.sender, excerpt: boundedOpeningLine(main.message.body, GIST_SOURCE_MAX_CHARACTERS) }));
                continue;
            }
            const message = this.state.messagesByRef.get(messageRef);
            if (message === undefined)
                continue;
            const project = this.state.projects.get(message.projectRef);
            if (this.visibleProject(project)?.workspaceId !== workspaceId)
                continue;
            resolved.push(Object.freeze({
                messageRef: message.messageRef,
                threadRef: message.threadRef,
                sender: message.sender,
                excerpt: boundedOpeningLine(message.body, GIST_SOURCE_MAX_CHARACTERS),
            }));
        }
        return resolved;
    }
    /**
     * Read one Message back verbatim, inside the Thread that carries it.
     *
     * Authorization comes first and comes from the Thread: a reader must be able
     * to address the Thread at all, which is where membership and Project
     * archival are decided, so this opens no path that reading the Thread did
     * not already open. The Message is then looked up by identity in the index —
     * never by position — so a ref resolves the same Message whatever else has
     * been written since, and an answer can never quietly become a neighbour.
     *
     * The body is returned whole. The quote a Message renders is a bounded
     * summary by design; this is the other thing, for the reader that has to
     * answer it.
     */
    readMessage(actor, request) {
        if ((request.threadRef === undefined) === (request.projectRef === undefined))
            throw new Error('readMessage needs exactly one of threadRef and projectRef');
        if (request.projectRef !== undefined)
            return this.readMainMessage(actor, request.workspaceId, request.projectRef, request.messageRef);
        // Addressing the Thread is the authorization: unknown, foreign, and
        // archived all refuse here, and refuse distinguishably.
        const context = this.threadContextForActor(actor, request.workspaceId, { threadRef: request.threadRef });
        const message = this.state.messagesByRef.get(request.messageRef);
        if (message === undefined)
            throw new Error(`Message '${request.messageRef}' is not a recorded Message${this.unknownRefHint(request.messageRef, 'message', 'Message')} — ${recoveryFor('message_read_unknown').sentence({ refused: `'${request.messageRef}'` })}`);
        if (message.threadRef !== context.thread.threadRef)
            throw new Error(`Message '${request.messageRef}' belongs to another Thread — ${recoveryFor('message_read_foreign').sentence({ refused: `'${request.messageRef}'` })}`);
        return Object.freeze({
            messageRef: message.messageRef,
            threadRef: message.threadRef,
            projectRef: context.projectRef,
            sender: message.sender,
            sequence: message.sequence,
            ...(message.occurredAt === undefined ? {} : { occurredAt: message.occurredAt }),
            body: message.body,
        });
    }
    /** A Main stream Message read back whole; the Main stream itself is the authorization. */
    readMainMessage(actor, workspaceId, projectRef, messageRef) {
        this.requireRulesVersion2('the Main stream');
        const authorized = this.assertActorForWorkspace(actor, workspaceId);
        const project = this.requireActiveProject(workspaceId, projectRef);
        this.requireProjectMemberActor(authorized, project.projectRef);
        const source = this.state.mainSourceByRef.get(messageRef);
        if (source?.kind !== 'message')
            throw new Error(`Message '${messageRef}' is not a recorded Main stream Message${this.unknownRefHint(messageRef, 'message', 'Message')} — ${recoveryFor('message_read_unknown').sentence({ refused: `'${messageRef}'` })}`);
        if (source.message.projectRef !== project.projectRef)
            throw new Error(`Message '${messageRef}' belongs to another Project — ${recoveryFor('message_read_foreign_project').sentence({ refused: `'${messageRef}'` })}`);
        const { message } = source;
        return Object.freeze({ messageRef, projectRef: project.projectRef, sender: message.sender, sequence: message.sequence, occurredAt: message.occurredAt, body: message.body });
    }
    /** Navigation facts for message-body Task refs; unknown refs are omitted. */
    resolveTaskRefs(workspaceId, taskRefs) {
        const numbers = this.taskNumbers(workspaceId);
        const resolved = [];
        for (const taskRef of taskRefs) {
            const key = this.uniqueRefKey(this.state.tasks, taskRef, 'task');
            const task = key === undefined ? undefined : this.state.tasks.get(key);
            const project = task === undefined ? undefined : this.state.projects.get(task.projectRef);
            if (task === undefined || this.visibleProject(project)?.workspaceId !== workspaceId)
                continue;
            resolved.push(Object.freeze({ taskRef: task.taskRef, projectRef: task.projectRef, threadRef: task.threadRef, taskNumber: numbers.get(task.taskRef) ?? 0 }));
        }
        return resolved;
    }
    view(request, memberId) {
        const limit = request.limit ?? 20;
        const direction = request.direction ?? 'after';
        const cursor = request.cursor ?? 0;
        if (direction !== 'after' && direction !== 'before')
            throw new Error('direction must be after or before');
        if (!Number.isInteger(limit) || limit < 1 || limit > 100)
            throw new Error('limit must be an integer between 1 and 100');
        if (!Number.isInteger(cursor) || cursor < 0)
            throw new Error('cursor must be a non-negative integer sequence');
        if (memberId !== undefined) {
            const member = this.requireMember(memberId);
            if (!this.participatesIn(member.memberId, request.workspaceId))
                throw new Error('Member cannot view another Workspace');
        }
        const projectRefFilter = request.projectRef === undefined
            ? undefined
            : this.requireActiveProject(request.workspaceId, request.projectRef).projectRef;
        const directoryRequested = memberId !== undefined && request.includeWorkspaceDirectory === true;
        if (projectRefFilter !== undefined) {
            if (memberId !== undefined && !directoryRequested && !this.isProjectMember(projectRefFilter, memberId))
                throw new Error(`Agent Member '${memberId}' is not authorized for Project '${request.projectRef}'`);
        }
        let threadRefFilter;
        if (request.threadRef !== undefined) {
            const thread = this.requireThread(request.threadRef);
            threadRefFilter = thread.threadRef;
            const projectRef = this.projectRefForThread(thread.threadRef);
            if (projectRef === undefined)
                throw new Error(`unknown Thread ref '${request.threadRef}'`);
            if (this.state.projects.get(projectRef)?.workspaceId !== request.workspaceId)
                throw new Error(`Thread '${request.threadRef}' does not belong to Workspace '${request.workspaceId}'`);
            this.assertThreadProjectActive(projectRef);
            if (projectRefFilter !== undefined && projectRef !== projectRefFilter)
                throw new Error(`Thread '${request.threadRef}' does not belong to Project '${request.projectRef}'`);
            if (memberId !== undefined && !this.isProjectMember(projectRef, memberId))
                throw new Error(`Agent Member '${memberId}' is not authorized for Project '${projectRef}'`);
        }
        const projects = [...this.state.projects.values()].filter(project => project.workspaceId === request.workspaceId
            && this.visibleProject(project) !== undefined
            && (memberId === undefined || this.isProjectMember(project.projectRef, memberId)));
        const projectRefs = new Set(projects.map(project => project.projectRef));
        const before = request.cursor ?? this.state.ordered.length + 1;
        const matches = (fact) => {
            const threadRef = fact.kind === 'message' ? fact.message.threadRef : fact.activity.threadRef;
            const projectRef = this.projectRefForThread(threadRef);
            if (projectRef === undefined || !projectRefs.has(projectRef))
                return false;
            if (projectRefFilter !== undefined && projectRef !== projectRefFilter)
                return false;
            if (threadRefFilter !== undefined && threadRef !== threadRefFilter)
                return false;
            if (request.topLevelOnly && (fact.kind !== 'message' || !fact.message.topLevel))
                return false;
            if (request.includeActivities === false && fact.kind === 'activity')
                return false;
            return direction === 'before' ? fact.sequence < before : fact.sequence > cursor;
        };
        const selected = [];
        let hasMore = false;
        // A cursor is a sequence bound, but one operation can append two facts
        // under the same sequence (a Task's anchor Message and its promote
        // activity). A page boundary must never split such a run: the next page
        // would address it by the same sequence and silently drop the half left
        // behind. So a full page absorbs the rest of its boundary sequence.
        if (direction === 'before') {
            for (let index = this.state.orderedFacts.length - 1; index >= 0; index -= 1) {
                const fact = this.state.orderedFacts[index];
                if (!matches(fact))
                    continue;
                if (selected.length < limit)
                    selected.push(fact);
                else {
                    hasMore = true;
                    let run = index;
                    while (run >= 0) {
                        const candidate = this.state.orderedFacts[run];
                        if (!matches(candidate) || candidate.sequence !== fact.sequence)
                            break;
                        selected.push(candidate);
                        run -= 1;
                    }
                    break;
                }
            }
            selected.reverse();
        }
        else {
            for (let index = 0; index < this.state.orderedFacts.length; index += 1) {
                const fact = this.state.orderedFacts[index];
                if (!matches(fact))
                    continue;
                if (selected.length < limit)
                    selected.push(fact);
                else {
                    hasMore = true;
                    let run = index;
                    while (run < this.state.orderedFacts.length) {
                        const candidate = this.state.orderedFacts[run];
                        if (!matches(candidate) || candidate.sequence !== fact.sequence)
                            break;
                        selected.push(candidate);
                        run += 1;
                    }
                    break;
                }
            }
        }
        // What this response's catalog describes. A caller that asked for the
        // catalog wants the whole request scope (the address-book radar). Every
        // other read describes its own facts: the Threads this page's facts
        // belong to plus the Thread it names, resolved by ref through the page's
        // own lookups.
        const catalogThreadRefs = new Set();
        if (request.includeCatalog === true) {
            for (const thread of this.state.threads.values())
                catalogThreadRefs.add(thread.threadRef);
        }
        else {
            if (threadRefFilter !== undefined)
                catalogThreadRefs.add(threadRefFilter);
            for (const fact of selected)
                catalogThreadRefs.add(fact.kind === 'message' ? fact.message.threadRef : fact.activity.threadRef);
        }
        const scopeCache = new Map();
        const inScope = (threadRef) => {
            const cached = scopeCache.get(threadRef);
            if (cached !== undefined)
                return cached;
            const projectRef = this.projectRefForThread(threadRef);
            const scoped = projectRef !== undefined && projectRefs.has(projectRef)
                && (projectRefFilter === undefined || projectRef === projectRefFilter)
                && (threadRefFilter === undefined || threadRef === threadRefFilter);
            scopeCache.set(threadRef, scoped);
            return scoped;
        };
        const catalogThreads = request.includeCatalog === true
            ? [...this.state.threads.values()].filter(thread => inScope(thread.threadRef))
            : [...catalogThreadRefs].map(threadRef => this.state.threads.get(threadRef)).filter((thread) => thread !== undefined && inScope(thread.threadRef));
        const catalogTasks = request.includeCatalog === true
            ? [...this.state.tasks.values()].filter(task => inScope(task.threadRef))
            : catalogThreads.flatMap(thread => thread.taskRef === undefined ? [] : [this.state.tasks.get(thread.taskRef)])
                .filter((task) => task !== undefined);
        const taskNumbers = this.taskNumbers(request.workspaceId);
        const items = selected.filter((fact) => fact.kind === 'message').map(fact => {
            const message = fact.message;
            const thread = this.requireThread(message.threadRef);
            const task = thread.taskRef === undefined ? undefined : this.state.tasks.get(thread.taskRef);
            const facts = this.state.factsByThread.get(thread.threadRef) ?? [];
            return Object.freeze({ message, mentions: fact.mentions, ...(task === undefined ? {} : { task, taskNumber: taskNumbers.get(task.taskRef) ?? 0 }), thread,
                liveClaimOwners: this.liveClaimOwners(task),
                messageCount: this.state.messageCountByThread.get(thread.threadRef) ?? 0,
                lastActivityAt: facts.at(-1)?.occurredAt ?? '' });
        });
        const initialization = this.initialization();
        const nextCursor = selected.length === 0 ? cursor : direction === 'before' ? selected[0].sequence : selected.at(-1).sequence;
        const directory = !directoryRequested ? undefined : Object.freeze({
            projects: Object.freeze([...this.state.projects.values()].filter(project => project.workspaceId === request.workspaceId
                && this.visibleProject(project) !== undefined
                && (projectRefFilter === undefined || project.projectRef === projectRefFilter)).map(project => {
                const subscriptions = this.subscriptionsOfProject(project.projectRef);
                return Object.freeze({
                    project,
                    ownerIds: this.projectOwnerIds(project.projectRef),
                    participating: this.isProjectMember(project.projectRef, memberId),
                    subscriptions: Object.freeze({
                        active: subscriptions.filter(subscription => subscription.state === 'active').length,
                        paused: subscriptions.filter(subscription => subscription.state === 'paused').length,
                    }),
                });
            })),
            memberIds: Object.freeze([...this.state.members.values()].filter(member => member.state !== 'inactive' && member.state !== 'archived'
                && this.participatesIn(member.memberId, request.workspaceId)).map(member => member.memberId)),
        });
        return Object.freeze({
            humanMemberId: initialization.data.humanMemberId,
            workspaces: Object.freeze(memberId === undefined ? [] : this.workspacesOfFrom(this.state, memberId)
                .map(workspaceId => Object.freeze({ workspaceId, default: workspaceId === this.state.members.get(memberId)?.workspaceId }))),
            projects: Object.freeze(projects),
            ...(directory === undefined ? {} : { directory }),
            // Project participation is derived, so this roster is too: every Member
            // that takes part in a visible Project, by explicit enrolment a ledger
            // still carries or by having taken part in one of its Threads. Reading
            // the membership table directly would hide Members that mention rules
            // let you address.
            members: Object.freeze([...projectRefs].flatMap(projectRef => [...this.state.members.keys()]
                .filter(memberId => {
                const state = this.state.members.get(memberId)?.state;
                return state !== undefined && state !== 'inactive' && state !== 'archived'
                    && this.isProjectMemberFrom(this.state, projectRef, memberId);
            }).sort().map(memberId => Object.freeze({ projectRef, memberId })))),
            owners: Object.freeze([...projectRefs].flatMap(projectRef => this.projectOwnerIds(projectRef)
                .map(memberId => Object.freeze({ projectRef, memberId })))),
            rulesVersion: this.state.rulesVersion,
            tasks: Object.freeze(catalogTasks),
            threads: Object.freeze(catalogThreads),
            taskNumbers: Object.freeze(catalogTasks.map(task => Object.freeze({ taskRef: task.taskRef, taskNumber: taskNumbers.get(task.taskRef) ?? 0 }))),
            items: Object.freeze(items),
            claims: this.claimsForVisibleTasks(catalogTasks),
            activities: Object.freeze(selected.filter((fact) => fact.kind === 'activity').map(fact => fact.activity)),
            cursor: nextCursor,
            hasMore,
        });
    }
    status() {
        const initialization = this.initialization();
        return Object.freeze({ initialized: true, sequence: this.state.ordered.length, operationCount: this.state.ordered.length,
            projectCount: this.state.projects.size, agentMemberCount: this.state.members.size, humanMemberId: initialization.data.humanMemberId,
            rulesVersion: this.state.rulesVersion });
    }
    getProject(projectRef) {
        return this.state.projects.get(projectRef);
    }
    /**
     * Whether this actor may change a Project's subscriptions. A trial run makes
     * no durable change, so the Host checks the same authority here that a write
     * would enforce, instead of learning a caller was not an owner only after the
     * script has already run.
     */
    assertSubscriptionAuthority(actor, projectRef, workspaceId) {
        this.activeProject(projectRef, workspaceId);
        this.requireProjectOwnerActor(actor, projectRef);
    }
    /** Workspace members may discover subscription metadata; scripts, credential references, webhook arms and logs stay Project-gated. */
    assertSubscriptionMetadataAuthority(actor, projectRef, workspaceId) {
        const project = this.state.projects.get(projectRef);
        if (project === undefined || project.workspaceId !== workspaceId)
            throw new Error(`Project '${projectRef}' is not in Workspace '${workspaceId}'`);
        if (actor.kind === 'host')
            throw new Error('reading subscriptions needs a Human or Agent Member actor');
        if (actor.kind === 'human') {
            this.assertHumanActor(actor);
            return;
        }
        const member = this.assertMemberActor(actor);
        if (!this.participatesIn(member.memberId, workspaceId))
            throw new Error(`Agent Member '${member.memberId}' is not authorized for Workspace '${workspaceId}'`);
    }
    /** Full subscription reads remain Project facts: run logs and the Human Client's script-bearing list. */
    assertSubscriptionReadAuthority(actor, projectRef, workspaceId) {
        // Reading spans archiving: the list and the run history are the audit
        // surface of what a Project ran, and archiving must not erase them.
        const project = this.state.projects.get(projectRef);
        if (project === undefined || project.workspaceId !== workspaceId) {
            throw new Error(`Project '${projectRef}' is not in Workspace '${workspaceId}'`);
        }
        if (actor.kind === 'host')
            throw new Error('reading subscriptions needs a Human or Agent Member actor');
        this.requireProjectMemberActor(actor, projectRef);
    }
    /** Whether one Project exists at all; a delegation may not guess one from a directory or a page. */
    hasProject(projectRef) {
        return this.state.projects.has(projectRef);
    }
    /** Agent owners of one Project, sorted. The Human owns every Project and is not listed. */
    projectOwnerIds(projectRef) {
        return Object.freeze([...this.state.owners.get(projectRef)?.keys() ?? []].sort());
    }
    /**
     * One subscription's event recipients as a create or update states them. The
     * Human is a member of every Project even though ownership is derived rather
     * than listed; anyone else must still belong to it. Deduplicated and sorted,
     * so the stored set has exactly one order to compare.
     */
    subscriptionNotifyOf(notify, fallback) {
        return Object.freeze([...new Set(notify ?? [fallback])].sort());
    }
    /**
     * Why a proposed recipient set cannot be stored, if it cannot. The Host asks
     * before its trial run, so a typo costs a rejected form rather than a script
     * execution.
     */
    subscriptionNotifyProblem(projectRef, notify) {
        const foreign = [...new Set(notify ?? [])].filter(memberId => !this.notifyRecipientIsLive(projectRef, memberId));
        return foreign.length === 0 ? undefined
            : `event recipient ${foreign.map(memberId => `'${memberId}'`).join(', ')} is not a member of Project '${projectRef}' (not_project_member) — ${recoveryFor('not_project_member').sentence({ projectRef })}`;
    }
    /** Whether one addressed recipient can still receive: the Human always, a Member only while it belongs to the Project. */
    notifyRecipientIsLive(projectRef, memberId) {
        return this.notifyRecipientLiveFrom(this.state, projectRef, memberId);
    }
    /** The same predicate over a replay projection, so validation judges each segment at its own point in the ledger. */
    notifyRecipientLiveFrom(projection, projectRef, memberId) {
        return memberId === AGENT_TEAM_HUMAN_MEMBER_ID || this.isProjectMemberFrom(projection, projectRef, memberId);
    }
    /**
     * A stored subscription as the projection should hold it. Records written
     * before events were addressed carry no `notify`; they read back as the
     * Creating Member alone, so replay of an old ledger never routes an event to
     * someone the subscription never named.
     */
    subscriptionWithNotify(subscription) {
        if (Array.isArray(subscription.notify))
            return subscription;
        return Object.freeze({ ...subscription, notify: Object.freeze([subscription.createdBy]) });
    }
    /** Active Projects the Agent Member owns, in creation order. */
    ownedProjects(memberId) {
        return Object.freeze([...this.state.projects.values()]
            .filter(project => project.state === 'active' && this.state.owners.get(project.projectRef)?.has(memberId) === true));
    }
    validate() {
        this.validateRecords(this.sortedRecords());
    }
    validateAtMount() {
        const boot = this.bootValidation;
        this.bootValidation = undefined;
        const head = this.state.ordered.at(-1);
        if (boot !== undefined
            && boot.records === this.state.ordered.length
            && boot.lastSequence === (head?.sequence ?? 0)
            && boot.lastOperationId === (head?.operationId ?? null))
            return;
        this.validate();
    }
    hasCommitted(requestId) {
        return this.state.byRequest.has(requestId);
    }
    /**
     * The operation one request id already committed, if any. It is the durable
     * record of that request: a caller whose own bookkeeping failed after the
     * commit reads the answer back from here instead of repeating the work.
     */
    committedOperation(requestId) {
        return this.state.byRequest.get(requestId);
    }
    /** Return one stored committed operation by id. */
    getOperation(operationId) {
        return this.state.byOperation.get(operationId);
    }
    withReleasedActivityScopes(scopes, tasks, activities) {
        const projectByTask = new Map(tasks.map(task => [task.taskRef, task.projectRef]));
        for (const activity of activities) {
            scopes.push({ kind: 'thread', threadRef: activity.threadRef });
            // A Worker run on a discussion Thread has no Task to look a Project up by.
            const projectRef = activity.taskRef === undefined ? undefined : projectByTask.get(activity.taskRef);
            if (projectRef !== undefined && !scopes.some(scope => scope.kind === 'project' && scope.projectRef === projectRef)) {
                scopes.push({ kind: 'project', projectRef });
            }
        }
        return scopes;
    }
    /** One workspace change scope per Workspace the Member participates in — member-level commits wake every panel that lists it. */
    memberWorkspaceScopes(memberId) {
        return [...(this.state.participations.get(memberId) ?? [])].map(workspaceId => ({ kind: 'workspace', workspaceId }));
    }
    /**
     * Durable position of the newest shared-projection commit: the version every
     * change waiter outside the presence scope observes. It only moves when a
     * commit has scopes somebody could refetch (`changeScopesOf`), never for
     * private read progress or an audit-only record.
     */
    projectionSequence() {
        return this.projectionVersion;
    }
    /** Scopes whose projections one committed operation invalidates; undefined wakes every waiter. */
    changeScopesOf(operation) {
        switch (operation.kind) {
            case 'team/initialized':
                return undefined;
            case 'team/project-created':
                return [{ kind: 'workspace', workspaceId: operation.data.workspaceId }];
            case 'team/project-updated':
                // The rename is visible in the sidebar list and any open Project/Thread header.
                return [{ kind: 'workspace', workspaceId: operation.data.workspaceId }, { kind: 'project', projectRef: operation.data.project.projectRef }];
            case 'team/member-added':
            case 'team/member-suspended':
            case 'team/member-resumed':
            case 'team/member-session-restarted':
            case 'team/member-context-cleared':
            case 'team/member-session-renewed':
            case 'team/member-session-rolled-over':
            case 'team/member-session-recycled':
            case 'team/member-updated':
            case 'team/member-removed':
                return this.memberWorkspaceScopes(operation.data.member.memberId);
            case 'team/member-archived':
                return this.withReleasedActivityScopes(this.memberWorkspaceScopes(operation.data.member.memberId), operation.data.tasks, operation.data.activities);
            case 'team/member-workspace-joined':
                return [{ kind: 'workspace', workspaceId: operation.data.workspaceId }];
            case 'team/member-workspace-left':
                return this.withReleasedActivityScopes([{ kind: 'workspace', workspaceId: operation.data.workspaceId }], operation.data.tasks, operation.data.activities);
            case 'team/project-member-added':
                return [{ kind: 'workspace', workspaceId: operation.data.workspaceId }, { kind: 'project', projectRef: operation.data.projectRef }];
            case 'team/project-member-removed':
                return this.withReleasedActivityScopes([
                    { kind: 'workspace', workspaceId: operation.data.workspaceId },
                    { kind: 'project', projectRef: operation.data.projectRef },
                ], operation.data.tasks, operation.data.activities);
            case 'team/project-archived': {
                const scopes = [
                    { kind: 'workspace', workspaceId: operation.data.workspaceId },
                    { kind: 'project', projectRef: operation.data.project.projectRef },
                ];
                for (const activity of operation.data.activities)
                    scopes.push({ kind: 'thread', threadRef: activity.threadRef });
                return scopes;
            }
            case 'team/message-sent':
            case 'team/thread-replied':
                return [{ kind: 'project', projectRef: operation.data.message.projectRef }, { kind: 'thread', threadRef: operation.data.message.threadRef }];
            case 'team/thread-started':
                return [{ kind: 'project', projectRef: operation.data.projectRef }, { kind: 'thread', threadRef: operation.data.thread.threadRef }];
            case 'team/main-message-posted':
                return [{ kind: 'project', projectRef: operation.data.message.projectRef }];
            case 'team/main-stream-read':
                // Private read progress, like a Thread read: nobody else has anything to refetch.
                return [];
            case 'team/thread-promoted':
                return [{ kind: 'project', projectRef: operation.data.task.projectRef }, { kind: 'thread', threadRef: operation.data.thread.threadRef }];
            case 'team/claim-created':
            case 'team/claim-done':
            case 'team/claim-released':
            case 'team/task-changed':
            case 'team/task-accountable-changed':
                return [{ kind: 'project', projectRef: operation.data.task.projectRef }, { kind: 'thread', threadRef: operation.data.thread.threadRef }];
            case 'team/thread-attention-changed':
                return [{ kind: 'thread', threadRef: operation.data.thread.threadRef }];
            case 'team/main-attention-changed':
                return [{ kind: 'project', projectRef: operation.data.project.projectRef }];
            case 'team/reminder-raised': {
                const task = this.state.tasks.get(operation.data.taskRef);
                return task === undefined ? [] : [{ kind: 'thread', threadRef: task.threadRef }];
            }
            case 'team/member-reminder-created':
            case 'team/member-reminder-raised':
            case 'team/member-reminder-consumed':
            case 'team/member-reminder-cancelled':
                // A Member reminder belongs to no Thread and no Project, but the Human's
                // Member detail renders it, so the whole Workspace catalog refetches.
                return [{ kind: 'workspace', workspaceId: operation.data.workspaceId }];
            case 'team/thread-read':
                // A read advances only the reader's private watermark; no projection
                // visible to other participants changes, so nobody is woken.
                return [];
            case 'team/dm-sent':
                // A DM changes no shared projection: delivery is a session-level
                // runtime effect, so no change waiter has anything to refetch.
                return [];
            case 'team/rules-version-adopted':
                // Later records validate differently; no projection anybody reads changes.
                return [];
            case 'team/worker-started':
            case 'team/worker-settled':
                // A Thread-bound run writes one public fact into that Thread, so an open
                // Thread and its Project refetch. A Project-only run projects nothing:
                // its result reaches the initiator's own session and no shared view.
                return operation.data.activity === undefined ? []
                    : [{ kind: 'project', projectRef: operation.data.activity.projectRef }, { kind: 'thread', threadRef: operation.data.activity.threadRef }];
            case 'team/worker-steer-admitted':
            case 'team/worker-steer-recorded':
                // A steer receipt is the private answer to the caller that already has
                // the execution ref. It writes no Thread fact, revision, or Worker row.
                return [];
            case 'team/project-owner-added':
                // Ownership shows on the Project rows and widens who sees the Project.
                return [{ kind: 'workspace', workspaceId: operation.data.workspaceId }, { kind: 'project', projectRef: operation.data.projectRef }];
            case 'team/project-owner-removed':
                // Removal also appends transfer facts on the Tasks it returns, so an
                // open Thread re-renders its new responsibility line.
                return this.withReleasedActivityScopes([{ kind: 'workspace', workspaceId: operation.data.workspaceId }, { kind: 'project', projectRef: operation.data.projectRef }], operation.data.tasks, operation.data.transfers);
            case 'team/subscription-created':
            case 'team/subscription-updated':
            case 'team/subscription-paused':
            case 'team/subscription-resumed':
            case 'team/subscription-deleted':
            case 'team/subscription-webhook-reset':
                // Subscription state shows in the Project's Main stream and the list.
                return [{ kind: 'project', projectRef: operation.data.subscription.projectRef }];
            case 'team/subscription-baseline':
            case 'team/subscription-events-accepted':
                // Accept only moves the pending count; a baseline moves nothing a reader shows.
                return [{ kind: 'project', projectRef: operation.data.projectRef }];
            case 'team/subscription-event-published':
                return [{ kind: 'project', projectRef: operation.data.projectRef }];
            default:
                return assertUnhandledKind(operation);
        }
    }
    /** Members whose Inbox projection may have changed; the Host notifies only live ones. */
    affectedMembersOf(operation) {
        const members = new Set();
        const delta = this.attentionDelta(operation);
        if (delta !== undefined) {
            for (const attention of delta.attention.set)
                members.add(attention.memberId);
            for (const key of delta.attention.removed)
                members.add(key.memberId);
            for (const marker of delta.directMarkers.added)
                members.add(marker.memberId);
            for (const marker of delta.directMarkers.removed)
                members.add(marker.memberId);
            for (const marker of delta.activityMarkers.added)
                members.add(marker.memberId);
            for (const marker of delta.activityMarkers.removed)
                members.add(marker.memberId);
            for (const marker of delta.reminderMarkers?.added ?? [])
                members.add(marker.memberId);
            for (const marker of delta.reminderMarkers?.removed ?? [])
                members.add(marker.memberId);
            for (const marker of delta.memberReminderMarkers?.added ?? [])
                members.add(marker.memberId);
            for (const marker of delta.memberReminderMarkers?.removed ?? [])
                members.add(marker.memberId);
            for (const marker of delta.mainMarkers?.added ?? [])
                members.add(marker.memberId);
            for (const marker of delta.mainMarkers?.removed ?? [])
                members.add(marker.memberId);
        }
        for (const threadRef of this.touchedThreadRefs(operation)) {
            for (const follower of this.state.attentionByThread.get(threadRef) ?? [])
                members.add(follower);
        }
        if (operation.kind === 'team/member-workspace-joined' || operation.kind === 'team/member-workspace-left')
            members.add(operation.data.memberId);
        // Ordinary Main stream sources wake everyone whose Main stream Attention
        // covers that stream, and nobody else: a new Task does not — the others
        // read it off the board. Without this the wake only follows inbox deltas,
        // so an Attention-covered reader's unread grows with no commit ever
        // notifying them. An owner's row is derived rather than stored, so the
        // owner ids join the stored rows here.
        if (operation.kind === 'team/main-message-posted'
            || (operation.kind === 'team/thread-started' && operation.data.task === undefined)
            || operation.kind === 'team/project-owner-added'
            || operation.kind === 'team/project-owner-removed') {
            const sender = operation.actor.kind === 'host' ? undefined : operation.actor.memberId;
            const projectRef = operation.kind === 'team/main-message-posted' ? operation.data.message.projectRef : operation.data.projectRef;
            for (const memberId of this.mainStreamRecipientsFrom(this.state, projectRef)) {
                if (sender === undefined || memberId !== sender)
                    members.add(memberId);
            }
        }
        // A subscription record is a Main stream entry like any other: it wakes the
        // readers whose Main stream Attention covers that stream. A published event
        // additionally carries a marker for every owner, which the inbox delta above
        // already turned into a recipient.
        if (operation.kind === 'team/subscription-created' || operation.kind === 'team/subscription-updated'
            || operation.kind === 'team/subscription-paused' || operation.kind === 'team/subscription-resumed'
            || operation.kind === 'team/subscription-deleted' || operation.kind === 'team/subscription-webhook-reset'
            || operation.kind === 'team/subscription-event-published') {
            const projectRef = 'projectRef' in operation.data
                ? operation.data.projectRef
                : operation.data.subscription.projectRef;
            for (const memberId of this.mainStreamRecipientsFrom(this.state, projectRef))
                members.add(memberId);
        }
        if (operation.actor.kind === 'member')
            members.add(operation.actor.memberId);
        return [...members];
    }
    touchedThreadRefs(operation) {
        switch (operation.kind) {
            case 'team/message-sent':
            case 'team/thread-replied':
                return [operation.data.message.threadRef];
            case 'team/thread-started':
                return [operation.data.anchor.threadRef];
            case 'team/thread-promoted':
                return [operation.data.activity.threadRef];
            case 'team/claim-created':
            case 'team/claim-done':
            case 'team/claim-released':
            case 'team/task-changed':
            case 'team/task-accountable-changed':
            case 'team/thread-attention-changed':
                return [operation.data.thread.threadRef];
            case 'team/main-attention-changed':
                return [];
            case 'team/worker-started':
            case 'team/worker-settled':
                return operation.data.activity === undefined ? [] : [operation.data.activity.threadRef];
            case 'team/worker-steer-admitted':
            case 'team/worker-steer-recorded':
                return [];
            case 'team/project-member-removed':
            case 'team/project-archived':
            case 'team/member-removed':
            case 'team/member-archived':
            case 'team/member-workspace-left':
                return operation.data.activities.map(activity => activity.threadRef);
            case 'team/initialized':
            case 'team/project-created':
            case 'team/project-updated':
            case 'team/member-added':
            case 'team/member-workspace-joined':
            case 'team/member-suspended':
            case 'team/member-resumed':
            case 'team/member-session-restarted':
            case 'team/member-context-cleared':
            case 'team/member-session-renewed':
            case 'team/member-session-rolled-over':
            case 'team/member-session-recycled':
            case 'team/member-updated':
            case 'team/project-member-added':
            case 'team/thread-read':
            case 'team/reminder-raised':
            case 'team/main-message-posted':
            case 'team/main-stream-read':
            case 'team/dm-sent':
            case 'team/rules-version-adopted':
            case 'team/project-owner-added':
            case 'team/project-owner-removed':
            case 'team/subscription-created':
            case 'team/subscription-updated':
            case 'team/subscription-paused':
            case 'team/subscription-resumed':
            case 'team/subscription-deleted':
            case 'team/subscription-webhook-reset':
            case 'team/subscription-baseline':
            case 'team/subscription-events-accepted':
            case 'team/subscription-event-published':
            case 'team/member-reminder-created':
            case 'team/member-reminder-raised':
            case 'team/member-reminder-consumed':
            case 'team/member-reminder-cancelled':
                return [];
            default:
                return assertUnhandledKind(operation);
        }
    }
    replay() {
        const records = this.sortedRecords();
        this.validateRecords(records);
        for (const [, operation] of records)
            this.applyAndAdvanceProjectionVersion(operation);
    }
    validateRecords(records) {
        const projection = emptyProjection();
        const operationIds = new Set();
        const requestIds = new Set();
        const refs = new Set();
        let previous = null;
        for (const [index, [key, operation]] of records.entries()) {
            const sequence = index + 1;
            if (key !== operation.operationId)
                throw new Error(`agent-team operation key '${key}' differs from record id '${operation.operationId}'`);
            if (operation.sequence !== sequence)
                throw new Error(`agent-team ledger expected sequence ${sequence}, found ${operation.sequence}`);
            if (operation.previousOperationId !== previous)
                throw new Error(`agent-team operation ${sequence} has a broken previous-operation link`);
            if (operationIds.has(operation.operationId))
                throw new Error(`agent-team ledger repeats operation id '${operation.operationId}'`);
            if (requestIds.has(operation.requestId))
                throw new Error(`agent-team ledger repeats request id '${operation.requestId}'`);
            if (sequence === 1)
                this.assertInitializationRecord(operation);
            else
                this.validateOperation(operation, projection, refs);
            this.applyTo(projection, operation);
            operationIds.add(operation.operationId);
            requestIds.add(operation.requestId);
            previous = operation.operationId;
        }
    }
    validateOperation(operation, projection, refs) {
        const human = projection.ordered[0];
        if (human === undefined || human.kind !== 'team/initialized')
            throw new Error('agent-team ledger has no Human Member');
        const humanMemberId = human.data.humanMemberId;
        const assertHuman = () => {
            // memberId is the durable Human authority; the handle is display-only
            // and may carry a configured name (old records carry the historic
            // literal), so replay never judges it here.
            if (operation.actor.kind !== 'human' || actorMemberId() !== humanMemberId) {
                throw new Error(`agent-team operation ${operation.sequence} has invalid Human authority`);
            }
        };
        const actorMemberId = () => {
            if (operation.actor.kind === 'host')
                throw new Error(`agent-team operation ${operation.sequence} has no Member actor`);
            return operation.actor.memberId;
        };
        const assertMember = () => {
            if (operation.actor.kind !== 'member')
                throw new Error(`agent-team operation ${operation.sequence} requires Member authority`);
            const member = projection.members.get(actorMemberId());
            if (member === undefined || member.state !== 'enabled' || member.handle !== operation.actor.handle) {
                throw new Error(`agent-team operation ${operation.sequence} has invalid Member authority`);
            }
            return member;
        };
        if (operation.kind === 'team/initialized')
            throw new Error('agent-team initialization must be first');
        if (REPLACED_AT_V2_KINDS.includes(operation.kind) && projection.rulesVersion >= 2) {
            throw new Error(`agent-team operation ${operation.sequence} (${operation.kind}) is not written under rules version ${projection.rulesVersion}`);
        }
        if (V2_ONLY_KINDS.includes(operation.kind) && projection.rulesVersion < 2) {
            throw new Error(`agent-team operation ${operation.sequence} (${operation.kind}) needs rules version 2; its segment runs version ${projection.rulesVersion}`);
        }
        if (V6_ONLY_KINDS.includes(operation.kind) && projection.rulesVersion < 6) {
            throw new Error(`agent-team operation ${operation.sequence} (${operation.kind}) needs rules version 6; its segment runs version ${projection.rulesVersion}`);
        }
        if (V7_ONLY_KINDS.includes(operation.kind) && projection.rulesVersion < 7) {
            throw new Error(`agent-team operation ${operation.sequence} (${operation.kind}) needs rules version 7; its segment runs version ${projection.rulesVersion}`);
        }
        // A caller's steer request id may also be the id of the continuation it
        // opens. No other record may reuse that id while a steer admission owns it.
        const admittedSteer = projection.workerSteerRequests.get(operation.requestId);
        if (admittedSteer !== undefined && operation.kind !== 'team/worker-started') {
            throw this.requestCollisionError(operation.requestId);
        }
        if (operation.kind === 'team/worker-started') {
            const workerVersionProblem = workerVersion7Problem(operation.data.execution, projection.rulesVersion);
            if (workerVersionProblem !== undefined)
                throw new Error(workerVersionProblem);
        }
        if (operation.kind === 'team/worker-settled') {
            const workerVersionProblem = workerVersion7Problem(operation.data.execution, projection.rulesVersion);
            if (workerVersionProblem !== undefined)
                throw new Error(workerVersionProblem);
        }
        if (operation.kind === 'team/project-created') {
            assertHuman();
            const { project, memberIds } = operation.data;
            if (projection.projects.has(project.projectRef) || project.createdAtSequence !== operation.sequence || project.workspaceId !== operation.data.workspaceId)
                throw new Error('invalid Project creation');
            this.addRef(refs, project.projectRef);
            const unique = new Set(memberIds);
            if (unique.size !== memberIds.length)
                throw new Error('invalid initial Project members');
            for (const memberId of memberIds) {
                const member = projection.members.get(memberId);
                if (member === undefined || !this.participatesInFrom(projection, member.memberId, project.workspaceId) || member.state !== 'enabled')
                    throw new Error('invalid initial Project Member');
            }
            return;
        }
        if (operation.kind === 'team/member-added') {
            assertHuman();
            const { member, projectRefs } = operation.data;
            if (projection.members.has(member.memberId) || new Set(projectRefs).size !== projectRefs.length)
                throw new Error('invalid Member creation');
            this.addRef(refs, member.memberId);
            for (const projectRef of projectRefs) {
                const project = projection.projects.get(projectRef);
                if (project === undefined || project.workspaceId !== member.workspaceId)
                    throw new Error('invalid initial Member Project');
            }
            return;
        }
        if (operation.kind === 'team/member-suspended' || operation.kind === 'team/member-resumed') {
            assertHuman();
            const prior = projection.members.get(operation.data.member.memberId);
            const expected = operation.kind === 'team/member-suspended' ? 'enabled' : 'suspended';
            const next = operation.kind === 'team/member-suspended' ? 'suspended' : 'enabled';
            if (prior === undefined || prior.state !== expected || operation.data.member.state !== next || !this.sameMemberIdentity(prior, operation.data.member))
                throw new Error('invalid Member lifecycle transition');
            return;
        }
        if (operation.kind === 'team/member-session-restarted') {
            assertHuman();
            const prior = projection.members.get(operation.data.member.memberId);
            // The restart records the unchanged Member: same identity, still enabled.
            if (prior === undefined || prior.state !== 'enabled' || !this.sameMemberIdentity(prior, operation.data.member))
                throw new Error('invalid Member restart');
            return;
        }
        if (operation.kind === 'team/member-context-cleared') {
            assertHuman();
            const prior = projection.members.get(operation.data.member.memberId);
            if (prior === undefined || prior.state !== 'enabled' || !this.sameMemberIdentity(prior, operation.data.member))
                throw new Error('invalid Member context clear');
            return;
        }
        if (operation.kind === 'team/member-session-renewed') {
            assertHuman();
            const prior = projection.members.get(operation.data.member.memberId);
            // The renewal moves exactly the sessionId: the prior Member must be
            // enabled on the recorded previous Session, and every other fact must
            // carry over unchanged.
            if (prior === undefined || prior.state !== 'enabled'
                || prior.sessionId !== operation.data.previousSessionId
                || operation.data.member.sessionId === operation.data.previousSessionId
                || !this.sameMemberFacts(prior, operation.data.member))
                throw new Error('invalid Member session renewal');
            return;
        }
        if (operation.kind === 'team/project-owner-added' || operation.kind === 'team/project-owner-removed') {
            assertHuman();
            const problem = this.projectOwnerChangeProblem(projection, operation.kind, operation.data);
            if (problem !== undefined)
                throw new Error(`agent-team operation ${operation.sequence}: ${problem}`);
            const { activity } = operation.data;
            if (activity.projectRef !== operation.data.projectRef || activity.memberId !== operation.data.memberId
                || activity.kind !== (operation.kind === 'team/project-owner-added' ? 'owner-added' : 'owner-removed')
                || activity.actor !== actorMemberId() || activity.sequence !== operation.sequence || activity.occurredAt !== operation.occurredAt) {
                throw new Error('invalid Project owner activity');
            }
            this.addRef(refs, activity.activityRef);
            const returned = operation.kind === 'team/project-owner-removed'
                ? this.accountabilityReturnsFrom(projection, operation.data.memberId, operation.sequence, new Set([operation.data.projectRef]), projection.rulesVersion >= 3)
                : { transfers: [], tasks: [], threads: [], markers: [] };
            const ownerInbox = this.ownerActivityInboxDelta(activity);
            // The grant writes a row only for a Member not already following the
            // stream. A ledger written by a build that overwrote unconditionally
            // replays as the row it actually stored, so both shapes stay valid.
            const alreadyFollowing = operation.kind === 'team/project-owner-added'
                && this.mainAttentionForFrom(projection, operation.data.memberId, operation.data.projectRef) !== undefined;
            const grantedMainAttention = operation.kind === 'team/project-owner-added' && !alreadyFollowing
                ? [this.startMainAttention(operation.data.memberId, operation.data.projectRef, operation.sequence, 'project-owner')] : [];
            const endedMainAttention = operation.kind === 'team/project-owner-removed'
                ? this.grantedMainAttentionEnds(projection, operation.data.memberId, operation.data.projectRef) : [];
            const expectedInbox = this.inboxDelta([], [], [], [], returned.markers, [], ownerInbox.mainMarkers?.added ?? [], [], [], [], grantedMainAttention, endedMainAttention);
            // A withdrawal written before it ended the grant's own Attention replays as
            // the row it stored, so that shape stays valid beside the current one.
            const legacyInbox = this.inboxDelta([], [], [], [], returned.markers, [], ownerInbox.mainMarkers?.added ?? [], [], [], [], grantedMainAttention);
            const transfers = operation.kind === 'team/project-owner-removed' ? operation.data.transfers : [];
            if (!this.sameInboxDelta(operation.data.inbox, expectedInbox, transfers)
                && !this.sameInboxDelta(operation.data.inbox, legacyInbox, transfers))
                throw new Error('invalid Project owner inbox projection');
            this.validateInboxDelta(operation.data.inbox, projection, refs, [], [], transfers, [], [activity]);
            if (operation.kind === 'team/project-owner-removed') {
                this.validateAccountabilityReturns(operation.data, returned, projection, refs);
            }
            return;
        }
        if (operation.kind === 'team/rules-version-adopted') {
            if (operation.actor.kind !== 'host' || operation.actor.handle !== 'agent-team')
                throw new Error('invalid rules version authority');
            const { version } = operation.data;
            if (version <= projection.rulesVersion)
                throw new Error(`agent-team operation ${operation.sequence} adopts rules version ${version} after version ${projection.rulesVersion}`);
            if (version > this.rulesVersion) {
                throw new Error(`agent-team ledger adopted rules version ${version}, but this build implements up to ${this.rulesVersion}; open it with a newer release`);
            }
            return;
        }
        if (operation.kind === 'team/member-session-recycled') {
            if (operation.actor.kind !== 'host' || operation.actor.handle !== 'agent-team')
                throw new Error('invalid Member session recycling authority');
            const prior = projection.members.get(operation.data.member.memberId);
            if (prior === undefined || prior.state !== 'enabled'
                || prior.sessionId !== operation.data.previousSessionId
                || operation.data.member.sessionId !== operation.data.newSessionId
                || operation.data.member.sessionId === operation.data.previousSessionId
                || !this.sameMemberFacts(prior, operation.data.member))
                throw new Error('invalid Member session recycling');
            return;
        }
        if (operation.kind === 'team/member-session-rolled-over') {
            // The rollover's business actor is the calling Member itself; the Host
            // only executes the recorded transition. Authorization is self-scoped:
            // the actor must be the enabled target Member on its currently bound
            // Session, and the recorded transition moves exactly the sessionId.
            const actorMember = assertMember();
            const prior = projection.members.get(operation.data.member.memberId);
            if (actorMember.memberId !== operation.data.member.memberId)
                throw new Error('rolled-over Member must match its actor');
            if (prior === undefined || prior.state !== 'enabled'
                || prior.sessionId !== operation.data.previousSessionId
                || operation.data.member.sessionId !== operation.data.newSessionId
                || operation.data.member.sessionId === operation.data.previousSessionId
                || !this.sameMemberFacts(prior, operation.data.member))
                throw new Error('invalid Member session rollover');
            if (operation.data.sourceSessionId !== undefined && operation.data.sourceThroughSeq === undefined)
                throw new Error('rolled-over checkpoint seed requires a through sequence');
            if (operation.data.sourceThroughSeq !== undefined && operation.data.sourceSessionId === undefined)
                throw new Error('rolled-over through sequence requires a source Session');
            if ((operation.data.checkpointRef !== undefined) !== (operation.data.sourceSessionId !== undefined))
                throw new Error('rolled-over checkpoint fields must appear together');
            return;
        }
        if (operation.kind === 'team/project-updated') {
            assertHuman();
            const prior = projection.projects.get(operation.data.project.projectRef);
            if (prior === undefined || prior.workspaceId !== operation.data.workspaceId
                || operation.data.project.workspaceId !== prior.workspaceId || operation.data.project.createdAtSequence !== prior.createdAtSequence
                || operation.data.project.state !== prior.state) {
                throw new Error('invalid Project update');
            }
            return;
        }
        if (operation.kind === 'team/member-updated') {
            assertHuman();
            const prior = projection.members.get(operation.data.member.memberId);
            if (prior === undefined || prior.state === 'inactive' || prior.state === 'archived' || operation.data.member.state !== prior.state
                || operation.data.member.sessionId !== prior.sessionId || operation.data.member.workspaceId !== prior.workspaceId
                || operation.data.member.presetId !== prior.presetId
                || operation.data.member.privateMemoryPath !== prior.privateMemoryPath)
                throw new Error('invalid Member update');
            // The renamed handle must stay unique among the live Members sharing any Workspace participation.
            const normalized = operation.data.member.handle.normalize('NFKC').trim().toLowerCase();
            for (const other of projection.members.values()) {
                if (other.memberId !== prior.memberId && other.state !== 'inactive' && this.participationOverlapFrom(projection, other.memberId, prior.memberId)
                    && other.handle.normalize('NFKC').trim().toLowerCase() === normalized)
                    throw new Error('invalid Member update handle');
            }
            if (normalized === this.humanHandle.normalize('NFKC').trim().toLowerCase())
                throw new Error('invalid Member update handle');
            return;
        }
        if (operation.kind === 'team/project-member-added') {
            assertHuman();
            const project = projection.projects.get(operation.data.projectRef);
            const member = projection.members.get(operation.data.memberId);
            if (project === undefined || member === undefined || !this.participatesInFrom(projection, member.memberId, project.workspaceId) || operation.data.workspaceId !== project.workspaceId || projection.memberships.get(project.projectRef)?.has(member.memberId))
                throw new Error('invalid Project membership');
            return;
        }
        if (operation.kind === 'team/project-member-removed') {
            assertHuman();
            const project = projection.projects.get(operation.data.projectRef);
            const member = projection.members.get(operation.data.memberId);
            if (project === undefined || member === undefined || operation.data.workspaceId !== project.workspaceId
                || !this.participatesInFrom(projection, member.memberId, project.workspaceId) || !projection.memberships.get(project.projectRef)?.has(member.memberId))
                throw new Error('invalid Project membership removal');
            const threadRefs = new Set([...projection.threads.keys()].filter(threadRef => this.projectRefForThreadFrom(projection, threadRef) === project.projectRef));
            this.validateReleaseCleanup(operation.data, projection, member.memberId, threadRefs, operation.sequence, refs, new Set([project.projectRef]));
            return;
        }
        if (operation.kind === 'team/member-workspace-joined') {
            assertHuman();
            const member = projection.members.get(operation.data.memberId);
            if (member === undefined || member.state === 'inactive' || member.state === 'archived'
                || this.participatesInFrom(projection, member.memberId, operation.data.workspaceId))
                throw new Error('invalid Workspace join');
            this.assertHandleAvailableFrom(projection, operation.data.workspaceId, member.handle);
            return;
        }
        if (operation.kind === 'team/member-workspace-left') {
            assertHuman();
            const member = projection.members.get(operation.data.memberId);
            if (member === undefined || member.state === 'inactive' || member.state === 'archived'
                || operation.data.workspaceId === member.workspaceId
                || !this.participatesInFrom(projection, member.memberId, operation.data.workspaceId))
                throw new Error('invalid Workspace leave');
            const threadRefs = this.workspaceThreadRefsFrom(projection, operation.data.workspaceId);
            this.validateReleaseCleanup(operation.data, projection, member.memberId, threadRefs, operation.sequence, refs, this.workspaceProjectRefsFrom(projection, operation.data.workspaceId));
            return;
        }
        if (operation.kind === 'team/project-archived') {
            assertHuman();
            const prior = projection.projects.get(operation.data.project.projectRef);
            if (prior === undefined || prior.state !== 'active' || operation.data.project.state !== 'archived'
                || operation.data.project.workspaceId !== prior.workspaceId || operation.data.workspaceId !== prior.workspaceId
                || operation.data.project.name !== prior.name || operation.data.project.description !== prior.description
                || operation.data.project.createdAtSequence !== prior.createdAtSequence)
                throw new Error('invalid Project archival');
            const threadRefs = new Set([...projection.threads.keys()].filter(threadRef => this.projectRefForThreadFrom(projection, threadRef) === prior.projectRef));
            this.validateReleaseCleanup(operation.data, projection, undefined, threadRefs, operation.sequence, refs, new Set([prior.projectRef]));
            return;
        }
        if (operation.kind === 'team/member-removed') {
            assertHuman();
            const prior = projection.members.get(operation.data.member.memberId);
            if (prior === undefined || prior.state === 'inactive' || operation.data.member.state !== 'inactive' || !this.sameMemberIdentity(prior, operation.data.member))
                throw new Error('invalid Member removal');
            const threadRefs = new Set(projection.threads.keys());
            this.validateReleaseCleanup(operation.data, projection, prior.memberId, threadRefs, operation.sequence, refs, undefined);
            return;
        }
        if (operation.kind === 'team/member-archived') {
            assertHuman();
            const prior = projection.members.get(operation.data.member.memberId);
            if (prior === undefined || (prior.state !== 'enabled' && prior.state !== 'suspended') || operation.data.member.state !== 'archived' || !this.sameMemberIdentity(prior, operation.data.member))
                throw new Error('invalid Member archival');
            const threadRefs = new Set(projection.threads.keys());
            this.validateReleaseCleanup(operation.data, projection, prior.memberId, threadRefs, operation.sequence, refs, undefined);
            return;
        }
        if (operation.kind === 'team/thread-attention-changed') {
            const actor = operation.actor.kind === 'member' ? assertMember() : (assertHuman(), undefined);
            if (operation.actor.kind === 'host' || operation.data.memberId !== operation.actor.memberId)
                throw new Error('Attention operation has wrong actor');
            const thread = projection.threads.get(operation.data.thread.threadRef);
            const task = operation.data.task;
            const currentTask = thread?.taskRef === undefined ? undefined : projection.tasks.get(thread.taskRef);
            const projectRef = thread === undefined ? undefined : this.projectRefForThreadFrom(projection, thread.threadRef);
            if (thread === undefined || projectRef === undefined || !this.sameThread(thread, operation.data.thread)
                || (task === undefined ? currentTask !== undefined : currentTask === undefined || !this.sameTask(currentTask, task) || thread.taskRef !== task.taskRef)
                || (actor !== undefined && !this.participatesInProjectWorkspaceFrom(projection, projectRef, actor.memberId)))
                throw new Error('invalid Attention operation');
            const current = this.attentionForFrom(projection, operation.data.memberId, thread.threadRef);
            if ((operation.data.action === 'follow' && ((projection.rulesVersion < 4 && task?.resolution === 'closed') || current !== undefined))
                || (operation.data.action === 'unfollow' && (current === undefined || (task !== undefined && this.hasActiveClaimFrom(projection, operation.data.memberId, task.taskRef))))) {
                throw new Error('invalid Attention transition');
            }
            const expected = operation.data.action === 'follow'
                ? this.inboxDelta([this.followAttentionFrom(projection, operation.data.memberId, thread.threadRef, 'self')])
                : this.inboxDelta([], [{ memberId: operation.data.memberId, threadRef: thread.threadRef }], [], this.frozenMarkerSnapshot(projection, operation.data.memberId, thread.threadRef));
            if (!isDeepStrictEqual(operation.data.inbox, expected))
                throw new Error('invalid Attention projection');
            this.validateInboxDelta(operation.data.inbox, projection, refs);
            return;
        }
        if (operation.kind === 'team/main-attention-changed') {
            const actor = operation.actor.kind === 'member' ? assertMember() : (assertHuman(), undefined);
            if (operation.actor.kind === 'host' || operation.data.memberId !== operation.actor.memberId)
                throw new Error('Main stream Attention operation has wrong actor');
            const project = projection.projects.get(operation.data.project.projectRef);
            if (project === undefined || project.workspaceId !== operation.data.project.workspaceId || project.name !== operation.data.project.name
                || project.state !== operation.data.project.state
                || (actor !== undefined && !this.participatesInProjectWorkspaceFrom(projection, project.projectRef, actor.memberId))) {
                throw new Error('invalid Main stream Attention operation');
            }
            const current = this.mainAttentionForFrom(projection, operation.data.memberId, project.projectRef);
            if ((operation.data.action === 'follow' && current !== undefined)
                || (operation.data.action === 'unfollow' && current === undefined))
                throw new Error('invalid Main stream Attention transition');
            // The Human's row is derived from owning the Project, so it can never end
            // and an unfollow naming it is a shape this build refuses to write. A
            // ledger holding one from an earlier build replays as the no-op it was,
            // because the derived row still stands and the delta removed nothing.
            if (operation.data.action === 'unfollow' && operation.data.memberId === AGENT_TEAM_HUMAN_MEMBER_ID
                && (operation.data.inbox.mainAttention?.removed.length ?? 0) > 0)
                throw new Error('invalid Main stream Attention projection');
            const stored = projection.mainAttention.get(mainAttentionKey(operation.data.memberId, project.projectRef));
            const expected = operation.data.action === 'follow'
                ? this.inboxDelta([], [], [], [], [], [], [], [], [], [], [this.startMainAttention(operation.data.memberId, project.projectRef, (this.mainSourcesFrom(projection, project.projectRef).at(-1)?.sequence ?? 0) + 1, 'self')], [])
                : this.inboxDelta([], [], [], [], [], [], [], [], [], [], [], stored === undefined ? [] : [{ memberId: operation.data.memberId, projectRef: project.projectRef }]);
            if (!isDeepStrictEqual(operation.data.inbox, expected))
                throw new Error('invalid Main stream Attention projection');
            this.validateInboxDelta(operation.data.inbox, projection, refs);
            return;
        }
        if (operation.kind === 'team/thread-read') {
            if (operation.actor.kind === 'member')
                assertMember();
            else
                assertHuman();
            const data = operation.data;
            if (operation.actor.kind === 'host' || data.memberId !== operation.actor.memberId)
                throw new Error('Thread read has wrong actor');
            const target = threadReadTargetOf(data);
            if (isThreadReadSnapshot(data))
                this.validateLegacyThreadReadSnapshot(data, projection, target);
            else
                this.validateThreadReadReceipt(data, projection, target);
            this.validateInboxDelta(data.inbox, projection, refs);
            return;
        }
        if (operation.kind === 'team/thread-promoted') {
            const promoter = operation.actor.kind === 'member' && projection.rulesVersion >= 2 ? assertMember() : (assertHuman(), undefined);
            const { activity, task, thread } = operation.data;
            const priorThread = projection.threads.get(thread.threadRef);
            const projectRef = priorThread === undefined ? undefined : this.projectRefForThreadFrom(projection, thread.threadRef);
            if (priorThread === undefined || priorThread.taskRef !== undefined || projection.tasks.has(task.taskRef)
                || projectRef === undefined || task.projectRef !== projectRef
                || projection.projects.get(projectRef)?.workspaceId !== operation.data.workspaceId
                || operation.data.baseRevision !== priorThread.revision
                || task.status !== 'todo' || task.resolution !== 'open'
                || thread.revision !== operation.sequence || task.threadRef !== thread.threadRef || thread.taskRef !== task.taskRef
                || !this.sameThread(thread, { ...priorThread, taskRef: task.taskRef, revision: operation.sequence })
                || activity.kind !== 'promote' || activity.sequence !== operation.sequence || activity.actor !== actorMemberId()
                || activity.taskRef !== task.taskRef || activity.threadRef !== thread.threadRef)
                throw new Error('invalid Thread promotion');
            if (promoter !== undefined && !this.isProjectOwnerFrom(projection, projectRef, actorMemberId()))
                throw new Error('invalid Thread promotion: not a Project owner');
            const expectedAccountable = promoter?.memberId ?? AGENT_TEAM_HUMAN_MEMBER_ID;
            if (projection.rulesVersion >= 2 && (task.accountable !== expectedAccountable || task.sourceThreadRefs.length !== 0))
                throw new Error('invalid Task accountability on promotion');
            if (projection.rulesVersion < 2 && (task.accountable !== AGENT_TEAM_HUMAN_MEMBER_ID || task.sourceThreadRefs.length !== 0))
                throw new Error('invalid legacy Task defaults');
            this.addRef(refs, task.taskRef);
            this.addRef(refs, activity.activityRef);
            const expectedInbox = projection.rulesVersion >= 2
                ? this.responsibilityInboxDeltaFrom(projection, task, activity, actorMemberId(), true)
                : this.promoteThreadInboxFrom(projection, activity, thread.threadRef);
            if (!isDeepStrictEqual(operation.data.inbox, expectedInbox))
                throw new Error('invalid Promotion inbox projection');
            this.validateInboxDelta(operation.data.inbox, projection, refs, [], [], [activity]);
            return;
        }
        if (operation.kind === 'team/thread-started') {
            const actor = operation.actor.kind === 'member' ? assertMember() : (assertHuman(), undefined);
            const { anchor, task, thread, projectRef, kind, mentions, activity: storedActivity } = operation.data;
            const project = projection.projects.get(projectRef);
            if (project === undefined || project.workspaceId !== operation.data.workspaceId || project.state === 'archived'
                || anchor.projectRef !== projectRef || anchor.sender !== actorMemberId() || !anchor.topLevel
                || anchor.sequence !== operation.sequence || anchor.occurredAt !== operation.occurredAt
                || thread.revision !== operation.sequence || anchor.threadRef !== thread.threadRef || projection.threads.has(thread.threadRef)
                || (kind === 'task') !== (task !== undefined)
                || (task === undefined ? anchor.taskRef !== undefined || thread.taskRef !== undefined
                    : anchor.taskRef !== task.taskRef || thread.taskRef !== task.taskRef || task.threadRef !== thread.threadRef
                        || task.projectRef !== projectRef || task.status !== 'todo' || task.resolution !== 'open' || projection.tasks.has(task.taskRef))) {
                throw new Error('invalid Thread start');
            }
            if (actor !== undefined && !this.isProjectOwnerFrom(projection, projectRef, actorMemberId()))
                throw new Error('invalid Thread start: not a Project owner');
            if (task !== undefined && (task.sourceThreadRefs.some(threadRef => {
                const source = projection.threads.get(threadRef);
                return source === undefined || source.taskRef !== undefined || this.projectRefForThreadFrom(projection, threadRef) !== projectRef;
            }) || new Set(task.sourceThreadRefs).size !== task.sourceThreadRefs.length))
                throw new Error('invalid Task source Threads');
            // The unreleased 06/07 dev builds of this train started Tasks without
            // the creation activity and with the discussion's plain inbox; a Task
            // without an activity is exactly that shape, replayed as it was written.
            const legacyTaskStart = task !== undefined && storedActivity === undefined;
            // An Agent Task creator is the accountable; the Human may name an enabled Project owner or itself.
            if (task !== undefined && !legacyTaskStart) {
                const validAccountable = actor !== undefined
                    ? task.accountable === actorMemberId()
                    : task.accountable === AGENT_TEAM_HUMAN_MEMBER_ID
                        || (projection.members.get(task.accountable)?.state === 'enabled' && this.isProjectOwnerFrom(projection, projectRef, task.accountable));
                if (!validAccountable)
                    throw new Error('invalid Task accountable');
            }
            else if (task !== undefined && task.accountable !== AGENT_TEAM_HUMAN_MEMBER_ID
                && !this.isProjectOwnerFrom(projection, projectRef, task.accountable))
                throw new Error('invalid Task accountable');
            this.addRef(refs, thread.threadRef);
            if (task !== undefined)
                this.addRef(refs, task.taskRef);
            this.addRef(refs, anchor.messageRef);
            this.validateMentions(mentions, anchor, projection);
            const taskActivity = storedActivity;
            if (!legacyTaskStart && (task === undefined) !== (taskActivity === undefined))
                throw new Error('invalid Task creation activity');
            if (taskActivity !== undefined && (task === undefined || taskActivity.kind !== 'promote' || taskActivity.taskRef !== task.taskRef
                || taskActivity.threadRef !== thread.threadRef || taskActivity.sequence !== operation.sequence || taskActivity.actor !== actorMemberId()))
                throw new Error('invalid Task creation activity');
            const expected = taskActivity === undefined
                ? this.messageInboxDelta(anchor, anchor.sender, mentions, [this.startAttention(anchor.sender, thread.threadRef, operation.sequence, 'thread-author')])
                : this.inboxDeltaForTaskResponsibility(projection, task, taskActivity, anchor, mentions);
            if (!isDeepStrictEqual(operation.data.inbox, expected))
                throw new Error('invalid Thread start inbox projection');
            this.validateInboxDelta(operation.data.inbox, projection, refs, [thread.threadRef], [anchor], taskActivity === undefined ? [] : [taskActivity]);
            return;
        }
        if (operation.kind === 'team/main-message-posted') {
            const actor = operation.actor.kind === 'member' ? assertMember() : (assertHuman(), undefined);
            const { message, mentions } = operation.data;
            const project = projection.projects.get(message.projectRef);
            if (project === undefined || project.workspaceId !== operation.data.workspaceId || project.state === 'archived'
                || message.sender !== actorMemberId() || message.sequence !== operation.sequence || message.occurredAt !== operation.occurredAt
                || (actor !== undefined && !this.isProjectMemberFrom(projection, project.projectRef, actor.memberId)))
                throw new Error('invalid Main stream Message');
            const parentSource = message.replyToMessageRef === undefined ? undefined : projection.mainSourceByRef.get(message.replyToMessageRef);
            if (message.replyToMessageRef !== undefined && (parentSource?.kind !== 'message' || parentSource.message.projectRef !== project.projectRef
                || (parentSource.message.sender !== message.sender && !mentions.includes(parentSource.message.sender))))
                throw new Error('invalid Main stream reply target');
            this.addRef(refs, message.messageRef);
            this.validateMentions(mentions, message, projection);
            if (!isDeepStrictEqual(operation.data.inbox, this.mainMessageInboxDelta(message, mentions)))
                throw new Error('invalid Main stream inbox projection');
            this.validateInboxDelta(operation.data.inbox, projection, refs, [], [], [], [message]);
            return;
        }
        if (operation.kind === 'team/main-stream-read') {
            const actor = operation.actor.kind === 'member' ? assertMember() : (assertHuman(), undefined);
            const { projectRef, memberId, readThroughSequence } = operation.data;
            const project = projection.projects.get(projectRef);
            if (project === undefined || project.workspaceId !== operation.data.workspaceId || project.state === 'archived'
                || memberId !== actorMemberId() || readThroughSequence > this.mainHeadFrom(projection, projectRef)
                || (actor !== undefined && !this.isProjectMemberFrom(projection, projectRef, actor.memberId)))
                throw new Error('invalid Main stream read');
            const expected = this.prepareMainReadFrom(projection, memberId, projectRef, readThroughSequence);
            if (!isDeepStrictEqual(operation.data.inbox, expected.inbox)
                && !this.isLegacySubscriptionEventReadAdvance(projection, memberId, projectRef, readThroughSequence, operation.data.inbox, expected)) {
                throw new Error('invalid Main stream read receipt');
            }
            this.validateInboxDelta(operation.data.inbox, projection, refs);
            return;
        }
        if (operation.kind === 'team/message-sent' || operation.kind === 'team/thread-replied') {
            const actor = operation.actor.kind === 'member' ? assertMember() : (assertHuman(), undefined);
            const { message, task, thread } = operation.data;
            const project = projection.projects.get(message.projectRef);
            if (project === undefined || project.workspaceId !== operation.data.workspaceId || message.sender !== actorMemberId()
                || message.sequence !== operation.sequence || thread.revision !== operation.sequence
                || message.threadRef !== thread.threadRef
                || (task === undefined ? message.taskRef !== undefined || thread.taskRef !== undefined
                    : message.taskRef !== task.taskRef || thread.taskRef !== task.taskRef || task.threadRef !== thread.threadRef || task.projectRef !== project.projectRef)
                || (actor !== undefined && !this.participatesInProjectWorkspaceFrom(projection, project.projectRef, actor.memberId)))
                throw new Error('invalid Message operation');
            if (operation.kind === 'team/message-sent') {
                if (!message.topLevel || projection.threads.has(thread.threadRef) || (task !== undefined && projection.tasks.has(task.taskRef))) {
                    throw new Error('invalid top-level Message operation');
                }
                this.addRef(refs, thread.threadRef);
                if (task !== undefined)
                    this.addRef(refs, task.taskRef);
            }
            else {
                const priorThread = projection.threads.get(thread.threadRef);
                const priorTask = task === undefined ? undefined : projection.tasks.get(task.taskRef);
                if (message.topLevel || priorThread === undefined || operation.data.baseRevision !== priorThread.revision
                    || priorThread.taskRef !== thread.taskRef
                    || (task === undefined ? priorTask !== undefined : priorTask === undefined || !this.sameTask(priorTask, task))) {
                    throw new Error('invalid Thread reply');
                }
                if (projection.rulesVersion >= 2 && actor !== undefined && !this.isProjectMemberFrom(projection, project.projectRef, actor.memberId)) {
                    throw new Error('invalid Thread reply: not a Project member');
                }
            }
            this.addRef(refs, message.messageRef);
            this.validateMentions(operation.data.mentions, message, projection);
            this.validateInboxDelta(operation.data.inbox, projection, refs, [thread.threadRef], [message]);
            this.validateMessageInbox(operation, projection);
            return;
        }
        if (operation.kind === 'team/claim-created' || operation.kind === 'team/claim-done' || operation.kind === 'team/claim-released') {
            const actor = operation.actor.kind === 'member' ? assertMember() : (assertHuman(), undefined);
            const { task, thread, claim, activity } = operation.data;
            const priorTask = projection.tasks.get(task.taskRef);
            const priorThread = projection.threads.get(thread.threadRef);
            if (priorTask === undefined || priorThread === undefined || priorThread.revision !== operation.data.baseRevision
                || !this.sameTaskIdentity(priorTask, task) || task.threadRef !== thread.threadRef || task.taskRef !== thread.taskRef
                || thread.revision !== operation.sequence || activity.sequence !== operation.sequence || activity.actor !== actorMemberId()
                || activity.taskRef !== task.taskRef || activity.threadRef !== thread.threadRef || activity.claimRef !== claim.claimRef
                || (actor !== undefined && !this.participatesInProjectWorkspaceFrom(projection, task.projectRef, actor.memberId)))
                throw new Error('invalid Claim operation');
            const creates = operation.kind === 'team/claim-created';
            const expectedKind = creates ? 'claim' : operation.kind === 'team/claim-done' ? 'done' : 'release';
            if (activity.kind !== expectedKind || claim.taskRef !== task.taskRef || claim.threadRef !== thread.threadRef)
                throw new Error('invalid Claim activity');
            if (operation.actor.kind !== 'member')
                throw new Error('invalid Claim authority');
            if ((creates && projection.claims.has(claim.claimRef))
                || (creates && claim.owner !== actorMemberId()) || (creates && claim.state !== 'active'))
                throw new Error('invalid Claim creation');
            if (creates && projection.rulesVersion >= 2 && !this.isProjectMemberFrom(projection, task.projectRef, actorMemberId()))
                throw new Error('invalid Claim creation: not a Project member');
            const previousClaim = projection.claims.get(claim.claimRef);
            if (!creates && (previousClaim === undefined || previousClaim.state !== 'active' || !this.sameClaimIdentity(previousClaim, claim)
                || (operation.actor.kind === 'member' && previousClaim.owner !== operation.actor.memberId)
                || claim.state !== (operation.kind === 'team/claim-done' ? 'done' : 'released')))
                throw new Error('invalid Claim transition');
            if (task.status !== this.deriveResolvedTaskStatus(task, new Map(projection.claims).set(claim.claimRef, claim).values()))
                throw new Error('invalid Claim Task status');
            this.addRef(refs, activity.activityRef);
            if (creates)
                this.addRef(refs, claim.claimRef);
            const expectedInbox = creates && !this.isFollowingFrom(projection, thread.threadRef, actorMemberId())
                ? this.inboxDelta([this.startAttention(actorMemberId(), thread.threadRef, operation.sequence, 'claim')])
                : this.inboxDelta();
            const projectedTask = { ...task, status: this.deriveResolvedTaskStatus(task, new Map(projection.claims).set(claim.claimRef, claim).values()) };
            const withResponsibility = projection.rulesVersion >= 2
                ? this.inboxDelta(expectedInbox.attention.set, [], [], [], this.responsibilityActivityRecipientsFrom(projection, projectedTask, actorMemberId())
                    .map(memberId => Object.freeze({ memberId, threadRef: thread.threadRef, activityRef: activity.activityRef, sequence: operation.sequence })))
                : expectedInbox;
            // The unreleased 06/07 dev builds recorded claim transitions without
            // the responsibility markers; either inbox is the one that era could
            // have written, so replay accepts both.
            if (!isDeepStrictEqual(operation.data.inbox, withResponsibility) && !isDeepStrictEqual(operation.data.inbox, expectedInbox)) {
                throw new Error('invalid Claim inbox projection');
            }
            this.validateInboxDelta(operation.data.inbox, projection, refs, [], [], [activity]);
            return;
        }
        if (operation.kind === 'team/task-accountable-changed') {
            const actor = operation.actor.kind === 'member' ? assertMember() : (assertHuman(), undefined);
            const { task, thread, activity } = operation.data;
            const priorTask = projection.tasks.get(task.taskRef);
            const priorThread = projection.threads.get(thread.threadRef);
            if (priorTask === undefined || priorThread === undefined || priorThread.revision !== operation.data.baseRevision
                || !this.sameTask({ ...priorTask, accountable: task.accountable }, task) || !this.sameThread(thread, { ...priorThread, revision: operation.sequence })
                || activity.kind !== 'transfer' || activity.actor !== actorMemberId() || activity.sequence !== operation.sequence
                || activity.taskRef !== task.taskRef || activity.threadRef !== thread.threadRef || activity.from !== priorTask.accountable
                || activity.to !== task.accountable || task.accountable === priorTask.accountable
                || (actor !== undefined && (priorTask.resolution !== 'open' || priorTask.accountable !== actor.memberId))
                || !this.transferTargetIsValidFrom(projection, task)) {
                throw new Error('invalid Task accountable transfer');
            }
            this.addRef(refs, activity.activityRef);
            const attention = task.accountable === actorMemberId() || this.isFollowingFrom(projection, thread.threadRef, task.accountable) ? []
                : [this.followAttentionFrom(projection, task.accountable, thread.threadRef, 'accountable')];
            const expected = this.inboxDelta(attention, [], [], [], [{ memberId: task.accountable, threadRef: thread.threadRef, activityRef: activity.activityRef, sequence: operation.sequence }]);
            if (!isDeepStrictEqual(operation.data.inbox, expected))
                throw new Error('invalid Task transfer inbox');
            this.validateInboxDelta(operation.data.inbox, projection, refs, [], [], [activity]);
            return;
        }
        if (operation.kind === 'team/task-changed') {
            if (projection.rulesVersion >= 2) {
                if (operation.actor.kind === 'member')
                    assertMember();
                else
                    assertHuman();
            }
            else
                assertHuman();
            const { task, thread, activity } = operation.data;
            const actor = actorMemberId();
            const priorTask = projection.tasks.get(task.taskRef);
            const priorThread = projection.threads.get(thread.threadRef);
            if (priorTask === undefined || priorThread === undefined || priorThread.revision !== operation.data.baseRevision
                || task.threadRef !== thread.threadRef || !this.sameThread(thread, { ...priorThread, revision: operation.sequence })
                || activity.sequence !== operation.sequence || activity.actor !== actorMemberId()
                || activity.taskRef !== task.taskRef || activity.threadRef !== thread.threadRef)
                throw new Error('invalid Task operation');
            if (activity.kind === 'reopen' && !this.accountableIsValidFrom(projection, priorTask))
                throw new Error('invalid Task accountable on reopen');
            if (projection.rulesVersion >= 2 && operation.actor.kind === 'member') {
                if (activity.kind === 'accept' && !this.canVerifyTaskFrom(projection, task, actor))
                    throw new Error('invalid Agent acceptance authority');
                if (activity.kind !== 'accept' && task.accountable !== actor)
                    throw new Error('invalid accountable Task authority');
            }
            const expectedResolution = taskResolutionForAction(activity.kind);
            const expectedStatus = this.deriveResolvedTaskStatus({ taskRef: task.taskRef, resolution: expectedResolution }, operation.data.claims);
            const expectedCompletedClaimRefs = operation.data.claims
                .filter(claim => projection.claims.get(claim.claimRef)?.state === 'active' && claim.state === 'done')
                .map(claim => claim.claimRef);
            // New-shape accepts carry the acceptance discriminator: every done
            // Claim at commit time, sorted. Legacy accepts without it keep
            // completed-only wake semantics as recorded.
            const expectedAcceptedClaimRefs = operation.data.claims
                .filter(claim => claim.state === 'done')
                .map(claim => claim.claimRef)
                .sort((left, right) => left.localeCompare(right));
            if (task.resolution !== expectedResolution || task.status !== expectedStatus
                || (activity.kind !== 'close' && activity.releasedClaimRefs !== undefined)
                || (activity.kind !== 'accept' && activity.completedClaimRefs !== undefined)
                || (activity.kind !== 'accept' && activity.acceptedClaimRefs !== undefined)
                || (activity.kind !== 'reopen' && activity.refollowedMembers !== undefined)
                || (activity.kind === 'close' && !this.sameList(activity.releasedClaimRefs ?? [], operation.data.claims
                    .filter(claim => projection.claims.get(claim.claimRef)?.state === 'active' && claim.state === 'released')
                    .map(claim => claim.claimRef)))
                || !this.sameList(activity.completedClaimRefs ?? [], expectedCompletedClaimRefs)
                || (activity.kind === 'accept' && activity.acceptedClaimRefs !== undefined
                    && !this.sameList(activity.acceptedClaimRefs, expectedAcceptedClaimRefs))
                || (activity.refollowedMembers !== undefined && !this.sameList(activity.refollowedMembers, priorTask.accountable !== actor && !this.isFollowingFrom(projection, thread.threadRef, priorTask.accountable) ? [priorTask.accountable] : []))) {
                throw new Error('invalid Task state transition');
            }
            const priorClaims = [...(projection.claimsByTask.get(task.taskRef) ?? [])].sort((left, right) => left.claimRef.localeCompare(right.claimRef));
            const operationClaims = [...operation.data.claims].sort((left, right) => left.claimRef.localeCompare(right.claimRef));
            if (priorClaims.length !== operationClaims.length || priorClaims.some((claim, index) => claim.claimRef !== operationClaims[index]?.claimRef))
                throw new Error('invalid Task Claim set');
            for (const claim of operationClaims) {
                const previousClaim = projection.claims.get(claim.claimRef);
                if (previousClaim === undefined || !this.sameClaimIdentity(previousClaim, claim))
                    throw new Error('invalid Task Claim identity');
                const legal = activity.kind === 'close'
                    ? (previousClaim.state === 'active' ? claim.state === 'released' : claim.state === previousClaim.state)
                    : activity.kind === 'accept'
                        ? (previousClaim.state === 'active' ? claim.state === 'done' : claim.state === previousClaim.state)
                        : claim.state === previousClaim.state;
                if (!legal)
                    throw new Error('invalid Task Claim transition');
            }
            this.addRef(refs, activity.activityRef);
            const expectedInbox = activity.kind === 'close'
                ? this.closeThreadInboxFrom(projection, activity, thread.threadRef)
                : activity.kind === 'reopen'
                    ? this.reopenThreadInboxFrom(projection, activity, thread.threadRef)
                    : this.withReminderCleanup(this.acceptThreadInboxFrom(projection, activity, thread.threadRef, activity.acceptedClaimRefs !== undefined ? activity.acceptedClaimRefs : expectedCompletedClaimRefs), projection, thread.threadRef);
            if (!isDeepStrictEqual(operation.data.inbox, expectedInbox))
                throw new Error('invalid Task inbox projection');
            this.validateInboxDelta(operation.data.inbox, projection, refs, [], [], [activity]);
            return;
        }
        if (operation.kind === 'team/reminder-raised') {
            if (operation.actor.kind !== 'host')
                throw new Error('invalid Task reminder authority');
            const { taskRef, kind, recipient, baselineSequence, inbox } = operation.data;
            const task = projection.tasks.get(taskRef);
            const thread = task === undefined ? undefined : projection.threads.get(task.threadRef);
            const project = task === undefined ? undefined : projection.projects.get(task.projectRef);
            const marker = inbox.reminderMarkers?.added[0];
            const key = reminderEpisodeKey(taskRef, kind, recipient, baselineSequence);
            if (task === undefined || thread === undefined || project === undefined || project.workspaceId !== operation.data.workspaceId
                || (kind === 'review-backlog' ? task.status !== 'in_review' : task.status !== 'in_progress')
                || projection.reminderEpisodes.has(key) || baselineSequence >= operation.sequence
                || !projection.occurredAtBySequence.has(baselineSequence)
                || (kind === 'review-backlog'
                    ? projection.taskStatusBaselines.get(taskRef)?.sequence !== baselineSequence
                    : baselineSequence !== Math.max(projection.factsByThread.get(task.threadRef)?.at(-1)?.sequence ?? 0, ...(projection.claimsByTask.get(taskRef) ?? []).filter(claim => claim.state === 'active')
                        .map(claim => projection.claimCreatedSequenceByRef.get(claim.claimRef) ?? 0)))
                || (recipient !== humanMemberId && (projection.members.get(recipient)?.state === undefined || !this.participatesInFrom(projection, recipient, project.workspaceId)))
                || marker === undefined || inbox.reminderMarkers?.added.length !== 1 || inbox.reminderMarkers.removed.length !== 0
                || !isDeepStrictEqual(marker, { memberId: recipient, threadRef: task.threadRef, taskRef, kind, baselineSequence, sequence: operation.sequence })
                || !isDeepStrictEqual(inbox, this.inboxDelta([], [], [], [], [], [], [], [], [marker]))) {
                throw new Error('invalid Task reminder projection');
            }
            this.validateInboxDelta(inbox, projection, refs);
            return;
        }
        if (operation.kind === 'team/subscription-created' || operation.kind === 'team/subscription-updated'
            || operation.kind === 'team/subscription-paused' || operation.kind === 'team/subscription-resumed'
            || operation.kind === 'team/subscription-deleted' || operation.kind === 'team/subscription-webhook-reset'
            || operation.kind === 'team/subscription-baseline'
            || operation.kind === 'team/subscription-events-accepted' || operation.kind === 'team/subscription-event-published') {
            this.validateSubscriptionOperation(operation, projection, refs);
            return;
        }
        if (operation.kind === 'team/member-reminder-created') {
            const member = assertMember();
            const { reminder } = operation.data;
            if (reminder.memberId !== member.memberId || projection.memberReminders.has(reminder.reminderRef)
                || reminder.state !== 'active' || !reminderScheduleIsSound(reminder.schedule)
                || !reminderRefIsStorable(reminder.reminderRef)
                || !Number.isFinite(Date.parse(reminder.createdAt))
                || characterLength(reminder.note) > MAX_REMINDER_NOTE_CHARACTERS || reminder.note.trim() === ''
                || reminder.reminderRef === '' || this.activeMemberReminderCountFrom(projection, member.memberId) > MAX_ACTIVE_REMINDERS_PER_MEMBER) {
                throw new Error('invalid Member reminder creation');
            }
            return;
        }
        if (operation.kind === 'team/member-reminder-raised') {
            if (operation.actor.kind !== 'host')
                throw new Error('invalid Member reminder authority');
            const { memberId, reminderRef, scheduledAt, inbox } = operation.data;
            const reminder = projection.memberReminders.get(reminderRef);
            const previous = projection.memberReminderOccurrences.get(reminderRef);
            const added = inbox.memberReminderMarkers?.added ?? [];
            const removed = inbox.memberReminderMarkers?.removed ?? [];
            const member = projection.members.get(memberId);
            const stored = projection.memberReminderMarkers.get(memberReminderMarkerKey({ memberId, reminderRef }));
            const at = Date.parse(scheduledAt);
            const previousAt = previous === undefined ? undefined : Date.parse(previous.scheduledAt);
            if (reminder === undefined || reminder.memberId !== memberId || reminder.state !== 'active'
                || member === undefined || (member.state !== 'enabled' && member.state !== 'suspended')
                || !Number.isFinite(at) || !reminderScheduleIsSound(reminder.schedule)
                || (reminder.schedule.kind === 'once' && previous !== undefined)
                || (previousAt !== undefined && at < previousAt)
                || added.length === 0 || removed.length > 1
                || added.some(marker => marker.memberId !== memberId || marker.reminderRef !== reminderRef || marker.sequence !== operation.sequence)
                || (stored === undefined) !== (removed.length === 0)
                || removed.some(marker => marker.memberId !== memberId || marker.reminderRef !== reminderRef
                    || !isDeepStrictEqual(projection.memberReminderMarkers.get(memberReminderMarkerKey(marker)), marker))
                || inbox.reminderMarkers !== undefined || inbox.mainMarkers !== undefined) {
                throw new Error('invalid Member reminder occurrence');
            }
            this.validateInboxDelta(inbox, projection, refs);
            return;
        }
        if (operation.kind === 'team/member-reminder-consumed') {
            if (operation.actor.kind !== 'host')
                throw new Error('invalid Member reminder authority');
            const { memberId, reminderRef, inbox } = operation.data;
            const occurrence = projection.memberReminderOccurrences.get(reminderRef);
            const removed = inbox.memberReminderMarkers?.removed ?? [];
            const marker = projection.memberReminderMarkers.get(`${memberId}|${reminderRef}`);
            if (occurrence === undefined || occurrence.memberId !== memberId || occurrence.consumedSequence !== undefined
                || marker === undefined || removed.length !== 1 || (inbox.memberReminderMarkers?.added.length ?? 0) !== 0
                || !isDeepStrictEqual(removed[0], marker)) {
                throw new Error('invalid Member reminder consumption');
            }
            this.validateInboxDelta(inbox, projection, refs);
            return;
        }
        if (operation.kind === 'team/member-reminder-cancelled') {
            const { memberId, reminderRef, reminder, inbox } = operation.data;
            const current = projection.memberReminders.get(reminderRef);
            const marker = projection.memberReminderMarkers.get(`${memberId}|${reminderRef}`);
            const removed = inbox.memberReminderMarkers?.removed ?? [];
            const added = inbox.memberReminderMarkers?.added ?? [];
            // The Member that owns the reminder withdraws it; the Human may withdraw any.
            if (operation.actor.kind === 'member') {
                if (actorMemberId() !== memberId)
                    throw new Error('invalid Member reminder cancellation authority');
            }
            else
                assertHuman();
            if (current === undefined || current.state !== 'active' || current.memberId !== memberId
                || reminder.reminderRef !== reminderRef || reminder.memberId !== memberId || reminder.state !== 'cancelled'
                || !isDeepStrictEqual({ ...current, state: 'cancelled' }, reminder)
                || removed.length > 1 || added.length !== 0
                || (marker === undefined) !== (removed.length === 0)
                || (marker !== undefined && removed.length === 1 && !isDeepStrictEqual(removed[0], marker))) {
                throw new Error('invalid Member reminder cancellation');
            }
            this.validateInboxDelta(inbox, projection, refs);
            return;
        }
        if (operation.kind === 'team/worker-started') {
            const actor = assertMember();
            const { execution, activity } = operation.data;
            const steer = projection.workerSteerRequests.get(operation.requestId);
            if (steer !== undefined && (steer.aliasOf !== undefined || steer.workerRef !== execution.workerRef
                || steer.continuedFrom !== execution.continuedFrom || steer.instruction !== execution.task
                || steer.initiatedBy !== execution.initiatedBy || steer.workspaceId !== operation.data.workspaceId)) {
                throw new Error('invalid Worker start for an admitted steer');
            }
            const project = projection.projects.get(execution.projectRef);
            if (project === undefined || project.workspaceId !== operation.data.workspaceId || project.state === 'archived'
                || execution.initiatedBy !== actor.memberId || !this.isProjectOwnerFrom(projection, project.projectRef, actor.memberId)
                || execution.startedAt !== operation.occurredAt || projection.workerExecutions.has(execution.workerRef)
                || execution.task.trim() === '' || execution.cwd.trim() === '')
                throw new Error('invalid Worker start');
            this.assertWorkerBindingFrom(projection, project.projectRef, execution);
            this.assertWorkerContinuationFrom(projection, execution);
            this.addRef(refs, execution.workerRef);
            if (execution.threadRef === undefined) {
                if (activity !== undefined)
                    throw new Error('invalid Worker start activity');
                return;
            }
            if (activity === undefined || activity.kind !== 'worker_started' || activity.threadRef !== execution.threadRef
                || activity.projectRef !== execution.projectRef || activity.workerRef !== execution.workerRef
                || activity.engine !== execution.engine || activity.actor !== execution.initiatedBy
                || activity.taskRef !== execution.taskRef || activity.sequence !== operation.sequence) {
                throw new Error('invalid Worker start activity');
            }
            this.addRef(refs, activity.activityRef);
            return;
        }
        if (operation.kind === 'team/worker-settled') {
            if (operation.actor.kind !== 'host' || operation.actor.handle !== HOST_ACTOR.handle)
                throw new Error('invalid Worker settlement authority');
            const { execution: settlement, activity, inbox } = operation.data;
            const prior = projection.workerExecutions.get(settlement.workerRef);
            const project = prior === undefined ? undefined : projection.projects.get(prior.projectRef);
            if (prior === undefined || prior.state !== 'running' || project === undefined
                || project.workspaceId !== operation.data.workspaceId || settlement.settledAt !== operation.occurredAt
                || settlement.workerRef !== prior.workerRef)
                throw new Error('invalid Worker settlement');
            this.assertWorkerSettlementFrom(projection, prior, settlement);
            if (prior.threadRef === undefined) {
                if (activity !== undefined || inbox.activityMarkers.added.length > 0
                    || inbox.activityMarkers.removed.length > 0)
                    throw new Error('invalid Worker settlement projection');
            }
            else {
                const reason = workerRunReasonOf(settlement);
                if (activity === undefined || activity.kind !== 'worker_settled' || activity.threadRef !== prior.threadRef
                    || activity.projectRef !== prior.projectRef || activity.workerRef !== prior.workerRef || activity.engine !== prior.engine
                    || activity.actor !== prior.initiatedBy || activity.taskRef !== prior.taskRef || activity.sequence !== operation.sequence
                    || activity.state !== settlement.state || activity.reason !== reason)
                    throw new Error('invalid Worker settlement activity');
                this.addRef(refs, activity.activityRef);
                const marker = this.isProjectMemberFrom(projection, prior.projectRef, prior.initiatedBy)
                    ? Object.freeze({ memberId: prior.initiatedBy, threadRef: activity.threadRef, activityRef: activity.activityRef, sequence: operation.sequence })
                    : undefined;
                const expected = this.inboxDelta([], [], [], [], marker === undefined ? [] : [marker], []);
                if (!isDeepStrictEqual(inbox, expected))
                    throw new Error('invalid Worker settlement inbox projection');
            }
            this.validateInboxDelta(inbox, projection, refs, [], [], activity === undefined ? [] : [activity]);
            return;
        }
        if (operation.kind === 'team/worker-steer-admitted') {
            const actor = assertMember();
            const { requestId, workspaceId, workerRef, instruction, initiatedBy, continuedFrom, aliasOf } = operation.data;
            if (initiatedBy !== actor.memberId || instruction.trim() === '' || instruction !== instruction.trim()
                || !this.participatesInFrom(projection, initiatedBy, workspaceId)
                || projection.workerSteerRequests.has(requestId) || projection.byRequest.has(requestId)) {
                throw new Error('invalid Worker steer admission');
            }
            const admission = { requestId, workspaceId, workerRef,
                instruction, initiatedBy, ...(continuedFrom === undefined ? {} : { continuedFrom }),
                ...(aliasOf === undefined ? {} : { aliasOf }) };
            this.workerSteerReceivingExecution(admission, projection);
            if (aliasOf === undefined) {
                const prior = this.workerSteerCanonicalAdmissionsFor(admission, projection);
                if (prior.some(candidate => candidate.outcome?.kind !== 'refused')) {
                    throw new Error('Worker steer admission repeats an instruction without a refusal');
                }
            }
            else {
                const alias = this.workerSteerAliasTarget(admission, projection);
                if (alias.outcome?.kind === 'refused')
                    throw new Error('invalid refused Worker steer alias');
            }
            return;
        }
        if (operation.kind === 'team/worker-steer-recorded') {
            if (operation.actor.kind !== 'host' || operation.actor.handle !== HOST_ACTOR.handle) {
                throw new Error('invalid Worker steer outcome authority');
            }
            const admission = projection.workerSteerRequests.get(operation.data.admissionRequestId);
            if (admission === undefined || admission.aliasOf !== undefined || admission.outcome !== undefined) {
                throw new Error('invalid Worker steer outcome');
            }
            this.assertWorkerSteerOutcome(admission, operation.data.outcome, projection);
            return;
        }
        if (operation.kind === 'team/dm-sent') {
            const sender = assertMember();
            const recipient = projection.members.get(operation.data.recipientMemberId);
            if (recipient === undefined || !this.participatesInFrom(projection, recipient.memberId, operation.data.workspaceId)
                || recipient.state !== 'enabled' || recipient.memberId === AGENT_TEAM_HUMAN_MEMBER_ID
                || operation.data.senderMemberId !== sender.memberId
                || operation.data.recipientMemberId === sender.memberId
                || operation.data.body.trim() === '' || operation.data.body !== operation.data.body.trim()) {
                throw new Error('invalid DM operation');
            }
            return;
        }
        assertUnhandledKind(operation);
    }
    /**
     * Validation of one operation's Inbox delta against the projection it was
     * derived from.
     *
     * Direct marker references resolve through the replay-derived Message index:
     * this runs once per inbox-carrying record, so a rescan of the Message list
     * here would make every record cost the whole ledger. The index is written by
     * the same fact appends that build `factsByThread`, so a lookup sees exactly
     * the records replayed before this one and can never reach a Message that
     * arrives later — which is why the operation's own entity, not yet in the
     * projection, needs the `additional*` fallbacks. The commit path resolved the
     * projection first and then its own record, and that precedence is kept.
     */
    validateInboxDelta(delta, projection, _refs, additionalThreadRefs = [], additionalMessages = [], additionalActivities = [], additionalMainMessages = [], additionalMainActivities = [], additionalMainEvents = []) {
        const attentionKeys = new Set();
        for (const attention of delta.attention.set) {
            if ((!projection.threads.has(attention.threadRef) && !additionalThreadRefs.includes(attention.threadRef)) || attention.startSequence < 1
                || attention.readThroughSequence < attention.startSequence - 1) {
                throw new Error('invalid Attention delta');
            }
            const key = this.attentionKey(attention.memberId, attention.threadRef);
            if (attentionKeys.has(key))
                throw new Error('repeated Attention delta');
            attentionKeys.add(key);
        }
        for (const key of delta.attention.removed) {
            if (attentionKeys.has(this.attentionKey(key.memberId, key.threadRef)))
                throw new Error('conflicting Attention delta');
        }
        const mainAttentionKeys = new Set();
        for (const attention of delta.mainAttention?.set ?? []) {
            const key = mainAttentionKey(attention.memberId, attention.projectRef);
            if (mainAttentionKeys.has(key))
                throw new Error('repeated Main stream Attention delta');
            mainAttentionKeys.add(key);
            // A Main stream Attention period starts at a sequence the stream has not
            // reached yet, so `startSequence` can exceed the current head by one.
            if (attention.startSequence < 1 || attention.readThroughSequence < attention.startSequence - 1) {
                throw new Error('invalid Main stream Attention delta');
            }
        }
        for (const key of delta.mainAttention?.removed ?? []) {
            if (mainAttentionKeys.has(mainAttentionKey(key.memberId, key.projectRef)))
                throw new Error('conflicting Main stream Attention delta');
        }
        const markerKeys = new Set();
        for (const marker of delta.directMarkers.added) {
            const key = this.directMarkerKey(marker);
            if (markerKeys.has(key) || projection.directMarkers.has(key))
                throw new Error('invalid direct marker addition');
            markerKeys.add(key);
            const message = projection.messagesByRef.get(marker.messageRef) ?? additionalMessages.find(candidate => candidate.messageRef === marker.messageRef);
            if (message === undefined || message.threadRef !== marker.threadRef || message.sequence !== marker.sequence
                || !this.validMentionTarget(projection, message.projectRef, marker.memberId))
                throw new Error('invalid direct marker addition');
        }
        for (const marker of delta.directMarkers.removed) {
            const key = this.directMarkerKey(marker);
            if (markerKeys.has(key) || !projection.directMarkers.has(key))
                throw new Error('invalid direct marker removal');
            markerKeys.add(key);
            const current = projection.directMarkers.get(key);
            const message = projection.messagesByRef.get(marker.messageRef) ?? additionalMessages.find(candidate => candidate.messageRef === marker.messageRef);
            if (!isDeepStrictEqual(current, marker) || message === undefined || message.threadRef !== marker.threadRef
                || message.sequence !== marker.sequence || !this.validMentionTarget(projection, message.projectRef, marker.memberId)) {
                throw new Error('invalid direct marker removal');
            }
        }
        const activityMarkerKeys = new Set();
        for (const marker of delta.activityMarkers.added) {
            const key = this.activityMarkerKey(marker);
            // Every activity marker is minted for the activity the same record
            // carries (promotion, close, reopen, acceptance), and a removal never
            // looks an activity up, so this record's own list is the whole
            // resolution space: scanning recorded activities would add nothing.
            const activity = additionalActivities.find(candidate => candidate.activityRef === marker.activityRef);
            if (activityMarkerKeys.has(key) || projection.activityMarkers.has(key) || activity === undefined
                || activity.threadRef !== marker.threadRef || activity.sequence !== marker.sequence)
                throw new Error('invalid activity marker addition');
            activityMarkerKeys.add(key);
        }
        for (const marker of delta.activityMarkers.removed) {
            const key = this.activityMarkerKey(marker);
            if (activityMarkerKeys.has(key) || !isDeepStrictEqual(projection.activityMarkers.get(key), marker)) {
                throw new Error('invalid activity marker removal');
            }
            activityMarkerKeys.add(key);
        }
        const reminderKeys = new Set();
        for (const marker of delta.reminderMarkers?.added ?? []) {
            const key = reminderMarkerKey(marker);
            if (reminderKeys.has(key) || projection.reminderMarkers.has(key))
                throw new Error('invalid Task reminder marker addition');
            reminderKeys.add(key);
        }
        for (const marker of delta.reminderMarkers?.removed ?? []) {
            const key = reminderMarkerKey(marker);
            if (reminderKeys.has(key) || !isDeepStrictEqual(projection.reminderMarkers.get(key), marker))
                throw new Error('invalid Task reminder marker removal');
            reminderKeys.add(key);
        }
        const removedMemberReminderKeys = new Set();
        for (const marker of delta.memberReminderMarkers?.removed ?? []) {
            const key = memberReminderMarkerKey(marker);
            if (!isDeepStrictEqual(projection.memberReminderMarkers.get(key), marker))
                throw new Error('invalid Member reminder marker removal');
            removedMemberReminderKeys.add(key);
        }
        const memberReminderKeys = new Set();
        for (const marker of delta.memberReminderMarkers?.added ?? []) {
            const key = memberReminderMarkerKey(marker);
            // One marker per reminder: an addition either opens the key or replaces the
            // marker this same record removes, and never stacks a second one.
            if (memberReminderKeys.has(key) || (projection.memberReminderMarkers.has(key) && !removedMemberReminderKeys.has(key))) {
                throw new Error('invalid Member reminder marker addition');
            }
            memberReminderKeys.add(key);
        }
        const mainKeys = new Set();
        for (const marker of delta.mainMarkers?.added ?? []) {
            const key = mainMarkerKey(marker);
            // A Main stream marker always points at the Message, Activity, or published event its own record carries.
            const target = 'messageRef' in marker
                ? additionalMainMessages.find(candidate => candidate.messageRef === marker.messageRef)
                : 'activityRef' in marker
                    ? additionalMainActivities.find(candidate => candidate.activityRef === marker.activityRef)
                    : additionalMainEvents.find(candidate => candidate.eventRef === marker.eventRef);
            if (mainKeys.has(key) || projection.mainMarkers.has(key) || target === undefined || target.projectRef !== marker.projectRef
                || target.sequence !== marker.sequence || !this.validMentionTarget(projection, marker.projectRef, marker.memberId))
                throw new Error('invalid Main stream marker addition');
            mainKeys.add(key);
        }
        for (const marker of delta.mainMarkers?.removed ?? []) {
            const key = mainMarkerKey(marker);
            if (mainKeys.has(key) || !isDeepStrictEqual(projection.mainMarkers.get(key), marker))
                throw new Error('invalid Main stream marker removal');
            mainKeys.add(key);
        }
    }
    /**
     * Replay validation of one departure's release snapshot against the
     * projection it was derived from. `memberId` scopes everything to a single
     * departing Member; `undefined` validates every owner, which is what
     * archiving a whole Project releases. The two scopes differ in exactly four
     * ways, all of them visible here rather than spread over two copies:
     *
     * 1. released Claims are owner-filtered for a Member, unfiltered for a Project;
     * 2. Activities group per (owner, Thread) with owners sorted, which for a
     *    single departing Member collapses to one Activity per Thread — the shape
     *    the commit path writes;
     * 3. the inbox cleanup covers the departing Member's Attention and markers, or
     *    every Member's on the archived Project's Threads;
     * 4. the failure message names which of the two paths lost its cleanup.
     */
    validateReleaseCleanup(data, projection, memberId, threadRefs, sequence, refs, projectRefs) {
        const releasedClaims = [...projection.claims.values()]
            .filter(claim => (memberId === undefined || claim.owner === memberId) && claim.state === 'active' && threadRefs.has(claim.threadRef))
            .map(claim => Object.freeze({ ...claim, state: 'released' }));
        if (data.claims.length !== releasedClaims.length || data.claims.some((claim, index) => {
            const expected = releasedClaims[index];
            return expected === undefined || !this.sameClaim(expected, claim);
        }))
            throw new Error('invalid released Claim projection');
        // One Activity per (owner, Thread), owners sorted like the commit path.
        const byOwner = new Map();
        for (const claim of releasedClaims) {
            const byThread = byOwner.get(claim.owner) ?? new Map();
            byOwner.set(claim.owner, byThread);
            byThread.set(claim.threadRef, [...(byThread.get(claim.threadRef) ?? []), claim]);
        }
        const expectedActivities = [...byOwner.keys()].sort().flatMap(owner => [...byOwner.get(owner).entries()].map(([threadRef, claims]) => ({
            kind: 'claims_released', taskRef: claims[0].taskRef, threadRef, actor: owner, sequence,
            claimRefs: claims.map(claim => claim.claimRef).sort(),
        })));
        if (data.activities.length !== expectedActivities.length || data.activities.some((activity, index) => {
            const expected = expectedActivities[index];
            return expected === undefined || activity.kind !== expected.kind || activity.taskRef !== expected.taskRef
                || activity.threadRef !== expected.threadRef || activity.actor !== expected.actor || activity.sequence !== expected.sequence
                || !this.sameList(activity.claimRefs, expected.claimRefs);
        }))
            throw new Error('invalid released Claim activities');
        for (const claim of data.claims) {
            const prior = projection.claims.get(claim.claimRef);
            if (prior === undefined)
                throw new Error('invalid released Claim reference');
        }
        for (const activity of data.activities)
            this.addRef(refs, activity.activityRef);
        const projectedClaims = new Map(projection.claims);
        for (const claim of releasedClaims)
            projectedClaims.set(claim.claimRef, claim);
        const expectedTasks = [...new Set(releasedClaims.map(claim => claim.taskRef))].map(taskRef => {
            const task = projection.tasks.get(taskRef);
            return Object.freeze({ ...task, status: this.deriveResolvedTaskStatus(task, projectedClaims.values()) });
        });
        const expectedThreads = expectedActivities.map(activity => {
            const thread = projection.threads.get(activity.threadRef);
            return Object.freeze({ ...thread, revision: sequence });
        });
        if (projection.rulesVersion < 2 && (!isDeepStrictEqual(data.tasks, expectedTasks) || !isDeepStrictEqual(data.threads, expectedThreads))) {
            throw new Error('invalid released Claim Task or Thread projection');
        }
        const expectedAttention = [...projection.attention.values()]
            .filter(attention => (memberId === undefined || attention.memberId === memberId) && threadRefs.has(attention.threadRef))
            .map(attention => ({ memberId: attention.memberId, threadRef: attention.threadRef }));
        const expectedMarkers = [...projection.directMarkers.values()]
            .filter(marker => (memberId === undefined || marker.memberId === memberId) && threadRefs.has(marker.threadRef));
        const expectedActivityMarkers = [...projection.activityMarkers.values()]
            .filter(marker => (memberId === undefined || marker.memberId === memberId) && threadRefs.has(marker.threadRef));
        const expectedReminderMarkers = [...projection.reminderMarkers.values()]
            .filter(marker => (memberId === undefined || marker.memberId === memberId) && threadRefs.has(marker.threadRef));
        if (projection.rulesVersion < 2) {
            const expectedInbox = this.inboxDelta([], expectedAttention, [], expectedMarkers, [], expectedActivityMarkers, [], this.mainMarkersToClear(projection, memberId, projectRefs), [], []);
            if (!isDeepStrictEqual(data.inbox, expectedInbox))
                throw new Error('invalid Member inbox cleanup');
            this.validateInboxDelta(data.inbox, projection, refs);
            return;
        }
        const returned = this.accountabilityReturnsForCleanup(projection, memberId, sequence, projectRefs);
        const { tasks: mergedTasks, threads: mergedThreads } = this.mergeResponsibilityReturn(expectedTasks, expectedThreads, returned);
        if (!isDeepStrictEqual(data.tasks, mergedTasks) || !isDeepStrictEqual(data.threads, mergedThreads))
            throw new Error('invalid released Claim Task or Thread projection');
        this.validateAccountabilityReturns(data, returned, projection, refs);
        const expectedInbox = this.inboxDelta([], expectedAttention, [], expectedMarkers, returned.markers, expectedActivityMarkers, [], this.mainMarkersToClear(projection, memberId, projectRefs), [], expectedReminderMarkers);
        if (!this.sameInboxDelta(data.inbox, expectedInbox, data.transfers)) {
            throw new Error(memberId === undefined ? 'invalid Project archival inbox cleanup' : 'invalid Member inbox cleanup');
        }
        this.validateInboxDelta(data.inbox, projection, refs, [], [], [...data.activities, ...data.transfers]);
    }
    /**
     * Inbox deltas minted by a departure carry the freshly generated activity
     * refs of its transfer Activities, so replay compares business fields and
     * matches each such marker's ref against the transfer recorded beside it.
     */
    sameInboxDelta(actual, expected, transfers) {
        const byKey = new Map(transfers.map(activity => [`${activity.threadRef}:${activity.sequence}`, activity]));
        const normalize = (delta) => ({
            ...delta,
            activityMarkers: {
                ...delta.activityMarkers,
                added: delta.activityMarkers.added.map(marker => byKey.has(`${marker.threadRef}:${marker.sequence}`)
                    ? { ...marker, activityRef: `transfer:${marker.threadRef}:${marker.sequence}` } : marker),
            },
        });
        if (!isDeepStrictEqual(normalize(actual), normalize(expected)))
            return false;
        for (const marker of actual.activityMarkers.added) {
            const transfer = byKey.get(`${marker.threadRef}:${marker.sequence}`);
            if (transfer !== undefined && marker.activityRef !== transfer.activityRef)
                return false;
        }
        return true;
    }
    accountabilityReturnsForCleanup(projection, memberId, sequence, projectRefs) {
        const members = memberId !== undefined ? [memberId] : this.accountableMembersInScopeFrom(projection, projectRefs);
        const returns = members.map(accountable => this.accountabilityReturnsFrom(projection, accountable, sequence, projectRefs));
        return { transfers: returns.flatMap(item => item.transfers), tasks: returns.flatMap(item => item.tasks),
            threads: returns.flatMap(item => item.threads), markers: returns.flatMap(item => item.markers) };
    }
    /**
     * Every Member that owes a Task inside a scope nothing will be left to hand it to: a Project being archived, or a
     * Member leaving. Version 2 ranged over owner grants, which cannot see a Task handed to a plain member; version 3
     * ranges over the Tasks themselves.
     */
    accountableMembersInScopeFrom(projection, projectRefs) {
        if (projection.rulesVersion < 3)
            return [...new Set([...projection.owners.values()].flatMap(owners => [...owners.keys()]))].sort();
        const members = new Set();
        for (const task of projection.tasks.values()) {
            if (task.resolution !== 'open' || task.accountable === AGENT_TEAM_HUMAN_MEMBER_ID)
                continue;
            if (projectRefs !== undefined && !projectRefs.has(task.projectRef))
                continue;
            members.add(task.accountable);
        }
        return [...members].sort();
    }
    validateAccountabilityReturns(data, expected, projection, refs) {
        if (data.transfers.length !== expected.transfers.length || data.transfers.some((activity, index) => {
            const other = expected.transfers[index];
            return other === undefined || activity.kind !== other.kind || activity.taskRef !== other.taskRef || activity.threadRef !== other.threadRef
                || activity.actor !== other.actor || activity.sequence !== other.sequence || activity.from !== other.from || activity.to !== other.to;
        }))
            throw new Error('invalid accountable return to Human');
        for (const activity of data.transfers) {
            const task = projection.tasks.get(activity.taskRef);
            if (activity.kind !== 'transfer' || activity.from !== task?.accountable || activity.to !== AGENT_TEAM_HUMAN_MEMBER_ID
                || activity.actor !== AGENT_TEAM_HUMAN_MEMBER_ID || activity.threadRef !== task?.threadRef)
                throw new Error('invalid accountable transfer Activity');
            this.addRef(refs, activity.activityRef);
        }
    }
    /**
     * Replay validation of one subscription record. Every judgement re-derives
     * what the commit path derived: the Project state, the owner standing, the
     * definition rules, the revision arithmetic, the deduplication waterline, and
     * the frozen recipient markers of a publication.
     */
    validateSubscriptionOperation(operation, projection, refs) {
        const at = `agent-team operation ${operation.sequence} (${operation.kind})`;
        const data = operation.data;
        // A lifecycle record names its Project through the subscription it carries; every other one carries it directly.
        const projectRef = 'projectRef' in data ? data.projectRef : data.subscription.projectRef;
        const project = projection.projects.get(projectRef);
        if (project === undefined || project.workspaceId !== data.workspaceId)
            throw new Error(`${at} names a Project outside its Workspace`);
        if (project.state !== 'active')
            throw new Error(`${at} changes an archived Project's subscriptions`);
        const human = projection.ordered[0];
        if (human === undefined || human.kind !== 'team/initialized')
            throw new Error('agent-team ledger has no Human Member');
        let actor;
        const ownerActor = () => {
            if (actor !== undefined)
                return actor;
            if (operation.actor.kind === 'human') {
                if (operation.actor.memberId !== human.data.humanMemberId)
                    throw new Error(`${at} has invalid Human authority`);
                actor = operation.actor.memberId;
                return actor;
            }
            if (operation.actor.kind !== 'member')
                throw new Error(`${at} needs a Human or Agent Member actor`);
            const member = projection.members.get(operation.actor.memberId);
            if (member === undefined || member.state !== 'enabled' || member.handle !== operation.actor.handle) {
                throw new Error(`${at} has invalid Member authority`);
            }
            if (projection.owners.get(projectRef)?.has(member.memberId) !== true) {
                throw new Error(`${at} was written by a Member who does not own the Project`);
            }
            actor = member.memberId;
            return actor;
        };
        if (operation.kind === 'team/subscription-created' || operation.kind === 'team/subscription-updated'
            || operation.kind === 'team/subscription-paused' || operation.kind === 'team/subscription-resumed'
            || operation.kind === 'team/subscription-deleted' || operation.kind === 'team/subscription-webhook-reset') {
            const { subscription, activity } = operation.data;
            const prior = projection.subscriptions.get(subscription.subscriptionRef);
            const definition = subscriptionDefinitionProblem(subscription);
            if (definition !== undefined)
                throw new Error(`${at}: ${definition}`);
            if (subscription.projectRef !== projectRef)
                throw new Error(`${at} stores a subscription of another Project`);
            // Events are addressed from version 5 on. The stored set must be canonical
            // (sorted, unique) and name only Members of this Project at this commit;
            // an older segment never carried the field, and inventing one there would
            // reroute events the record itself sent to the owners.
            const addressed = subscription.notify;
            if (addressed !== undefined) {
                if (!isDeepStrictEqual([...addressed].sort(), addressed) || new Set(addressed).size !== addressed.length) {
                    throw new Error(`${at} stores subscription recipients in no canonical order`);
                }
                for (const memberId of addressed) {
                    if (!this.notifyRecipientLiveFrom(projection, projectRef, memberId)) {
                        throw new Error(`${at} addresses an event to a Member outside the Project`);
                    }
                }
            }
            // The address exists exactly as long as the trigger asks for one; a record
            // that disagrees would make the entry resolve a token nothing can post to.
            if ((subscription.webhook !== undefined) !== (subscription.triggers.webhook === true)) {
                throw new Error(`${at} arms a webhook address its triggers do not ask for`);
            }
            // The Host pauses a subscription itself once runs keep failing. That is
            // the one lifecycle line with no Member behind it, so it records no actor.
            const hostPause = operation.kind === 'team/subscription-paused' && operation.actor.kind === 'host';
            if (hostPause && (operation.actor.handle !== HOST_ACTOR.handle || subscription.pausedReason !== 'failures')) {
                throw new Error(`${at} has no authority to pause this subscription`);
            }
            const actorId = hostPause ? undefined : ownerActor();
            const kind = operation.kind === 'team/subscription-created' ? 'subscription-created'
                : operation.kind === 'team/subscription-updated' ? 'subscription-updated'
                    : operation.kind === 'team/subscription-paused' ? 'subscription-paused'
                        : operation.kind === 'team/subscription-resumed' ? 'subscription-resumed'
                            : operation.kind === 'team/subscription-deleted' ? 'subscription-deleted' : 'subscription-webhook-reset';
            let expectedReason;
            if (operation.kind === 'team/subscription-created') {
                if (prior !== undefined)
                    throw new Error(`${at} recreates an existing subscription`);
                this.addRef(refs, subscription.subscriptionRef);
                if (subscription.revision !== 1 || subscription.state !== 'active' || subscription.pausedReason !== undefined
                    || subscription.createdBy !== actorId || subscription.createdAt !== operation.occurredAt) {
                    throw new Error(`${at} stores an invalid initial subscription state`);
                }
                const ids = subscriptionIdsProblem(operation.data.baselineIds);
                if (ids !== undefined)
                    throw new Error(`${at}: ${ids}`);
                if (subscription.webhook !== undefined
                    && (subscription.webhook.generation !== 1 || subscription.webhook.armedAt !== operation.occurredAt)) {
                    throw new Error(`${at} arms an initial webhook address outside its first generation`);
                }
            }
            else {
                if (prior === undefined)
                    throw new Error(`${at} changes a subscription that does not exist`);
                const sameFacts = prior.projectRef === subscription.projectRef && prior.createdBy === subscription.createdBy
                    && prior.createdAt === subscription.createdAt;
                if (operation.kind === 'team/subscription-updated') {
                    if (!sameFacts || prior.revision !== operation.data.previousRevision || subscription.revision !== prior.revision + 1
                        || subscription.state !== prior.state || subscription.pausedReason !== prior.pausedReason) {
                        throw new Error(`${at} does not move exactly the revision of its prior state`);
                    }
                    if (prior.webhook === undefined) {
                        if (subscription.webhook !== undefined
                            && (subscription.webhook.generation !== 1 || subscription.webhook.armedAt !== operation.occurredAt)) {
                            throw new Error(`${at} arms an initial webhook address outside its first generation`);
                        }
                    }
                    else if (!isDeepStrictEqual(subscription.webhook, prior.webhook)) {
                        // Only a reset moves an address; an edit keeps the one it has or drops
                        // it with the trigger, so an accepted delivery never loses its target.
                        throw new Error(`${at} moves a webhook address outside a reset`);
                    }
                }
                else if (operation.kind === 'team/subscription-webhook-reset') {
                    const priorArm = prior.webhook;
                    const arm = subscription.webhook;
                    if (!sameFacts || prior.revision !== subscription.revision || subscription.state !== prior.state
                        || subscription.pausedReason !== prior.pausedReason) {
                        throw new Error(`${at} does not reset the address of its prior state`);
                    }
                    if (priorArm === undefined || arm === undefined || arm.generation !== priorArm.generation + 1
                        || operation.data.previousGeneration !== priorArm.generation || arm.armedAt !== operation.occurredAt) {
                        throw new Error(`${at} does not arm exactly the next webhook address generation`);
                    }
                    if (arm.tokenHash === priorArm.tokenHash)
                        throw new Error(`${at} keeps the token it resets`);
                    if (subscription.name !== prior.name || !isDeepStrictEqual(subscription.triggers, prior.triggers)
                        || !isDeepStrictEqual(subscription.script, prior.script)
                        || !isDeepStrictEqual(subscription.credentials, prior.credentials)) {
                        throw new Error(`${at} changes more than the webhook address`);
                    }
                }
                else if (operation.kind === 'team/subscription-paused') {
                    if (!sameFacts || prior.revision !== subscription.revision || prior.state !== 'active'
                        || subscription.state !== 'paused'
                        || (subscription.pausedReason !== 'manual' && subscription.pausedReason !== 'failures')) {
                        throw new Error(`${at} does not pause an active subscription`);
                    }
                    expectedReason = subscription.pausedReason;
                }
                else if (operation.kind === 'team/subscription-resumed') {
                    if (!sameFacts || prior.revision !== subscription.revision || prior.state !== 'paused'
                        || subscription.state !== 'active' || subscription.pausedReason !== undefined) {
                        throw new Error(`${at} does not resume a paused subscription`);
                    }
                }
                else if (operation.kind === 'team/subscription-deleted') {
                    if (!sameFacts || prior.revision !== subscription.revision || subscription.state !== 'deleted'
                        || subscription.pausedReason !== undefined) {
                        throw new Error(`${at} does not delete the subscription it names`);
                    }
                }
            }
            if (activity.projectRef !== subscription.projectRef || activity.subscriptionRef !== subscription.subscriptionRef
                || activity.subscriptionName !== subscription.name || activity.kind !== kind
                || activity.revision !== subscription.revision || activity.actor !== actorId
                || activity.sequence !== operation.sequence || activity.occurredAt !== operation.occurredAt
                || activity.reason !== expectedReason) {
                throw new Error(`${at} has an invalid subscription activity`);
            }
            if (operation.kind === 'team/subscription-paused' && operation.data.inbox !== undefined) {
                // The recipients are the Project's owners as they stood at this commit,
                // the Human included: the Host freezes them here, never at read time.
                const owners = [human.data.humanMemberId, ...(projection.owners.get(projectRef)?.keys() ?? [])].sort();
                const notified = operation.data.inbox.mainMarkers?.added ?? [];
                if (!isDeepStrictEqual(notified.map(marker => marker.memberId).sort(), owners)
                    || notified.some(marker => marker.projectRef !== projectRef || marker.sequence !== operation.sequence
                        || !('activityRef' in marker) || marker.activityRef !== activity.activityRef)) {
                    throw new Error(`${at} does not notify exactly the Project owners`);
                }
            }
            this.addRef(refs, activity.activityRef);
            return;
        }
        if (operation.kind === 'team/subscription-baseline') {
            ownerActor();
            const target = projection.subscriptions.get(operation.data.subscriptionRef);
            if (target === undefined || target.projectRef !== projectRef)
                throw new Error(`${at} names a subscription of another Project`);
            if (target.state === 'deleted')
                throw new Error(`${at} appends to a deleted subscription`);
            const problem = subscriptionIdsProblem(operation.data.ids);
            if (problem !== undefined)
                throw new Error(`${at}: ${problem}`);
            const known = new Set(projection.subscriptionBaselines.get(target.subscriptionRef) ?? []);
            for (const entry of projection.subscriptionEvents.get(target.subscriptionRef) ?? [])
                known.add(entry.event.id);
            const repeated = operation.data.ids.find(id => known.has(id));
            if (repeated !== undefined)
                throw new Error(`${at} appends id '${repeated}', which the subscription already knows`);
            return;
        }
        const subscription = projection.subscriptions.get(operation.data.subscriptionRef);
        if (subscription === undefined || subscription.projectRef !== projectRef)
            throw new Error(`${at} names a subscription of another Project`);
        if (subscription.state === 'deleted')
            throw new Error(`${at} runs after the subscription was deleted`);
        const accepted = projection.subscriptionEvents.get(subscription.subscriptionRef) ?? [];
        if (operation.kind === 'team/subscription-events-accepted') {
            if (operation.data.subscriptionRevision < 1 || operation.data.subscriptionRevision > subscription.revision) {
                throw new Error(`${at} names a revision this subscription never had`);
            }
            if (!isScriptHash(operation.data.scriptHash))
                throw new Error(`${at} names a malformed script hash`);
            const ranRevision = projection.subscriptionScriptHistory.get(subscription.subscriptionRef)?.get(operation.data.subscriptionRevision);
            if (ranRevision !== operation.data.scriptHash) {
                throw new Error(`${at} pairs revision ${operation.data.subscriptionRevision} with a script that revision never carried`);
            }
            const pending = accepted.filter(entry => entry.publishedSequence === undefined).length;
            if (pending + operation.data.events.length > SUBSCRIPTION_PENDING_MAX)
                throw new Error(`${at} crosses the unpublished ceiling`);
            const known = new Set(projection.subscriptionBaselines.get(subscription.subscriptionRef) ?? []);
            for (const entry of accepted)
                known.add(entry.event.id);
            const problem = subscriptionRunEventsProblem(operation.data.events, known);
            if (problem !== undefined)
                throw new Error(`${at}: ${problem}`);
            return;
        }
        if (operation.kind !== 'team/subscription-event-published')
            throw new Error(`${at} is not a subscription record`);
        if (operation.data.subscriptionName !== subscription.name)
            throw new Error(`${at} names the subscription differently than it stood`);
        const source = accepted.find(entry => entry.acceptedSequence === operation.data.acceptedSequence && entry.event.id === operation.data.eventId);
        if (source === undefined)
            throw new Error(`${at} publishes an event it never accepted`);
        if (source.publishedSequence !== undefined)
            throw new Error(`${at} publishes an event twice`);
        const eventRef = `event:${operation.sequence}`;
        const published = Object.freeze({ eventRef,
            projectRef: subscription.projectRef, subscriptionRef: subscription.subscriptionRef, subscriptionName: subscription.name,
            event: source.event, acceptedSequence: source.acceptedSequence, sequence: operation.sequence, occurredAt: operation.occurredAt });
        const recipients = projection.rulesVersion >= 5
            ? subscription.notify.filter(memberId => this.notifyRecipientLiveFrom(projection, projectRef, memberId))
            : [human.data.humanMemberId, ...([...projection.owners.get(projectRef)?.keys() ?? []].sort())];
        const expected = this.inboxDelta([], [], [], [], [], [], recipients.map(memberId => Object.freeze({ memberId,
            projectRef: subscription.projectRef, eventRef, sequence: operation.sequence })));
        if (!isDeepStrictEqual(operation.data.inbox, expected))
            throw new Error(`${at} does not mark exactly the event recipients of this subscription`);
        this.validateInboxDelta(operation.data.inbox, projection, refs, [], [], [], [], [], [published]);
        this.addRef(refs, eventRef);
    }
    validateMessageInbox(operation, projection) {
        const { message, mentions } = operation.data;
        const mentionedAgents = mentions.filter(memberId => projection.members.has(memberId));
        const v2 = projection.rulesVersion >= 2;
        // Top-level mentions are open to every actor; only a Member reply may not
        // pull an unfollowed Member into an existing Thread. Version 2 has no such invitation rule.
        if (!v2 && operation.actor.kind === 'member' && operation.kind === 'team/thread-replied'
            && mentionedAgents.some(memberId => !this.everParticipatedFrom(projection, message.threadRef, memberId))) {
            throw new Error('invalid Agent mention projection');
        }
        if (v2 && message.replyToMessageRef !== undefined) {
            const parent = projection.messagesByRef.get(message.replyToMessageRef);
            if (parent === undefined || parent.threadRef !== message.threadRef
                || (parent.sender !== message.sender && !mentions.includes(parent.sender)))
                throw new Error('invalid Message reply target');
        }
        const started = v2 ? []
            : operation.kind === 'team/message-sent'
                ? [this.startAttention(message.sender, message.threadRef, message.sequence, 'mention'),
                    ...mentionedAgents.map(memberId => this.startAttention(memberId, message.threadRef, message.sequence, 'mention'))]
                : mentionedAgents.filter(memberId => !this.isFollowingFrom(projection, message.threadRef, memberId))
                    .map(memberId => this.startAttention(memberId, message.threadRef, message.sequence, 'mention'));
        const markers = mentions.map(memberId => Object.freeze({ memberId, threadRef: message.threadRef,
            messageRef: message.messageRef, sequence: message.sequence }));
        const expected = this.inboxDelta(started, [], markers);
        if (!isDeepStrictEqual(operation.data.inbox, expected))
            throw new Error('invalid Message inbox projection');
    }
    validateMentions(mentions, message, projection) {
        if (mentions.includes(message.sender) || !this.sameList(mentions, [...new Set(mentions)].sort()))
            throw new Error('invalid Message mentions');
        for (const memberId of mentions)
            if (!this.validMentionTarget(projection, message.projectRef, memberId))
                throw new Error('invalid Message mention target');
    }
    validMentionTarget(projection, projectRef, memberId) {
        if (memberId === AGENT_TEAM_HUMAN_MEMBER_ID)
            return true;
        const member = projection.members.get(memberId);
        const projectWorkspaceId = projection.projects.get(projectRef)?.workspaceId;
        return member !== undefined && member.state !== 'inactive' && member.state !== 'archived'
            && projectWorkspaceId !== undefined && this.participatesInFrom(projection, memberId, projectWorkspaceId);
    }
    /**
     * Apply one committed operation to the live projection, then advance the
     * version shared-projection consumers compare against — but only when the
     * operation invalidated a scope somebody could refetch. Private read progress
     * and audit-only records (`changeScopesOf` derives no scope for them) leave it
     * where it was, so one Member's Thread read cannot make a parked Client
     * believe that something it watches changed.
     */
    applyAndAdvanceProjectionVersion(operation) {
        this.applyTo(this.state, operation);
        const scopes = this.changeScopesOf(operation);
        if (scopes === undefined || scopes.length !== 0)
            this.projectionVersion = operation.sequence;
    }
    applyTo(target, operation) {
        target.ordered.push(operation);
        target.occurredAtBySequence.set(operation.sequence, operation.occurredAt);
        target.byRequest.set(operation.requestId, operation);
        target.byOperation.set(operation.operationId, operation);
        if (operation.kind === 'team/initialized')
            return;
        if (isAuditOnlyOperation(operation))
            return;
        if (operation.kind === 'team/project-created') {
            target.projects.set(operation.data.project.projectRef, operation.data.project);
            target.memberships.set(operation.data.project.projectRef, new Set(operation.data.memberIds));
            return;
        }
        if (operation.kind === 'team/member-added') {
            target.members.set(operation.data.member.memberId, operation.data.member);
            // Creation seeds the first Workspace participation; member.workspaceId
            // stays the default Workspace the Session roots in, immutable after add.
            target.participations.set(operation.data.member.memberId, new Set([operation.data.member.workspaceId]));
            for (const projectRef of operation.data.projectRefs)
                this.addMembership(target, projectRef, operation.data.member.memberId);
            return;
        }
        if (operation.kind === 'team/member-suspended' || operation.kind === 'team/member-resumed') {
            target.members.set(operation.data.member.memberId, operation.data.member);
            return;
        }
        if (operation.kind === 'team/member-session-renewed') {
            target.members.set(operation.data.member.memberId, operation.data.member);
            target.sessionTransitions.set(operation.data.member.memberId, { previousSessionId: operation.data.previousSessionId });
            return;
        }
        if (operation.kind === 'team/rules-version-adopted') {
            target.rulesVersion = operation.data.version;
            return;
        }
        if (operation.kind === 'team/project-owner-added') {
            const owners = target.owners.get(operation.data.projectRef) ?? new Map();
            owners.set(operation.data.memberId, operation.sequence);
            target.owners.set(operation.data.projectRef, owners);
            this.recordNamed(target, operation.data.projectRef, [operation.data.memberId]);
            this.appendMainActivity(target, operation.data.activity);
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/project-owner-removed') {
            target.owners.get(operation.data.projectRef)?.delete(operation.data.memberId);
            // A removed owner was named in this Project's Main stream, so it stays a member.
            this.recordNamed(target, operation.data.projectRef, [operation.data.memberId]);
            this.appendMainActivity(target, operation.data.activity);
            this.applyReleaseSnapshot(target, operation, { ...operation.data, claims: [], activities: [] }, operation.occurredAt);
            return;
        }
        if (operation.kind === 'team/member-session-recycled') {
            target.members.set(operation.data.member.memberId, operation.data.member);
            target.sessionTransitions.set(operation.data.member.memberId, {
                previousSessionId: operation.data.previousSessionId,
                ...(operation.data.inputFromSeq === undefined ? {} : { inputFromSeq: operation.data.inputFromSeq }),
            });
            return;
        }
        if (operation.kind === 'team/member-session-rolled-over') {
            target.members.set(operation.data.member.memberId, operation.data.member);
            target.sessionTransitions.set(operation.data.member.memberId, { previousSessionId: operation.data.previousSessionId });
            return;
        }
        if (operation.kind === 'team/project-updated') {
            target.projects.set(operation.data.project.projectRef, operation.data.project);
            return;
        }
        if (operation.kind === 'team/member-updated') {
            target.members.set(operation.data.member.memberId, operation.data.member);
            return;
        }
        if (operation.kind === 'team/project-member-added') {
            this.addMembership(target, operation.data.projectRef, operation.data.memberId);
            return;
        }
        if (operation.kind === 'team/project-member-removed') {
            target.memberships.get(operation.data.projectRef)?.delete(operation.data.memberId);
            this.applyReleaseSnapshot(target, operation, operation.data, operation.occurredAt);
            return;
        }
        if (operation.kind === 'team/member-workspace-joined') {
            const workspaces = target.participations.get(operation.data.memberId) ?? new Set();
            workspaces.add(operation.data.workspaceId);
            target.participations.set(operation.data.memberId, workspaces);
            return;
        }
        if (operation.kind === 'team/member-workspace-left') {
            target.participations.get(operation.data.memberId)?.delete(operation.data.workspaceId);
            // Departure ends Project memberships inside the left Workspace — unlike
            // archival, which keeps them hidden for a possible restore.
            for (const project of target.projects.values()) {
                if (project.workspaceId !== operation.data.workspaceId)
                    continue;
                target.memberships.get(project.projectRef)?.delete(operation.data.memberId);
                target.owners.get(project.projectRef)?.delete(operation.data.memberId);
            }
            this.applyReleaseSnapshot(target, operation, operation.data, operation.occurredAt);
            return;
        }
        if (operation.kind === 'team/project-archived') {
            // Archival keeps Memberships: hidden state, not departure — a future
            // restore returns every Member to the Project. Visibility filters by
            // project state instead.
            target.projects.set(operation.data.project.projectRef, operation.data.project);
            this.applyReleaseSnapshot(target, operation, operation.data, operation.occurredAt);
            return;
        }
        if (operation.kind === 'team/member-removed') {
            target.members.set(operation.data.member.memberId, operation.data.member);
            for (const membership of target.memberships.values())
                membership.delete(operation.data.member.memberId);
            for (const owners of target.owners.values())
                owners.delete(operation.data.member.memberId);
            this.dropMainAttention(target, operation.data.member.memberId);
            this.applyReleaseSnapshot(target, operation, operation.data, operation.occurredAt);
            return;
        }
        if (operation.kind === 'team/member-archived') {
            // Archival keeps Memberships: hidden state, not departure — a future
            // restore returns the Member to its Projects. Visibility filters by
            // member state instead. Ownership is a responsibility, not membership: it ends here.
            target.members.set(operation.data.member.memberId, operation.data.member);
            for (const owners of target.owners.values())
                owners.delete(operation.data.member.memberId);
            this.dropMainAttention(target, operation.data.member.memberId);
            this.applyReleaseSnapshot(target, operation, operation.data, operation.occurredAt);
            return;
        }
        if (operation.kind === 'team/thread-promoted') {
            this.appendActivityFact(target, operation.data.activity, operation.occurredAt);
            this.recordTaskSnapshot(target, operation.data.task.taskRef, operation.data.task, operation.sequence);
            target.threads.set(operation.data.thread.threadRef, operation.data.thread);
            this.recordTaskNumber(target, operation.data.task);
            this.recordAttentionObservations(target, operation, operation.data.inbox);
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/message-sent' || operation.kind === 'team/thread-replied') {
            const { message, mentions } = operation.data;
            this.recordMentions(target, message.messageRef, message.projectRef, mentions);
            this.appendMessageFact(target, message, mentions, message.occurredAt ?? operation.occurredAt);
            if (operation.data.task !== undefined)
                this.recordTaskSnapshot(target, operation.data.task.taskRef, operation.data.task, operation.sequence);
            target.threads.set(operation.data.thread.threadRef, operation.data.thread);
            if (message.topLevel) {
                target.projectRefByThread.set(message.threadRef, message.projectRef);
                // The anchor is the Thread's first topLevel Message; a later topLevel
                // Message must not displace it.
                if (!target.anchorByThread.has(message.threadRef))
                    target.anchorByThread.set(message.threadRef, message);
            }
            // Only message-sent mints a Task ordinal; thread-replied may echo the
            // Task without renumbering it.
            if (operation.kind === 'team/message-sent' && operation.data.task !== undefined)
                this.recordTaskNumber(target, operation.data.task);
            if (operation.kind === 'team/message-sent')
                this.appendMainSource(target, message.projectRef, { kind: 'thread', sequence: message.sequence, threadRef: message.threadRef, unreadable: false });
            this.recordAttentionObservations(target, operation, operation.data.inbox);
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/thread-started') {
            const { anchor, mentions, task, thread } = operation.data;
            this.recordMentions(target, anchor.messageRef, anchor.projectRef, mentions);
            this.appendMessageFact(target, anchor, mentions, anchor.occurredAt ?? operation.occurredAt);
            if (operation.data.activity !== undefined)
                this.appendActivityFact(target, operation.data.activity, operation.occurredAt);
            if (task !== undefined) {
                this.recordTaskSnapshot(target, task.taskRef, task, operation.sequence);
                this.recordTaskNumber(target, task);
            }
            target.threads.set(thread.threadRef, thread);
            target.projectRefByThread.set(anchor.threadRef, anchor.projectRef);
            target.anchorByThread.set(anchor.threadRef, anchor);
            this.appendMainSource(target, anchor.projectRef, { kind: 'thread', sequence: anchor.sequence, threadRef: anchor.threadRef,
                unreadable: operation.data.kind === 'discussion', hidden: task !== undefined && task.sourceThreadRefs.length > 0 });
            this.recordAttentionObservations(target, operation, operation.data.inbox);
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/main-message-posted') {
            const { message, mentions } = operation.data;
            this.recordMentions(target, message.messageRef, message.projectRef, mentions);
            this.appendMainSource(target, message.projectRef, { kind: 'message', sequence: message.sequence, message });
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/main-stream-read') {
            // The reader's own Main stream Attention row is the watermark: the delta
            // carries it, so replay re-derives the same standing without an owner test.
            // The Human's attention is derived, so its read watermark is the one piece
            // the projection stores.
            if (operation.data.memberId === AGENT_TEAM_HUMAN_MEMBER_ID) {
                const floor = this.humanMainAttentionFrom(target, operation.data.projectRef)?.readThroughSequence ?? 0;
                target.humanMainWatermarks.set(operation.data.projectRef, Math.max(floor, operation.data.readThroughSequence));
            }
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/claim-created' || operation.kind === 'team/claim-done' || operation.kind === 'team/claim-released') {
            if (operation.kind === 'team/claim-created')
                target.claimCreatedSequenceByRef.set(operation.data.claim.claimRef, operation.sequence);
            this.upsertClaimKeepingPosition(target, operation.data.claim);
            this.appendActivityFact(target, operation.data.activity, operation.occurredAt);
            this.recordTaskSnapshot(target, operation.data.task.taskRef, operation.data.task, operation.sequence);
            target.threads.set(operation.data.thread.threadRef, operation.data.thread);
            this.recordAttentionObservations(target, operation, operation.data.inbox);
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/task-changed' || operation.kind === 'team/task-accountable-changed') {
            if (operation.kind === 'team/task-changed')
                for (const claim of operation.data.claims)
                    this.upsertClaimKeepingPosition(target, claim);
            this.appendActivityFact(target, operation.data.activity, operation.occurredAt);
            this.recordTaskSnapshot(target, operation.data.task.taskRef, operation.data.task, operation.sequence);
            target.threads.set(operation.data.thread.threadRef, operation.data.thread);
            this.recordAttentionObservations(target, operation, operation.data.inbox);
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/reminder-raised') {
            const key = reminderEpisodeKey(operation.data.taskRef, operation.data.kind, operation.data.recipient, operation.data.baselineSequence);
            target.reminderEpisodes.set(key, operation);
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/member-reminder-created') {
            target.memberReminders.set(operation.data.reminder.reminderRef, operation.data.reminder);
            return;
        }
        if (operation.kind === 'team/member-reminder-cancelled') {
            target.memberReminders.set(operation.data.reminder.reminderRef, operation.data.reminder);
            target.memberReminderOccurrences.delete(operation.data.reminderRef);
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/member-reminder-raised') {
            const { memberId, reminderRef, scheduledAt } = operation.data;
            const reminder = target.memberReminders.get(reminderRef);
            // A fresh occurrence starts unconsumed, whatever the occurrence it replaced did.
            target.memberReminderOccurrences.set(reminderRef, { reminderRef, memberId, scheduledAt, raisedSequence: operation.sequence });
            if (reminder !== undefined && reminder.schedule.kind === 'once') {
                target.memberReminders.set(reminderRef, { ...reminder, state: 'done' });
            }
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/member-reminder-consumed') {
            const previous = target.memberReminderOccurrences.get(operation.data.reminderRef);
            if (previous !== undefined) {
                target.memberReminderOccurrences.set(operation.data.reminderRef, { ...previous, consumedSequence: operation.sequence });
            }
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/thread-attention-changed' || operation.kind === 'team/thread-read') {
            this.recordAttentionObservations(target, operation, operation.data.inbox);
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/main-attention-changed') {
            // A Main stream Attention row is private state, not an observation log:
            // only the delta moves, so replay re-derives the same standing.
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/subscription-created' || operation.kind === 'team/subscription-updated'
            || operation.kind === 'team/subscription-paused' || operation.kind === 'team/subscription-resumed'
            || operation.kind === 'team/subscription-deleted' || operation.kind === 'team/subscription-webhook-reset') {
            const { activity } = operation.data;
            const subscription = this.subscriptionWithNotify(operation.data.subscription);
            // The creation order is the list order; an update must not move its row.
            if (!target.subscriptions.has(subscription.subscriptionRef)) {
                const refs = target.subscriptionsByProject.get(subscription.projectRef) ?? [];
                refs.push(subscription.subscriptionRef);
                target.subscriptionsByProject.set(subscription.projectRef, refs);
            }
            target.subscriptions.set(subscription.subscriptionRef, subscription);
            if (operation.kind === 'team/subscription-resumed') {
                target.subscriptionResumeSequences.set(subscription.subscriptionRef, operation.sequence);
            }
            const history = target.subscriptionScriptHistory.get(subscription.subscriptionRef) ?? new Map();
            history.set(subscription.revision, subscription.script.sha256);
            target.subscriptionScriptHistory.set(subscription.subscriptionRef, history);
            // Creation is the one entry point of the waterline besides an explicit re-baseline.
            if (operation.kind === 'team/subscription-created' && operation.data.baselineIds.length > 0) {
                target.subscriptionBaselines.set(subscription.subscriptionRef, new Set(operation.data.baselineIds));
            }
            this.appendMainActivity(target, activity);
            if (operation.kind === 'team/subscription-paused' && operation.data.inbox !== undefined) {
                this.applyInboxDelta(target, operation.data.inbox);
            }
            return;
        }
        if (operation.kind === 'team/subscription-baseline') {
            const baseline = target.subscriptionBaselines.get(operation.data.subscriptionRef) ?? new Set();
            for (const id of operation.data.ids)
                baseline.add(id);
            target.subscriptionBaselines.set(operation.data.subscriptionRef, baseline);
            return;
        }
        if (operation.kind === 'team/subscription-events-accepted') {
            const accepted = target.subscriptionEvents.get(operation.data.subscriptionRef) ?? [];
            for (const event of operation.data.events) {
                const entry = Object.freeze({ acceptedSequence: operation.sequence, event,
                    subscriptionRevision: operation.data.subscriptionRevision, scriptHash: operation.data.scriptHash, acceptedAt: operation.occurredAt });
                accepted.push(entry);
                target.acceptedEventsBySequence.set(`${operation.sequence}|${event.id}`, { subscriptionRef: operation.data.subscriptionRef, event: entry });
            }
            target.subscriptionEvents.set(operation.data.subscriptionRef, accepted);
            return;
        }
        if (operation.kind === 'team/worker-started') {
            target.workerExecutions.set(operation.data.execution.workerRef, Object.freeze({ ...operation.data.execution, state: 'running' }));
            if (operation.data.activity !== undefined)
                this.appendActivityFact(target, operation.data.activity, operation.occurredAt);
            return;
        }
        if (operation.kind === 'team/worker-steer-admitted') {
            target.workerSteerRequests.set(operation.data.requestId, this.workerSteerAdmissionOf(operation));
            return;
        }
        if (operation.kind === 'team/worker-steer-recorded') {
            const admission = target.workerSteerRequests.get(operation.data.admissionRequestId);
            if (admission === undefined)
                throw new Error('agent-team replay recorded an outcome for a steer it never admitted');
            target.workerSteerRequests.set(admission.requestId, Object.freeze({ ...admission, outcome: operation.data.outcome }));
            return;
        }
        if (operation.kind === 'team/worker-settled') {
            const prior = target.workerExecutions.get(operation.data.execution.workerRef);
            if (prior === undefined)
                throw new Error('agent-team replay settled a Worker run it never recorded');
            const { state, settledAt, nativeSessionId, nativeTurnId, nativeTurnIds, nativeInputIds, nativeStorage, stage, output, diagnostic } = operation.data.execution;
            target.workerExecutions.set(prior.workerRef, Object.freeze({ ...prior, state, settledAt,
                ...(nativeSessionId === undefined ? {} : { nativeSessionId }),
                ...(nativeTurnId === undefined ? {} : { nativeTurnId }),
                ...(nativeTurnIds === undefined ? {} : { nativeTurnIds: Object.freeze([...nativeTurnIds]) }),
                ...(nativeInputIds === undefined ? {} : { nativeInputIds: Object.freeze([...nativeInputIds]) }),
                ...(nativeStorage === undefined ? {} : { nativeStorage }),
                ...(stage === undefined ? {} : { stage }),
                ...(output === undefined ? {} : { output }),
                ...(diagnostic === undefined ? {} : { diagnostic }) }));
            if (operation.data.activity !== undefined)
                this.appendActivityFact(target, operation.data.activity, operation.occurredAt);
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        if (operation.kind === 'team/subscription-event-published') {
            const accepted = target.subscriptionEvents.get(operation.data.subscriptionRef) ?? [];
            const position = accepted.findIndex(entry => entry.acceptedSequence === operation.data.acceptedSequence && entry.event.id === operation.data.eventId);
            if (position !== -1)
                accepted[position] = Object.freeze({ ...accepted[position], publishedSequence: operation.sequence });
            const event = accepted[position]?.event;
            if (event === undefined)
                throw new Error('agent-team replay published an event it never accepted');
            const published = Object.freeze({
                eventRef: `event:${operation.sequence}`,
                projectRef: operation.data.projectRef, subscriptionRef: operation.data.subscriptionRef,
                subscriptionName: operation.data.subscriptionName, event,
                acceptedSequence: operation.data.acceptedSequence, sequence: operation.sequence, occurredAt: operation.occurredAt
            });
            this.appendMainSource(target, operation.data.projectRef, { kind: 'subscription-event', sequence: operation.sequence, published });
            this.applyInboxDelta(target, operation.data.inbox);
            return;
        }
        assertUnhandledKind(operation);
    }
    /**
     * Replay the departure snapshot a releasing operation carries. The listed
     * order is replay semantics: an Activity references a Claim, and the inbox
     * delta reads the Tasks and Threads. Each caller still applies its own
     * identifying writes (member, membership, project) around this call.
     */
    applyReleaseSnapshot(target, operation, data, occurredAt) {
        this.applyReleasedClaims(target, data.claims);
        this.applyReleasedActivities(target, [...data.activities, ...data.transfers], occurredAt);
        this.applyReleasedTargets(target, data.tasks, data.threads, operation.sequence);
        this.applyReleasedInbox(target, operation, data.inbox);
    }
    applyReleasedClaims(target, claims) {
        for (const claim of claims)
            this.upsertClaimKeepingPosition(target, claim);
    }
    applyReleasedActivities(target, activities, occurredAt) {
        for (const activity of activities)
            this.appendActivityFact(target, activity, occurredAt);
    }
    applyReleasedTargets(target, tasks, threads, sequence) {
        for (const task of tasks)
            this.recordTaskSnapshot(target, task.taskRef, task, sequence);
        for (const thread of threads)
            target.threads.set(thread.threadRef, thread);
    }
    applyReleasedInbox(target, operation, inbox) {
        this.recordAttentionObservations(target, operation, inbox);
        this.applyInboxDelta(target, inbox);
    }
    /** Facts arrive in ledger sequence order, so global and per-thread lists stay sorted by append only. */
    appendMessageFact(target, message, mentions, occurredAt) {
        const fact = Object.freeze({ kind: 'message', sequence: message.sequence, message, mentions, occurredAt });
        target.orderedFacts.push(fact);
        const facts = target.factsByThread.get(message.threadRef) ?? [];
        facts.push(fact);
        target.factsByThread.set(message.threadRef, facts);
        target.messageCountByThread.set(message.threadRef, (target.messageCountByThread.get(message.threadRef) ?? 0) + 1);
        // The ref index is written in this same step, so it is exactly the set of
        // replayed Messages: a validator lookup can never reach a later record.
        target.messagesByRef.set(message.messageRef, message);
        // Participation is indexed per writer as the fact lands, so the Human
        // recent slice asks who wrote where without scanning the whole ledger.
        const written = target.threadsByWriter.get(message.sender) ?? new Set();
        written.add(message.threadRef);
        target.threadsByWriter.set(message.sender, written);
    }
    appendActivityFact(target, activity, occurredAt) {
        const fact = Object.freeze({ kind: 'activity', sequence: activity.sequence, activity, occurredAt });
        target.orderedFacts.push(fact);
        const facts = target.factsByThread.get(activity.threadRef) ?? [];
        facts.push(fact);
        target.factsByThread.set(activity.threadRef, facts);
    }
    /** Display ordinals are a per-Project creation counter; the workspace filter happens at read time. */
    recordTaskNumber(target, task) {
        const ordinal = (target.taskCountByProject.get(task.projectRef) ?? 0) + 1;
        target.taskCountByProject.set(task.projectRef, ordinal);
        target.taskNumberByTask.set(task.taskRef, ordinal);
    }
    /** One shared bucket for a Task's Claims, created on first write. */
    claimBucketFor(target, taskRef) {
        const bucket = target.claimsByTask.get(taskRef);
        if (bucket !== undefined)
            return bucket;
        const created = [];
        target.claimsByTask.set(taskRef, created);
        return created;
    }
    /**
     * Write one Claim into the projection and its Task bucket, keeping the
     * position a Claim already holds: read projections paginate by bucket order,
     * so an update must not move its Claim to the end.
     */
    upsertClaimKeepingPosition(target, claim) {
        target.claims.set(claim.claimRef, claim);
        const bucket = this.claimBucketFor(target, claim.taskRef);
        const known = bucket.findIndex(entry => entry.claimRef === claim.claimRef);
        if (known === -1)
            bucket.push(claim);
        else
            bucket[known] = claim;
    }
    /**
     * Replay-order Attention observations, appended from committed Inbox deltas
     * only (the hypothetical read projection applies its delta directly).
     *
     * Removals are evaluated before sets, exactly like the scan's loop order. A
     * removal records only when Attention existed, and a set records unless it is
     * the Thread-creating Message (initial Attention) or merely advances the same
     * follow's watermark.
     */
    recordAttentionObservations(target, operation, delta) {
        if (delta.attention.removed.length === 0 && delta.attention.set.length === 0)
            return;
        const retired = this.recordUnfollowObservations(target, operation, delta.attention.removed);
        this.recordFollowObservations(target, operation, delta.attention.set, retired);
    }
    /** Append one `unfollow` per removal that had Attention to end; returns the keys that ended. */
    recordUnfollowObservations(target, operation, removed) {
        const retired = new Set();
        for (const key of removed) {
            retired.add(this.attentionKey(key.memberId, key.threadRef));
            if (!target.attention.has(this.attentionKey(key.memberId, key.threadRef)))
                continue;
            this.appendObservation(target, key.threadRef, { sequence: operation.sequence, memberId: key.memberId, action: 'unfollow' });
        }
        return retired;
    }
    /** Append one `follow` for each set that starts a new Attention rather than restating an existing one. */
    recordFollowObservations(target, operation, set, retired) {
        for (const next of set) {
            const prior = retired.has(this.attentionKey(next.memberId, next.threadRef)) ? undefined : target.attention.get(this.attentionKey(next.memberId, next.threadRef));
            if (operation.kind === 'team/message-sent' || operation.kind === 'team/thread-started' || (prior !== undefined && prior.startSequence === next.startSequence))
                continue;
            this.appendObservation(target, next.threadRef, { sequence: operation.sequence, memberId: next.memberId, action: 'follow' });
        }
    }
    appendObservation(target, threadRef, observation) {
        const observations = target.observationsByThread.get(threadRef) ?? [];
        observations.push(Object.freeze(observation));
        target.observationsByThread.set(threadRef, observations);
    }
    applyInboxDelta(target, delta) {
        for (const key of delta.attention.removed) {
            target.attention.delete(this.attentionKey(key.memberId, key.threadRef));
            const followers = target.attentionByThread.get(key.threadRef);
            if (followers !== undefined) {
                followers.delete(key.memberId);
                if (followers.size === 0)
                    target.attentionByThread.delete(key.threadRef);
            }
            const threads = target.attentionThreadsByMember.get(key.memberId);
            if (threads !== undefined) {
                threads.delete(key.threadRef);
                if (threads.size === 0)
                    target.attentionThreadsByMember.delete(key.memberId);
            }
        }
        for (const attention of delta.attention.set) {
            target.attention.set(this.attentionKey(attention.memberId, attention.threadRef), attention);
            const followers = target.attentionByThread.get(attention.threadRef) ?? new Set();
            followers.add(attention.memberId);
            target.attentionByThread.set(attention.threadRef, followers);
            const threads = target.attentionThreadsByMember.get(attention.memberId) ?? new Set();
            threads.add(attention.threadRef);
            target.attentionThreadsByMember.set(attention.memberId, threads);
        }
        for (const marker of delta.directMarkers.removed) {
            target.directMarkers.delete(this.directMarkerKey(marker));
            this.removeBucketedMarker(target.directMarkersByMember, marker.memberId, marker.threadRef, this.directMarkerKey(marker), candidate => this.directMarkerKey(candidate));
        }
        for (const marker of delta.directMarkers.added) {
            target.directMarkers.set(this.directMarkerKey(marker), marker);
            this.insertBucketedMarker(target.directMarkersByMember, marker.memberId, marker.threadRef, marker);
        }
        for (const marker of delta.activityMarkers.removed) {
            target.activityMarkers.delete(this.activityMarkerKey(marker));
            this.removeBucketedMarker(target.activityMarkersByMember, marker.memberId, marker.threadRef, this.activityMarkerKey(marker), candidate => this.activityMarkerKey(candidate));
        }
        for (const marker of delta.activityMarkers.added) {
            target.activityMarkers.set(this.activityMarkerKey(marker), marker);
            this.insertBucketedMarker(target.activityMarkersByMember, marker.memberId, marker.threadRef, marker);
        }
        for (const marker of delta.reminderMarkers?.removed ?? []) {
            target.reminderMarkers.delete(reminderMarkerKey(marker));
            this.removeBucketedMarker(target.reminderMarkersByMember, marker.memberId, marker.threadRef, reminderMarkerKey(marker), reminderMarkerKey);
        }
        for (const marker of delta.reminderMarkers?.added ?? []) {
            target.reminderMarkers.set(reminderMarkerKey(marker), marker);
            this.insertBucketedMarker(target.reminderMarkersByMember, marker.memberId, marker.threadRef, marker);
        }
        for (const marker of delta.memberReminderMarkers?.removed ?? []) {
            target.memberReminderMarkers.delete(memberReminderMarkerKey(marker));
            this.removeBucketedMarker(target.memberReminderMarkersByMember, marker.memberId, marker.reminderRef, memberReminderMarkerKey(marker), memberReminderMarkerKey);
        }
        for (const marker of delta.memberReminderMarkers?.added ?? []) {
            target.memberReminderMarkers.set(memberReminderMarkerKey(marker), marker);
            this.insertBucketedMarker(target.memberReminderMarkersByMember, marker.memberId, marker.reminderRef, marker);
        }
        for (const marker of delta.mainMarkers?.removed ?? []) {
            target.mainMarkers.delete(mainMarkerKey(marker));
            this.removeBucketedMarker(target.mainMarkersByMember, marker.memberId, marker.projectRef, mainMarkerKey(marker), candidate => mainMarkerKey(candidate));
        }
        for (const marker of delta.mainMarkers?.added ?? []) {
            target.mainMarkers.set(mainMarkerKey(marker), marker);
            this.insertBucketedMarker(target.mainMarkersByMember, marker.memberId, marker.projectRef, marker);
        }
        for (const key of delta.mainAttention?.removed ?? []) {
            target.mainAttention.delete(mainAttentionKey(key.memberId, key.projectRef));
        }
        for (const attention of delta.mainAttention?.set ?? []) {
            target.mainAttention.set(mainAttentionKey(attention.memberId, attention.projectRef), attention);
        }
    }
    /** Structured mentions per Message, and the Project-wide set that feeds rules-version-2 membership. */
    recordMentions(target, messageRef, projectRef, mentions) {
        target.mentionsByMessage.set(messageRef, Object.freeze([...mentions]));
        this.recordNamed(target, projectRef, mentions);
    }
    recordNamed(target, projectRef, memberIds) {
        if (memberIds.length === 0)
            return;
        const named = target.mentionedByProject.get(projectRef) ?? new Set();
        for (const memberId of memberIds)
            named.add(memberId);
        target.mentionedByProject.set(projectRef, named);
    }
    recordTaskSnapshot(target, taskRef, task, sequence) {
        const previous = target.tasks.get(taskRef);
        target.tasks.set(taskRef, task);
        if (previous?.status !== task.status)
            target.taskStatusBaselines.set(taskRef, { status: task.status, sequence });
    }
    appendMainSource(target, projectRef, source) {
        const sources = target.mainSourcesByProject.get(projectRef) ?? [];
        sources.push(source);
        target.mainSourcesByProject.set(projectRef, sources);
        if (source.kind === 'message')
            target.mainSourceByRef.set(source.message.messageRef, source);
        if (source.kind === 'activity')
            target.mainSourceByRef.set(source.activity.activityRef, source);
        if (source.kind === 'subscription-event')
            target.mainSourceByRef.set(source.published.eventRef, source);
    }
    appendMainActivity(target, activity) {
        this.appendMainSource(target, activity.projectRef, { kind: 'activity', sequence: activity.sequence, activity });
    }
    /** Departure ends every Main stream Attention this Member holds, as it ends its Thread Attention. */
    dropMainAttention(target, memberId) {
        for (const key of [...target.mainAttention.keys()]) {
            if (key.startsWith(`${memberId}|`))
                target.mainAttention.delete(key);
        }
    }
    /** Insert into the Member's Thread bucket keeping the sequence order the read path must see. */
    insertBucketedMarker(index, memberId, threadRef, marker) {
        const threads = index.get(memberId) ?? new Map();
        index.set(memberId, threads);
        const bucket = threads.get(threadRef) ?? [];
        threads.set(threadRef, bucket);
        let position = bucket.length;
        while (position > 0 && bucket[position - 1].sequence > marker.sequence)
            position -= 1;
        bucket.splice(position, 0, marker);
    }
    removeBucketedMarker(index, memberId, threadRef, key, identityOf) {
        const threads = index.get(memberId);
        const bucket = threads?.get(threadRef);
        if (bucket === undefined)
            return;
        const position = bucket.findIndex(item => identityOf(item) === key);
        if (position >= 0)
            bucket.splice(position, 1);
        if (bucket.length === 0) {
            threads.delete(threadRef);
            if (threads.size === 0)
                index.delete(memberId);
        }
    }
    prepareRead(memberId, workspaceId, request) {
        return this.prepareReadFrom(this.state, memberId, workspaceId, request);
    }
    /**
     * The Thread's head: the sequence of its last public fact. Every fact an
     * unread batch can carry sits at or below it, which is what makes it the
     * bound a confirmation may reach. It is deliberately not `thread.revision`:
     * that number fences Thread writes and moves only with the operations that
     * revise Thread state, so a fact that revises none — a bound Worker run's
     * start or ending — legitimately sits past it.
     */
    threadHeadFrom(projection, threadRef) {
        return this.threadFactsFrom(projection, threadRef).at(-1)?.sequence ?? 0;
    }
    /** Validate one Host-selected confirmation bound against the Thread it targets. */
    threadReadSelection(head, selected) {
        if (selected === undefined)
            return undefined;
        if (!Number.isInteger(selected) || selected < 0)
            throw new Error('selectedThroughSequence must be a non-negative integer');
        if (selected > head)
            throw new Error(`selectedThroughSequence ${selected} exceeds Thread head ${head}`);
        return selected;
    }
    /**
     * Derive the durable receipt of one Thread read from a prior projection: the
     * Thread it targeted, the watermark it reaches, the Attention row it writes
     * and the Inbox delta it consumes. This is the whole durable content of a
     * receipt-shaped read and the only thing `validateRecords` re-derives for
     * one; the picture derivation below builds on the same result, so the two can
     * never drift.
     */
    prepareReadReceiptFrom(projection, memberId, workspaceId, request) {
        const { task, thread, projectRef } = this.threadContextFrom(projection, workspaceId, request);
        if (memberId !== AGENT_TEAM_HUMAN_MEMBER_ID) {
            const member = projection.members.get(memberId);
            if (member === undefined || !this.participatesInProjectWorkspaceFrom(projection, projectRef, member.memberId)) {
                throw new Error(`Agent Member '${memberId}' is not authorized for Project '${projectRef}'`);
            }
            // Version-1 read receipts predate Project membership as a read gate.
            if (projection.rulesVersion >= 2)
                this.requireProjectMemberActorFrom(projection, { kind: 'member', memberId, handle: member.handle }, projectRef);
        }
        const selectedThroughSequence = this.threadReadSelection(this.threadHeadFrom(projection, thread.threadRef), request.selectedThroughSequence);
        const attention = this.attentionForFrom(projection, memberId, thread.threadRef);
        const unread = this.unreadForFrom(projection, memberId, thread.threadRef);
        // The default batch is fixed at 20. A Host selection only takes a prefix of
        // that batch, so a continuing reader can never skip an incomplete fact or
        // reach past the bounded batch in one read.
        const batch = selectedThroughSequence === undefined
            ? unread.slice(0, 20)
            : unread.slice(0, 20).filter(item => item.fact.sequence <= selectedThroughSequence);
        // Direct markers are sparse acknowledgements, not part of the contiguous
        // follower watermark. Consuming an old marker after a later follow must
        // never move that watermark backwards.
        const ordinaryUnread = batch.filter(item => item.fact.sequence >= (attention?.startSequence ?? Number.MAX_SAFE_INTEGER)
            && this.visibleToFollower(item.fact, memberId));
        const readThroughSequence = Math.max(attention?.readThroughSequence ?? 0, ordinaryUnread.at(-1)?.fact.sequence ?? 0);
        const nextAttention = attention === undefined || readThroughSequence === attention.readThroughSequence ? []
            : [Object.freeze({ ...attention, readThroughSequence })];
        const consumedDirectMarkers = new Set(batch.flatMap(item => item.direct && item.fact.kind === 'message'
            ? [this.directMarkerKey({ memberId, threadRef: thread.threadRef, messageRef: item.fact.message.messageRef })] : []));
        const consumed = this.frozenMarkerSnapshot(projection, memberId, thread.threadRef)
            .filter(marker => consumedDirectMarkers.has(this.directMarkerKey(marker)));
        const activityMarkers = this.activityMarkersForFrom(projection, memberId, thread.threadRef)
            .filter(marker => batch.some(item => item.fact.kind === 'activity' && item.fact.activity.activityRef === marker.activityRef));
        // A selection that confirms no fact must not spend a Task reminder it never
        // reached. An unread-free read still confirms reminders as before, and a
        // selection that reaches at least one fact confirms them normally.
        const withholdsMarkers = selectedThroughSequence !== undefined && batch.length === 0 && unread.length > 0;
        const reminderMarkers = withholdsMarkers ? [] : this.reminderMarkersForFrom(projection, memberId, thread.threadRef);
        const inbox = this.inboxDelta(nextAttention, [], [], consumed, [], activityMarkers, [], [], [], reminderMarkers);
        return Object.freeze({ ...(task === undefined ? {} : { task }), thread, unread, batch,
            ...(selectedThroughSequence === undefined ? {} : { selectedThroughSequence }),
            reminders: this.remindersFor(memberId, thread.threadRef),
            ...(attention === undefined ? {} : { attentionBefore: attention }), readThroughSequence,
            ...(attention === undefined ? {} : { attention: nextAttention[0] ?? attention }),
            consumedDirectMarkers: Object.freeze(consumed), inbox });
    }
    /** Derive the only legal durable result of one Thread read from a prior projection. */
    prepareReadFrom(projection, memberId, workspaceId, request) {
        const receipt = this.prepareReadReceiptFrom(projection, memberId, workspaceId, request);
        const { task, thread } = receipt;
        const anchor = this.threadAnchorFrom(projection, thread.threadRef);
        // The first read of a Thread after following also shows the bounded
        // background that preceded the follow, so a reader sees what they joined.
        const firstRead = receipt.attentionBefore !== undefined && receipt.attentionBefore.readThroughSequence < receipt.attentionBefore.startSequence;
        const unreadFactKeys = new Set(receipt.unread.map(item => this.threadFactKey(item.fact)));
        const background = firstRead
            ? this.threadFactsFrom(projection, thread.threadRef)
                .filter((fact) => fact.kind === 'message'
                && fact.sequence < receipt.attentionBefore.startSequence)
                .map(fact => Object.freeze({ kind: 'message', sequence: fact.sequence, message: fact.message,
                mentions: projection.mentionsByMessage.get(fact.message.messageRef) ?? [],
                occurredAt: this.occurredAtForFactFrom(projection, fact.sequence, fact.message.occurredAt) }))
                .filter(fact => !unreadFactKeys.has(this.threadFactKey(fact))).slice(-12)
            : [];
        const combined = [...background.map(fact => this.readFactFrom(projection, memberId, fact, false)), ...receipt.batch]
            .sort((left, right) => left.fact.sequence - right.fact.sequence);
        const remainingUnreadCount = this.remainingUnreadAfter(projection, memberId, receipt);
        // What this bounded read leaves behind it: the Thread facts that precede the
        // watermark it reaches, which is where this reader now stands in the Thread
        // and how much of it that position has never shown it. Anchoring on the
        // watermark rather than on the response's own oldest fact is what keeps a
        // returning reader honest — the background window starts at the Thread's
        // first fact whenever the Thread is short enough to fit it, so measuring
        // from the response would report nothing behind a reader that has in fact
        // never read the Thread. Derived from the projection the read resolved
        // against, like every other field of this picture, so a replay re-derives
        // the same number.
        const earlierFactCount = this.threadFactsFrom(projection, thread.threadRef)
            .filter(fact => fact.sequence < receipt.readThroughSequence).length;
        return Object.freeze({ ...receipt, claims: task === undefined ? Object.freeze([]) : this.claimsForTaskFrom(projection, task.taskRef), anchor,
            anchorMentions: projection.mentionsByMessage.get(anchor.messageRef) ?? [],
            facts: Object.freeze(combined), remainingUnreadCount, earlierFactCount });
    }
    readFactFrom(projection, memberId, fact, unread) {
        // A direct fact is one the reader was personally summoned to: a mention
        // marker on a Message, or the activity marker a responsibility event
        // minted for their role. Both render as the Inbox's direct class.
        const direct = fact.kind === 'message'
            ? projection.directMarkers.has(this.directMarkerKey({ memberId, threadRef: fact.message.threadRef,
                messageRef: fact.message.messageRef, sequence: fact.sequence }))
            : projection.activityMarkers.has(this.activityMarkerKey({ memberId, threadRef: fact.activity.threadRef,
                activityRef: fact.activity.activityRef, sequence: fact.sequence }));
        return Object.freeze({ fact, unread, direct });
    }
    unreadFor(memberId, threadRef) {
        const readSet = this.notificationReadSet;
        if (readSet?.memberId === memberId && readSet.facts.has(threadRef))
            return readSet.facts.get(threadRef);
        const facts = this.unreadForFrom(this.state, memberId, threadRef);
        if (readSet?.memberId === memberId)
            readSet.facts.set(threadRef, facts);
        return facts;
    }
    unreadForFrom(projection, memberId, threadRef) {
        const attention = this.attentionForFrom(projection, memberId, threadRef);
        const directKeys = new Set(this.frozenMarkerSnapshot(projection, memberId, threadRef).map(marker => this.directMarkerKey(marker)));
        const activityKeys = new Set(this.activityMarkersForFrom(projection, memberId, threadRef).map(marker => this.activityMarkerKey(marker)));
        const result = [];
        for (const fact of this.threadFactsFrom(projection, threadRef)) {
            if (this.isUnreadFact(fact, memberId, threadRef, attention, directKeys, activityKeys)) {
                result.push(this.readFactFrom(projection, memberId, fact, true));
            }
        }
        return Object.freeze(result);
    }
    /**
     * The single authority on "this fact is unread for this reader". The picture
     * derivation and the remaining-count derivation both go through it, so the
     * count a read reports can never disagree with the facts it lists. Marker
     * membership arrives as key sets: the caller may be looking at a state the
     * projection has not applied yet.
     */
    isUnreadFact(fact, memberId, threadRef, attention, directKeys, activityKeys) {
        const marker = fact.kind === 'message' && directKeys.has(this.directMarkerKey({ memberId, threadRef,
            messageRef: fact.message.messageRef, sequence: fact.sequence }));
        const activityMarker = fact.kind === 'activity' && activityKeys.has(this.activityMarkerKey({ memberId, threadRef,
            activityRef: fact.activity.activityRef, sequence: fact.sequence }));
        const ordinary = attention !== undefined && fact.sequence >= attention.startSequence
            && fact.sequence > attention.readThroughSequence && this.visibleToFollower(fact, memberId);
        return marker || activityMarker || ordinary;
    }
    /**
     * Unread count once this read's own Inbox delta has been applied, derived
     * without materializing a hypothetical projection. The delta can only touch
     * the reader's own Attention row and its own marker keys in one Thread, and
     * every lookup in `isUnreadFact` is scoped to that same (member, Thread)
     * pair, so the post-delta state is the Attention row the receipt already
     * derived plus those marker keys with the delta's own removals and additions
     * applied.
     */
    remainingUnreadAfter(projection, memberId, receipt) {
        const threadRef = receipt.thread.threadRef;
        const directKeys = new Set(this.frozenMarkerSnapshot(projection, memberId, threadRef).map(marker => this.directMarkerKey(marker)));
        for (const marker of receipt.inbox.directMarkers.removed)
            directKeys.delete(this.directMarkerKey(marker));
        for (const marker of receipt.inbox.directMarkers.added)
            directKeys.add(this.directMarkerKey(marker));
        const activityKeys = new Set(this.activityMarkersForFrom(projection, memberId, threadRef).map(marker => this.activityMarkerKey(marker)));
        for (const marker of receipt.inbox.activityMarkers.removed)
            activityKeys.delete(this.activityMarkerKey(marker));
        for (const marker of receipt.inbox.activityMarkers.added)
            activityKeys.add(this.activityMarkerKey(marker));
        let count = this.liveReminderMarkersFrom(projection, memberId, threadRef)
            .filter(marker => !receipt.inbox.reminderMarkers?.removed.some(removed => reminderMarkerKey(removed) === reminderMarkerKey(marker))).length;
        for (const marker of receipt.inbox.reminderMarkers?.added ?? []) {
            if (!this.reminderMarkersForFrom(projection, memberId, threadRef).some(current => reminderMarkerKey(current) === reminderMarkerKey(marker)))
                count += 1;
        }
        for (const fact of this.threadFactsFrom(projection, threadRef)) {
            if (this.isUnreadFact(fact, memberId, threadRef, receipt.attention, directKeys, activityKeys))
                count += 1;
        }
        return count;
    }
    visibleToFollower(fact, memberId) {
        const sender = fact.kind === 'message' ? fact.message.sender : fact.activity.actor;
        return sender !== memberId;
    }
    threadFacts(threadRef) {
        return this.threadFactsFrom(this.state, threadRef);
    }
    threadFactsFrom(projection, threadRef) {
        return projection.factsByThread.get(threadRef) ?? [];
    }
    /**
     * Check a receipt against its own independent derivation: the progress it
     * claims and the Inbox delta it consumed, nothing else. The picture and the
     * unread count left behind are projection state a replay re-derives for the
     * surfaces that need them, not content of this record. The Task ref is
     * derived rather than copied back, so a Task Thread read cannot drop the Task
     * it belongs to and shrink its own claim unchecked.
     */
    validateThreadReadReceipt(data, projection, target) {
        const expected = this.prepareReadReceiptFrom(projection, data.memberId, data.workspaceId, {
            ...target,
            ...(data.selectedThroughSequence === undefined ? {} : { selectedThroughSequence: data.selectedThroughSequence }),
        });
        const expectedData = Object.freeze({ workspaceId: data.workspaceId, memberId: data.memberId, threadRef: data.threadRef,
            ...(expected.task === undefined ? {} : { taskRef: expected.task.taskRef }),
            readThroughSequence: expected.readThroughSequence,
            ...(expected.selectedThroughSequence === undefined ? {} : { selectedThroughSequence: expected.selectedThroughSequence }),
            inbox: expected.inbox });
        if (!isDeepStrictEqual(data, expectedData))
            throw new Error('invalid Thread read receipt');
    }
    /**
     * Check a pre-receipt snapshot against the same derivation that wrote it. That
     * shape is frozen: a field added to a read afterwards, like the orientation
     * count, is deliberately not compared, because no stored record carries it and
     * expecting one would reject every ledger written before the field existed.
     */
    validateLegacyThreadReadSnapshot(data, projection, target) {
        const expected = this.prepareReadFrom(projection, data.memberId, data.workspaceId, target);
        const expectedData = Object.freeze({ workspaceId: data.workspaceId, memberId: data.memberId,
            ...(expected.task === undefined ? {} : { task: expected.task }), thread: expected.thread, claims: expected.claims, anchor: expected.anchor,
            anchorMentions: expected.anchorMentions, facts: expected.facts,
            readThroughSequence: expected.readThroughSequence, remainingUnreadCount: expected.remainingUnreadCount,
            ...(expected.attention === undefined ? {} : { attention: expected.attention }), inbox: expected.inbox });
        // Snapshot reads predate responsibility events, so their activity facts
        // were flagged direct by the mention-only rule of the era that wrote them;
        // replay judges those flags by that rule, not by today's.
        const eraDirect = (facts) => facts.map(entry => (entry.fact.kind === 'activity' && entry.direct ? { ...entry, direct: false } : entry));
        const stripSource = (snapshot) => ({
            ...snapshot,
            ...(snapshot.attention === undefined ? {} : { attention: (() => {
                    const { source: _source, ...attention } = snapshot.attention;
                    return attention;
                })() }),
            inbox: { ...snapshot.inbox, attention: { ...snapshot.inbox.attention,
                    set: snapshot.inbox.attention.set.map(attention => {
                        const { source: _source, ...rest } = attention;
                        return rest;
                    }) } },
        });
        const stored = stripSource({ ...data, facts: eraDirect(data.facts) });
        const derived = stripSource({ ...expectedData, facts: eraDirect(expectedData.facts) });
        if (!isDeepStrictEqual(stored, derived)) {
            throw new Error('invalid Thread read projection');
        }
    }
    occurredAtForFactFrom(projection, sequence, fallback) {
        if (fallback !== undefined)
            return fallback;
        return projection.occurredAtBySequence.get(sequence) ?? '';
    }
    messageInboxDelta(message, sender, mentions, attention) {
        const markers = mentions.map(memberId => Object.freeze({ memberId, threadRef: message.threadRef,
            messageRef: message.messageRef, sequence: message.sequence }));
        return this.inboxDelta(attention, [], markers);
    }
    closeThreadInbox(activity, threadRef) {
        return this.closeThreadInboxFrom(this.state, activity, threadRef);
    }
    closeThreadInboxFrom(projection, activity, threadRef) {
        const recipients = new Set([...projection.attention.values()]
            .filter(attention => attention.threadRef === threadRef && attention.memberId !== activity.actor)
            .map(attention => attention.memberId));
        const removed = activity.kind === 'close' ? [...projection.attention.values()].filter(attention => attention.threadRef === threadRef)
            .map(attention => Object.freeze({ memberId: attention.memberId, threadRef: attention.threadRef })) : [];
        const activityMarkers = [...recipients].map(memberId => Object.freeze({ memberId, threadRef,
            activityRef: activity.activityRef, sequence: activity.sequence }));
        return this.inboxDelta([], removed, [], activity.kind === 'close' ? [...projection.directMarkers.values()].filter(marker => marker.threadRef === threadRef) : [], activityMarkers, activity.kind === 'close' ? [...projection.activityMarkers.values()].filter(marker => marker.threadRef === threadRef) : [], [], [], [], activity.kind === 'close' ? [...projection.reminderMarkers.values()].filter(marker => marker.threadRef === threadRef) : []);
    }
    withReminderCleanup(delta, projection, threadRef) {
        const removed = [...projection.reminderMarkers.values()].filter(marker => marker.threadRef === threadRef);
        return removed.length === 0 ? delta : Object.freeze({ ...delta, reminderMarkers: Object.freeze({ added: Object.freeze([]), removed: Object.freeze(removed) }) });
    }
    /**
     * Acceptance notifies every done Claim owner, pre-finished (the normal
     * flow) and atomically completed (early acceptance) alike, through activity
     * markers regardless of whether they still follow the Thread. The actor
     * never notifies itself. Legacy records without the acceptance
     * discriminator keep completed-only wake semantics on replay.
     */
    acceptThreadInbox(activity, threadRef, acceptedOwners) {
        if (acceptedOwners.length === 0)
            return this.inboxDelta();
        const recipients = [...new Set(acceptedOwners)].filter(memberId => memberId !== activity.actor);
        const markers = recipients.map(memberId => Object.freeze({ memberId, threadRef,
            activityRef: activity.activityRef, sequence: activity.sequence }));
        return this.inboxDelta([], [], [], [], markers);
    }
    acceptThreadInboxFrom(projection, activity, threadRef, claimRefs) {
        if (claimRefs.length === 0)
            return this.inboxDelta();
        const owners = claimRefs.map(claimRef => projection.claims.get(claimRef)?.owner).filter(owner => owner !== undefined);
        return this.acceptThreadInbox(activity, threadRef, owners);
    }
    reopenThreadInbox(activity, threadRef) {
        return this.reopenThreadInboxFrom(this.state, activity, threadRef);
    }
    reopenThreadInboxFrom(projection, activity, threadRef) {
        const recipients = new Set([...projection.activityMarkers.values()]
            .filter(marker => marker.threadRef === threadRef).map(marker => marker.memberId));
        // The accountable owns the Task's revival regardless of Attention: a
        // close cleared their follow, so the marker is their direct wake.
        if (projection.rulesVersion >= 2) {
            const task = [...projection.tasks.values()].find(candidate => candidate.threadRef === threadRef);
            if (task !== undefined && task.accountable !== activity.actor)
                recipients.add(task.accountable);
        }
        const markers = [...recipients].map(memberId => Object.freeze({ memberId, threadRef,
            activityRef: activity.activityRef, sequence: activity.sequence }));
        const attention = activity.refollowedMembers === undefined ? []
            : activity.refollowedMembers.map(memberId => this.followAttentionFrom(projection, memberId, threadRef, 'accountable'));
        return this.inboxDelta(attention, [], [], [], markers);
    }
    promoteThreadInbox(activity, threadRef) {
        return this.promoteThreadInboxFrom(this.state, activity, threadRef);
    }
    promoteThreadInboxFrom(projection, activity, threadRef) {
        const markers = [...projection.attention.values()]
            .filter(attention => attention.threadRef === threadRef && attention.memberId !== activity.actor)
            .map(attention => Object.freeze({ memberId: attention.memberId, threadRef,
            activityRef: activity.activityRef, sequence: activity.sequence }));
        return this.inboxDelta([], [], [], [], markers);
    }
    /** `projectRefs` scopes the Main stream markers a departure clears; undefined means every Project. */
    removeMemberThreadInbox(memberId, threadRefs, projectRefs) {
        return this.removeMemberThreadInboxFrom(this.state, memberId, threadRefs, projectRefs);
    }
    removeMemberThreadInboxFrom(projection, memberId, threadRefs, projectRefs) {
        const removed = [...projection.attention.values()].filter(attention => attention.memberId === memberId && threadRefs.has(attention.threadRef))
            .map(attention => Object.freeze({ memberId, threadRef: attention.threadRef }));
        const markers = [...projection.directMarkers.values()].filter(marker => marker.memberId === memberId && threadRefs.has(marker.threadRef));
        const activityMarkers = [...projection.activityMarkers.values()].filter(marker => marker.memberId === memberId && threadRefs.has(marker.threadRef));
        const reminders = [...projection.reminderMarkers.values()].filter(marker => marker.memberId === memberId && threadRefs.has(marker.threadRef));
        return this.inboxDelta([], removed, [], markers, [], activityMarkers, [], this.mainMarkersToClear(projection, memberId, projectRefs), [], reminders);
    }
    /** Live Main stream markers a departure clears, in sequence order so write and replay derive the same list. */
    mainMarkersToClear(projection, memberId, projectRefs) {
        return [...projection.mainMarkers.values()]
            .filter(marker => (memberId === undefined || marker.memberId === memberId) && (projectRefs === undefined || projectRefs.has(marker.projectRef)))
            .sort((left, right) => left.sequence - right.sequence || mainMarkerKey(left).localeCompare(mainMarkerKey(right)));
    }
    /** Attention and marker cleanup for EVERY Member on the given Threads. */
    projectArchivalInbox(threadRefs, projectRef) {
        return this.projectArchivalInboxFrom(this.state, threadRefs, projectRef);
    }
    projectArchivalInboxFrom(projection, threadRefs, projectRef) {
        const removed = [...projection.attention.values()].filter(attention => threadRefs.has(attention.threadRef))
            .map(attention => Object.freeze({ memberId: attention.memberId, threadRef: attention.threadRef }));
        const markers = [...projection.directMarkers.values()].filter(marker => threadRefs.has(marker.threadRef));
        const activityMarkers = [...projection.activityMarkers.values()].filter(marker => threadRefs.has(marker.threadRef));
        const reminders = [...projection.reminderMarkers.values()].filter(marker => threadRefs.has(marker.threadRef));
        return this.inboxDelta([], removed, [], markers, [], activityMarkers, [], this.mainMarkersToClear(projection, undefined, new Set([projectRef])), [], reminders);
    }
    inboxDelta(set = [], removed = [], addedMarkers = [], removedMarkers = [], addedActivityMarkers = [], removedActivityMarkers = [], addedMainMarkers = [], removedMainMarkers = [], addedReminderMarkers = [], removedReminderMarkers = [], setMainAttention = [], removedMainAttention = [], addedMemberReminderMarkers = [], removedMemberReminderMarkers = []) {
        return Object.freeze({
            attention: Object.freeze({ set: Object.freeze(set), removed: Object.freeze(removed) }),
            directMarkers: Object.freeze({ added: Object.freeze(addedMarkers), removed: Object.freeze(removedMarkers) }),
            activityMarkers: Object.freeze({ added: Object.freeze(addedActivityMarkers), removed: Object.freeze(removedActivityMarkers) }),
            ...(addedReminderMarkers.length === 0 && removedReminderMarkers.length === 0 ? {}
                : { reminderMarkers: Object.freeze({ added: Object.freeze(addedReminderMarkers), removed: Object.freeze(removedReminderMarkers) }) }),
            // Absent unless it changes something, so every delta written before Member reminders existed keeps its stored bytes.
            ...(addedMemberReminderMarkers.length === 0 && removedMemberReminderMarkers.length === 0 ? {}
                : { memberReminderMarkers: Object.freeze({ added: Object.freeze(addedMemberReminderMarkers), removed: Object.freeze(removedMemberReminderMarkers) }) }),
            // Absent unless it changes something: a rules-version-1 delta keeps its stored bytes.
            ...(addedMainMarkers.length === 0 && removedMainMarkers.length === 0 ? {}
                : { mainMarkers: Object.freeze({ added: Object.freeze(addedMainMarkers), removed: Object.freeze(removedMainMarkers) }) }),
            // Absent unless it changes something, so every delta written before Main stream Attention existed keeps its stored bytes.
            ...(setMainAttention.length === 0 && removedMainAttention.length === 0 ? {}
                : { mainAttention: Object.freeze({ set: Object.freeze(setMainAttention), removed: Object.freeze(removedMainAttention) }) }),
        });
    }
    /** A delta that moves only Member reminder markers; every other family stays untouched. */
    memberReminderInboxDelta(added = [], removed = []) {
        return this.inboxDelta([], [], [], [], [], [], [], [], [], [], [], [], added, removed);
    }
    /** A Thread Attention period starting at `startSequence`, established by `source`. */
    startAttention(memberId, threadRef, startSequence, source) {
        return Object.freeze({ memberId, threadRef, startSequence, readThroughSequence: Math.max(0, startSequence - 1), source });
    }
    /** A Thread Attention period starting after everything the Thread holds now, so it inherits no backlog. */
    followAttention(memberId, threadRef, source) {
        return this.followAttentionFrom(this.state, memberId, threadRef, source);
    }
    followAttentionFrom(projection, memberId, threadRef, source) {
        const tail = this.threadFactsFrom(projection, threadRef).at(-1)?.sequence ?? 1;
        return this.startAttention(memberId, threadRef, tail + 1, source);
    }
    currentTail(threadRef) {
        return this.threadFacts(threadRef).at(-1)?.sequence ?? 1;
    }
    /**
     * A Main stream Attention period anchored at `sequence`: the reader saw
     * everything before it and nothing after. An explicit follow anchors at the
     * stream's current tail, so a new follower inherits no backlog; an ownership
     * grant anchors at the grant itself.
     */
    startMainAttention(memberId, projectRef, sequence, source) {
        return Object.freeze({ memberId, projectRef, startSequence: sequence, readThroughSequence: Math.max(0, sequence - 1), source });
    }
    /**
     * The Human's Main stream Attention, derived rather than stored: the Human
     * owns every Project without a stored grant, so its Main stream attention is
     * the one identity-derived fact that survives — it starts at the Project's
     * creation and is advanced only by its own reads. Every other Member's comes
     * from its own durable row.
     */
    humanMainAttentionFrom(projection, projectRef) {
        const project = projection.projects.get(projectRef);
        if (project === undefined)
            return undefined;
        const readThrough = Math.max(project.createdAtSequence - 1, projection.humanMainWatermarks.get(projectRef) ?? 0);
        return Object.freeze({ memberId: AGENT_TEAM_HUMAN_MEMBER_ID, projectRef, startSequence: project.createdAtSequence, readThroughSequence: readThrough, source: 'project-owner' });
    }
    mainAttentionForFrom(projection, memberId, projectRef) {
        return memberId === AGENT_TEAM_HUMAN_MEMBER_ID
            ? this.humanMainAttentionFrom(projection, projectRef)
            : projection.mainAttention.get(mainAttentionKey(memberId, projectRef));
    }
    /**
     * The Main stream Attention row a withdrawn ownership grant created, or nothing.
     * Only `project-owner` rows end with the grant: a Member that followed on its
     * own holds a `self` row, and that following — with its read progress — is not
     * the grant's to end. The Human's derived row is never stored, and the Human is
     * never removed as owner.
     */
    grantedMainAttentionEnds(projection, memberId, projectRef) {
        const stored = projection.mainAttention.get(mainAttentionKey(memberId, projectRef));
        return stored?.source === 'project-owner' ? [Object.freeze({ memberId, projectRef })] : [];
    }
    isFollowingMainFrom(projection, projectRef, memberId) {
        return this.mainAttentionForFrom(projection, memberId, projectRef) !== undefined;
    }
    /**
     * Everyone whose Main stream Attention covers one Project: the stored rows
     * plus the Human, whose row is derived from owning the Project. Membership is
     * re-checked, because a row survives the departure that should have ended it
     * and a departed Member must not be woken for a stream it can no longer read.
     */
    mainStreamRecipientsFrom(projection, projectRef) {
        if (!projection.projects.has(projectRef))
            return [];
        const found = new Set([AGENT_TEAM_HUMAN_MEMBER_ID]);
        for (const attention of projection.mainAttention.values()) {
            if (attention.projectRef !== projectRef)
                continue;
            if (!this.isProjectMemberFrom(projection, projectRef, attention.memberId))
                continue;
            found.add(attention.memberId);
        }
        return [...found];
    }
    attentionFor(memberId, threadRef) {
        return this.attentionForFrom(this.state, memberId, threadRef);
    }
    attentionForFrom(projection, memberId, threadRef) {
        return projection.attention.get(this.attentionKey(memberId, threadRef));
    }
    isFollowing(threadRef, memberId) {
        return this.attentionFor(memberId, threadRef) !== undefined;
    }
    isFollowingFrom(projection, threadRef, memberId) {
        return this.attentionForFrom(projection, memberId, threadRef) !== undefined;
    }
    directMarkersFor(memberId, threadRef) {
        return this.frozenMarkerSnapshot(this.state, memberId, threadRef);
    }
    /** One Member's live Inbox markers for one Thread, snapshotted so a caller cannot freeze the live bucket's array. */
    frozenMarkerSnapshot(projection, memberId, threadRef) {
        const markers = projection.directMarkersByMember.get(memberId)?.get(threadRef);
        return markers === undefined ? [] : Object.freeze([...markers]);
    }
    reminderMarkersForFrom(projection, memberId, threadRef) {
        const markers = projection.reminderMarkersByMember.get(memberId)?.get(threadRef);
        return markers === undefined ? [] : Object.freeze([...markers]);
    }
    /** Current conditions decide whether a durable reminder still deserves a row or a wake; stale markers stay stored until a Task read or lifecycle cleanup. */
    liveReminderMarkersFrom(projection, memberId, threadRef) {
        return this.reminderMarkersForFrom(projection, memberId, threadRef).filter(marker => {
            const task = projection.tasks.get(marker.taskRef);
            const episode = projection.reminderEpisodes.get(reminderEpisodeKey(marker.taskRef, marker.kind, memberId, marker.baselineSequence));
            if (task === undefined || task.resolution !== 'open' || this.visibleProject(projection.projects.get(task.projectRef)) === undefined)
                return false;
            if (marker.kind === 'review-backlog') {
                return task.status === 'in_review'
                    && projection.taskStatusBaselines.get(task.taskRef)?.sequence === marker.baselineSequence
                    && this.verifierOfFrom(projection, task) === memberId;
            }
            return task.status === 'in_progress' && marker.memberId === task.accountable
                && (projection.factsByThread.get(task.threadRef)?.at(-1)?.sequence ?? 0) <= marker.baselineSequence
                && (episode?.sequence ?? marker.sequence) === marker.sequence;
        });
    }
    remindersFor(memberId, threadRef) {
        return Object.freeze(this.liveReminderMarkersFrom(this.state, memberId, threadRef).map(marker => Object.freeze({
            taskRef: marker.taskRef, kind: marker.kind, recipient: marker.memberId, baselineSequence: marker.baselineSequence,
            sequence: marker.sequence, occurredAt: this.state.occurredAtBySequence.get(marker.sequence) ?? '',
        })));
    }
    activityMarkersForFrom(projection, memberId, threadRef) {
        const markers = projection.activityMarkersByMember.get(memberId)?.get(threadRef);
        return markers === undefined ? [] : Object.freeze([...markers]);
    }
    assertMentionTargets(project, recipients) {
        for (const memberId of recipients) {
            if (memberId === AGENT_TEAM_HUMAN_MEMBER_ID)
                continue;
            const member = this.requireMember(memberId);
            if (member.state === 'inactive' || member.state === 'archived' || !this.participatesIn(member.memberId, project.workspaceId)) {
                throw new Error(`Agent Member '${memberId}' is not authorized for Project '${project.projectRef}'`);
            }
        }
    }
    requireRulesVersion2(what) {
        if (this.state.rulesVersion < 2)
            throw new Error(`${what} needs rules version 2; this ledger runs version ${this.state.rulesVersion}`);
    }
    requireProjectMemberActor(actor, projectRef) {
        this.requireProjectMemberActorFrom(this.state, actor, projectRef);
    }
    requireProjectMemberActorFrom(projection, actor, projectRef) {
        if (actor.kind === 'member' && !this.isProjectMemberFrom(projection, projectRef, actor.memberId)) {
            throw new Error(`Agent Member '${actor.handle}' is not a member of Project '${projectRef}' (not_project_member) — ${recoveryFor('not_project_member').sentence({ projectRef })}`);
        }
    }
    resolveAccountable(projectRef, actor, requested) {
        const accountable = requested ?? (actor.kind === 'member' ? actor.memberId : AGENT_TEAM_HUMAN_MEMBER_ID);
        if (accountable !== AGENT_TEAM_HUMAN_MEMBER_ID) {
            const member = this.requireMember(accountable);
            if (member.state !== 'enabled' || !this.isProjectOwnerFrom(this.state, projectRef, accountable)) {
                throw new Error(`Task accountable '${member.handle}' must be an enabled Project owner or the Human (accountable_target_invalid) — ${recoveryFor('accountable_target_invalid').sentence({})}`);
            }
        }
        return accountable;
    }
    /**
     * Who a transfer may hand a Task to. Creating a Task still names an owner, so responsibility reaches a plain
     * Project member only through this move; version 3 therefore asks the narrower question, whether the target
     * still takes part in the Project, and not whether it owns it. Following the Thread is never part of it.
     */
    resolveTransferTarget(projectRef, requested) {
        const member = this.requireMember(requested);
        if (member.state !== 'enabled' || !this.isProjectMemberFrom(this.state, projectRef, requested)) {
            throw new Error(`Task accountable '${member.handle}' must be an enabled Project member or the Human (accountable_target_invalid) — ${recoveryFor('accountable_target_invalid').sentence({})}`);
        }
        return requested;
    }
    validateTaskSources(projectRef, requested) {
        const sourceThreadRefs = Object.freeze([...new Set(requested ?? [])]);
        if (sourceThreadRefs.length !== (requested?.length ?? 0))
            throw new Error('sourceThreadRefs contains duplicate Threads');
        for (const threadRef of sourceThreadRefs) {
            const thread = this.state.threads.get(threadRef);
            if (thread === undefined || thread.taskRef !== undefined || this.projectRefForThreadFrom(this.state, threadRef) !== projectRef) {
                throw new Error(`source Thread '${threadRef}' must be a discussion in the Task's Project`);
            }
        }
        return sourceThreadRefs;
    }
    heldTaskClaimFrom(projection, taskRef, memberId) {
        return (projection.claimsByTask.get(taskRef) ?? []).some(claim => claim.owner === memberId);
    }
    /**
     * Whether this Task still has somewhere to be accountable: the Human, or a Member who still takes part in the
     * Project. Version 2 asked for an owner grant, which stranded a Task handed to a plain member and a Task kept by
     * a former owner who still takes part.
     */
    accountableIsValidFrom(projection, task) {
        if (task.accountable === AGENT_TEAM_HUMAN_MEMBER_ID)
            return true;
        if (projection.rulesVersion < 3)
            return this.isProjectOwnerFrom(projection, task.projectRef, task.accountable);
        return projection.members.get(task.accountable)?.state === 'enabled'
            && this.isProjectMemberFrom(projection, task.projectRef, task.accountable);
    }
    /**
     * Who may verify this Task as an Agent: a Project owner, or the accountable the Task was handed to, and never
     * anyone who ever held a Claim on it. The Human decides separately, because the Human is not an Agent actor.
     */
    canVerifyTaskFrom(projection, task, memberId) {
        if (this.heldTaskClaimFrom(projection, task.taskRef, memberId))
            return false;
        return this.isProjectOwnerFrom(projection, task.projectRef, memberId)
            || (projection.rulesVersion >= 3 && task.accountable === memberId);
    }
    /** The target a committed transfer landed on, judged by the rules the segment that wrote it ran under. */
    transferTargetIsValidFrom(projection, task) {
        if (task.accountable === AGENT_TEAM_HUMAN_MEMBER_ID)
            return true;
        if (projection.members.get(task.accountable)?.state !== 'enabled')
            return false;
        return projection.rulesVersion >= 3
            ? this.isProjectMemberFrom(projection, task.projectRef, task.accountable)
            : this.isProjectOwnerFrom(projection, task.projectRef, task.accountable);
    }
    /** The one Member this Task's review belongs to: its accountable when that Member may verify, otherwise the Human. */
    verifierOfFrom(projection, task) {
        if (task.accountable === AGENT_TEAM_HUMAN_MEMBER_ID)
            return task.accountable;
        return projection.members.get(task.accountable)?.state === 'enabled'
            && this.canVerifyTaskFrom(projection, task, task.accountable) ? task.accountable : AGENT_TEAM_HUMAN_MEMBER_ID;
    }
    /**
     * Who a Task change's responsibility marker reaches. Version 2 named the accountable, or the Human when that
     * accountable had ever held a Claim — a suspended accountable was still the member the change concerned.
     * Version 3 asks who can verify, which also moves a marker off an accountable that can no longer act. Each
     * version answers for the records it wrote, so a captured version 2 segment still replays onto its own member.
     */
    responsibilityActivityRecipientsFrom(projection, task, actor) {
        const recipients = new Set();
        if (task.status === 'in_review') {
            if (projection.rulesVersion < 3) {
                const accountableHeld = this.heldTaskClaimFrom(projection, task.taskRef, task.accountable);
                recipients.add(task.accountable === AGENT_TEAM_HUMAN_MEMBER_ID || !accountableHeld ? task.accountable : AGENT_TEAM_HUMAN_MEMBER_ID);
            }
            else
                recipients.add(this.verifierOfFrom(projection, task));
        }
        else if (task.status === 'todo')
            recipients.add(task.accountable);
        recipients.delete(actor);
        return [...recipients];
    }
    mergeResponsibilityReturn(tasks, threads, returned) {
        const taskMap = new Map(tasks.map(task => [task.taskRef, task]));
        for (const task of returned.tasks)
            taskMap.set(task.taskRef, task);
        const threadMap = new Map(threads.map(thread => [thread.threadRef, thread]));
        for (const thread of returned.threads)
            threadMap.set(thread.threadRef, thread);
        return { tasks: [...taskMap.values()], threads: [...threadMap.values()] };
    }
    /**
     * The responsibility a departing Member gives back to the Human, one transfer per open Task.
     * `keepWhenStillMember` is the owner-grant question: losing the grant is not leaving the Project, so a Member
     * that still takes part keeps its Tasks, and only the Member whose participation ends hands them back.
     */
    accountabilityReturnsFrom(projection, memberId, sequence, projectRefs, keepWhenStillMember = false) {
        const transfers = [];
        const tasks = [];
        const threads = [];
        const markers = [];
        for (const task of projection.tasks.values()) {
            if (task.accountable !== memberId || task.resolution !== 'open' || (projectRefs !== undefined && !projectRefs.has(task.projectRef)))
                continue;
            if (keepWhenStillMember && this.isProjectMemberFrom(projection, task.projectRef, memberId, true))
                continue;
            const activity = Object.freeze({ activityRef: this.ref('activity'), kind: 'transfer', taskRef: task.taskRef,
                threadRef: task.threadRef, actor: AGENT_TEAM_HUMAN_MEMBER_ID, from: memberId, to: AGENT_TEAM_HUMAN_MEMBER_ID, sequence });
            transfers.push(activity);
            tasks.push(Object.freeze({ ...task, accountable: AGENT_TEAM_HUMAN_MEMBER_ID }));
            threads.push(Object.freeze({ ...projection.threads.get(task.threadRef), revision: sequence }));
            markers.push(Object.freeze({ memberId: AGENT_TEAM_HUMAN_MEMBER_ID, threadRef: task.threadRef, activityRef: activity.activityRef, sequence }));
        }
        return { transfers, tasks, threads, markers };
    }
    responsibilityInboxDeltaFrom(projection, task, activity, actor, follow = false) {
        const recipients = new Set(this.responsibilityActivityRecipientsFrom(projection, task, actor));
        for (const attention of projection.attention.values()) {
            if (attention.threadRef === task.threadRef && attention.memberId !== actor)
                recipients.add(attention.memberId);
        }
        const attention = follow && task.accountable !== actor && !this.isFollowingFrom(projection, task.threadRef, task.accountable)
            ? [this.startAttention(task.accountable, task.threadRef, activity.sequence, 'accountable')] : [];
        return this.inboxDelta(attention, [], [], [], [...recipients].map(memberId => Object.freeze({ memberId, threadRef: task.threadRef, activityRef: activity.activityRef, sequence: activity.sequence })));
    }
    inboxDeltaForTaskResponsibility(projection, task, activity, anchor, mentions = []) {
        const attention = [this.startAttention(anchor.sender, task.threadRef, activity.sequence, 'thread-author')];
        if (task.accountable !== anchor.sender && !this.isFollowingFrom(projection, task.threadRef, task.accountable))
            attention.push(this.startAttention(task.accountable, task.threadRef, activity.sequence, 'accountable'));
        const markers = mentions.map(memberId => Object.freeze({ memberId, threadRef: task.threadRef, messageRef: anchor.messageRef, sequence: activity.sequence }));
        const responsible = task.accountable === anchor.sender ? [] : [Object.freeze({ memberId: task.accountable, threadRef: task.threadRef, activityRef: activity.activityRef, sequence: activity.sequence })];
        return this.inboxDelta(attention, [], markers, [], responsible);
    }
    requireProjectOwnerActor(actor, projectRef) {
        if (actor.kind === 'host')
            throw new Error(`a subscription write needs a Human or Agent Member actor (project_owner_required) — ${recoveryFor('project_owner_required').sentence({ projectRef })}`);
        if (actor.kind === 'member' && !this.isProjectOwnerFrom(this.state, projectRef, actor.memberId)) {
            throw new Error(`Only a Project owner can do this in Project '${projectRef}' (project_owner_required) — ${recoveryFor('project_owner_required').sentence({ projectRef })}`);
        }
    }
    /** The Human owns every Project; an Agent owns it from its grant until the grant ends. */
    isProjectOwnerFrom(projection, projectRef, memberId) {
        if (memberId === AGENT_TEAM_HUMAN_MEMBER_ID)
            return projection.projects.has(projectRef);
        return projection.owners.get(projectRef)?.has(memberId) === true;
    }
    mainSourcesFrom(projection, projectRef) {
        return projection.mainSourcesByProject.get(projectRef) ?? [];
    }
    mainHeadFrom(projection, projectRef) {
        return [...this.mainSourcesFrom(projection, projectRef).filter(source => source.kind !== 'thread' || source.hidden !== true).values()].at(-1)?.sequence ?? 0;
    }
    mainProducerFrom(projection, source) {
        if (source.kind === 'message')
            return source.message.sender;
        if (source.kind === 'activity')
            return source.activity.actor;
        // A published event belongs to a script, not to the Member who created the subscription.
        if (source.kind === 'subscription-event')
            return undefined;
        return projection.anchorByThread.get(source.threadRef)?.sender;
    }
    /**
     * One reader's unread Main stream, oldest first. Ordinary unread comes from the
     * reader's own Main stream Attention: whatever the stream holds after that
     * period's read watermark, minus what the reader produced. There is no
     * identity-derived ordinary unread, so a reader who does not follow the Main
     * stream has markers alone — exactly as a Thread reader who does not follow it.
     * Task cards and earlier-version Thread anchors are never unread.
     */
    mainUnreadFrom(projection, memberId, projectRef) {
        const found = new Map();
        const attention = this.mainAttentionForFrom(projection, memberId, projectRef);
        if (attention !== undefined) {
            const floor = attention.readThroughSequence;
            const sources = this.mainSourcesFrom(projection, projectRef);
            for (let index = sources.length - 1; index >= 0 && sources[index].sequence > floor; index -= 1) {
                const source = sources[index];
                if (source.kind === 'thread' && !source.unreadable)
                    continue;
                // A published event is addressed intelligence, not Project news: it
                // stays on the timeline for every reader (the stream remains auditable)
                // and only its recipients' markers may interrupt anyone.
                if (source.kind === 'subscription-event')
                    continue;
                if (this.mainProducerFrom(projection, source) === memberId)
                    continue;
                found.set(source.sequence, { source, ordinary: true, direct: false });
            }
        }
        for (const marker of projection.mainMarkersByMember.get(memberId)?.get(projectRef) ?? []) {
            const source = projection.mainSourceByRef.get(mainMarkerSourceRef(marker));
            if (source !== undefined)
                found.set(source.sequence, { source, ordinary: found.get(source.sequence)?.ordinary ?? false, direct: true });
        }
        return Object.freeze([...found.values()].sort((left, right) => left.source.sequence - right.source.sequence));
    }
    mainStandingFrom(projection, memberId, projectRef) {
        const unread = this.mainUnreadFrom(projection, memberId, projectRef);
        return Object.freeze({ following: this.isFollowingMainFrom(projection, projectRef, memberId),
            head: this.mainHeadFrom(projection, projectRef), unreadCount: unread.length,
            directCount: unread.filter(item => item.direct).length,
            markers: Object.freeze([...projection.mainMarkersByMember.get(memberId)?.get(projectRef) ?? []]) });
    }
    /**
     * Standing as it will read once a Main stream read through `readThrough`
     * commits, derived without materializing the committed delta. Only this
     * reader's ordinary unread and markers up to the bound can change.
     */
    mainStandingAfterRead(memberId, projectRef, readThrough) {
        const remaining = this.mainUnreadFrom(this.state, memberId, projectRef).filter(item => item.source.sequence > readThrough);
        return Object.freeze({ following: this.isFollowingMainFrom(this.state, projectRef, memberId),
            head: this.mainHeadFrom(this.state, projectRef), unreadCount: remaining.length,
            directCount: remaining.filter(item => item.direct).length,
            markers: Object.freeze([...this.state.mainMarkersByMember.get(memberId)?.get(projectRef) ?? []]
                .filter(marker => marker.sequence > readThrough)) });
    }
    /**
     * The only legal durable result of reading through `readThrough`: the markers it consumes, and whether the
     * reader's own Main stream Attention watermark moves. The watermark itself is replayed from the operation,
     * so the delta carries the Attention row and the markers alone.
     */
    prepareMainReadFrom(projection, memberId, projectRef, readThrough) {
        const unread = this.mainUnreadFrom(projection, memberId, projectRef);
        const attention = this.mainAttentionForFrom(projection, memberId, projectRef);
        const advances = attention !== undefined && readThrough > attention.readThroughSequence
            && unread.some(item => item.ordinary && item.source.sequence <= readThrough);
        const consumed = Object.freeze((projection.mainMarkersByMember.get(memberId)?.get(projectRef) ?? []).filter(marker => marker.sequence <= readThrough));
        // The Human's Attention is derived rather than stored, so its read advances
        // the stored watermark instead of a delta row; every other Member's row is
        // carried by the delta so replay re-derives the same standing.
        const inbox = memberId === AGENT_TEAM_HUMAN_MEMBER_ID
            ? this.inboxDelta([], [], [], [], [], [], [], consumed)
            : advances && attention !== undefined
                ? this.inboxDelta([], [], [], [], [], [], [], consumed, [], [], [Object.freeze({ ...attention, readThroughSequence: readThrough })])
                : this.inboxDelta([], [], [], [], [], [], [], consumed);
        return Object.freeze({ advances, consumed, inbox });
    }
    /**
     * A receipt dev builds of this train wrote while a published event still
     * counted as Project news: that event alone advanced the reader's watermark.
     * The current model gives a marker-only read no watermark to move, so the
     * stored receipt is the one this build derives plus the standing row the old
     * model moved. Only that exact shape is accepted, and it replays as written —
     * the records after it were written against the watermark it set.
     */
    isLegacySubscriptionEventReadAdvance(projection, memberId, projectRef, readThrough, inbox, expected) {
        // The Human's standing is derived rather than stored, so only a Member's receipt can carry the row.
        if (memberId === AGENT_TEAM_HUMAN_MEMBER_ID || expected.advances)
            return false;
        const advanced = inbox.mainAttention?.set ?? [];
        if (advanced.length !== 1 || (inbox.mainAttention?.removed.length ?? 0) !== 0)
            return false;
        const attention = this.mainAttentionForFrom(projection, memberId, projectRef);
        if (attention === undefined || readThrough <= attention.readThroughSequence)
            return false;
        // The row is this reader's own standing moved to this read, and nothing else.
        if (!isDeepStrictEqual(advanced[0], { ...attention, readThroughSequence: readThrough }))
            return false;
        // Only an event could have advanced it: every other source in the window is
        // ordinary unread, which this build would advance on too.
        const eventAdvanced = this.mainSourcesFrom(projection, projectRef).some(source => source.kind === 'subscription-event'
            && source.sequence > attention.readThroughSequence && source.sequence <= readThrough);
        if (!eventAdvanced)
            return false;
        return isDeepStrictEqual(inbox, this.inboxDelta([], [], [], [], [], [], [], expected.consumed, [], [], advanced));
    }
    /** The newest page through `readThrough` a read answers with, plus any older entry whose marker the read consumes, so no marker is cleared unseen. */
    mainReadPage(memberId, projectRef, consumed, readThrough) {
        const sources = this.mainSourcesFrom(this.state, projectRef)
            .filter(source => source.sequence <= readThrough && (source.kind !== 'thread' || source.hidden !== true));
        const marked = new Set(consumed.map(marker => this.state.mainSourceByRef.get(mainMarkerSourceRef(marker))?.sequence));
        const page = sources.filter((source, index) => index >= sources.length - MAIN_READ_PAGE_SIZE || marked.has(source.sequence));
        return this.mainEntries(page, this.mainUnreadFrom(this.state, memberId, projectRef));
    }
    mainReadResult(memberId, projectRef, readThrough, consumed, receipt) {
        return Object.freeze({ ...(receipt === undefined ? {} : { receipt }), projectRef, readThroughSequence: readThrough,
            entries: this.mainReadPage(memberId, projectRef, consumed, readThrough), consumedMarkers: consumed,
            standing: this.mainStandingFrom(this.state, memberId, projectRef) });
    }
    mainEntries(sources, unread) {
        const flags = new Map(unread.map(item => [item.source.sequence, item.direct]));
        return Object.freeze(sources.map(source => this.mainEntry(source, flags.has(source.sequence), flags.get(source.sequence) === true)));
    }
    mainEntry(source, unread, direct) {
        if (source.kind === 'subscription-event') {
            return Object.freeze({ kind: 'subscription-event', sequence: source.sequence, occurredAt: source.published.occurredAt, unread, direct, event: source.published });
        }
        if (source.kind === 'activity') {
            return Object.freeze({ kind: 'activity', sequence: source.sequence, occurredAt: source.activity.occurredAt, unread, direct, activity: source.activity });
        }
        if (source.kind === 'thread') {
            const card = this.mainThreadCard(source.threadRef);
            return Object.freeze({ kind: 'thread-card', sequence: source.sequence, occurredAt: card.anchor.occurredAt, unread, direct, card });
        }
        const parentRef = source.message.replyToMessageRef;
        const parent = parentRef === undefined ? undefined : this.state.mainSourceByRef.get(parentRef);
        const replyTo = parent?.kind === 'message'
            ? Object.freeze({ sender: this.printableSender(parent.message.sender), excerpt: boundedOpeningLine(parent.message.body, GIST_SOURCE_MAX_CHARACTERS) })
            : undefined;
        return Object.freeze({ kind: 'message', sequence: source.sequence, occurredAt: source.message.occurredAt, unread, direct,
            message: source.message, mentions: this.state.mentionsByMessage.get(source.message.messageRef) ?? [],
            ...(replyTo === undefined ? {} : { replyTo }) });
    }
    /** A card is the current state of its Thread, rebuilt on every read; it keeps no copy of the Thread's progress. */
    mainThreadCard(threadRef) {
        const thread = this.state.threads.get(threadRef);
        const anchor = this.threadAnchor(threadRef);
        const facts = this.threadFacts(threadRef);
        const writers = [];
        let replyCount = 0;
        for (const fact of facts) {
            if (fact.kind !== 'message')
                continue;
            if (fact.message.messageRef !== anchor.messageRef)
                replyCount += 1;
            if (!writers.includes(fact.message.sender))
                writers.push(fact.message.sender);
        }
        const newest = facts.at(-1);
        const task = thread.taskRef === undefined ? undefined : this.state.tasks.get(thread.taskRef);
        return Object.freeze({
            threadRef, anchor: Object.freeze({ messageRef: anchor.messageRef, sender: anchor.sender,
                preview: boundedOpeningLine(anchor.body, GIST_SOURCE_MAX_CHARACTERS), sequence: anchor.sequence, occurredAt: anchor.occurredAt }),
            ...(task === undefined ? {} : { task: Object.freeze({ taskRef: task.taskRef, taskNumber: this.state.taskNumberByTask.get(task.taskRef) ?? 0,
                    status: task.status, resolution: task.resolution, accountable: task.accountable, liveClaimOwners: this.liveClaimOwners(task) }) }),
            replyCount, participants: Object.freeze(writers.map(memberId => this.memberActor(memberId))),
            newestSequence: newest.sequence, newestOccurredAt: newest.occurredAt, newestActor: this.inboxActorFor(newest),
        });
    }
    printableSender(memberId) {
        return memberId === AGENT_TEAM_HUMAN_MEMBER_ID ? AGENT_TEAM_HUMAN_HANDLE : this.state.members.get(memberId)?.handle ?? memberId;
    }
    mainUnreadRequired(projectRef, unread) {
        return Object.freeze({ kind: 'main_unread_required', projectRef, unreadCount: unread.length,
            directCount: unread.filter(item => item.direct).length, head: this.mainHeadFrom(this.state, projectRef),
            entries: this.mainEntries(unread.slice(-MAIN_READ_PAGE_SIZE).map(item => item.source), unread) });
    }
    /** The Agent whose ownership changed learns of it through a Main stream marker. */
    ownerActivityInboxDelta(activity) {
        const marker = Object.freeze({ memberId: activity.memberId, projectRef: activity.projectRef,
            activityRef: activity.activityRef, sequence: activity.sequence });
        return this.inboxDelta([], [], [], [], [], [], [marker]);
    }
    mainMessageInboxDelta(message, mentions) {
        const markers = mentions.map(memberId => Object.freeze({ memberId, projectRef: message.projectRef,
            messageRef: message.messageRef, sequence: message.sequence }));
        return this.inboxDelta([], [], [], [], [], [], markers);
    }
    /** A Main stream reply answers a Main stream Message of the same Project; a Thread Message is never a target. */
    requireMainReplyParent(ref, projectRef) {
        if (ref === undefined)
            return undefined;
        const source = this.state.mainSourceByRef.get(ref);
        if (source?.kind === 'message') {
            if (source.message.projectRef !== projectRef)
                throw new Error(`reply target '${ref}' belongs to another Project`);
            return source.message;
        }
        const reason = this.state.messagesByRef.has(ref) ? 'is a Thread Message, and the Main stream answers only Main stream Messages'
            : `is not a recorded Message${this.unknownRefHint(ref, 'message', 'Message')}`;
        throw new Error(`reply target '${ref}' ${reason} — ${recoveryFor('reply_target_unknown').sentence({ refused: `'${ref}'` })}`);
    }
    mainPostResult(operation) {
        return Object.freeze({ kind: 'committed', receipt: this.receipt(operation), message: operation.data.message,
            markers: operation.data.inbox.mainMarkers?.added ?? [] });
    }
    startThreadResult(operation) {
        return Object.freeze({ kind: 'committed', receipt: this.receipt(operation), message: operation.data.anchor,
            ...(operation.data.task === undefined ? {} : { task: operation.data.task }), thread: operation.data.thread,
            attention: operation.data.inbox.attention.set, directMarkers: operation.data.inbox.directMarkers.added });
    }
    assertSameMainMessage(operation, request, recipients) {
        if (operation.kind !== 'team/main-message-posted' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.message.projectRef !== request.projectRef
            || operation.data.message.body !== request.body.trim() || !this.sameList(operation.data.mentions, recipients)
            || operation.data.message.replyToMessageRef !== request.replyToMessageRef
            || !this.sameList(operation.data.message.attachments?.map(attachment => attachment.attachmentId) ?? [], request.resolvedAttachments?.map(attachment => attachment.attachmentId) ?? []))
            this.throwRequestCollision(request.requestId);
    }
    assertSameThreadStart(operation, request, recipients) {
        if (operation.kind !== 'team/thread-started' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.projectRef !== request.projectRef
            || operation.data.kind !== request.kind || operation.data.anchor.body !== request.body.trim()
            || (operation.data.task?.accountable ?? undefined) !== (request.kind === 'task' ? request.accountable ?? (request.actor.kind === 'member' ? request.actor.memberId : AGENT_TEAM_HUMAN_MEMBER_ID) : undefined)
            || !this.sameList(operation.data.task?.sourceThreadRefs ?? [], request.kind === 'task' ? request.sourceThreadRefs ?? [] : [])
            || !this.sameList(operation.data.mentions, recipients)
            || !this.sameList(operation.data.anchor.attachments?.map(attachment => attachment.attachmentId) ?? [], request.resolvedAttachments?.map(attachment => attachment.attachmentId) ?? []))
            this.throwRequestCollision(request.requestId);
    }
    assertSameMainRead(operation, request, projectRef) {
        if (operation.kind !== 'team/main-stream-read' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.projectRef !== projectRef
            || (request.readThroughSequence !== undefined && operation.data.readThroughSequence !== request.readThroughSequence))
            this.throwRequestCollision(request.requestId);
    }
    unreadRequired(task, thread, unread) {
        return Object.freeze({ kind: 'unread_required', ...(task === undefined ? {} : { taskRef: task.taskRef }), threadRef: thread.threadRef,
            revision: thread.revision, unreadCount: unread.length, directCount: unread.filter(item => item.direct).length,
            facts: unread });
    }
    staleRevision(actorMemberId, task, thread, expectedRevision) {
        const relation = this.revisionRelationTo(thread, expectedRevision);
        const staleTokenKind = relation === 'reached' ? undefined : relation === 'known-absent' ? 'unrecognized' : 'unknown';
        return Object.freeze({ kind: 'stale_revision', ...(task === undefined ? {} : { taskRef: task.taskRef }), threadRef: thread.threadRef,
            expectedRevision, revision: thread.revision,
            ...(staleTokenKind === undefined ? {} : { staleTokenKind }),
            facts: this.factsAfter(actorMemberId, thread.threadRef, expectedRevision) });
    }
    /**
     * How the token a stale writer used relates to this Thread's revisions.
     *
     * `before-first-fact` is a token from before this Thread existed — the writer
     * may simply have read it a moment too early. `known-absent` is a token this
     * Thread's revisions skipped over: the writer copied it from another Thread or
     * invented it, so the way out names that instead of pointing at facts that
     * were never missed. `reached` means the revision really was a point this
     * Thread passed, so the write is a plain race.
     */
    revisionRelationTo(thread, expectedRevision) {
        const facts = this.threadFactsFrom(this.state, thread.threadRef);
        const first = facts[0]?.sequence;
        if (first === undefined || expectedRevision < first)
            return 'before-first-fact';
        return facts.some(fact => fact.sequence === expectedRevision) ? 'reached' : 'known-absent';
    }
    /**
     * The facts committed strictly after `sequence` — the increment a stale
     * writer never saw. `unread_required` already carries its own batch through
     * `unreadFor`; this is the revision gate's equivalent, where the missed
     * facts are simply those past the obsolete token. `unread` is true by
     * construction (the writer's token predates them) and `direct` resolves
     * through the same marker lookup a read uses, so the two surfaces can never
     * disagree about which facts were aimed at this reader.
     */
    factsAfter(memberId, threadRef, sequence) {
        const projection = this.state;
        const result = [];
        for (const fact of this.threadFactsFrom(projection, threadRef)) {
            if (fact.sequence <= sequence)
                continue;
            result.push(this.readFactFrom(projection, memberId, fact, true));
        }
        return Object.freeze(result);
    }
    /**
     * Assemble the departure snapshot every releasing entry persists. The four
     * entries differ in scope (which Claims release, whose Attention and markers
     * clear), in the shape of their release Activities (per owner and Thread for a
     * Project, one per Thread for a Member), and in the responsibility-return
     * range; those differences are arguments here, not branches in the callers.
     *
     * Pure by contract: it reads the live projection through the existing helpers
     * and returns a frozen snapshot. It never writes a table, never advances the
     * projection, and never mints an operation — each entry still owns its
     * operation kind, its primary entity's state change, and the membership
     * difference that makes archive a hidden state and remove a real departure.
     */
    buildReleaseSnapshot(input) {
        const returned = this.accountabilityReturnsForCleanup(this.state, input.memberId, input.sequence, input.projectRefs);
        const { tasks, threads } = this.mergeResponsibilityReturn(this.tasksForClaims(input.claims, input.projected), this.threadsForActivities(input.activities), returned);
        // The responsibility return carries its own activity markers, so they are
        // the only ones added here; every other bucket is the entry's own cleanup.
        const inbox = this.inboxDelta([], input.cleanup.attention.removed, [], input.cleanup.directMarkers.removed, returned.markers, input.cleanup.activityMarkers.removed, [], input.cleanup.mainMarkers?.removed ?? [], [], input.cleanup.reminderMarkers?.removed ?? []);
        // The caller's array is copied, not frozen in place: the snapshot is what the
        // operation data and the released result both hand out, so the copy is what
        // keeps a caller from editing committed Claim records through the array it
        // passed in. Every other bucket is already built here from frozen parts.
        return Object.freeze({
            claims: Object.freeze([...input.claims]),
            activities: input.activities,
            transfers: returned.transfers,
            tasks,
            threads,
            inbox,
        });
    }
    releaseSummaries(claims, actor, sequence) {
        const byThread = new Map();
        for (const claim of claims) {
            const grouped = byThread.get(claim.threadRef) ?? [];
            grouped.push(claim);
            byThread.set(claim.threadRef, grouped);
        }
        return Object.freeze([...byThread.entries()].map(([threadRef, grouped]) => Object.freeze({ activityRef: this.ref('activity'),
            kind: 'claims_released', taskRef: grouped[0].taskRef, threadRef, actor, sequence,
            claimRefs: Object.freeze(grouped.map(claim => claim.claimRef).sort()) })));
    }
    threadsForActivities(activities) {
        return Object.freeze(activities.map(activity => Object.freeze({ ...this.requireThread(activity.threadRef), revision: activity.sequence })));
    }
    claimsForTask(taskRef) {
        return this.claimsForTaskFrom(this.state, taskRef);
    }
    claimsForTaskFrom(projection, taskRef) {
        return Object.freeze([...(projection.claimsByTask.get(taskRef) ?? [])]);
    }
    claimsForVisibleTasks(tasks) {
        return Object.freeze(tasks.flatMap(task => [...(this.state.claimsByTask.get(task.taskRef) ?? [])]));
    }
    tasksForClaims(claims, projected) {
        return Object.freeze([...new Set(claims.map(claim => claim.taskRef))].map(taskRef => {
            const task = this.state.tasks.get(taskRef);
            return Object.freeze({ ...task, status: this.deriveResolvedTaskStatus(task, projected.values()) });
        }));
    }
    /** Resolve one Task's Thread for a workspace-authorized actor; Member actors must belong to the Task's Project. */
    threadForActor(actor, workspaceId, taskRef) {
        const task = this.requireTask(workspaceId, taskRef);
        const thread = this.requireThread(task.threadRef);
        this.assertThreadProjectActive(task.projectRef);
        if (this.state.rulesVersion >= 2)
            this.requireProjectMemberActor(actor, task.projectRef);
        else if (actor.kind === 'member')
            this.requireMemberProject(this.requireMember(actor.memberId), task.projectRef);
        return { task, thread };
    }
    /**
     * Business outcomes that defer a thread write: unread work first, then a
     * stale revision.
     *
     * The unread gate has a second chance before it refuses: when every unread
     * fact is already on this Member's model-visible surface in full, the model
     * has genuinely read the content, and refusing the write would buy nothing
     * but a round-trip. That exemption writes no ledger state — no watermark
     * advance, no marker consumed — it only declines to refuse this one write,
     * so the durable "has this been read" answer stays exactly what it was.
     */
    deferredThreadWrite(actorMemberId, task, thread, baseRevision) {
        const unread = this.unreadFor(actorMemberId, thread.threadRef);
        if (unread.length > 0 && !this.visibleSurfaceExempts(actorMemberId, unread, thread.threadRef))
            return this.unreadRequired(task, thread, unread);
        if (baseRevision !== thread.revision)
            return this.staleRevision(actorMemberId, task, thread, baseRevision);
        return undefined;
    }
    /**
     * Whether every unread fact is already on this Member's visible surface.
     * Fail-closed in every direction: an absent probe, an empty answer, or one
     * fact the surface cannot show means the write is not exempt. The probe is
     * the Host's, because the surface is runtime state the ledger never holds.
     */
    visibleSurfaceExempts(memberId, unread, threadRef) {
        const probe = this.areFactsVisible;
        if (probe === undefined)
            return false;
        return probe(memberId, unread, threadRef);
    }
    /** Commit projections shared by the Message-sent and Thread-replied results. */
    committedMessageResult(operation, undelivered = []) {
        return { kind: 'committed', receipt: this.receipt(operation), message: operation.data.message,
            ...(operation.data.task === undefined ? {} : { task: operation.data.task }), thread: operation.data.thread, attention: operation.data.inbox.attention.set,
            directMarkers: operation.data.inbox.directMarkers.added,
            ...(undelivered.length === 0 ? {} : { undeliveredMentions: undelivered }) };
    }
    threadAnchor(threadRef) {
        return this.threadAnchorFrom(this.state, threadRef);
    }
    threadAnchorFrom(projection, threadRef) {
        const anchor = projection.anchorByThread.get(threadRef);
        if (anchor === undefined)
            throw new Error(`Thread '${threadRef}' has no anchor Message`);
        return anchor;
    }
    threadFactKey(fact) {
        return fact.kind === 'message' ? `message:${fact.message.messageRef}` : `activity:${fact.activity.activityRef}`;
    }
    /**
     * Display numbers for Tasks: one counter per home Project, in creation
     * order. This is the single numbering authority — Project cards, Thread
     * headings, cross-project ref resolution, and inbox renders all show the
     * ordinal the Task holds inside its own Project. The ordinals are derived
     * at replay time (`taskNumberByTask`); this read only filters them to one
     * Workspace.
     */
    taskNumbers(workspaceId) {
        const numbers = new Map();
        for (const [taskRef, taskNumber] of this.state.taskNumberByTask) {
            const task = this.state.tasks.get(taskRef);
            if (task === undefined || this.state.projects.get(task.projectRef)?.workspaceId !== workspaceId)
                continue;
            numbers.set(taskRef, taskNumber);
        }
        return numbers;
    }
    hasActiveClaim(memberId, taskRef) {
        return this.hasActiveClaimFrom(this.state, memberId, taskRef);
    }
    hasActiveClaimFrom(projection, memberId, taskRef) {
        return [...projection.claims.values()].some(claim => claim.owner === memberId && claim.taskRef === taskRef && claim.state === 'active');
    }
    deriveResolvedTaskStatus(task, claims) {
        return task.resolution === 'accepted' ? 'done' : task.resolution === 'closed' ? 'closed' : this.deriveTaskStatus(task.taskRef, claims);
    }
    deriveTaskStatus(taskRef, claims) {
        const relevant = [...claims].filter(claim => claim.taskRef === taskRef);
        if (relevant.some(claim => claim.state === 'active'))
            return 'in_progress';
        if (relevant.some(claim => claim.state === 'done'))
            return 'in_review';
        return 'todo';
    }
    setMemberState(request, state) {
        return this.enqueue(async () => {
            const existing = this.state.byRequest.get(request.requestId);
            if (existing !== undefined) {
                this.assertSameMemberState(existing, request, state);
                return this.resolved(this.memberResult(existing));
            }
            this.assertHumanActor(request.actor);
            const member = this.requireMember(request.memberId);
            const prior = state === 'suspended' ? 'enabled' : 'suspended';
            if (member.state !== prior)
                throw new Error(`Agent Member '${member.memberId}' is already ${member.state}`);
            const next = Object.freeze({ ...member, state });
            const operation = state === 'suspended'
                ? Object.freeze({ ...this.operationBase(request, this.nextSequence()), kind: 'team/member-suspended', data: Object.freeze({ member: next }) })
                : Object.freeze({ ...this.operationBase(request, this.nextSequence()), kind: 'team/member-resumed', data: Object.freeze({ member: next }) });
            await this.table.put(operation.operationId, operation);
            this.applyAndAdvanceProjectionVersion(operation);
            return this.committed(this.memberResult(operation));
        });
    }
    assertActorForWorkspace(actor, workspaceId) {
        if (actor.kind === 'human') {
            this.assertHumanActor(actor);
            return actor;
        }
        const member = this.assertMemberActor(actor);
        if (!this.participatesIn(member.memberId, workspaceId))
            throw new Error('Member cannot mutate another Workspace');
        return actor;
    }
    assertHumanActor(actor) {
        const initialization = this.initialization();
        // memberId is the durable Human authority; the handle is display-only.
        if (actor.kind !== 'human' || actor.memberId !== initialization.data.humanMemberId) {
            throw new Error('agent-team operation lacks Human authority');
        }
    }
    assertMemberActor(actor) {
        const member = this.requireMember(actor.memberId);
        if (member.state !== 'enabled' || member.handle !== actor.handle)
            throw new Error('agent-team operation lacks enabled Member authority');
        return member;
    }
    /** Shortest accepted UUID abbreviation after the branded prefix. */
    static MIN_REF_UUID_PREFIX = 6;
    isRefAbbreviationTail(tail) {
        return tail.length >= AgentTeamLedger.MIN_REF_UUID_PREFIX && /^[0-9a-f]+$/i.test(tail);
    }
    /**
     * Full map key for one branded ref, tolerating a unique UUID abbreviation.
     * Exact refs win; an abbreviated ref (prefix plus at least 6 hex chars,
     * hyphens ignored) resolves only when it matches exactly one key. Returns
     * undefined for unknown or ambiguous refs so lenient callers can degrade
     * without throwing.
     */
    uniqueRefKey(map, ref, prefix) {
        if (map.has(ref))
            return ref;
        const tail = ref.startsWith(`${prefix}:`) ? ref.slice(prefix.length + 1).replaceAll('-', '') : undefined;
        if (tail === undefined || !this.isRefAbbreviationTail(tail))
            return undefined;
        const lower = tail.toLowerCase();
        const candidates = [...map.keys()].filter(key => key.slice(prefix.length + 1).replaceAll('-', '').startsWith(lower));
        return candidates.length === 1 ? candidates[0] : undefined;
    }
    /** uniqueRefKey with the established unknown/ambiguous error contract and hints. */
    requireRefKey(map, ref, prefix, label) {
        const key = this.uniqueRefKey(map, ref, prefix);
        if (key !== undefined)
            return key;
        const tail = ref.startsWith(`${prefix}:`) ? ref.slice(prefix.length + 1).replaceAll('-', '') : undefined;
        if (tail !== undefined && this.isRefAbbreviationTail(tail)) {
            const lower = tail.toLowerCase();
            const candidates = [...map.keys()].filter(candidate => candidate.slice(prefix.length + 1).replaceAll('-', '').toLowerCase().startsWith(lower));
            if (candidates.length > 1) {
                throw new Error(`ambiguous ${label} ref '${ref}' matches ${candidates.map(candidate => `'${candidate}'`).join(', ')} — ${recoveryFor('ambiguous_ref').sentence({ refused: `'${ref}'` })}`);
            }
        }
        throw new Error(`unknown ${label} ref '${ref}'${this.unknownRefHint(ref, prefix, label)} — ${recoveryFor('unknown_ref').sentence({ refused: `${label} '${ref}'` })}`);
    }
    /** Agents strip the branded prefix or abbreviate UUIDs when echoing refs; point at the fix instead of a bare lookup failure. */
    unknownRefHint(ref, prefix, label) {
        if (!ref.startsWith(`${prefix}:`)) {
            return ` A ${label} ref must start with '${prefix}:'; reuse the full ref exactly as returned by Team tools ('${prefix}:${ref}').`;
        }
        const tail = ref.slice(prefix.length + 1).replaceAll('-', '');
        return this.isRefAbbreviationTail(tail)
            ? ` No ${label} matches this UUID prefix; reuse the full ref exactly as returned by Team tools.`
            : ` A ${label} ref needs at least 6 hex characters after '${prefix}:', or the full ref exactly as returned by Team tools.`;
    }
    requireTask(workspaceId, taskRef) {
        const task = this.state.tasks.get(this.requireRefKey(this.state.tasks, taskRef, 'task', 'Task'));
        if (task === undefined)
            throw new Error(`unknown Task ref '${taskRef}'${this.unknownRefHint(taskRef, 'task', 'Task')}`);
        if (this.state.projects.get(task.projectRef)?.workspaceId !== workspaceId)
            throw new Error(`Task '${taskRef}' does not belong to Workspace '${workspaceId}'`);
        return task;
    }
    requireThread(threadRef) {
        const thread = this.state.threads.get(this.requireRefKey(this.state.threads, threadRef, 'thread', 'Thread'));
        if (thread === undefined)
            throw new Error(`unknown Thread ref '${threadRef}'${this.unknownRefHint(threadRef, 'thread', 'Thread')}`);
        return thread;
    }
    projectRefForThread(threadRef) {
        return this.projectRefForThreadFrom(this.state, threadRef);
    }
    /**
     * The Project one read resolves against, or undefined when it is not on Team
     * read surfaces at all.
     *
     * Archival removes a Project and everything it owns from every read: its
     * Threads, Tasks, Claims, and Messages stop resolving, and participation ends
     * with it. This is the single definition of that rule for reads; writes use
     * `requireActiveProject`, and Thread-scoped writes `assertThreadProjectActive`.
     */
    visibleProject(project) {
        return project?.state === 'archived' ? undefined : project;
    }
    projectRefForThreadFrom(projection, threadRef) {
        return projection.projectRefByThread.get(threadRef);
    }
    threadContextForActor(actor, workspaceId, request) {
        const resolved = this.threadContextFrom(this.state, workspaceId, request);
        if (actor.kind === 'member') {
            if (this.state.rulesVersion >= 2)
                this.requireProjectMemberActor(actor, resolved.projectRef);
            else
                this.requireMemberProject(this.requireMember(actor.memberId), resolved.projectRef);
        }
        return resolved;
    }
    threadContextFrom(projection, workspaceId, request) {
        if (request.threadRef === undefined && request.taskRef === undefined)
            throw new Error('Thread addressing requires threadRef or taskRef');
        let thread;
        let task;
        if (request.threadRef !== undefined) {
            const threadKey = this.requireRefKey(projection.threads, request.threadRef, 'thread', 'Thread');
            thread = projection.threads.get(threadKey);
            if (thread === undefined)
                throw new Error(`unknown Thread ref '${request.threadRef}'${this.unknownRefHint(request.threadRef, 'thread', 'Thread')}`);
            task = thread.taskRef === undefined ? undefined : projection.tasks.get(thread.taskRef);
        }
        if (request.taskRef !== undefined) {
            const taskKey = this.requireRefKey(projection.tasks, request.taskRef, 'task', 'Task');
            const byTask = projection.tasks.get(taskKey);
            if (byTask === undefined)
                throw new Error(`unknown Task ref '${request.taskRef}'${this.unknownRefHint(request.taskRef, 'task', 'Task')}`);
            if (task !== undefined && task.taskRef !== byTask.taskRef)
                throw new Error(`Task '${request.taskRef}' does not belong to Thread '${request.threadRef}'`);
            if (thread !== undefined && byTask.threadRef !== thread.threadRef)
                throw new Error(`Task '${request.taskRef}' does not belong to Thread '${thread.threadRef}'`);
            task = byTask;
            thread = projection.threads.get(byTask.threadRef);
            if (thread === undefined)
                throw new Error(`unknown Thread ref '${byTask.threadRef}'`);
        }
        if (thread === undefined)
            throw new Error('unknown Thread');
        const projectRef = this.projectRefForThreadFrom(projection, thread.threadRef);
        if (projectRef === undefined)
            throw new Error(`Thread '${thread.threadRef}' has no Project`);
        if (projection.projects.get(projectRef)?.workspaceId !== workspaceId)
            throw new Error(`Thread '${thread.threadRef}' does not belong to Workspace '${workspaceId}'`);
        // Replay stays honest: operations predating the archival resolve against
        // the then-active Project because replay applies in sequence.
        if (projection.projects.get(projectRef)?.state === 'archived') {
            throw new Error(`Project '${projectRef}' is archived and no longer accepts Team work`);
        }
        if (task !== undefined && task.projectRef !== projectRef)
            throw new Error(`Task '${task.taskRef}' does not belong to Thread '${thread.threadRef}'`);
        return { ...(task === undefined ? {} : { task }), thread, projectRef };
    }
    requireProject(workspaceId, projectRef) {
        const project = this.state.projects.get(this.requireRefKey(this.state.projects, projectRef, 'project', 'Project'));
        if (project === undefined)
            throw new Error(`unknown Project ref '${projectRef}'${this.unknownRefHint(projectRef, 'project', 'Project')}`);
        if (project.workspaceId !== workspaceId)
            throw new Error(`Project '${projectRef}' does not belong to Workspace '${workspaceId}'`);
        return project;
    }
    /** Guard for every mutating or Project-scoped surface flow: archived Projects reject. */
    requireActiveProject(workspaceId, projectRef) {
        const project = this.requireProject(workspaceId, projectRef);
        if (project.state === 'archived')
            throw new Error(`Project '${projectRef}' is archived and no longer accepts Team work`);
        return project;
    }
    /** Thread-mutation guard: the Project owning the Thread must still be active. */
    assertThreadProjectActive(projectRef) {
        if (this.state.projects.get(projectRef)?.state === 'archived') {
            throw new Error(`Project '${projectRef}' is archived and no longer accepts Team work`);
        }
    }
    requireMember(memberId) {
        const member = this.state.members.get(this.requireRefKey(this.state.members, memberId, 'member', 'Agent Member'));
        if (member === undefined)
            throw new Error(`unknown Agent Member '${memberId}'`);
        return member;
    }
    /**
     * Live-side write gate for a Member acting in a Project: participation in the
     * Workspace that owns the Project. Joining the Project is not a prerequisite —
     * a Member who works in this Workspace can reply, claim, follow and read here.
     */
    requireMemberProject(member, projectRef) {
        const project = this.state.projects.get(projectRef);
        if (project === undefined || !this.participatesIn(member.memberId, project.workspaceId)) {
            throw new Error(`Agent Member '${member.memberId}' is not authorized for Project '${projectRef}'`);
        }
    }
    /**
     * Replay-side write authorization for one Project's operations:
     * participation in the Workspace that owns the Project. Project membership
     * is a Human-side organisation and is not a write gate, but historical
     * operations were checked against it; every actor that passed the
     * membership form also participates, so this form never rejects a record
     * the membership form accepted.
     */
    participatesInProjectWorkspaceFrom(projection, projectRef, memberId) {
        const workspaceId = projection.projects.get(projectRef)?.workspaceId;
        return workspaceId !== undefined && this.participatesInFrom(projection, memberId, workspaceId);
    }
    /**
     * Whether a Member takes part in a Project (the visibility question),
     * derived from taking part in any Thread of the Project, or from an
     * explicit membership a historical ledger still carries. The explicit half
     * keeps old ledgers reproducible (a Member added by `project-member-joined`
     * who never wrote a word must still see the Project); nothing new is
     * enrolled. Deriving from Threads is what makes a Member mentioned into a
     * Thread see the Project that Thread belongs to.
     */
    isProjectMember(projectRef, memberId) {
        return this.isProjectMemberFrom(this.state, projectRef, memberId);
    }
    isProjectMemberFrom(projection, projectRef, memberId, withoutOwnerGrant = false) {
        // Deriving stays inside the Workspace boundary: a Member who has left the
        // Workspace stops seeing its Projects even though the Threads it wrote
        // there are still on the record.
        if (memberId === AGENT_TEAM_HUMAN_MEMBER_ID)
            return false;
        const project = projection.projects.get(projectRef);
        if (project === undefined || !this.participatesInFrom(projection, memberId, project.workspaceId))
            return false;
        if (projection.rulesVersion >= 2) {
            // Version 2 widens membership to owners and anyone ever named in the Project, and drops departed Members,
            // enrolled ones included: the rule intersects every source with the Member lifecycle (spec §2).
            const state = projection.members.get(memberId)?.state;
            if (state === 'inactive' || state === 'archived')
                return false;
            // `withoutOwnerGrant` answers what participation is left once one owner grant ends: a Member who is a
            // Project owner only because of that grant stops being a member when the grant does.
            if (!withoutOwnerGrant && projection.owners.get(projectRef)?.has(memberId) === true)
                return true;
            if (projection.mentionedByProject.get(projectRef)?.has(memberId) === true)
                return true;
            if (projection.memberships.get(projectRef)?.has(memberId) === true)
                return true;
        }
        else if (projection.memberships.get(projectRef)?.has(memberId) === true) {
            return true;
        }
        for (const threadRef of this.projectThreadRefsFrom(projection, projectRef)) {
            if (this.everParticipatedFrom(projection, threadRef, memberId))
                return true;
        }
        return false;
    }
    /** Every Thread of the Project, taskful or taskless — the scope both cleanup validators replay against. */
    projectThreadRefs(projectRef) {
        return this.projectThreadRefsFrom(this.state, projectRef);
    }
    projectThreadRefsFrom(projection, projectRef) {
        return new Set([...projection.threads.keys()].filter(threadRef => this.projectRefForThreadFrom(projection, threadRef) === projectRef));
    }
    /** The Workspace authorization question: does this Member participate in this Workspace. */
    participatesIn(memberId, workspaceId) {
        return this.participatesInFrom(this.state, memberId, workspaceId);
    }
    participatesInFrom(projection, memberId, workspaceId) {
        return projection.participations.get(memberId)?.has(workspaceId) === true;
    }
    /** Every Workspace the Member participates in: the default first, then the rest sorted. */
    workspacesOf(memberId) {
        return Object.freeze(this.workspacesOfFrom(this.state, memberId));
    }
    workspacesOfFrom(projection, memberId) {
        const member = projection.members.get(memberId);
        if (member === undefined)
            return [];
        const rest = [...(projection.participations.get(memberId) ?? new Set())]
            .filter(workspaceId => workspaceId !== member.workspaceId).sort();
        return [member.workspaceId, ...rest];
    }
    /** Whether two Members share at least one Workspace participation — the handle-uniqueness scope. */
    participationOverlapFrom(projection, leftMemberId, rightMemberId) {
        const left = projection.participations.get(leftMemberId);
        const right = projection.participations.get(rightMemberId);
        if (left === undefined || right === undefined)
            return false;
        for (const workspaceId of left)
            if (right.has(workspaceId))
                return true;
        return false;
    }
    /** Every Thread in the Workspace — the scope a Workspace leave replays its cleanup against. */
    workspaceThreadRefs(workspaceId) {
        return this.workspaceThreadRefsFrom(this.state, workspaceId);
    }
    workspaceProjectRefsFrom(projection, workspaceId) {
        return new Set([...projection.projects.values()].filter(project => project.workspaceId === workspaceId).map(project => project.projectRef));
    }
    workspaceThreadRefsFrom(projection, workspaceId) {
        return new Set([...projection.threads.keys()].filter(threadRef => {
            const projectRef = this.projectRefForThreadFrom(projection, threadRef);
            return projectRef !== undefined && projection.projects.get(projectRef)?.workspaceId === workspaceId;
        }));
    }
    assertJoinableMember(workspaceId, memberId) {
        const member = this.requireMember(memberId);
        if (!this.participatesIn(memberId, workspaceId))
            throw new Error(`Agent Member '${memberId}' does not participate in Workspace '${workspaceId}'`);
        if (member.state !== 'enabled')
            throw new Error(`Agent Member '${memberId}' is ${member.state}; only enabled Members can join a Project`);
    }
    normalizeUnique(values, label) {
        const unique = new Set(values ?? []);
        if (unique.size !== (values?.length ?? 0))
            throw new Error(`${label} contains duplicate Member refs`);
        return Object.freeze([...unique].sort());
    }
    /**
     * Names a Message body may address in one Project: every live Member who
     * participates in the Project's Workspace plus the Human. A name outside this
     * set stays prose, which is what keeps an incidental name-drop from reaching
     * someone the Workspace cannot deliver to.
     *
     * Participation, not Project membership, is the boundary: Project membership
     * is a Human-side organisation of the Workspace, so a Member who works in
     * this Workspace is addressable here without first being enrolled in the
     * Project. `@all` is narrower than this set — see `allRecipientsFor`.
     *
     * The Human is reachable under two names: the current display handle and the
     * permanent `human` alias, so a rename never silently orphans `@human`
     * (matching ignores case, and chips render the display name either way).
     * The alias yields when another candidate already answers to it, so one
     * written name never notifies two different Members; enrollment reserves the
     * literal, so that yield only ever covers data predating the reservation.
     */
    mentionCandidatesFor(projectRef) {
        const workspaceId = this.state.projects.get(projectRef)?.workspaceId;
        const candidates = [{ memberId: AGENT_TEAM_HUMAN_MEMBER_ID, handle: this.humanHandle }];
        for (const member of this.state.members.values()) {
            if (member.state === 'inactive' || member.state === 'archived')
                continue;
            if (workspaceId === undefined || !this.participatesIn(member.memberId, workspaceId))
                continue;
            candidates.push({ memberId: member.memberId, handle: member.handle });
        }
        return this.withHumanAlias(candidates);
    }
    /**
     * The Member set `@all` stands for in one Project: the Members who take part
     * in that Project plus the Human. Deliberately narrower than the names a body
     * may address — a Member can be named by hand from anywhere in the Workspace,
     * while `@all` only reaches the people already in this conversation.
     */
    allRecipientsFor(projectRef) {
        const memberIds = [AGENT_TEAM_HUMAN_MEMBER_ID];
        for (const member of this.state.members.values()) {
            if (member.state === 'inactive' || member.state === 'archived')
                continue;
            if (!this.isProjectMember(projectRef, member.memberId))
                continue;
            memberIds.push(member.memberId);
        }
        return Object.freeze(memberIds.sort());
    }
    withHumanAlias(candidates) {
        const taken = candidates.some(candidate => candidate.handle.normalize('NFKC').trim().toLowerCase() === AGENT_TEAM_HUMAN_HANDLE);
        if (taken || this.humanHandle.normalize('NFKC').trim().toLowerCase() === AGENT_TEAM_HUMAN_HANDLE)
            return Object.freeze([...candidates]);
        return Object.freeze([...candidates, { memberId: AGENT_TEAM_HUMAN_MEMBER_ID, handle: AGENT_TEAM_HUMAN_HANDLE }]);
    }
    /**
     * Resolve the Message one reply answers, inside the Thread being written.
     *
     * The ref is checked against the ledger's own Message index instead of being
     * trusted: a ref from another Thread would render as a quote of a
     * conversation this reader cannot follow, and an unknown ref would render as
     * a dangling quote. Both are refused at write time, so every stored reply has
     * a parent a reader can actually be taken to.
     */
    requireReplyParent(request, threadRef) {
        const ref = request.replyToMessageRef;
        if (ref === undefined)
            return undefined;
        const parent = this.state.messagesByRef.get(ref);
        if (parent === undefined)
            throw new Error(`reply target '${ref}' is not a recorded Message${this.unknownRefHint(ref, 'message', 'Message')} — ${recoveryFor('reply_target_unknown').sentence({ refused: `'${ref}'` })}`);
        if (parent.threadRef !== threadRef)
            throw new Error(`reply target '${ref}' belongs to another Thread`);
        return parent;
    }
    /**
     * The recipient set one write delivers to. The body is the sole authority on
     * mentions: the `@Handle` scan below is the only thing a caller can name with,
     * and it is the same scan for an Agent and for Human input typed by hand. The
     * one input besides the body is `answered`, the parent Message's author, whom
     * a reply reaches the way a mention does.
     */
    deliveryRecipientsFor(sender, projectRef, body, answered) {
        const candidates = this.mentionCandidatesFor(projectRef);
        const resolution = resolveBodyMentions(body, candidates, sender);
        // `@all` stands for its expansion as of this write: the Member set is
        // snapshotted into the recipient list, so a later roster change cannot
        // retroactively alter what this operation delivered. It expands to the
        // Project's own participants, not to every name the body could address.
        const authored = resolution.all && this.state.rulesVersion < 2 ? this.allRecipientsFor(projectRef) : resolution.memberIds;
        const merged = new Set([...answered, ...authored]);
        merged.delete(sender);
        return Object.freeze([...merged].sort());
    }
    /**
     * Whether one Member has ever held Attention on one Thread. Committed Inbox
     * deltas append a follow/unfollow observation, and the live index covers the
     * Thread-creating Message whose initial Attention is never observed — so the
     * two together answer "was this Member ever part of this Thread" without
     * adding a second durable authority.
     */
    everParticipated(threadRef, memberId) {
        return this.everParticipatedFrom(this.state, threadRef, memberId);
    }
    everParticipatedFrom(projection, threadRef, memberId) {
        if (this.isFollowingFrom(projection, threadRef, memberId))
            return true;
        return (projection.observationsByThread.get(threadRef) ?? []).some(observation => observation.memberId === memberId);
    }
    /**
     * Split the Agent recipients an existing Thread cannot deliver to: those the
     * body named that the Thread has never carried. The send still commits — a
     * text mention must never fail the write — and the author is told through the
     * result, because inviting a Member into an existing Thread stays a Human
     * decision.
     */
    undeliverableRecipients(actor, threadRef, recipients) {
        if (actor.kind !== 'member')
            return Object.freeze([]);
        return Object.freeze(recipients.filter(memberId => this.state.members.has(memberId) && !this.everParticipated(threadRef, memberId)));
    }
    normalizeDirection(direction) {
        return direction.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
    }
    assertHandleAvailable(workspaceId, handle, exceptMemberId) {
        this.assertHandleAvailableFrom(this.state, workspaceId, handle, exceptMemberId);
    }
    assertHandleAvailableFrom(projection, workspaceId, handle, exceptMemberId) {
        const normalized = handle.normalize('NFKC').trim().toLowerCase();
        if ([...projection.members.values()].some(member => member.memberId !== exceptMemberId && member.state !== 'inactive'
            && this.participatesInFrom(projection, member.memberId, workspaceId)
            && member.handle.normalize('NFKC').trim().toLowerCase() === normalized)) {
            throw new Error(`Agent Member handle '${handle}' is already active in Workspace '${workspaceId}'`);
        }
        // The human display name shares the @ namespace: an agent handle colliding
        // with it would make body mentions ambiguous, so it is reserved globally.
        // The ledger's runtime humanHandle is the single source; replay uses the
        // Host-synced value, and the default equals the historic literal.
        // The historic literal itself is reserved permanently alongside it: `@human`
        // is the documented permanent alias for the Human, so it must never belong
        // to an agent even after a rename moves the display name elsewhere.
        const humanNormalized = this.humanHandle.normalize('NFKC').trim().toLowerCase();
        if (humanNormalized !== '' && normalized === humanNormalized) {
            throw new Error(`Agent Member handle '${handle}' collides with the human display name`);
        }
        if (normalized === AGENT_TEAM_HUMAN_HANDLE) {
            throw new Error(`Agent Member handle '${handle}' collides with the reserved human alias`);
        }
    }
    assertModelSelection(model) {
        if (model === undefined || model === null)
            return;
        if (model.provider.trim() === '' || model.model.trim() === '')
            throw new Error('member model selection must name a provider route and a model id');
    }
    /**
     * Capability allow-list entries are exact identifiers (skill names,
     * reserved tool names); only whitespace-only values are rejected. Unknown
     * names are intent, not errors — committing must stay replayable across
     * Harness upgrades, so divergence is derived at activation instead.
     */
    assertCapabilities(capabilities) {
        for (const surface of [capabilities?.tools?.allow, capabilities?.skills?.allow]) {
            if (surface === undefined)
                continue;
            if (surface.some(name => name.trim() === ''))
                throw new Error('capability allow-list names must not be empty');
        }
    }
    initialization() {
        const operation = this.state.ordered[0];
        if (operation === undefined)
            throw new Error('agent-team ledger is not initialized');
        this.assertInitializationRecord(operation);
        return operation;
    }
    assertInitializationRecord(operation) {
        if (operation.kind !== 'team/initialized' || operation.sequence !== 1 || operation.previousOperationId !== null
            || operation.actor.kind !== 'human' || operation.actor.memberId !== operation.data.humanMemberId) {
            throw new Error('agent-team initialization operation has an invalid payload');
        }
    }
    assertSameInitialization(operation, request) {
        if (operation.kind !== 'team/initialized' || !this.sameActor(operation.actor, request.actor) || operation.data.humanMemberId !== request.humanMemberId)
            this.throwRequestCollision(request.requestId);
    }
    assertSameProjectCreation(operation, request, memberIds) {
        if (operation.kind !== 'team/project-created' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.project.name !== request.name.trim()
            || operation.data.project.description !== request.description.trim() || !this.sameList(operation.data.memberIds, memberIds))
            this.throwRequestCollision(request.requestId);
    }
    assertSameMemberAdd(operation, request) {
        if (operation.kind !== 'team/member-added' || !this.sameActor(operation.actor, request.actor)
            || operation.data.member.workspaceId !== request.workspaceId || operation.data.member.handle !== request.handle.trim()
            || operation.data.member.description !== request.description.trim() || operation.data.member.presetId !== request.presetId.trim()
            || !isDeepStrictEqual(operation.data.member.model ?? undefined, request.member.model ?? undefined)
            || !isDeepStrictEqual(operation.data.member.capabilities ?? undefined, request.member.capabilities ?? undefined)
            || !this.sameList(operation.data.projectRefs, this.normalizeUnique(request.projectRefs, 'initial Member Projects')))
            this.throwRequestCollision(request.requestId);
    }
    assertSameMemberState(operation, request, state) {
        const kind = state === 'suspended' ? 'team/member-suspended' : 'team/member-resumed';
        if (operation.kind !== kind || !this.sameActor(operation.actor, request.actor) || operation.data.member.memberId !== request.memberId)
            this.throwRequestCollision(request.requestId);
    }
    assertSameMemberSessionRecycled(operation, request) {
        if (operation.kind !== 'team/member-session-recycled' || !this.sameActor(operation.actor, request.actor)
            || operation.data.member.memberId !== request.memberId || operation.data.member.sessionId !== request.newSessionId
            || operation.data.previousSessionId !== request.previousSessionId
            || operation.data.inputFromSeq !== request.inputFromSeq)
            this.throwRequestCollision(request.requestId);
    }
    assertSameProjectUpdate(operation, request) {
        if (operation.kind !== 'team/project-updated' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.project.projectRef !== request.projectRef
            || operation.data.project.name !== request.name.trim() || operation.data.project.description !== request.description.trim())
            this.throwRequestCollision(request.requestId);
    }
    assertSameMemberUpdate(operation, request) {
        if (operation.kind !== 'team/member-updated' || !this.sameActor(operation.actor, request.actor)
            || operation.data.member.memberId !== request.memberId || operation.data.member.handle !== request.handle.trim()
            || operation.data.member.description !== request.description.trim()
            // Only fields the request actually states are comparable: an absent one
            // means "keep the stored value", which the record cannot distinguish from
            // a request that stated the same value.
            || (request.model !== undefined && !isDeepStrictEqual(operation.data.member.model ?? undefined, request.model ?? undefined))
            || (request.capabilities !== undefined && !isDeepStrictEqual(operation.data.member.capabilities ?? undefined, request.capabilities ?? undefined)))
            this.throwRequestCollision(request.requestId);
    }
    assertSameProjectJoin(operation, request) {
        if (operation.kind !== 'team/project-member-added' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.projectRef !== request.projectRef || operation.data.memberId !== request.memberId)
            this.throwRequestCollision(request.requestId);
    }
    assertSameProjectMemberRemoval(operation, request) {
        if (operation.kind !== 'team/project-member-removed' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.projectRef !== request.projectRef || operation.data.memberId !== request.memberId)
            this.throwRequestCollision(request.requestId);
    }
    assertSameWorkspaceJoin(operation, request) {
        if (operation.kind !== 'team/member-workspace-joined' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.memberId !== request.memberId)
            this.throwRequestCollision(request.requestId);
    }
    assertSameWorkspaceLeave(operation, request) {
        if (operation.kind !== 'team/member-workspace-left' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.memberId !== request.memberId)
            this.throwRequestCollision(request.requestId);
    }
    assertSameProjectArchival(operation, request) {
        if (operation.kind !== 'team/project-archived' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.project.projectRef !== request.projectRef)
            this.throwRequestCollision(request.requestId);
    }
    assertSameDm(operation, request) {
        if (operation.kind !== 'team/dm-sent' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId
            || operation.data.senderMemberId !== request.actor.memberId
            || operation.data.recipientMemberId !== request.recipientMemberId
            || operation.data.body !== request.body.trim())
            this.throwRequestCollision(request.requestId);
    }
    dmResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), recipient: this.requireMember(operation.data.recipientMemberId) });
    }
    assertSameReply(operation, request, recipients) {
        if (operation.kind !== 'team/thread-replied' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId
            || (request.threadRef !== undefined && operation.data.thread.threadRef !== request.threadRef)
            || (request.taskRef !== undefined && operation.data.task?.taskRef !== request.taskRef)
            || (request.threadRef === undefined && request.taskRef === undefined)
            || operation.data.message.body !== request.body.trim() || operation.data.baseRevision !== request.baseRevision
            || operation.data.message.replyToMessageRef !== request.replyToMessageRef
            || !this.sameList(operation.data.message.attachments?.map(attachment => attachment.attachmentId) ?? [], request.resolvedAttachments?.map(attachment => attachment.attachmentId) ?? [])
            || !this.sameList(operation.data.mentions, recipients))
            this.throwRequestCollision(request.requestId);
    }
    assertSamePromotion(operation, request) {
        if (operation.kind !== 'team/thread-promoted' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId
            || operation.data.thread.threadRef !== request.threadRef
            || operation.data.baseRevision !== request.baseRevision
            || (operation.data.task.accountable ?? AGENT_TEAM_HUMAN_MEMBER_ID) !== (request.accountable ?? (request.actor.kind === 'member' ? request.actor.memberId : AGENT_TEAM_HUMAN_MEMBER_ID))) {
            this.throwRequestCollision(request.requestId);
        }
    }
    assertSameClaim(operation, request) {
        const kind = request.action === 'claim' ? 'team/claim-created' : request.action === 'done' ? 'team/claim-done' : 'team/claim-released';
        if (operation.kind !== kind || !this.sameActor(operation.actor, request.actor) || operation.data.workspaceId !== request.workspaceId
            || operation.data.task.taskRef !== request.taskRef || operation.data.baseRevision !== request.baseRevision
            || (request.action === 'claim' ? operation.data.claim.direction !== request.direction?.trim() : operation.data.claim.claimRef !== request.claimRef))
            this.throwRequestCollision(request.requestId);
    }
    assertSameTask(operation, request) {
        if (operation.kind !== 'team/task-changed' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId || operation.data.task.taskRef !== request.taskRef
            || operation.data.baseRevision !== request.baseRevision || operation.data.activity.kind !== request.action)
            this.throwRequestCollision(request.requestId);
    }
    assertSameRemoval(operation, request) {
        if (operation.kind !== 'team/member-removed' || !this.sameActor(operation.actor, request.actor)
            || operation.data.member.memberId !== request.memberId)
            this.throwRequestCollision(request.requestId);
    }
    assertSameArchival(operation, request) {
        if (operation.kind !== 'team/member-archived' || !this.sameActor(operation.actor, request.actor)
            || operation.data.member.memberId !== request.memberId)
            this.throwRequestCollision(request.requestId);
    }
    /** A replayed Attention request must address the same scope it first wrote, whichever face it used. */
    assertSameAttention(operation, request) {
        if (operation.kind === 'team/main-attention-changed') {
            if (request.projectRef === undefined || !this.sameActor(operation.actor, request.actor)
                || operation.data.workspaceId !== request.workspaceId
                || operation.data.project.projectRef !== request.projectRef
                || operation.data.action !== request.action)
                this.throwRequestCollision(request.requestId);
            return;
        }
        if (operation.kind !== 'team/thread-attention-changed' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId
            || (request.threadRef !== undefined && operation.data.thread.threadRef !== request.threadRef)
            || (request.taskRef !== undefined && operation.data.task?.taskRef !== request.taskRef)
            || (request.threadRef === undefined && request.taskRef === undefined)
            || operation.data.action !== request.action)
            this.throwRequestCollision(request.requestId);
    }
    assertSameThreadRead(operation, request) {
        if (operation.kind !== 'team/thread-read' || !this.sameActor(operation.actor, request.actor)
            || operation.data.workspaceId !== request.workspaceId
            || (request.threadRef !== undefined && threadReadTargetOf(operation.data).threadRef !== request.threadRef)
            || (request.taskRef !== undefined && threadReadTargetOf(operation.data).taskRef !== request.taskRef)
            // A computed selection is not part of the request payload; only an
            // explicit one has to match the stored receipt.
            || (request.selectedThroughSequence !== undefined
                && request.selectedThroughSequence !== (isThreadReadSnapshot(operation.data) ? undefined : operation.data.selectedThroughSequence))
            || (request.threadRef === undefined && request.taskRef === undefined))
            this.throwRequestCollision(request.requestId);
    }
    sameTask(left, right) {
        return this.sameTaskIdentity(left, right) && left.status === right.status && left.resolution === right.resolution
            && (left.accountable ?? AGENT_TEAM_HUMAN_MEMBER_ID) === (right.accountable ?? AGENT_TEAM_HUMAN_MEMBER_ID)
            && this.sameList(left.sourceThreadRefs ?? [], right.sourceThreadRefs ?? []);
    }
    sameTaskIdentity(left, right) {
        return left.taskRef === right.taskRef && left.projectRef === right.projectRef && left.threadRef === right.threadRef;
    }
    sameClaim(left, right) {
        return this.sameClaimIdentity(left, right) && left.state === right.state;
    }
    sameClaimIdentity(left, right) {
        return left.claimRef === right.claimRef && left.taskRef === right.taskRef && left.threadRef === right.threadRef
            && left.owner === right.owner && left.direction === right.direction && left.normalizedDirection === right.normalizedDirection;
    }
    sameThread(left, right) {
        return left.threadRef === right.threadRef && left.taskRef === right.taskRef && left.revision === right.revision;
    }
    sameMemberIdentity(left, right) {
        return left.sessionId === right.sessionId && this.sameMemberFacts(left, right);
    }
    sameMemberFacts(left, right) {
        return left.memberId === right.memberId && left.workspaceId === right.workspaceId
            && left.handle === right.handle && left.description === right.description && left.presetId === right.presetId
            && isDeepStrictEqual(left.model ?? undefined, right.model ?? undefined)
            && left.privateMemoryPath === right.privateMemoryPath;
    }
    sameActor(left, right) {
        if (left.kind !== right.kind || left.handle !== right.handle)
            return false;
        if (left.kind === 'host')
            return true;
        return right.kind !== 'host' && left.memberId === right.memberId;
    }
    sameList(left, right) {
        return left.length === right.length && left.every((value, index) => value === right[index]);
    }
    attentionKey(memberId, threadRef) {
        return `${memberId}\u0000${threadRef}`;
    }
    directMarkerKey(marker) {
        return `${marker.memberId}\u0000${marker.threadRef}\u0000${marker.messageRef}`;
    }
    activityMarkerKey(marker) {
        return `${marker.memberId}\u0000${marker.threadRef}\u0000${marker.activityRef}`;
    }
    addMembership(target, projectRef, memberId) {
        const members = target.memberships.get(projectRef) ?? new Set();
        members.add(memberId);
        target.memberships.set(projectRef, members);
    }
    addRef(refs, ref) {
        if (refs.has(ref))
            throw new Error(`agent-team ledger repeats entity ref '${ref}'`);
        refs.add(ref);
    }
    throwRequestCollision(requestId) {
        throw this.requestCollisionError(requestId);
    }
    requestCollisionError(requestId) {
        return new Error(`agent-team request id '${requestId}' was reused with a different operation or payload`);
    }
    projectResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), project: operation.data.project, memberIds: operation.data.memberIds });
    }
    projectOwnerResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), projectRef: operation.data.projectRef, ownerIds: this.projectOwnerIds(operation.data.projectRef) });
    }
    projectUpdateResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), project: operation.data.project });
    }
    memberResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), member: operation.data.member });
    }
    joinResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), projectRef: operation.data.projectRef, memberId: operation.data.memberId });
    }
    projectMemberRemovalResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), projectRef: operation.data.projectRef, memberId: operation.data.memberId,
            releasedClaims: operation.data.claims, removedAttention: operation.data.inbox.attention.removed });
    }
    workspaceJoinResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), memberId: operation.data.memberId, workspaceId: operation.data.workspaceId });
    }
    workspaceLeaveResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), memberId: operation.data.memberId, workspaceId: operation.data.workspaceId,
            releasedClaims: operation.data.claims, removedAttention: operation.data.inbox.attention.removed });
    }
    projectArchivalResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), project: operation.data.project,
            releasedClaims: operation.data.claims });
    }
    replyResult(operation, undelivered = []) {
        return Object.freeze(this.committedMessageResult(operation, undelivered));
    }
    claimResult(operation) {
        const attention = operation.data.inbox.attention.set.find(candidate => candidate.memberId === operation.data.claim.owner);
        const base = { kind: 'committed', receipt: this.receipt(operation), activity: operation.data.activity,
            claim: operation.data.claim, task: operation.data.task, thread: operation.data.thread };
        return attention === undefined ? Object.freeze(base) : Object.freeze({ ...base, attention });
    }
    taskResult(operation) {
        return Object.freeze({ kind: 'committed', receipt: this.receipt(operation), activity: operation.data.activity,
            task: operation.data.task, thread: operation.data.thread, claims: operation.data.claims });
    }
    transferTaskResult(operation) {
        return Object.freeze({ kind: 'committed', receipt: this.receipt(operation), activity: operation.data.activity,
            task: operation.data.task, thread: operation.data.thread });
    }
    attentionResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), ...(operation.data.task === undefined ? {} : { task: operation.data.task }), thread: operation.data.thread,
            ...(operation.data.inbox.attention.set[0] === undefined ? {} : { attention: operation.data.inbox.attention.set[0] }) });
    }
    /**
     * A Main stream Attention change answers with the Project it addressed and the
     * row now standing, so the caller can state the scope without a Thread ref.
     */
    mainAttentionResult(operation, attention) {
        return Object.freeze({ receipt: this.receipt(operation), project: operation.data.project,
            ...(attention === undefined ? {} : { attention }) });
    }
    promotionResult(operation) {
        return Object.freeze({ kind: 'committed', receipt: this.receipt(operation), activity: operation.data.activity,
            task: operation.data.task, thread: operation.data.thread });
    }
    /**
     * The Thread picture a read answers with, derived from the projection the
     * read resolved against. Committed reads, no-op reads and retries all share
     * this one derivation, so a read that writes nothing still returns the same
     * Attention, facts, watermark and unread count a committed one would.
     */
    readPicture(prepared) {
        return Object.freeze({ ...(prepared.task === undefined ? {} : { task: prepared.task }), thread: prepared.thread,
            claims: prepared.claims, anchor: prepared.anchor, anchorMentions: prepared.anchorMentions, facts: prepared.facts,
            readThroughSequence: prepared.readThroughSequence, remainingUnreadCount: prepared.remainingUnreadCount,
            earlierFactCount: prepared.earlierFactCount,
            ...(prepared.attention === undefined ? {} : { attention: prepared.attention }),
            consumedDirectMarkers: prepared.inbox.directMarkers.removed, reminders: prepared.reminders });
    }
    receipt(operation) {
        return Object.freeze({ operationId: operation.operationId, requestId: operation.requestId, sequence: operation.sequence, occurredAt: operation.occurredAt });
    }
    removalResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), member: operation.data.member,
            releasedClaims: operation.data.claims, removedAttention: operation.data.inbox.attention.removed });
    }
    archivalResult(operation) {
        return Object.freeze({ receipt: this.receipt(operation), member: operation.data.member,
            releasedClaims: operation.data.claims, removedAttention: operation.data.inbox.attention.removed });
    }
    operationBase(request, sequence) {
        return { sequence, operationId: this.createOperationId(), requestId: request.requestId, occurredAt: this.createOccurredAt(),
            actor: freezeActor(request.actor), previousOperationId: this.state.ordered.at(-1)?.operationId ?? null };
    }
    nextSequence() {
        if (this.state.ordered.length === 0)
            throw new Error('agent-team ledger is not initialized');
        return this.state.ordered.length + 1;
    }
    ref(kind) {
        return this.createRef(kind);
    }
    committed(value) { return Object.freeze({ value, committed: true }); }
    resolved(value) { return Object.freeze({ value, committed: false }); }
    sortedRecords() {
        const records = [...this.table.entries()].sort((left, right) => left[1].sequence - right[1].sequence);
        const occurrences = new Map();
        const instants = new Map();
        for (const [, operation] of records) {
            instants.set(operation.sequence, operation.occurredAt);
            if (operation.kind === 'team/message-sent' || operation.kind === 'team/thread-replied') {
                occurrences.set(operation.data.message.messageRef, operation.data.message.occurredAt ?? operation.occurredAt);
            }
        }
        // Replay against a scratch projection while normalizing, so a legacy
        // cleanup repair sees the same state its validator will.
        const projection = emptyProjection();
        return records.map(([id, operation]) => {
            const normalized = this.repairLegacyProjectCleanup(this.repairLegacyMainStreamRead(this.repairLegacyMainAttentionGrantOverwrite(this.repairLegacyMainAttentionGrant(this.repairLegacyAttentionSource(this.normalizeOperation(operation, occurrences, instants), projection), projection), projection), projection), projection);
            this.applyTo(projection, normalized);
            return [id, normalized];
        });
    }
    /**
     * Attention rows written before the source field existed carry none, and a
     * replay validator re-derives the row it expects from the projection — which
     * always has one. The missing source is supplied in memory, so an old record
     * validates against the same row the projection holds. `self` is the only
     * source that claims a cause the stored bytes never had, so it is the honest
     * default: a row whose origin the ledger cannot know is treated as the
     * Member's own choice.
     */
    repairLegacyAttentionSource(operation, projection) {
        const inbox = 'inbox' in operation.data ? operation.data.inbox : undefined;
        if (inbox === undefined)
            return operation;
        const threadRows = inbox.attention.set.filter(attention => attention.source === undefined);
        const mainRows = (inbox.mainAttention?.set ?? []).filter(attention => attention.source === undefined);
        if (threadRows.length === 0 && mainRows.length === 0)
            return operation;
        // The cause is derived from the operation, not guessed from a version: the
        // validator re-derives the same row, so a repair that guessed would leave
        // the record failing against it. Every kind that establishes Attention
        // names its own cause, and the one that cannot is the Member's own choice —
        // the only source that claims nothing.
        const fallback = this.legacyAttentionSourceOf(operation, projection);
        const withThread = (attention) => (attention.source === undefined ? { ...attention, source: fallback } : attention);
        const withMain = (attention) => (attention.source === undefined ? { ...attention, source: fallback } : attention);
        const repaired = {
            ...inbox,
            attention: { ...inbox.attention, set: inbox.attention.set.map(withThread) },
            ...(inbox.mainAttention === undefined ? {} : { mainAttention: { ...inbox.mainAttention, set: inbox.mainAttention.set.map(withMain) } }),
        };
        return { ...operation, data: { ...operation.data, inbox: repaired } };
    }
    /** What an operation whose Attention rows carry no source established them by. */
    legacyAttentionSourceOf(operation, projection) {
        switch (operation.kind) {
            case 'team/project-owner-added':
                return 'project-owner';
            case 'team/claim-created':
                return 'claim';
            case 'team/task-changed':
                // A reopen re-establishes its accountable's Attention; close and accept
                // end it instead of starting it, so only a refollow is attributable.
                return 'accountable';
            case 'team/message-sent':
            case 'team/thread-replied':
                // Version 1 delivered Attention through the mention rule, which is the
                // only source version 2 no longer produces.
                return projection.rulesVersion >= 2 ? 'self' : 'mention';
            case 'team/thread-attention-changed':
            case 'team/main-attention-changed':
                return 'self';
            case 'team/thread-read': {
                const target = threadReadTargetOf(operation.data);
                return this.attentionForFrom(projection, operation.data.memberId, target.threadRef)?.source ?? 'self';
            }
            case 'team/main-stream-read':
                return this.mainAttentionForFrom(projection, operation.data.memberId, operation.data.projectRef)?.source ?? 'self';
            case 'team/thread-started':
                return 'thread-author';
            case 'team/task-accountable-changed':
                return 'accountable';
            default:
                return 'self';
        }
    }
    /**
     * An owner grant written before Main stream Attention existed carries the
     * era's inbox: a Main marker alone, with no `mainAttention` row. That grant
     * still started its Member's default attention, so the missing row is
     * re-minted from the grant's own sequence and the record is repaired in
     * memory. Any other shape — a row already present, or a delta that differs
     * from the era's in some other way — is left alone, so it still fails
     * validation and a forgery is not silently accepted.
     */
    repairLegacyMainAttentionGrant(operation, projection) {
        if (operation.kind !== 'team/project-owner-added')
            return operation;
        const { inbox, memberId, projectRef } = operation.data;
        if (inbox.mainAttention !== undefined)
            return operation;
        const granted = [this.startMainAttention(memberId, projectRef, operation.sequence, 'project-owner')];
        // The era's delta: the owner-added Main marker and nothing else. A delta
        // that differs in any other way is a shape this build never wrote, so it
        // is left alone and still fails validation.
        const legacy = this.inboxDelta([], [], [], [], [], [], inbox.mainMarkers?.added ?? []);
        if (!isDeepStrictEqual(inbox, legacy))
            return operation;
        return { ...operation, data: { ...operation.data, inbox: this.inboxDelta([], [], [], [], [], [], inbox.mainMarkers?.added ?? [], [], [], [], granted) } };
    }
    /**
     * An owner grant written before the grant learned to leave an existing follow
     * alone overwrote the Member's Main stream Attention with a fresh row anchored
     * at the grant, discarding the read watermark its own follow had earned. The
     * Member was already following, so the correct durable result of that grant is
     * no row at all: the existing one stands. The overwriting row is dropped in
     * memory, which restores the progress the write destroyed. Only that exact
     * shape is repaired — a grant that minted a row for a Member not yet following
     * is what this build writes and is left alone.
     */
    repairLegacyMainAttentionGrantOverwrite(operation, projection) {
        if (operation.kind !== 'team/project-owner-added')
            return operation;
        const { inbox, memberId, projectRef } = operation.data;
        const set = inbox.mainAttention?.set ?? [];
        if (set.length !== 1)
            return operation;
        if (this.mainAttentionForFrom(projection, memberId, projectRef) === undefined)
            return operation;
        const overwrite = [this.startMainAttention(memberId, projectRef, operation.sequence, 'project-owner')];
        if (!isDeepStrictEqual(set, overwrite))
            return operation;
        return { ...operation, data: { ...operation.data,
                inbox: this.inboxDelta([], [], [], [], [], [], inbox.mainMarkers?.added ?? [], [], [], [], [], []) } };
    }
    /**
     * An Agent's Main stream read written before Main stream Attention existed
     * carried only the markers it consumed: its watermark lived in a projection
     * field that no longer exists, so replay alone would lose every byte of read
     * progress and hand the reader its whole history as unread. The row is
     * re-minted from the read's own `readThroughSequence`, so the era's progress
     * survives. Only the era's shape is repaired — a receipt that differs in any
     * other way is a shape this build never wrote and still fails validation.
     */
    repairLegacyMainStreamRead(operation, projection) {
        if (operation.kind !== 'team/main-stream-read')
            return operation;
        const { inbox, memberId, projectRef, readThroughSequence } = operation.data;
        if (memberId === AGENT_TEAM_HUMAN_MEMBER_ID || inbox.mainAttention !== undefined)
            return operation;
        const attention = this.mainAttentionForFrom(projection, memberId, projectRef);
        if (attention === undefined)
            return operation;
        // The era's receipt: the markers it consumed and nothing else.
        if (!isDeepStrictEqual(inbox, this.inboxDelta([], [], [], [], [], [], [], inbox.mainMarkers?.removed ?? [])))
            return operation;
        // A read that advanced nothing is a shape this build still writes: a read
        // consuming only markers leaves the watermark alone, so repairing it would
        // mint a row the current replay expectation refuses.
        if (!this.prepareMainReadFrom(projection, memberId, projectRef, readThroughSequence).advances)
            return operation;
        const advanced = Object.freeze({ ...attention, readThroughSequence: Math.max(attention.readThroughSequence, readThroughSequence) });
        return { ...operation, data: { ...operation.data,
                inbox: this.inboxDelta([], [], [], [], [], [], [], inbox.mainMarkers?.removed ?? [], [], [], [advanced]) } };
    }
    /**
     * Records written by releases that scoped Project archival and Project
     * member-removal inbox cleanup to taskful Threads only (the collector read
     * the Task projection) carry an incomplete inbox when the Project holds a
     * taskless Thread with Attention or markers. They are repaired in memory
     * the same way pre-envelope Thread reads are; any other inbox still fails
     * validation, so a forgery is not silently accepted.
     */
    repairLegacyProjectCleanup(operation, projection) {
        if (operation.kind === 'team/project-archived') {
            const projectRef = operation.data.project.projectRef;
            const expected = this.projectArchivalInboxFrom(projection, this.projectThreadRefsFrom(projection, projectRef), projectRef);
            if (!isDeepStrictEqual(operation.data.inbox, expected)
                && isDeepStrictEqual(operation.data.inbox, this.projectArchivalInboxFrom(projection, this.legacyProjectThreadRefs(projection, projectRef), projectRef))) {
                return { ...operation, data: { ...operation.data, inbox: expected } };
            }
            return operation;
        }
        if (operation.kind === 'team/project-member-removed') {
            const { projectRef, memberId } = operation.data;
            const expected = this.removeMemberThreadInboxFrom(projection, memberId, this.projectThreadRefsFrom(projection, projectRef), new Set([projectRef]));
            if (!isDeepStrictEqual(operation.data.inbox, expected)
                && isDeepStrictEqual(operation.data.inbox, this.removeMemberThreadInboxFrom(projection, memberId, this.legacyProjectThreadRefs(projection, projectRef), new Set([projectRef])))) {
                return { ...operation, data: { ...operation.data, inbox: expected } };
            }
            return operation;
        }
        return operation;
    }
    /** The legacy Project Thread scope: only Threads carrying a Task. */
    legacyProjectThreadRefs(projection, projectRef) {
        return new Set([...projection.tasks.values()].filter(task => task.projectRef === projectRef).map(task => task.threadRef));
    }
    /**
     * Ledgers written before message occurredAt existed store bare messages;
     * snapshot-shaped Thread reads resolve instants from the originating
     * operations. A receipt-shaped read carries no message at all, so it passes
     * through untouched — the load path must never touch a shape it does not
     * have, and it never writes either form back.
     */
    normalizeOperation(operation, occurrences, instants) {
        if (operation.kind !== 'team/thread-read' || !isThreadReadSnapshot(operation.data))
            return operation;
        const data = operation.data;
        const stamp = (message) => (message.occurredAt === undefined
            ? { ...message, occurredAt: occurrences.get(message.messageRef) ?? operation.occurredAt }
            : { ...message, occurredAt: message.occurredAt });
        const stampEnvelope = (envelope) => envelope.kind === 'message'
            ? { kind: 'message', sequence: envelope.sequence, message: stamp(envelope.message), mentions: envelope.mentions,
                occurredAt: envelope.occurredAt ?? envelope.message.occurredAt ?? occurrences.get(envelope.message.messageRef) ?? operation.occurredAt }
            : { kind: 'activity', sequence: envelope.sequence, activity: envelope.activity,
                occurredAt: envelope.occurredAt ?? instants.get(envelope.sequence) ?? operation.occurredAt };
        const facts = data.facts.map((fact) => ({ ...fact, fact: stampEnvelope(fact.fact) }));
        return { ...operation, data: { ...data, anchor: stamp(data.anchor), facts } };
    }
    enqueue(operation) {
        const result = this.operationTail.then(operation);
        this.operationTail = result.then(() => { }, () => { });
        return result;
    }
}
