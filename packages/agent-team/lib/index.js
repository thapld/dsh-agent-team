/**
 * Durable Agent Team Host capability.
 *
 * The Host owns the append-only collaboration ledger and all Member lifecycle
 * effects. Session history and browser state are projections, never Team facts.
 * @module @contexera/dsh-agent-team
 */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Service } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import { installModelSelection } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { scopeOf, scopeParentOf } from '@deepseek-ai/dsh-scope';
import { Session, SessionId } from '@deepseek-ai/dsh-session';
import { setSandboxMode } from '@deepseek-ai/dsh-sandbox-policy';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain';
import { ATTACHMENT_MAX_BYTES, attachmentPayloadPath, attachmentsRoot, copyPathAttachment, pathAttachmentId, readAttachment, removeAttachment, sanitizeMediaType, sweepAttachmentCache, validatePathAttachment, writeRequestScopedAttachment } from "./attachments.js";
import { reportEnvironment } from "./environment-check.js";
import { HUMAN_PROFILE_DEFAULT_NAME, HUMAN_PROFILE_REPO_URL, HUMAN_PROFILE_VERSION, assertValidHumanName, normalizeHumanName, parseLegacyHumanProfile, parseRowHumanProfile } from "./human-profile.js";
import { TEAM_HOST_ROW_SETTINGS_SCHEMA, planHostRowWrite } from "./host-row-settings.js";
import { HUMAN_AVATAR_NONE, HUMAN_PROFILE_SETTINGS_NAMESPACE, LEGACY_HUMAN_PROFILE_SETTINGS_NAMESPACE } from "./human-settings.js";
import { readableSidebarOrders, sanitizeSidebarOrderRefs, sidebarOrderKeyProblem } from "./sidebar-order.js";
import { humanAvatarsRoot, readHumanAvatar, removeHumanAvatar, writeHumanAvatar } from "./human-avatar.js";
import { createHumanUpdateChecker } from "./human-update-check.js";
import { AgentTeamInvariantError } from "./invariant.js";
import { createCheckpointContinuationMessage } from "./context-codec.js";
import { TeamContextManagement } from "./team-context-management.js";
import { decideWakeRecycle } from "./wake-recycle.js";
import { createAcceptanceReminder, planAcceptanceContext } from "./acceptance-context.js";
import { installMemberCompaction } from "./member-compaction.js";
import { AGENT_TEAM_PLUGIN_ID, isAgentTeamContextSource, isAgentTeamSource } from "./context-source.js";
import { surfaceVisibilityProbe, teamMessageSurface, visibleTeamSurface, isFactOnSurface, isMainEntryOnSurface } from "./surface-visibility.js";
export { teamMessageSurface, visibleTeamSurface, missingMessageRange } from "./surface-visibility.js";
export { activityFact, activityText } from "./activity-facts.js";
import { carriedInputOf, createTeamContextProjectionDefinition, foldTeamContextProjection, isAcceptanceNotice, TEAM_INBOX_NOTICE_SUMMARY, TEAM_RECOVERY_NOTICE_SUMMARY } from "./context-projection.js";
import { AGENT_TEAM_HUMAN_MEMBER_ID, AgentTeamLedger, agentTeamHostActor, agentTeamHumanActor } from "./ledger.js";
import { AGENT_TEAM_TOOL_NAMES, deepCopyCapabilities, isReservedToolName, memberMemoryDirectoryName, MemberRuntime } from "./member-runtime.js";
import { EXTRA_TOOL_GRANTS_FIELD, extraToolGrantsFrom, sanitizeExtraToolGrants, } from "./member-tool-grants.js";
import { PROJECT_OWNER_SECTION, projectOwnerGuidance } from "./project-owner-guidance.js";
import { TOOL_AVAILABILITY_SECTION, toolAvailabilityGuidance } from "./tool-availability-guidance.js";
import { classifyRecoverableError, failureDetail, RecoveryCoordinator } from "./recovery.js";
import { StoredSessionReadError, StoredSessionReader, sessionFailureOf } from "./stored-session-reader.js";
import { newestEndedRuns, WorkerRefusal, WorkerRegistry, workerTaskPreview, WORKER_RUN_LIST_LIMIT } from "./worker-service.js";
import { readWorkerHistory } from "./worker-inspection.js";
import { coldInboxOf } from "./cold-inbox.js";
import { agentTeamDomainSpec } from "./spec.js";
import { subscriptionDomainSpec } from "./subscription-store.js";
import { INITIAL_CHECKPOINT, SubscriptionScheduler } from "./subscription-runtime.js";
import { baselineIdsOf, failureCategory, failureTail, missingCredentials, probeShellFamily, runSubscriptionScript } from "./subscription-runner.js";
import { deliveryEntryOf, deliveryKey, deliveryKeysOf, deliveryRecordOf, evictedDeliveries, evictedRunKeys, failedDeliveries, replayKey, replayKeysOf, runRecordOf, runSummaryOf, subscriptionRunKey, subscriptionRunKeysOf, SUBSCRIPTION_DELIVERY_LIMIT, SUBSCRIPTION_RUN_HISTORY_LIMIT } from "./subscription-runs.js";
import { snapshotScript, subscriptionDefinitionProblem, SUBSCRIPTION_FAILURES_BEFORE_PAUSE, SUBSCRIPTION_PENDING_MAX, SUBSCRIPTION_SCRIPT_MAX_BYTES } from "./subscriptions.js";
import { SqliteStorageBackend } from "./vendor/storage-sqlite/index.js";
import { formatTeamTimestamp } from "./time-format.js";
import { planInboxDelivery } from "./inbox-delivery.js";
import { renderInboxNotice } from "./inbox-notice.js";
import { MemberIdleTracker } from "./member-idle.js";
export { agentTeamDomainSpec, agentTeamOperationSchema } from "./spec.js";
export { subscriptionDomainSpec } from "./subscription-store.js";
export { SubscriptionScheduler } from "./subscription-runtime.js";
export { baselineIdsOf, detectShellFamily, failureTail, missingCredentials, probeShellFamily, runSubscriptionScript } from "./subscription-runner.js";
export { parseSubscriptionOutput, scriptHash, snapshotScript, subscriptionDefinitionProblem, SUBSCRIPTION_ENV_PREFIX, SUBSCRIPTION_FAILURES_BEFORE_PAUSE, SUBSCRIPTION_MAX_PER_PROJECT, SUBSCRIPTION_MIN_INTERVAL_MINUTES, SUBSCRIPTION_PENDING_MAX, SUBSCRIPTION_PUBLISH_PER_MINUTE, SUBSCRIPTION_RUN_TIMEOUT_MS, SUBSCRIPTION_SCRIPT_MAX_BYTES, SUBSCRIPTION_STDOUT_MAX_BYTES, } from "./subscriptions.js";
import { WEBHOOK_QUEUE_LIMIT, WEBHOOK_QUEUE_RETRY_AFTER_SECONDS, webhookAddress, webhookOriginRefusal, WEBHOOK_PUMP_INTERVAL_MS, webhookRetryDelayMs, webhookStdin } from "./subscription-webhook.js";
import { admissionAttemptRequestId, admissionDeliveryRef, admissionKey, admissionKeysOf, admissionRefFor, dueAdmissions } from "./subscription-admissions.js";
export { AGENT_TEAM_HUMAN_HANDLE, AGENT_TEAM_HUMAN_MEMBER_ID, AGENT_TEAM_INITIALIZE_REQUEST_ID } from "./ledger.js";
export { HUMAN_PROFILE_DEFAULT_NAME, HUMAN_PROFILE_REPO_URL, HUMAN_PROFILE_SETTINGS_SCHEMA, HUMAN_PROFILE_VERSION, assertValidHumanName, normalizeHumanName } from "./human-profile.js";
export { DEFAULT_WEBHOOK_CONFIG, EXTRA_TOOL_GRANTS_SETTINGS_SCHEMA, HOST_ROW_FIELDS, MEMBER_COMPACTION_SETTINGS_SCHEMA, TEAM_HOST_ROW_SETTINGS_SCHEMA, WAKE_RECYCLE_SETTINGS_SCHEMA, WEBHOOK_SETTINGS_SCHEMA, planHostRowWrite } from "./host-row-settings.js";
export { EXTRA_TOOL_GRANTS_FIELD, extraToolGrantsFrom, sanitizeExtraToolGrants } from "./member-tool-grants.js";
export { HUMAN_PROFILE_SETTINGS_NAMESPACE, LEGACY_HUMAN_PROFILE_SETTINGS_NAMESPACE } from "./human-settings.js";
export { humanAvatarsRoot } from "./human-avatar.js";
export { AGENT_TEAM_TOOL_NAMES } from "./member-runtime.js";
export { MEMBER_REMINDER_REF_PATTERN, reminderRefForCallId, reminderRefIsStorable } from "./member-reminders.js";
/** Process-stable marker carried by the final Team message tool definition. */
export const AGENT_TEAM_PRESET_MARKER = Symbol.for('@contexera/dsh-agent-team.preset');
const ORPHANED_MEMBER_DIAGNOSTIC = 'Member preset composition was lost after a reload; its tools are unavailable. Resume rebuilds the member in place.';
const NOTIFICATION_QUEUE_THRESHOLD = 8;
/**
 * How many consecutive Member-reminder consumption writes may fail before the
 * Host stops rederiving the notice for them. Each retry spends one of the
 * Member's turns, so a persistent storage outage must not spend them forever;
 * the occurrence stays owed and the coverage stays dropped either way.
 */
const MAX_MEMBER_REMINDER_CONSUME_RETRIES = 3;
/** Node caps one `setTimeout` delay at 2^31-1 ms and silently shortens a longer one to 1 ms, so a farther wake arms in capped slices and re-evaluates when a slice ends. */
const MEMBER_REMINDER_TIMER_MAX_DELAY_MS = 2 ** 31 - 1;
/** Read one profile or settings document, or `undefined` when it is absent or unreadable; both are steady states on a first boot. */
async function readProfileDocument(path) {
    try {
        return await readFile(path, 'utf8');
    }
    catch {
        return undefined;
    }
}
function settingsConflictOf(error) {
    if (typeof error !== 'object' || error === null)
        return undefined;
    if (Reflect.get(error, 'code') !== 'SETTINGS_CONFLICT'
        || typeof Reflect.get(error, 'message') !== 'string'
        || typeof Reflect.get(error, 'expected') !== 'number'
        || typeof Reflect.get(error, 'actual') !== 'number')
        return undefined;
    return error;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function errorCode(error) {
    return typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
}
/**
 * A preset mount/validation failure during activation, carrying its own class
 * so the activation diagnostic can route preset-composition failures (the
 * install/runtime split failure mode) without matching message text.
 */
class PresetCompositionError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'PresetCompositionError';
    }
}
function sameChangeScope(left, right) {
    if (left.kind === 'workspace' && right.kind === 'workspace')
        return left.workspaceId === right.workspaceId;
    if (left.kind === 'project' && right.kind === 'project')
        return left.projectRef === right.projectRef;
    if (left.kind === 'thread' && right.kind === 'thread')
        return left.threadRef === right.threadRef;
    if (left.kind === 'presence' && right.kind === 'presence')
        return left.workspaceId === right.workspaceId;
    return false;
}
export function markAgentTeamPreset(definition) {
    Object.defineProperty(definition, AGENT_TEAM_PRESET_MARKER, { value: true });
    return definition;
}
/**
 * Whether the running dsh loads workspace packages from source via tsx.
 * tsx honors the Harness tsconfig path map onto `src/`, while a profile-installed bundle resolves compiled `lib/`: two module instances with independent scope keys.
 */
export function isTsxDevMode() {
    const flags = [...process.execArgv];
    const nodeOptions = process.env.NODE_OPTIONS;
    if (nodeOptions !== undefined)
        flags.push(...nodeOptions.split(/\s+/));
    return flags.some(flag => flag.includes('tsx'));
}
/**
 * Activation diagnostic for a dsh-scope module-instance mismatch: the harness sees a scope key this bundle does not,
 * so the two sides loaded different physical copies of `@deepseek-ai/dsh-scope`.
 */
export function teamPresetScopeMismatchMessage(tsxDevMode) {
    if (tsxDevMode) {
        return 'selected preset is not team-enabled: the dsh CLI is running from source via tsx (tsconfig paths resolve @deepseek-ai/dsh-scope to src/), so the harness and this bundle load different module instances; start dsh with the compiled CLI instead (pnpm dsh, node apps/cli/lib/bin.js, or npx @deepseek-ai/dsh)';
    }
    return 'selected preset is not team-enabled: this bundle and the harness resolved different physical copies of @deepseek-ai/dsh-scope; run pnpm install in the profile directory so node_modules matches the lockfile, then restart';
}
/**
 * One adoption's ledger request id. The event sequence restarts with every Session, so a Member that changes generation
 * would reuse the previous generation's id at the same sequence: the ledger's collision guard refuses that write and the
 * adoption is dropped silently. The Session is part of the identity, and the route comparison keeps a replay idempotent.
 */
export function adoptionRequestId(memberId, sessionId, seq) {
    return `${memberId}:${sessionId}:request-${seq}`;
}
/**
 * A DM was durably recorded but its session injection could not run (no live
 * handle, or the wake itself failed). The recorded DM stays durable; the
 * sender should not blindly retry — the recipient recovers it through its DM
 * history once its session is live again.
 */
export class AgentTeamDmDeliveryError extends Error {
    recipientMemberId;
    recipientHandle;
    constructor(recipientMemberId, recipientHandle, message) {
        super(message);
        this.recipientMemberId = recipientMemberId;
        this.recipientHandle = recipientHandle;
        this.name = 'AgentTeamDmDeliveryError';
    }
}
let AgentTeam = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _resolveTaskRefs_decorators;
    let _resolveThreadRefs_decorators;
    let _resolveMessageRefs_decorators;
    let _membersForClient_decorators;
    let _changes_decorators;
    let _createProject_decorators;
    let _updateProject_decorators;
    let _archiveProject_decorators;
    let _addProjectOwner_decorators;
    let _removeProjectOwner_decorators;
    let _addMember_decorators;
    let _recoverMember_decorators;
    let _updateMember_decorators;
    let _archiveMember_decorators;
    let _changeTask_decorators;
    let _promoteThread_decorators;
    let _transferTask_decorators;
    let _joinWorkspace_decorators;
    let _leaveWorkspace_decorators;
    let _startThread_decorators;
    let _postMainMessage_decorators;
    let _readMainStream_decorators;
    let _mainStreamHistory_decorators;
    let _putAttachment_decorators;
    let _getAttachment_decorators;
    let _environmentForClient_decorators;
    let _toolCatalogForClient_decorators;
    let _humanProfileForClient_decorators;
    let _putHumanAvatar_decorators;
    let _getHumanAvatar_decorators;
    let _removeHumanAvatar_decorators;
    let _setHumanProfile_decorators;
    let _sidebarOrderForClient_decorators;
    let _setSidebarOrder_decorators;
    let _reply_decorators;
    let _readMessage_decorators;
    let _changeAttention_decorators;
    let _inbox_decorators;
    let _taskBoard_decorators;
    let _readThread_decorators;
    let _threadObservations_decorators;
    let _threadHistory_decorators;
    let _view_decorators;
    let _memberRemindersForClient_decorators;
    let _cancelMemberReminderForClient_decorators;
    let _subscriptionsForClient_decorators;
    let _workerRunsForClient_decorators;
    let _stopWorkerForClient_decorators;
    let _inspectWorkerForClient_decorators;
    let _subscriptionLogsForClient_decorators;
    let _subscriptionDeliveriesForClient_decorators;
    let _replaySubscriptionDeliveryForClient_decorators;
    let _createSubscription_decorators;
    let _updateSubscription_decorators;
    let _testSubscriptionForClient_decorators;
    let _testSubscriptionDraft_decorators;
    let _pauseSubscription_decorators;
    let _resumeSubscription_decorators;
    let _resetSubscriptionWebhook_decorators;
    let _deleteSubscription_decorators;
    let _baselineSubscription_decorators;
    return class AgentTeam extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _resolveTaskRefs_decorators = [Remote('resolveTaskRefs')];
            _resolveThreadRefs_decorators = [Remote('resolveThreadRefs')];
            _resolveMessageRefs_decorators = [Remote('resolveMessageRefs')];
            _membersForClient_decorators = [Remote('members')];
            _changes_decorators = [Remote({ mode: 'stream' })];
            _createProject_decorators = [Remote('createProject')];
            _updateProject_decorators = [Remote('updateProject')];
            _archiveProject_decorators = [Remote('archiveProject')];
            _addProjectOwner_decorators = [Remote('addProjectOwner')];
            _removeProjectOwner_decorators = [Remote('removeProjectOwner')];
            _addMember_decorators = [Remote('addMember')];
            _recoverMember_decorators = [Remote('recoverMember')];
            _updateMember_decorators = [Remote('updateMember')];
            _archiveMember_decorators = [Remote('archiveMember')];
            _changeTask_decorators = [Remote('changeTask')];
            _promoteThread_decorators = [Remote('promoteThread')];
            _transferTask_decorators = [Remote('transferTask')];
            _joinWorkspace_decorators = [Remote('joinWorkspace')];
            _leaveWorkspace_decorators = [Remote('leaveWorkspace')];
            _startThread_decorators = [Remote('startThread')];
            _postMainMessage_decorators = [Remote('postMainMessage')];
            _readMainStream_decorators = [Remote('readMainStream')];
            _mainStreamHistory_decorators = [Remote('mainStreamHistory')];
            _putAttachment_decorators = [Remote('putAttachment')];
            _getAttachment_decorators = [Remote('getAttachment')];
            _environmentForClient_decorators = [Remote('environment')];
            _toolCatalogForClient_decorators = [Remote('toolCatalog')];
            _humanProfileForClient_decorators = [Remote('humanProfile')];
            _putHumanAvatar_decorators = [Remote('putHumanAvatar')];
            _getHumanAvatar_decorators = [Remote('getHumanAvatar')];
            _removeHumanAvatar_decorators = [Remote('removeHumanAvatar')];
            _setHumanProfile_decorators = [Remote('setHumanProfile')];
            _sidebarOrderForClient_decorators = [Remote('sidebarOrder')];
            _setSidebarOrder_decorators = [Remote('setSidebarOrder')];
            _reply_decorators = [Remote('reply')];
            _readMessage_decorators = [Remote('readMessage')];
            _changeAttention_decorators = [Remote('changeAttention')];
            _inbox_decorators = [Remote('inbox')];
            _taskBoard_decorators = [Remote('taskBoard')];
            _readThread_decorators = [Remote('readThread')];
            _threadObservations_decorators = [Remote('threadObservations')];
            _threadHistory_decorators = [Remote('threadHistory')];
            _view_decorators = [Remote('view')];
            _memberRemindersForClient_decorators = [Remote('memberReminders')];
            _cancelMemberReminderForClient_decorators = [Remote('cancelMemberReminder')];
            _subscriptionsForClient_decorators = [Remote('subscriptions')];
            _workerRunsForClient_decorators = [Remote('workerRuns')];
            _stopWorkerForClient_decorators = [Remote('stopWorker')];
            _inspectWorkerForClient_decorators = [Remote('inspectWorker')];
            _subscriptionLogsForClient_decorators = [Remote('subscriptionLogs')];
            _subscriptionDeliveriesForClient_decorators = [Remote('subscriptionDeliveries')];
            _replaySubscriptionDeliveryForClient_decorators = [Remote('replaySubscriptionDelivery')];
            _createSubscription_decorators = [Remote('createSubscription')];
            _updateSubscription_decorators = [Remote('updateSubscription')];
            _testSubscriptionForClient_decorators = [Remote('testSubscription')];
            _testSubscriptionDraft_decorators = [Remote('testSubscriptionDraft')];
            _pauseSubscription_decorators = [Remote('pauseSubscription')];
            _resumeSubscription_decorators = [Remote('resumeSubscription')];
            _resetSubscriptionWebhook_decorators = [Remote('resetSubscriptionWebhook')];
            _deleteSubscription_decorators = [Remote('deleteSubscription')];
            _baselineSubscription_decorators = [Remote('baselineSubscription')];
            __esDecorate(this, null, _resolveTaskRefs_decorators, { kind: "method", name: "resolveTaskRefs", static: false, private: false, access: { has: obj => "resolveTaskRefs" in obj, get: obj => obj.resolveTaskRefs }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _resolveThreadRefs_decorators, { kind: "method", name: "resolveThreadRefs", static: false, private: false, access: { has: obj => "resolveThreadRefs" in obj, get: obj => obj.resolveThreadRefs }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _resolveMessageRefs_decorators, { kind: "method", name: "resolveMessageRefs", static: false, private: false, access: { has: obj => "resolveMessageRefs" in obj, get: obj => obj.resolveMessageRefs }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _membersForClient_decorators, { kind: "method", name: "membersForClient", static: false, private: false, access: { has: obj => "membersForClient" in obj, get: obj => obj.membersForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _changes_decorators, { kind: "method", name: "changes", static: false, private: false, access: { has: obj => "changes" in obj, get: obj => obj.changes }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _createProject_decorators, { kind: "method", name: "createProject", static: false, private: false, access: { has: obj => "createProject" in obj, get: obj => obj.createProject }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _updateProject_decorators, { kind: "method", name: "updateProject", static: false, private: false, access: { has: obj => "updateProject" in obj, get: obj => obj.updateProject }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _archiveProject_decorators, { kind: "method", name: "archiveProject", static: false, private: false, access: { has: obj => "archiveProject" in obj, get: obj => obj.archiveProject }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _addProjectOwner_decorators, { kind: "method", name: "addProjectOwner", static: false, private: false, access: { has: obj => "addProjectOwner" in obj, get: obj => obj.addProjectOwner }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _removeProjectOwner_decorators, { kind: "method", name: "removeProjectOwner", static: false, private: false, access: { has: obj => "removeProjectOwner" in obj, get: obj => obj.removeProjectOwner }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _addMember_decorators, { kind: "method", name: "addMember", static: false, private: false, access: { has: obj => "addMember" in obj, get: obj => obj.addMember }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _recoverMember_decorators, { kind: "method", name: "recoverMember", static: false, private: false, access: { has: obj => "recoverMember" in obj, get: obj => obj.recoverMember }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _updateMember_decorators, { kind: "method", name: "updateMember", static: false, private: false, access: { has: obj => "updateMember" in obj, get: obj => obj.updateMember }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _archiveMember_decorators, { kind: "method", name: "archiveMember", static: false, private: false, access: { has: obj => "archiveMember" in obj, get: obj => obj.archiveMember }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _changeTask_decorators, { kind: "method", name: "changeTask", static: false, private: false, access: { has: obj => "changeTask" in obj, get: obj => obj.changeTask }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _promoteThread_decorators, { kind: "method", name: "promoteThread", static: false, private: false, access: { has: obj => "promoteThread" in obj, get: obj => obj.promoteThread }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _transferTask_decorators, { kind: "method", name: "transferTask", static: false, private: false, access: { has: obj => "transferTask" in obj, get: obj => obj.transferTask }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _joinWorkspace_decorators, { kind: "method", name: "joinWorkspace", static: false, private: false, access: { has: obj => "joinWorkspace" in obj, get: obj => obj.joinWorkspace }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _leaveWorkspace_decorators, { kind: "method", name: "leaveWorkspace", static: false, private: false, access: { has: obj => "leaveWorkspace" in obj, get: obj => obj.leaveWorkspace }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _startThread_decorators, { kind: "method", name: "startThread", static: false, private: false, access: { has: obj => "startThread" in obj, get: obj => obj.startThread }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _postMainMessage_decorators, { kind: "method", name: "postMainMessage", static: false, private: false, access: { has: obj => "postMainMessage" in obj, get: obj => obj.postMainMessage }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readMainStream_decorators, { kind: "method", name: "readMainStream", static: false, private: false, access: { has: obj => "readMainStream" in obj, get: obj => obj.readMainStream }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _mainStreamHistory_decorators, { kind: "method", name: "mainStreamHistory", static: false, private: false, access: { has: obj => "mainStreamHistory" in obj, get: obj => obj.mainStreamHistory }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _putAttachment_decorators, { kind: "method", name: "putAttachment", static: false, private: false, access: { has: obj => "putAttachment" in obj, get: obj => obj.putAttachment }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getAttachment_decorators, { kind: "method", name: "getAttachment", static: false, private: false, access: { has: obj => "getAttachment" in obj, get: obj => obj.getAttachment }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _environmentForClient_decorators, { kind: "method", name: "environmentForClient", static: false, private: false, access: { has: obj => "environmentForClient" in obj, get: obj => obj.environmentForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _toolCatalogForClient_decorators, { kind: "method", name: "toolCatalogForClient", static: false, private: false, access: { has: obj => "toolCatalogForClient" in obj, get: obj => obj.toolCatalogForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _humanProfileForClient_decorators, { kind: "method", name: "humanProfileForClient", static: false, private: false, access: { has: obj => "humanProfileForClient" in obj, get: obj => obj.humanProfileForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _putHumanAvatar_decorators, { kind: "method", name: "putHumanAvatar", static: false, private: false, access: { has: obj => "putHumanAvatar" in obj, get: obj => obj.putHumanAvatar }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getHumanAvatar_decorators, { kind: "method", name: "getHumanAvatar", static: false, private: false, access: { has: obj => "getHumanAvatar" in obj, get: obj => obj.getHumanAvatar }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _removeHumanAvatar_decorators, { kind: "method", name: "removeHumanAvatar", static: false, private: false, access: { has: obj => "removeHumanAvatar" in obj, get: obj => obj.removeHumanAvatar }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _setHumanProfile_decorators, { kind: "method", name: "setHumanProfile", static: false, private: false, access: { has: obj => "setHumanProfile" in obj, get: obj => obj.setHumanProfile }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _sidebarOrderForClient_decorators, { kind: "method", name: "sidebarOrderForClient", static: false, private: false, access: { has: obj => "sidebarOrderForClient" in obj, get: obj => obj.sidebarOrderForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _setSidebarOrder_decorators, { kind: "method", name: "setSidebarOrder", static: false, private: false, access: { has: obj => "setSidebarOrder" in obj, get: obj => obj.setSidebarOrder }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _reply_decorators, { kind: "method", name: "reply", static: false, private: false, access: { has: obj => "reply" in obj, get: obj => obj.reply }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readMessage_decorators, { kind: "method", name: "readMessage", static: false, private: false, access: { has: obj => "readMessage" in obj, get: obj => obj.readMessage }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _changeAttention_decorators, { kind: "method", name: "changeAttention", static: false, private: false, access: { has: obj => "changeAttention" in obj, get: obj => obj.changeAttention }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _inbox_decorators, { kind: "method", name: "inbox", static: false, private: false, access: { has: obj => "inbox" in obj, get: obj => obj.inbox }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _taskBoard_decorators, { kind: "method", name: "taskBoard", static: false, private: false, access: { has: obj => "taskBoard" in obj, get: obj => obj.taskBoard }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _readThread_decorators, { kind: "method", name: "readThread", static: false, private: false, access: { has: obj => "readThread" in obj, get: obj => obj.readThread }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _threadObservations_decorators, { kind: "method", name: "threadObservations", static: false, private: false, access: { has: obj => "threadObservations" in obj, get: obj => obj.threadObservations }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _threadHistory_decorators, { kind: "method", name: "threadHistory", static: false, private: false, access: { has: obj => "threadHistory" in obj, get: obj => obj.threadHistory }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _view_decorators, { kind: "method", name: "view", static: false, private: false, access: { has: obj => "view" in obj, get: obj => obj.view }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _memberRemindersForClient_decorators, { kind: "method", name: "memberRemindersForClient", static: false, private: false, access: { has: obj => "memberRemindersForClient" in obj, get: obj => obj.memberRemindersForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _cancelMemberReminderForClient_decorators, { kind: "method", name: "cancelMemberReminderForClient", static: false, private: false, access: { has: obj => "cancelMemberReminderForClient" in obj, get: obj => obj.cancelMemberReminderForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _subscriptionsForClient_decorators, { kind: "method", name: "subscriptionsForClient", static: false, private: false, access: { has: obj => "subscriptionsForClient" in obj, get: obj => obj.subscriptionsForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _workerRunsForClient_decorators, { kind: "method", name: "workerRunsForClient", static: false, private: false, access: { has: obj => "workerRunsForClient" in obj, get: obj => obj.workerRunsForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _stopWorkerForClient_decorators, { kind: "method", name: "stopWorkerForClient", static: false, private: false, access: { has: obj => "stopWorkerForClient" in obj, get: obj => obj.stopWorkerForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _inspectWorkerForClient_decorators, { kind: "method", name: "inspectWorkerForClient", static: false, private: false, access: { has: obj => "inspectWorkerForClient" in obj, get: obj => obj.inspectWorkerForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _subscriptionLogsForClient_decorators, { kind: "method", name: "subscriptionLogsForClient", static: false, private: false, access: { has: obj => "subscriptionLogsForClient" in obj, get: obj => obj.subscriptionLogsForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _subscriptionDeliveriesForClient_decorators, { kind: "method", name: "subscriptionDeliveriesForClient", static: false, private: false, access: { has: obj => "subscriptionDeliveriesForClient" in obj, get: obj => obj.subscriptionDeliveriesForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _replaySubscriptionDeliveryForClient_decorators, { kind: "method", name: "replaySubscriptionDeliveryForClient", static: false, private: false, access: { has: obj => "replaySubscriptionDeliveryForClient" in obj, get: obj => obj.replaySubscriptionDeliveryForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _createSubscription_decorators, { kind: "method", name: "createSubscription", static: false, private: false, access: { has: obj => "createSubscription" in obj, get: obj => obj.createSubscription }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _updateSubscription_decorators, { kind: "method", name: "updateSubscription", static: false, private: false, access: { has: obj => "updateSubscription" in obj, get: obj => obj.updateSubscription }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _testSubscriptionForClient_decorators, { kind: "method", name: "testSubscriptionForClient", static: false, private: false, access: { has: obj => "testSubscriptionForClient" in obj, get: obj => obj.testSubscriptionForClient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _testSubscriptionDraft_decorators, { kind: "method", name: "testSubscriptionDraft", static: false, private: false, access: { has: obj => "testSubscriptionDraft" in obj, get: obj => obj.testSubscriptionDraft }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _pauseSubscription_decorators, { kind: "method", name: "pauseSubscription", static: false, private: false, access: { has: obj => "pauseSubscription" in obj, get: obj => obj.pauseSubscription }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _resumeSubscription_decorators, { kind: "method", name: "resumeSubscription", static: false, private: false, access: { has: obj => "resumeSubscription" in obj, get: obj => obj.resumeSubscription }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _resetSubscriptionWebhook_decorators, { kind: "method", name: "resetSubscriptionWebhook", static: false, private: false, access: { has: obj => "resetSubscriptionWebhook" in obj, get: obj => obj.resetSubscriptionWebhook }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deleteSubscription_decorators, { kind: "method", name: "deleteSubscription", static: false, private: false, access: { has: obj => "deleteSubscription" in obj, get: obj => obj.deleteSubscription }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _baselineSubscription_decorators, { kind: "method", name: "baselineSubscription", static: false, private: false, access: { has: obj => "baselineSubscription" in obj, get: obj => obj.baselineSubscription }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        config = __runInitializers(this, _instanceExtraInitializers);
        static Config = TEAM_HOST_ROW_SETTINGS_SCHEMA;
        static inject = [
            'storageDomain',
            'tokenMeter',
            'workspaceRegistry',
            'agents',
            'agentDefaultModel',
            'agentPresets',
            'tools',
            'sessionPersistence',
            'sessionProjections',
        ];
        backend;
        domain;
        ledger;
        /** The scheduler's private state: deleting it changes no domain fact, so it is not part of the ledger. */
        subscriptionDomain;
        subscriptionTable;
        /** The last fifty runs of every subscription, keyed by subscription then start instant. */
        subscriptionRunsTable;
        /** The deliveries whose automatic retries were spent, waiting for an owner. */
        subscriptionDeliveriesTable;
        /** The answer each replay request already got, keyed by subscription then request id. */
        subscriptionReplaysTable;
        /** The deliveries still owing work: one row per admission. */
        subscriptionAdmissionsTable;
        /** The pass that runs due webhook deliveries; it stops with the Host. */
        admissionPumpTimer;
        /** One pass at a time: a second one would read the same rows and start them twice. */
        admissionPumpRunning = false;
        subscriptionScheduler;
        subscriptionCheckpoints = new Map();
        /**
         * One subscription's private read-modify-write steps, serialized. Two webhook
         * deliveries that arrive together must not both add one to the same old
         * failure count, or three spent retries would pause later than the third.
         */
        subscriptionWriteTails = new Map();
        /** The probe once it answers with a family, cached for the composition's lifetime; a refusal is retried. */
        subscriptionShellProbe;
        handles = new Map();
        /** Reader of the awaited context-projection registration; unloading Team releases it. */
        contextProjection;
        /** Agent ids with a turn in flight; restarts must wait for the boundary. */
        runningAgents = new Set();
        memberRuntime = new MemberRuntime({
            ctx: this.ctx,
            liveMemberContext: memberId => this.liveContextFor(memberId),
            runningAgents: this.runningAgents,
        });
        /**
         * The single seam for every per-Session stored read: handle lifecycle and failure normalization live here,
         * and consumers choose policy by failure category instead of matching error text.
         */
        sessionReader = new StoredSessionReader(this.ctx);
        /**
         * Why one Member shows error presence, per failure source. Reads prefer activation, then runtime, then compaction;
         * slots clear independently, so a recovered runtime error re-reveals an outstanding compaction failure.
         * Keyed by Member rather than Session so a restarted Session cannot leak stale keys.
         */
        memberFailures = new Map();
        /**
         * The Workers this Host started. Team owns the execution record and the refusal
         * rules; the Harness subagent service owns admission and the parent notice.
         */
        workerRegistry = new WorkerRegistry(this.ctx, {
            config: () => this.config.worker.get(),
            projectExists: projectRef => this.requireLedger().hasProject(projectRef),
            projectActive: projectRef => {
                const project = this.requireLedger().getProject(projectRef);
                return project !== undefined && project.state !== 'archived';
            },
            projectWorkspace: projectRef => this.requireLedger().getProject(projectRef)?.workspaceId,
            memberEnabled: memberId => this.requireLedger().getMember(memberId)?.state === 'enabled',
            projectOwners: projectRef => this.requireLedger().projectOwnerIds(projectRef),
            recordStarted: async (write) => {
                const result = await this.requireLedger().recordWorkerStarted(write);
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
                return result.value.execution;
            },
            // A bound run's ending is the fact that wakes its initiator, so the commit
            // that made it durable is what publishes it.
            recordSettled: async (write) => {
                const result = await this.requireLedger().recordWorkerSettled(write);
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
            },
            recordSteerAdmitted: async (write) => (await this.requireLedger().recordWorkerSteerAdmitted(write)).value,
            recordSteerRecorded: async (write) => { await this.requireLedger().recordWorkerSteerRecorded(write); },
            steerRequest: requestId => this.requireLedger().workerSteerRequest(requestId),
            steerOutcome: requestId => this.requireLedger().workerSteerOutcome(requestId),
            steerAdmissionsForText: query => this.requireLedger().workerSteerAdmissionsForText(query),
            workerStartedByRequest: requestId => this.requireLedger().workerStartedByRequest(requestId),
            workerResumeAnchors: workerRef => this.requireLedger().workerResumeAnchors(workerRef),
            warn: message => { this.ctx.logger.warn(`agent-team: ${message}`); },
        });
        /** Team notice ids waiting for a turn boundary, keyed by the live Agent message id. */
        pendingTeamWakes = new Map();
        /** Agents that already spent their one acceptance boundary; cleared when the Agent settles. */
        acceptanceBoundaries = new WeakSet();
        /** Notice removals initiated by Team itself, which are normal replacement/disposal operations. */
        expectedInboxDiscards = new Set();
        /**
         * Per-Member Inbox notice delivery: the unread facts the last attempt covered and the attempts they have spent.
         * A retry after a failed wake spends the next attempt over the same durable facts, never a second operation.
         */
        inboxNoticeDeliveries = new Map();
        /**
         * Queued Team notices that carry Member reminders, keyed by message id. The
         * claim of a message is the only evidence that its reminders reached a turn,
         * and each entry names the occurrences that message actually rendered, so a
         * claim consumes exactly those and nothing newer.
         */
        memberReminderWakes = new Map();
        /**
         * Consecutive Member-reminder consumption writes that failed for one Member.
         * Process-local like the notice coverage it bounds: a restart starts over, and
         * a successful write clears it.
         */
        memberReminderConsumeFailures = new Map();
        /** The timer armed for the next Member-reminder occurrence, rearmed after every raise. */
        memberReminderTimer;
        attachmentGcTimer;
        /**
         * New-release check behind the settings footnote. Memory-only and background-refreshed,
         * so the profile read path never waits on the network and every failure settles as "no update known".
         */
        humanUpdateCheck = createHumanUpdateChecker({ currentVersion: HUMAN_PROFILE_VERSION });
        /** Opaque process fence kept out of the Client's interpretation and combined with the Harness revision on every profile write. */
        humanProfileHostFence = randomUUID();
        memberIdle = new MemberIdleTracker();
        reminderEvaluationTail = Promise.resolve();
        reminderEvaluationRequested = false;
        recovery = new RecoveryCoordinator({
            wake: memberId => { this.injectRecovery(memberId); },
            report: fact => { this.reportRecovery(fact); },
        });
        contextManagement = new TeamContextManagement({
            memberForAgent: agent => this.memberForAgent(agent),
            projectionForMember: (memberId, sessionId) => {
                const handle = this.handles.get(memberId);
                if (handle === undefined || handle.agent.session.id !== sessionId)
                    return undefined;
                return this.contextProjection?.stateOf(handle.agent.session);
            },
            executeTransition: (memberId, plan) => this.executeMemberTransition(memberId, plan),
            messages: {
                continuation: checkpointRef => createCheckpointContinuationMessage(checkpointRef),
            },
            log: message => { this.ctx.logger.warn(`agent-team: ${message}`); },
        });
        /**
         * Per-Member lifecycle chains: one Member's long waits (turn boundary, idle) hold only that Member's later operations.
         * Order within a chain is submission order; cross-Member commits stay ordered by the ledger's single writer queue.
         */
        memberLifecycleTails = new Map();
        retiringAgents = new WeakSet();
        enteredMemberChains = new AsyncLocalStorage();
        enteredAdditionChains = new AsyncLocalStorage();
        /**
         * addMember chains by request id: the Member id does not exist until the
         * commit answers, and concurrent duplicates of one request must serialize
         * so exactly one of them activates the replayed id.
         */
        additionLifecycleTails = new Map();
        /** Deferred notification effects leave durable writes and Client invalidation on the caller's path; each Member keeps its own effect chain. */
        notificationEffectTails = new Map();
        /** Resolves when Host teardown starts: in-chain idle waits release on it instead of outliving the Host. */
        shutdown = (() => {
            let resolve;
            const promise = new Promise(finish => { resolve = finish; });
            return Object.freeze({ promise, resolve });
        })();
        /** Aborts every Host-owned background operation that would otherwise outlive teardown. */
        shutdownController = new AbortController();
        accepting = true;
        /** One adoption attempt per boot: the two readiness edges fire once each, and this keeps their attempt single. */
        legacyAdoptionStarted = false;
        /**
         * Presence wake epoch: Agent running/idle/failure has no durable fact behind it, so the presence scope counts those edge wakes in process.
         * It never takes part in a projection waiter's comparison.
         */
        presenceEpoch = 0;
        changeWaiters = new Set();
        /**
         * The Worker switch the live Member surfaces currently reflect. The Host row
         * is the only switch: it decides whether `team_worker` is declared, and the
         * registry still refuses a start while it is off, so a stale surface can never
         * become an execution path.
         */
        workerExposure;
        constructor(ctx, config) {
            super(ctx, 'agentTeam');
            this.config = config;
            this.ctx.inject(['settings'], settingsCtx => {
                settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, this.ctx.fiber));
                this.migrateLegacyHostRow();
            });
            this.workerExposure = this.config.worker.get().enabled;
            this.ctx.on('loader/volatile-update', () => {
                this.syncHumanHandle();
                this.syncWorkerExposure();
            });
        }
        openTeamStorage() {
            if (this.ctx.fiber.entry === undefined)
                return this.ctx.storageDomain;
            // Bundle toggling must not replace the Host's global DomainFacility.
            const storageCtx = this.ctx.isolate('storage');
            const storage = new Storage(storageCtx);
            this.backend = new SqliteStorageBackend({ path: dshHomePath('storages', 'agent_team.sqlite'), journalMode: 'wal' });
            storage.backend.register('sqlite', this.backend);
            const facility = new DomainFacility(storageCtx, { backend: 'sqlite', routes: {} });
            storage.mount('domain', facility);
            return facility;
        }
        printableSender(memberId) {
            return memberId === AGENT_TEAM_HUMAN_MEMBER_ID
                ? 'human'
                : this.requireLedger().getMember(memberId)?.handle ?? memberId;
        }
        /** What every reply in this window answers, resolved in one pass: a read is a bounded batch and the resolution is a pure ledger lookup. */
        replyContextsFor(facts, workspaceId) {
            const contexts = new Map();
            const refs = facts.flatMap(fact => fact.kind === 'message' && fact.message.replyToMessageRef !== undefined
                ? [fact.message.replyToMessageRef]
                : []);
            if (refs.length === 0)
                return contexts;
            for (const parent of this.requireLedger().resolveMessageRefs(workspaceId, refs)) {
                contexts.set(parent.messageRef, Object.freeze({ sender: this.printableSender(parent.sender), excerpt: parent.excerpt }));
            }
            return contexts;
        }
        /**
         * The same fact with its reply target attached, as a new object: writing a read-time projection into a durable read's payload
         * would freeze-throw or leave a stored record carrying a field its schema does not know.
         */
        withReplyTo(fact, contexts) {
            if (fact.kind !== 'message')
                return fact;
            const ref = fact.message.replyToMessageRef;
            const replyTo = ref === undefined ? undefined : contexts.get(ref);
            return replyTo === undefined ? fact : Object.freeze({ ...fact, replyTo });
        }
        /**
         * The `Replies to:` line for one notice, or nothing when it answers nothing.
         * An unresolvable target (e.g. an archived Project) falls back to the bare ref.
         */
        repliesToLine(message, workspaceId) {
            const ref = message.replyToMessageRef;
            if (ref === undefined)
                return undefined;
            const parent = this.requireLedger().resolveMessageRefs(workspaceId, [ref])[0];
            return parent === undefined
                ? `Replies to: ${ref}`
                : `Replies to: @${this.printableSender(parent.sender)} — "${parent.excerpt}" [${ref}]`;
        }
        /** The live agent context of one Member, resolved at call time; throws when the Member has no live handle. */
        liveContextFor(memberId) {
            const handle = this.handles.get(memberId);
            if (handle === undefined)
                throw new Error(`Agent Member '${this.memberLabel(memberId)}' has no live session for a tool-policy update`);
            return handle.agent.ctx;
        }
        wakeRecycleConfig() {
            return this.config.wakeRecycle.get();
        }
        memberCompactionConfig() {
            return this.config.memberCompaction.get();
        }
        /**
         * Whether this generation should be replaced before the next message reaches it. Cheap gates decide from the log's newest event time;
         * only a generation that passed them is priced, because pricing rebuilds a cold Session (a whole-log replay).
         */
        async planWakeForMember(member, agent) {
            const stored = agent === undefined ? await this.sessionReader.read(member.sessionId) : undefined;
            const events = agent !== undefined ? agent.session.ownEvents() : stored?.ok === true ? stored.inspection.events : undefined;
            const plan = this.cheapWakePlan(events);
            if (plan.action !== 'measure-context')
                return plan;
            const contextTokens = agent !== undefined
                ? this.measureLiveContext(agent)
                : stored?.ok === true ? this.measureStoredContext(member.sessionId, stored.inspection) : null;
            return decideWakeRecycle({ config: this.wakeRecycleConfig(), facts: { hasPriorGeneration: true, lastActivityAtMs: lastActivityTime(events ?? []), contextTokens }, nowMs: Date.now() });
        }
        cheapWakePlan(events) {
            if (events === undefined || events.length === 0)
                return { action: 'resume', reason: 'no_prior_generation' };
            return decideWakeRecycle({
                config: this.wakeRecycleConfig(),
                facts: { hasPriorGeneration: true, lastActivityAtMs: lastActivityTime(events), contextTokens: null },
                nowMs: Date.now(),
            });
        }
        measureLiveContext(agent) {
            try {
                return this.ctx.tokenMeter.measure(agent.session).totalTokens;
            }
            catch (error) {
                this.ctx.logger.warn(`agent-team: could not price Session '${agent.id}' for the wake swap: ${failureDetail(error)}; the generation is kept`);
                return null;
            }
        }
        measureStoredContext(sessionId, inspection) {
            try {
                const session = Session.create(sessionId, inspection.events, inspection.header, inspection.inheritedEventCount);
                // The driver owns the inbox projection and publishes no reader, so this prices the Session's own durable splices; an invalid history keeps the generation.
                const inbox = coldInboxOf(inspection.events);
                if (inbox === undefined || [...inbox['next-turn'], ...inbox['next-step']].some(message => this.isOrdinaryInput(message)))
                    return null;
                return this.ctx.tokenMeter.measure(session).totalTokens;
            }
            catch (error) {
                this.ctx.logger.warn(`agent-team: could not price Session '${sessionId}' for the wake swap: ${failureDetail(error)}; the generation is kept`);
                return null;
            }
        }
        /**
         * Record the configured route on a resumed Agent. A route the ledger names without an effort keeps the effort its own log recorded for that same route, so a Session-level model edit that never entered the ledger survives the next activation.
         */
        applyConfiguredRoute(agent, selection) {
            const previous = agent.model.current();
            const inherited = previous !== undefined && previous.provider === selection.provider && previous.model === selection.model
                ? previous.reasoningEffort
                : undefined;
            const effort = selection.reasoningEffort ?? inherited;
            agent.model.select({ provider: selection.provider, model: selection.model, ...effort === undefined ? {} : { reasoningEffort: effort } });
        }
        /**
         * Carry the route a Member's Session actually sent into the ledger.
         *
         * The composer writes its choice into the Session log; this is the only bridge from there into the Team ledger, and it runs on
         * `request/header` — after compaction and the model-switch guard have passed — rather than on the selection event, because a
         * switch the Host refuses (a window that cannot hold the context) keeps the old route and must never become the durable one.
         * A request whose route already equals what the Member would run next is a no-op, so the route Team writes back on activation
         * cannot feed itself through the ledger. Only the route is recorded: the reasoning effort stays a Session-log fact that
         * activation re-reads for that route, so adoption can neither drop an inherited tier nor pin it permanently.
         */
        adoptMemberRouteFromRequest(memberId, agent, sessionId, event) {
            if (this.retiringAgents.has(agent))
                return;
            let ledger;
            try {
                ledger = this.requireLedger();
            }
            catch {
                return;
            }
            const member = ledger.getMember(memberId);
            if (member === undefined || member.state !== 'enabled')
                return;
            const config = event.data.header.config;
            // The header's route was fixed at step preparation, so a pick made since then (settings page or composer) is newer than
            // this request: adopting it here would write the replaced route back over the Human's choice.
            const live = agent.model.current();
            if (live === undefined || live.provider !== config.provider || live.model !== config.model)
                return;
            const running = member.model ?? this.ctx.agentDefaultModel.currentSelection();
            if (running.provider === config.provider && running.model === config.model)
                return;
            // The route alone: the effort belongs to the Session log, where activation re-reads it for the same route. Writing it
            // here would turn an inherited tier into a permanent one that later edits cannot lower.
            const model = Object.freeze({ provider: config.provider, model: config.model });
            const requestId = adoptionRequestId(member.memberId, sessionId, event.seq);
            void ledger.updateMember({
                requestId, memberId: member.memberId, handle: member.handle, description: member.description,
                model, actor: agentTeamHumanActor(),
            }).then((result) => {
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
            }).catch((error) => {
                this.ctx.logger.warn(`agent-team: could not adopt the request route for member '${this.memberLabel(memberId)}' requestId '${requestId}': ${failureDetail(error)}`);
            });
        }
        async recycleColdGeneration(member, agent) {
            const queued = this.queuedInputOf(agent);
            if (queued.length > 0) {
                this.ctx.logger.info(`agent-team: ${this.memberScope(member.memberId, agent.id)} keeps its generation: ${queued.length} queued message(s) are still waiting for a turn`);
                return undefined;
            }
            const plan = await this.planWakeForMember(member, agent);
            if (plan.action !== 'recycle')
                return undefined;
            this.ctx.logger.info(`agent-team: waking ${this.memberScope(member.memberId, agent.id)} swaps its cold generation: idle ${plan.idleMs}ms over ${plan.thresholds.idleMs}ms, context ${plan.contextTokens} over ${plan.thresholds.minContextTokens}`);
            await this.contextManagement.requestRecycle(member.memberId, { ...member, sessionId: agent.session.id });
            if (this.handles.has(member.memberId))
                return undefined;
            return new Error('the generation swap did not finish; the recorded Session transition is finished by the next wake or by Member recovery');
        }
        async wakeGateFor(agent) {
            const member = this.memberForAgent(agent);
            if (member === undefined || agent.status !== 'idle')
                return undefined;
            if (this.contextManagement.isTransitioning(member.memberId)) {
                await this.contextManagement.whenSettled(member.memberId);
                return this.handles.has(member.memberId) ? undefined : new Error('the Member is changing generation and the swap has not finished; the message stays durable in its Inbox');
            }
            return this.recycleColdGeneration(member, agent);
        }
        /** Current human display name; the single source for team_view and @ matching. */
        humanHandle() {
            const name = normalizeHumanName(this.config.name.get());
            return name === '' ? HUMAN_PROFILE_DEFAULT_NAME : name;
        }
        /** Current human profile reference from this Host row's Config. `avatarRef` is present only when configured, never explicit `undefined` (exactOptionalPropertyTypes). */
        humanProfile() {
            const avatarRef = this.config.avatarRef.get();
            return Object.freeze({ name: this.humanHandle(), ...(typeof avatarRef === 'string' ? { avatarRef } : {}) });
        }
        /** The Host row's Worker switch, read at each use so a live edit is never cached into a stale decision. */
        workerEnabled() {
            return this.config.worker.get().enabled;
        }
        /** The profile's exact extra tool-name grants, read at a turn start before tool resolution. */
        extraToolGrants() {
            return sanitizeExtraToolGrants(this.config[EXTRA_TOOL_GRANTS_FIELD].get());
        }
        /**
         * Follow the Worker switch on the live surfaces. The loader event fires for any
         * volatile row update, so the switch is compared before anything is applied;
         * an unchanged value costs nothing. Members are reached at their next turn
         * boundary, and a running Worker is never touched: the switch gates new
         * delegations, not work already in flight.
         */
        syncWorkerExposure() {
            const enabled = this.workerEnabled();
            if (enabled === this.workerExposure)
                return;
            this.workerExposure = enabled;
            void this.applyWorkerExposure(enabled).catch((error) => {
                this.ctx.logger.warn(`agent-team: failed to apply the Worker switch to live Member surfaces: ${error instanceof Error ? error.message : String(error)}`);
            });
        }
        /** Re-apply the Worker switch to every live Member at its own turn boundary, one failure never stopping the others. */
        async applyWorkerExposure(enabled) {
            // Members wait independently: one long turn must not delay the others.
            await Promise.all([...this.handles].map(async ([memberId, handle]) => {
                const member = this.requireLedger().getMember(memberId);
                if (member === undefined)
                    return;
                try {
                    let boundary = await this.memberRuntime.awaitTurnBoundary(handle);
                    // A turn may start in the gap between the boundary event and this
                    // continuation. Wait again so a delayed apply never replaces that
                    // turn's frozen grants after its turn/start.
                    while (this.accepting && this.handles.get(memberId) === handle && this.runningAgents.has(handle.agent.id)) {
                        boundary = await this.memberRuntime.awaitTurnBoundary(handle);
                    }
                    // A suspend, removal, or restart during the wait replaced the surface this
                    // apply targeted; the replacement reads the switch on its own activation.
                    if (!this.accepting || this.handles.get(memberId) !== handle)
                        return;
                    // A second flip while this one waited supersedes it: the newer sync owns
                    // the surface, and applying this value now would undo the newer one.
                    if (this.workerEnabled() !== enabled)
                        return;
                    // A capability edit may have committed while this switch waited. Read
                    // the accepted intent now rather than restoring a pre-wait snapshot.
                    const member = this.requireLedger().getMember(memberId);
                    if (member === undefined)
                        return;
                    this.memberRuntime.reapplyMemberToolPolicy(member, enabled, this.extraToolGrants());
                    // The swap released the applied-capability record; the stored intent is
                    // in force again, so the roster must not read as pending after a toggle.
                    this.memberRuntime.recordAppliedCapabilities(memberId, member.capabilities);
                    if (boundary === 'waited') {
                        this.ctx.logger.info(`agent-team: member '${member.handle}' session '${member.sessionId}' stage 'worker-exposure' applied the Worker switch at its next turn boundary`);
                    }
                }
                catch (error) {
                    this.ctx.logger.warn(`agent-team: failed to apply the Worker switch to member '${this.memberLabel(memberId)}': ${error instanceof Error ? error.message : String(error)}`);
                }
            }));
        }
        /** Push the current Config name into the ledger's runtime @ handle; the ledger may not be open yet, and the post-open sync covers that. */
        syncHumanHandle() {
            this.ledger?.setHumanDisplayHandle(this.humanHandle());
        }
        /**
         * The judgements the Config schema cannot make about a Human name: the same non-empty floor as Member handles,
         * plus global uniqueness against live Members. Runs before the write so a colliding rename rejects instead of persisting.
         */
        validateHumanProfile(value) {
            const name = assertValidHumanName(value.name);
            const ledger = this.ledger;
            if (ledger === undefined)
                return;
            const normalized = name.normalize('NFKC').trim().toLowerCase();
            for (const member of ledger.listMembers()) {
                if (member.state === 'inactive' || member.state === 'archived')
                    continue;
                if (member.handle.normalize('NFKC').trim().toLowerCase() === normalized) {
                    throw new Error(`human name '${name}' collides with an existing Member handle`);
                }
            }
        }
        /**
         * One-time migration of Host row values that predate the current stored
         * shape. Two sources, in upgrade order: the pre-rename settings namespace
         * (see {@link migrateRenamedHostRowNow}), then the retired
         * `agent-team-human` settings section (see `LEGACY_HUMAN_PROFILE_SECTION`).
         * Whichever readiness edge fires second (settings service, ledger open)
         * starts the attempt; both write only fields the current namespace stores
         * nothing for, once per boot.
         */
        migrateLegacyHostRow() {
            if (this.legacyAdoptionStarted)
                return;
            if (this.ctx.get('settings') === undefined || this.ledger === undefined)
                return;
            this.legacyAdoptionStarted = true;
            void this.migrateLegacyHostRowNow().catch((error) => {
                this.ctx.logger.warn('agent-team: legacy host row migration failed: %s', String(error));
            });
        }
        async migrateLegacyHostRowNow() {
            await this.migrateRenamedHostRowNow();
            await this.adoptRetiredHumanSectionNow();
        }
        /**
         * The Host row's own USER layer in the current namespace: exactly the fields
         * the Human wrote there. The resolved config is the wrong signal — it carries
         * schema defaults, so a Human who explicitly stored a value equal to the
         * default would read as "nothing stored" and be overwritten.
         */
        storedHostRowFields() {
            const descriptor = this.ctx.get('settings')?.describe().find(row => row.ns === HUMAN_PROFILE_SETTINGS_NAMESPACE);
            return (descriptor?.user ?? {});
        }
        /**
         * Writes one migration decision into the current namespace and reports
         * whether anything went out. Every field of the row is volatile, so the
         * settings write is also what makes the value live; nothing else may write
         * the running config.
         *
         * The name still passes the Remote's own judgement: adopting a display name a
         * live Member handle already claims would make the Human unaddressable. That
         * drops only the name — the operational settings in the same plan are
         * independent of it.
         */
        async writeHostRowValues(plan) {
            const settings = this.ctx.get('settings');
            if (settings === undefined)
                return false;
            const ops = [];
            let name = plan.name;
            if (name !== undefined) {
                try {
                    this.validateHumanProfile({ name });
                }
                catch (error) {
                    this.ctx.logger.warn('agent-team: kept the Host row display name unset: %s', String(error));
                    name = undefined;
                }
            }
            if (name !== undefined)
                ops.push({ op: 'set', path: ['name'], value: name });
            // The reference is carried only while its bytes still draw: the avatar
            // store, not the document, is the authority for whether it exists at all.
            if (plan.avatarRef === null) {
                ops.push({ op: 'set', path: ['avatarRef'], value: plan.avatarRef });
            }
            else if (plan.avatarRef !== undefined) {
                try {
                    if (await readHumanAvatar(humanAvatarsRoot(), plan.avatarRef) !== undefined) {
                        ops.push({ op: 'set', path: ['avatarRef'], value: plan.avatarRef });
                    }
                }
                catch (error) {
                    this.ctx.logger.warn(`agent-team: skipped an invalid legacy human avatar reference during migration: ${errorMessage(error)}`);
                }
            }
            if (plan.wakeRecycle !== undefined)
                ops.push({ op: 'set', path: ['wakeRecycle'], value: plan.wakeRecycle });
            if (plan.memberCompaction !== undefined)
                ops.push({ op: 'set', path: ['memberCompaction'], value: plan.memberCompaction });
            if (ops.length === 0)
                return false;
            await settings.mutate(HUMAN_PROFILE_SETTINGS_NAMESPACE, ops);
            return true;
        }
        /**
         * Carries the whole Host row across the `@wowyuarm` → `@contexera` row rename.
         *
         * The settings namespace IS the Host row id, so the rename left every value
         * the row stored — the Human's name and avatar reference AND the operational
         * settings this Host runs with — under an id that no loader entry answers to
         * any more: the composition skips that patch, and the row restarts from
         * schema defaults. That is a silent behaviour reset, not only a cosmetic one:
         * an operator who switched Member compaction off would silently get it back
         * on. The stored values survive only in the profile's own patch document, so
         * this reads them there and writes every field the current namespace stores
         * nothing for.
         *
         * Fields that hold a Cordis expression are not carried: the loader would
         * evaluate them in the row's own context, and this runs outside it, so their
         * source text must never be written back as the value.
         */
        async migrateRenamedHostRowNow() {
            const profile = this.ctx.get('profileContext');
            if (profile === undefined)
                return;
            const document = await readProfileDocument(profile.patchPath);
            if (document === undefined)
                return;
            const carried = parseRowHumanProfile(document, LEGACY_HUMAN_PROFILE_SETTINGS_NAMESPACE);
            if (carried === undefined)
                return;
            const plan = planHostRowWrite(this.storedHostRowFields(), carried);
            if (plan === undefined)
                return;
            if (!await this.writeHostRowValues(plan))
                return;
            this.ctx.logger.info('agent-team: migrated the host row off the pre-rename settings namespace in %s', profile.patchPath);
        }
        async adoptRetiredHumanSectionNow() {
            // A profile-launched Host always carries the profile context; a Host booted
            // without one still adopts from the DSH home, which is where the
            // document may still live. Read through `get`: cordis refuses a direct
            // `ctx.profileContext` for a service this plugin does not declare, and
            // adoption may not gate the Host on app-boot.
            const profileHome = this.ctx.get('profileContext')?.home;
            const homes = profileHome === undefined ? [dshHomePath()] : [dshHomePath(), profileHome];
            const candidates = new Set(homes.flatMap(home => [join(home, 'settings.yaml'), join(home, 'settings.yaml.imported')]));
            let legacy;
            let source;
            for (const candidate of candidates) {
                let text;
                try {
                    text = readFileSync(candidate, 'utf8');
                }
                catch {
                    // Absent candidates are the steady state; the live document is one only because the first boot after the upgrade can race the importer that renames it.
                    continue;
                }
                const parsed = parseLegacyHumanProfile(text);
                if (parsed !== undefined) {
                    legacy = parsed;
                    source = candidate;
                    break;
                }
            }
            if (legacy === undefined || source === undefined)
                return;
            // The same rule as the rename above, on the same signal: a value the Human
            // stored in the current namespace outranks this older document too, so the
            // two migrations cannot disagree about which source wins.
            const plan = planHostRowWrite(this.storedHostRowFields(), { ...legacy });
            if (plan === undefined)
                return;
            if (!await this.writeHostRowValues(plan))
                return;
            this.ctx.logger.info('agent-team: adopted the retired human settings section from %s', source);
        }
        async [Service.init]() {
            // Registered once per Host: the framework keeps one unit per projection key and drives it for every Session, so the fold is session-agnostic.
            // The registration rides this plugin's fiber, so unloading Team releases the key and its cached cells; one owner, never a second disposer.
            this.contextProjection = await this.ctx.sessionProjections.register(createTeamContextProjectionDefinition());
            this.ctx.on('agent/error', ({ agent, error }) => {
                const member = this.memberForAgent(agent);
                if (member === undefined)
                    return;
                const message = error instanceof Error ? error.message : String(error);
                this.setMemberFailure(member.memberId, 'runtime', message);
                // Every occurrence is classified here, including verdicts the coordinator reports no state change for;
                // those are logged at diagnostic level to explain why no automatic recovery was scheduled.
                const kind = classifyRecoverableError(error);
                this.ctx.logger.debug(`agent-team: ${this.memberScope(member.memberId, agent.id)} reported an error classified as ${kind === undefined ? 'not automatically recoverable' : `recoverable ${kind}`}: ${message}`);
                this.recovery.onError(member.memberId, error);
                this.emitMemberPresenceChanged(member);
            });
            this.ctx.on('agent/status', ({ agent, status }) => {
                const member = this.memberForAgent(agent);
                if (status === 'running')
                    this.runningAgents.add(agent.id);
                else
                    this.runningAgents.delete(agent.id);
                if (member !== undefined)
                    this.memberIdle.status(member.memberId, status, Date.now());
                if (status === 'running' && member !== undefined) {
                    const recovered = this.clearMemberFailure(member.memberId, 'runtime');
                    const preTurnRecovered = this.clearMemberFailure(member.memberId, 'preTurnCancellation');
                    if (recovered || preTurnRecovered)
                        this.dropInboxCoverage(member.memberId);
                    this.emitMemberPresenceChanged(member);
                    // A transition in flight delivers its own sequenced rederived Inbox
                    // after any carried input; a status-driven steer would leapfrog it.
                    if (!this.contextManagement.isTransitioning(member.memberId))
                        this.notifyMember(agent, { kind: 'running' });
                }
                // A turn that ends without an error closes any automatic recovery episode.
                // The idle transition is presence-affecting (working → available), so it wakes presence watchers like the running transition; otherwise cached Client rows keep showing the Member as working.
                if (status === 'idle' && member !== undefined) {
                    this.acceptanceBoundaries.delete(agent);
                    if (this.memberFailures.get(member.memberId)?.runtime === undefined) {
                        this.recovery.onCleanTurnEnd(member.memberId);
                    }
                    this.emitMemberPresenceChanged(member);
                }
            });
            // A Team notice can be removed before the Agent opens `turn/start`.
            // `agent/inbox/spliced` deliberately carries no cancellation owner, so a
            // claimed notice is a normal consumed wake, while a discarded one the Host
            // did not itself retire is the narrowest Team-owned signal of a drop.
            this.ctx.on('agent/inbox/claimed', ({ message }) => {
                this.pendingTeamWakes.delete(message.id);
                // The notice reached a turn: that is the moment a Member reminder stops
                // being owed. A Host that dies before this write leaves the marker
                // unconsumed, so the next wake redelivers the same occurrence.
                const carried = this.memberReminderWakes.get(message.id);
                if (carried === undefined)
                    return;
                this.memberReminderWakes.delete(message.id);
                this.consumeMemberReminders(carried);
            });
            this.ctx.on('agent/inbox/discarded', ({ agent, message }) => {
                // A discard this Host itself initiated is expected whatever tracked it: the
                // acceptance reminder is not in `pendingTeamWakes`, so this check must not
                // sit behind that lookup or the id would be retained forever.
                if (this.expectedInboxDiscards.delete(message.id))
                    return;
                const pending = this.pendingTeamWakes.get(message.id);
                if (pending === undefined)
                    return;
                this.pendingTeamWakes.delete(message.id);
                this.memberReminderWakes.delete(message.id);
                const member = this.memberForAgent(agent);
                if (member === undefined || member.state !== 'enabled' || agent.id !== pending.sessionId)
                    return;
                this.setPreTurnCancellation(member.memberId, pending.sessionId);
                this.emitMemberPresenceChanged(member);
            });
            const storageDomain = this.openTeamStorage();
            const domain = await storageDomain.open(agentTeamDomainSpec);
            const subscriptionDomain = await storageDomain.open(subscriptionDomainSpec);
            this.ctx.effect(() => async () => {
                this.accepting = false;
                // Stop admitting runs before anything they write stops being served, and
                // wait for the ones already executing: a late result must never reach a
                // store this shutdown is about to close.
                await this.subscriptionScheduler?.stop();
                // Host shutdown must not depend on a turn that may never end: release
                // every wait (in-chain idle waits through the gate, boundary waits
                // through the runtime), so the chains below can drain to zero first.
                this.shutdown.resolve();
                this.shutdownController.abort({ kind: 'disposed' });
                this.memberRuntime.releaseTurnWaits();
                this.recovery.dispose();
                this.contextManagement.dispose();
                await this.workerRegistry.dispose();
                if (this.attachmentGcTimer !== undefined)
                    clearInterval(this.attachmentGcTimer);
                this.attachmentGcTimer = undefined;
                if (this.admissionPumpTimer !== undefined)
                    clearInterval(this.admissionPumpTimer);
                this.admissionPumpTimer = undefined;
                if (this.memberReminderTimer !== undefined)
                    clearTimeout(this.memberReminderTimer);
                this.memberReminderTimer = undefined;
                this.memberReminderWakes.clear();
                this.memberReminderConsumeFailures.clear();
                this.emitChanged();
                // Every lifecycle operation enqueued before `accepting` flipped is in
                // one of the two maps (new ones reject at enqueue), so this snapshot
                // drains them all.
                await Promise.all([...this.memberLifecycleTails.values(), ...this.additionLifecycleTails.values()]);
                await this.reminderEvaluationTail;
                await Promise.all([...this.handles.values()].map(handle => this.disposeWithWakeGuard(handle)));
                this.handles.clear();
                this.memberRuntime.disposeAll();
                this.runningAgents.clear();
                await domain.close();
                await subscriptionDomain.close();
                await this.backend?.close();
            }, 'agentTeam.dispose');
            this.domain = domain;
            const ledger = new AgentTeamLedger(domain.table('operations'), {
                areFactsVisible: surfaceVisibilityProbe(memberId => this.handles.get(memberId)?.agent),
                areMainEntriesVisible: (memberId, entries, projectRef) => {
                    const agent = this.handles.get(memberId)?.agent;
                    if (agent === undefined)
                        return false;
                    const surface = visibleTeamSurface(agent);
                    return entries.every(entry => isMainEntryOnSurface(surface, entry, projectRef));
                },
            });
            this.ledger = ledger;
            // A live Config edit in the constructor's window may have arrived before
            // the ledger existed; sync once here so @ matching starts from the stored
            // name.
            this.syncHumanHandle();
            this.migrateLegacyHostRow();
            const initialization = await ledger.initialize();
            if (initialization.committed)
                this.emitCommitted(initialization.value);
            this.startAttachmentGc(ledger);
            // A downtime make-up is derived from the durable ledger, so boot evaluates
            // it once rather than waiting for the next scheduled occurrence.
            this.scheduleMemberReminderEvaluation();
            // One metadata listing serves every Member restore; per-member list calls
            // would repeat the same I/O linearly during startup.
            const persistedSessions = new Set((await this.persistedSessionHeaders()).map(snapshot => snapshot.header.id));
            await this.sweepWorkspaceParticipations(ledger);
            for (const member of ledger.listMembers()) {
                if (member.state === 'enabled') {
                    // A swap that committed but never finished leaves no live handle to reveal it: startup derives the outstanding effects from the ledger and the registry's archive set.
                    // A Workspace fault must not keep the Member from running, so activation still runs when the retire half cannot be finished.
                    try {
                        await this.finishMemberTransition(member.memberId, { knownSessions: persistedSessions });
                    }
                    catch (error) {
                        this.ctx.logger.warn(`agent-team: could not finish the recorded Session transition for member '${member.handle}': ${error instanceof Error ? error.message : String(error)}`);
                    }
                    // Activation reads the binding as it stands NOW: finishing the
                    // transition above may have moved the Member onto its successor, and
                    // activating the row this loop was entered with would resume the
                    // generation the ledger already retired.
                    const current = ledger.getMember(member.memberId);
                    if (current !== undefined && !this.handles.has(current.memberId)) {
                        await this.activateMember(current, undefined, persistedSessions);
                    }
                }
                else {
                    // Every other durable state converges through the effect table its operation runs after commit, finishing a crash or failed call between commit and effect.
                    // One Member's fault must not fail the boot: it is logged and retried at the next startup.
                    try {
                        await this.convergeMemberEffects(member);
                    }
                    catch (error) {
                        this.ctx.logger.warn(`agent-team: could not converge member '${member.handle}' to its '${member.state}' state: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
            // Timers start last: every Member is settled, so a run that finishes
            // immediately can already reach the owners it must notify.
            await this.startSubscriptionRuntime(subscriptionDomain);
        }
        /**
         * Lazy Workspace-deletion handling: deletion is detectable only through the registry (no event).
         * A dead non-default participation is withdrawn through the normal leave path; a dead default Workspace is left alone and the Member surfaces as unavailable.
         */
        async sweepWorkspaceParticipations(ledger) {
            for (const member of ledger.listMembers()) {
                if (member.state === 'inactive' || member.state === 'archived')
                    continue;
                for (const workspaceId of ledger.workspacesOf(member.memberId)) {
                    if (workspaceId === member.workspaceId || this.ctx.workspaceRegistry.get(workspaceId) !== undefined)
                        continue;
                    this.ctx.logger.warn(`agent-team: workspace '${workspaceId}' is gone; withdrawing member '${member.handle}' from it`);
                    try {
                        await ledger.leaveWorkspace({ requestId: randomUUID(), workspaceId, memberId: member.memberId, actor: agentTeamHumanActor() });
                    }
                    catch (error) {
                        this.ctx.logger.warn(`agent-team: failed to withdraw member '${member.handle}' from deleted workspace '${workspaceId}': ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
        }
        /**
         * Whether one Member Session has durable persisted content, decided through {@link SessionPersistence.stat}:
         * it reports a still-draining session via its pending header, so a resume racing a suspend's final flush cannot fork a fresh generation over it.
         */
        async sessionPersisted(sessionId) {
            return this.sessionReader.exists(sessionId);
        }
        /** Resolve one exact live Agent to its durable Team Member; forks do not inherit identity. */
        memberForAgent(agent) {
            for (const [memberId, handle] of this.handles) {
                if (handle.agent === agent)
                    return this.requireLedger().getMember(memberId);
            }
            return undefined;
        }
        members() {
            return this.requireLedger().listMembers().map(member => this.memberStatus(member));
        }
        /** Read-only navigation lookup for branded Task refs found in message bodies. */
        resolveTaskRefs(request) {
            this.requireWorkspace(request.workspaceId);
            const seen = new Set();
            const taskRefs = request.taskRefs.filter(taskRef => {
                if (seen.has(taskRef))
                    return false;
                seen.add(taskRef);
                return true;
            });
            return Object.freeze({ resolved: Object.freeze(this.requireLedger().resolveTaskRefs(request.workspaceId, taskRefs)) });
        }
        /** Read-only navigation lookup for branded Thread refs found in message bodies. */
        resolveThreadRefs(request) {
            this.requireWorkspace(request.workspaceId);
            const seen = new Set();
            const threadRefs = request.threadRefs.filter(threadRef => {
                if (seen.has(threadRef))
                    return false;
                seen.add(threadRef);
                return true;
            });
            return Object.freeze({ resolved: Object.freeze(this.requireLedger().resolveThreadRefs(request.workspaceId, threadRefs)) });
        }
        /** Read-only lookup resolving each reply's parent into its author and excerpt. */
        resolveMessageRefs(request) {
            this.requireWorkspace(request.workspaceId);
            const seen = new Set();
            const messageRefs = request.messageRefs.filter(messageRef => {
                if (seen.has(messageRef))
                    return false;
                seen.add(messageRef);
                return true;
            });
            return Object.freeze({ resolved: Object.freeze(this.requireLedger().resolveMessageRefs(request.workspaceId, messageRefs)) });
        }
        membersForClient(request) {
            if (request.workspaceId !== undefined)
                this.requireWorkspace(request.workspaceId);
            const ledger = this.requireLedger();
            return this.members()
                .filter(status => request.workspaceId === undefined || ledger.participatesIn(status.member.memberId, request.workspaceId))
                .map(({ member: { privateMemoryPath: _privateMemoryPath, ...member }, ...status }) => Object.freeze({ ...status, member: Object.freeze(member), workspaceIds: ledger.workspacesOf(member.memberId) }));
        }
        /** Emit a current baseline, then coalesced invalidations until canceled. */
        async *changes(request, signal) {
            const scope = this.validateChangeScope(request.scope);
            let pending;
            let resume;
            const waiter = {
                scope,
                wake: version => {
                    pending = version;
                    resume?.();
                },
            };
            const onAbort = () => { resume?.(); };
            if (signal?.aborted || !this.accepting)
                return;
            this.changeWaiters.add(waiter);
            signal?.addEventListener('abort', onAbort, { once: true });
            try {
                // Listen before yielding so a commit during the consumer's read is kept.
                yield { version: this.changeVersionOf(scope) };
                while (!signal?.aborted && this.accepting) {
                    if (pending === undefined)
                        await new Promise(resolve => { resume = resolve; });
                    resume = undefined;
                    if (signal?.aborted || !this.accepting)
                        return;
                    if (pending !== undefined) {
                        const version = pending;
                        pending = undefined;
                        yield { version };
                    }
                }
            }
            finally {
                this.changeWaiters.delete(waiter);
                signal?.removeEventListener('abort', onAbort);
            }
        }
        /** Return durable Team status without issuing a model request or a storage write. */
        status() {
            return this.requireLedger().status();
        }
        async createProject(request) {
            this.requireAccepting();
            this.requireWorkspace(request.workspaceId);
            const ledger = this.requireLedger();
            if (!ledger.hasCommitted(request.requestId))
                this.assertProjectMembersAvailable(request.memberIds);
            const result = await ledger.createProject({ ...request, actor: agentTeamHumanActor() });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        /** Human rename of one Project's display facts; identity refs are immutable. */
        async updateProject(request) {
            this.requireAccepting();
            this.requireWorkspace(request.workspaceId);
            const result = await this.requireLedger().updateProject({ ...request, actor: agentTeamHumanActor() });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        /**
         * Archive one Project: hidden from every surface with all facts kept. Member sessions stay live,
         * active Claims on its Threads release, and affected Members' Attention clears.
         */
        async archiveProject(request) {
            this.requireAccepting();
            this.requireWorkspace(request.workspaceId);
            const result = await this.requireLedger().archiveProject({ ...request, actor: agentTeamHumanActor() });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            // Archiving stops every subscription the Project owns, so their queues and
            // history are cleared at the decision instead of waiting for the next boot.
            if (result.committed)
                await this.forgetProjectSubscriptions(request.projectRef);
            return result.value;
        }
        /** Drop the private state of every subscription a Project owns: none of it can run or publish again. */
        async forgetProjectSubscriptions(projectRef) {
            for (const subscription of this.requireLedger().subscriptionsOfProject(projectRef)) {
                await this.forgetSubscriptionPrivateState(subscription.subscriptionRef);
            }
        }
        /** Human grant of Project ownership to one Agent Member of the Project's Workspace. */
        async addProjectOwner(request) {
            this.requireAccepting();
            this.requireWorkspace(request.workspaceId);
            const result = await this.requireLedger().addProjectOwner({ ...request, actor: agentTeamHumanActor() });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        /** Human withdrawal of one Agent Member's Project ownership; the Human owner cannot be removed. */
        async removeProjectOwner(request) {
            this.requireAccepting();
            this.requireWorkspace(request.workspaceId);
            const result = await this.requireLedger().removeProjectOwner({ ...request, actor: agentTeamHumanActor() });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        /** Create a durable Member and atomically grant its declared initial Projects. */
        async addMember(request) {
            return this.enqueueAddition(request.requestId, async () => {
                const workspace = this.requireWorkspace(request.workspaceId);
                await this.assertModelRoute(request.model);
                const memberId = `member:${randomUUID()}`;
                const member = Object.freeze({
                    memberId,
                    sessionId: SessionId(`agent-team-${randomUUID()}`),
                    workspaceId: request.workspaceId,
                    handle: request.handle,
                    description: request.description,
                    presetId: request.presetId,
                    ...(request.model === undefined ? {} : { model: Object.freeze({ ...request.model }) }),
                    ...(request.capabilities === undefined ? {} : { capabilities: Object.freeze(deepCopyCapabilities(request.capabilities)) }),
                    privateMemoryPath: dshHomePath('agent-team', 'members', memberMemoryDirectoryName(memberId)),
                    state: 'enabled',
                });
                const ledger = this.requireLedger();
                const result = await ledger.addMember({ ...request, actor: agentTeamHumanActor(), member });
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
                const stored = result.value.member;
                if (!this.handles.has(stored.memberId))
                    await this.activateMember(stored, workspace.path);
                // Creation seeds exactly the creation Workspace participation; attach it
                // here (like membersForClient) so the Client never synthesizes it.
                return Object.freeze({ receipt: result.value.receipt, status: this.memberStatus(stored), workspaceIds: ledger.workspacesOf(stored.memberId) });
            });
        }
        /** Commit suspended intent, then dispose the owned AgentHandle; the Session stays. */
        async suspendMember(request) {
            return this.enqueueLifecycle(request.memberId, async () => {
                const result = await this.requireLedger().suspendMember({ ...request, actor: agentTeamHumanActor() });
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
                await this.convergeMemberEffects(result.value.member);
                return Object.freeze({ receipt: result.value.receipt, status: this.memberStatus(result.value.member) });
            });
        }
        async resumeMember(request) {
            return this.enqueueLifecycle(request.memberId, async () => {
                const result = await this.requireLedger().resumeMember({ ...request, actor: agentTeamHumanActor() });
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
                this.dropInboxCoverage(result.value.member.memberId);
                // The suspended Session's log is durable once its retirement completes, and agents.resume() waits for exactly that.
                // Re-listing the persistence tree would race the retirement on Windows (transient staging entries surface as ENOENT), so pass the known session.
                await this.activateMember(result.value.member, undefined, new Set([result.value.member.sessionId]));
                return Object.freeze({ receipt: result.value.receipt, status: this.memberStatus(result.value.member) });
            });
        }
        /**
         * Operator nudge for a Member that stopped making progress: steer a continuation prompt into its live session,
         * rebuild it after an orphaned preset composition, or re-run activation when none is live.
         * Runtime-only (no ledger operation); also cancels any pending automatic recovery episode.
         * A non-enabled Member still holding a live handle is an interrupted suspend/archive/remove; recovery finishes that cleanup.
         */
        async recoverMember(request) {
            this.requireAccepting();
            const member = this.requireLedger().getMember(request.memberId);
            if (member === undefined || !this.requireLedger().participatesIn(request.memberId, request.workspaceId))
                throw new Error(`unknown Member '${request.memberId}' in workspace '${request.workspaceId}'`);
            this.recovery.stopTracking(request.memberId, 'manual');
            const handle = this.handles.get(request.memberId);
            // A committed renewal or rollover whose retire or activation never finished leaves no live generation (or the retired one still live):
            // recovery finishes that recorded transition rather than restarting a Session the ledger has moved off.
            const stranded = handle === undefined || handle.agent.id !== member.sessionId;
            const recordedTransition = this.requireLedger().lastTransitionForMember(request.memberId);
            if (stranded && member.state === 'enabled' && recordedTransition !== undefined) {
                this.ctx.logger.info(`agent-team: finishing the recorded Session transition for ${this.memberScope(request.memberId, recordedTransition.targetSessionId)} previousSession '${recordedTransition.previousSessionId}'`);
                const settled = await this.enqueueLifecycle(request.memberId, async () => {
                    await this.finishMemberTransition(request.memberId);
                    return this.requireLedger().getMember(request.memberId) ?? member;
                });
                return Object.freeze({ status: this.memberStatus(settled) });
            }
            // A live handle on a non-enabled Member is residue of a suspend, archive, or removal whose disposal failed after commit:
            // recovery re-runs that state's effects instead of resuming or rebuilding the stray generation.
            if (member.state !== 'enabled' && handle !== undefined) {
                this.ctx.logger.info(`agent-team: finishing the interrupted ${member.state} cleanup for ${this.memberScope(request.memberId)}`);
                const settled = await this.enqueueLifecycle(request.memberId, async () => {
                    await this.convergeMemberEffects(member);
                    return this.requireLedger().getMember(request.memberId) ?? member;
                });
                return Object.freeze({ status: this.memberStatus(settled) });
            }
            // An orphaned composition cannot be steered: its tools are gone, so a
            // continuation prompt reaches an inert Member. Rebuild the Agent in place.
            if (handle !== undefined && this.ctx.agentPresets.composedPreset(handle.agent.ctx) === undefined) {
                this.ctx.logger.info(`agent-team: rebuilding ${this.memberScope(request.memberId)} after its preset composition was orphaned by a reload`);
                await this.reactivateMember(request.memberId);
                return Object.freeze({ status: this.memberStatus(member) });
            }
            // A failed activation also leaves nothing to steer; re-running it is the
            // only way back. A renewed failure stays non-throwing: the refreshed
            // status carries the activation diagnostic for the sidebar.
            if (handle === undefined) {
                if (member.state !== 'enabled')
                    throw new Error(`Agent Member '${member.handle}' is ${member.state}; only enabled Members can be restarted`);
                this.ctx.logger.info(`agent-team: restarting ${this.memberScope(request.memberId)} after a failed activation`);
                // A refusal stays a deterministic failure the retry reports again; the
                // restart does not heal it.
                await this.reactivateMember(request.memberId);
                return Object.freeze({ status: this.memberStatus(member) });
            }
            this.steerResume(member, this.manualResumeText(), 'operator recovery');
            return Object.freeze({ status: this.memberStatus(member) });
        }
        /**
         * Finish one Member's committed Session transition, whichever half a failure interrupted. Each external effect is derived fresh:
         * retire a generation still live on the old Session, archive the retired Session unless the registry already reports it archived,
         * and activate the target when no live generation runs it. A live handle alone never decides completion; the registry's archive set is the evidence for the archive step.
         *
         * `forkedFrom` marks a planned in-process activation (the caller just retired that Session): its absence tells `activateMember` the Session may never have materialized, so it runs the carried-input replay.
         * Callers must hold the lifecycle queue (or run before other lifecycle work); this method does not re-enter it.
         */
        async finishMemberTransition(memberId, options) {
            const member = this.requireLedger().getMember(memberId);
            if (member === undefined || member.state !== 'enabled')
                return;
            const transition = this.requireLedger().lastTransitionForMember(memberId);
            if (transition === undefined)
                return;
            const live = this.handles.get(memberId);
            if (live !== undefined && live.agent.id !== member.sessionId) {
                await this.retireMemberGeneration(memberId, live, live.agent.id);
            }
            await this.archiveRetiredSession(transition.previousSessionId);
            if (this.handles.get(memberId) === undefined) {
                await this.activateMember(member, undefined, options?.knownSessions, options?.forkedFrom);
            }
        }
        /**
         * Converge one Member's external effects onto its durable lifecycle state: the effect table every lifecycle operation runs after commit and startup re-runs for non-enabled Members.
         *
         * - `suspended`: no live handle; the Session and private memory stay.
         * - `archived`: no live handle; the Session is hidden from grouping surfaces; log and private memory stay.
         * - `inactive`: no live handle; the Session is archived and private memory deleted.
         *
         * `enabled` has no entry: its effects belong to the Session transition and activation. Every step is derived from durable state and safe to repeat,
         * so a repeat after a crash runs exactly the owed steps and never a second durable write. Callers must hold the lifecycle queue (or run before other lifecycle work).
         */
        async convergeMemberEffects(member) {
            if (member.state === 'enabled')
                return;
            await this.disposeMemberSession(member.memberId, member);
            if (member.state === 'archived') {
                if (!this.ctx.workspaceRegistry.archivedSessionIds.includes(member.sessionId)) {
                    await this.ctx.workspaceRegistry.archiveSession(member.sessionId);
                }
            }
            else if (member.state === 'inactive') {
                await this.memberRuntime.cleanupRemovedMember(member);
            }
        }
        /**
         * Retire one Member's previous generation after its durable binding moved
         * onto a new Session id: drop the old handle's transient state, dispose the
         * Agent, and archive the old Session log.
         */
        async retireMemberGeneration(memberId, active, previousSessionId) {
            this.recovery.stopTracking(memberId, 'session-disposed');
            await this.waitLogged('wait-external', { label: this.memberLabel(memberId), sessionId: previousSessionId }, 'for the retired Agent to release its Session write path', () => this.disposeWithWakeGuard(active));
            this.handles.delete(memberId);
            this.memberRuntime.forgetMember(memberId);
            this.clearMemberFailure(memberId, 'activation');
            this.dropInboxCoverage(memberId);
            // The previous log survives on disk; archiving hides it from every
            // grouping surface so one Member keeps exactly one visible Session.
            await this.waitLogged('wait-external', { label: this.memberLabel(memberId), sessionId: previousSessionId }, 'for the Workspace registry to archive the retired Session', () => this.ctx.workspaceRegistry.archiveSession(previousSessionId));
        }
        isOrdinaryInput(message) {
            return !this.isTeamWake(message) && !isAgentTeamContextSource(message);
        }
        queuedInputOf(agent) {
            return [...agent.inbox.nextTurn, ...agent.inbox.nextStep].filter(message => this.isOrdinaryInput(message));
        }
        async archiveRetiredSession(sessionId) {
            if (!this.ctx.workspaceRegistry.archivedSessionIds.includes(sessionId))
                await this.ctx.workspaceRegistry.archiveSession(sessionId);
        }
        /**
         * Execute one prepared generation swap at a true idle boundary: commit the idempotent Host-actor operation, retire the previous generation, activate the fresh Session.
         * The Team Inbox is rederived, never copied; there is no handoff envelope, because a successor told it received one performs the handoff instead of reading its memory.
         */
        async executeMemberTransition(memberId, plan) {
            await this.enqueueLifecycle(memberId, async () => {
                this.requireAccepting();
                const stored = this.requireLedger().getMember(memberId);
                if (stored === undefined || stored.state !== 'enabled')
                    throw new Error(`Agent Member '${memberId}' cannot recycle: not enabled`);
                if (stored.sessionId !== plan.previousSessionId)
                    throw new Error(`Agent Member '${stored.handle}' is no longer bound to the recycled Session`);
                const active = this.handles.get(memberId);
                if (active !== undefined) {
                    // Public idle status also includes maintenance; whenIdle waits for both.
                    await this.waitLogged('wait-turn', { label: stored.handle, sessionId: stored.sessionId }, 'for the turn to converge before the Session transition', () => Promise.race([active.agent.whenIdle(), this.shutdown.promise]));
                    if (this.runningAgents.has(active.agent.id))
                        throw new Error(`Agent Member '${stored.handle}' is still running; the recycle must wait for idle`);
                    const queued = this.queuedInputOf(active.agent);
                    if (queued.length > 0) {
                        throw new Error(`the context recycle is deferred: this generation has ${queued.length} queued message(s) that would not survive the switch`);
                    }
                    // Disposal cancels the Agent's jobs, so a case that would silently
                    // discard unfinished or unreported output keeps the old generation.
                    const blockingJobs = this.ownedJobsBlockingRecycle(active.agent);
                    if (blockingJobs.length > 0) {
                        throw new Error(`the context recycle is refused: this Member now owns jobs that would not survive the switch (${blockingJobs.join(', ')})`);
                    }
                }
                const commit = (inputFromSeq) => this.requireLedger().recycleMemberSession({
                    requestId: plan.requestId,
                    workspaceId: stored.workspaceId,
                    memberId,
                    previousSessionId: plan.previousSessionId,
                    newSessionId: plan.newSessionId,
                    actor: agentTeamHostActor(),
                    ...(inputFromSeq === undefined ? {} : { inputFromSeq }),
                });
                const recycled = active === undefined ? await commit() : await active.agent.runMaintenance(async () => {
                    // Maintenance holds later waking input in the durable inbox until the
                    // ledger has recorded where its successor must start replaying.
                    const result = await commit(active.agent.session.seq);
                    this.retiringAgents.add(active.agent);
                    active.agent.cancel({ kind: 'disposed' }, { keepInbox: true });
                    return result;
                });
                this.emitCommitted(recycled.value.receipt);
                if (active === undefined)
                    await this.archiveRetiredSession(plan.previousSessionId);
                else
                    await this.retireMemberGeneration(memberId, active, plan.previousSessionId);
                // Linear succession: the new Session's lineage parent is the one it
                // replaces. Activation defers the Inbox wake until input replay completes.
                await this.activateMember(recycled.value.member, undefined, undefined, plan.previousSessionId, { deferNotify: true });
                const reactivated = this.handles.get(memberId);
                if (reactivated === undefined) {
                    throw new Error(`Agent Member '${stored.handle}' failed to activate its next context: ${this.memberFailures.get(memberId)?.activation ?? 'unknown error'}`);
                }
                const notifications = this.requireLedger().notificationFacts(recycled.value.member.memberId);
                if (notifications.length > 0 || this.requireLedger().mainNotificationFacts(recycled.value.member.memberId).length > 0) {
                    this.notifyMember(reactivated.agent, {
                        kind: 'transition',
                        requestId: plan.requestId,
                        previousSessionId: plan.previousSessionId,
                    });
                }
            });
        }
        memberLabel(memberId) {
            return this.ledger?.getMember(memberId)?.handle ?? memberId;
        }
        /**
         * Run one lifecycle wait and log its class, subject, and duration, so an operator can tell a Member parked on its own turn (`wait-turn`)
         * from one parked on an external service (`wait-external`).
         */
        async waitLogged(stage, subject, detail, wait) {
            const started = Date.now();
            try {
                return await wait();
            }
            finally {
                this.ctx.logger.info(`agent-team: member '${subject.label}' session '${subject.sessionId}' stage '${stage}' waited ${Date.now() - started}ms ${detail}`);
            }
        }
        /**
         * Cache GC: uploads referenced by a Message survive 72h from upload; orphans (never sent) go after 24h.
         * Runs at startup and then daily, in-process only because the cache is transient.
         */
        startAttachmentGc(ledger) {
            const sweep = async () => {
                await sweepAttachmentCache(attachmentsRoot(), ledger.referencedAttachmentIds(), Date.now());
            };
            void sweep();
            this.attachmentGcTimer = setInterval(() => { void sweep(); }, 24 * 60 * 60 * 1000);
            this.attachmentGcTimer.unref?.();
        }
        automaticResumeText() {
            return 'Your previous turn ended early due to a temporary service error. Please continue the work you were doing before the error.';
        }
        manualResumeText() {
            return 'The operator asked you to resume after the previous turn ended early. Please continue the work you were doing before the error.';
        }
        /**
         * Steer one continuation message into a Member's live session and log the delivery. Throws when no handle exists so the coordinator stops tracking.
         * Appends the inbox snapshot when there is anything new; a steered continuation is queued for the next step, not read.
         */
        steerResume(member, text, trigger) {
            const handle = this.handles.get(member.memberId);
            if (handle === undefined)
                throw new Error(`member '${member.handle}' has no active session`);
            const material = this.requireLedger().notificationSnapshot(member.memberId);
            const notifications = material.threads;
            const mainNotifications = material.main;
            const memberReminders = material.memberReminders;
            // A Member reminder is unread like any other durable fact, so the recovery
            // instruction carries it too: otherwise the reminder would be answered by a
            // notice that never mentioned it, and a one-shot would never fire again.
            const notice = notifications.length === 0 && mainNotifications.length === 0 && memberReminders.length === 0 ? undefined
                : this.notificationText(handle.agent, notifications, member.memberId, mainNotifications, undefined, text, memberReminders, material.workers);
            const body = notice === undefined ? text : `${text}\n\n${notice.text}`;
            const hint = createUserMessage({
                content: [{ type: 'text', text: body }],
                source: { kind: AGENT_TEAM_PLUGIN_ID, form: 'notice', summary: TEAM_RECOVERY_NOTICE_SUMMARY,
                    teamFacts: teamMessageSurface(body, notice?.messages ?? [], notice?.activities ?? []) },
            });
            for (const pending of [...handle.agent.inbox.nextStep, ...handle.agent.inbox.nextTurn]) {
                if (this.isInboxNotice(pending))
                    this.removeExpectedTeamWake(handle.agent, pending);
            }
            this.trackTeamWake(handle.agent, hint);
            // The occurrences this recovery instruction rendered are the ones its claim
            // consumes, exactly as an Inbox notice's claim does.
            if (notice !== undefined && notice.deliveredReminders.length > 0) {
                this.memberReminderWakes.set(hint.id, { memberId: member.memberId, reminders: notice.deliveredReminders });
            }
            handle.agent.steer(hint);
            this.ctx.logger.info(`agent-team: ${trigger} continuation steered for ${this.memberScope(member.memberId, handle.agent.session.id)}${notifications.length === 0 && mainNotifications.length === 0 && memberReminders.length === 0 ? '' : ` carrying ${this.notificationIdentity(notifications, mainNotifications, memberReminders)}`}: it is queued for the Member's next step, not yet read by the model`);
        }
        /** Automatic-recovery wakeup; throwing tells the coordinator the target is gone. */
        injectRecovery(memberId) {
            const handle = this.handles.get(memberId);
            const agent = handle?.agent;
            const member = agent !== undefined ? this.memberForAgent(agent) : undefined;
            if (agent === undefined || member === undefined || member.state !== 'enabled')
                throw new Error(`member '${memberId}' cannot be recovered automatically`);
            this.steerResume(member, this.automaticResumeText(), 'automatic recovery');
        }
        /**
         * Human edit of one Member's mutable facts. A live model edit records the new route in the Session log through the public model-selection seam, so no Agent is disposed: disposing an Agent emits session/disposed,
         * which makes the Web Client permanently mark the same Session id unavailable even if Team recreates it.
         */
        async updateMember(request) {
            return this.enqueueLifecycle(request.memberId, async () => {
                await this.assertModelRoute(request.model);
                const previous = this.requireLedger().getMember(request.memberId);
                const result = await this.requireLedger().updateMember({ ...request, actor: agentTeamHumanActor() });
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
                // A replayed request resolves to the member as it was at its own commit; driving the runtime from that history would let a late retry roll back a newer configuration.
                // Apply and report the currently accepted member instead (lifecycle calls serialize).
                const current = this.requireLedger().getMember(request.memberId);
                if (current === undefined)
                    throw new Error(`Agent Member '${request.memberId}' no longer exists`);
                const active = this.handles.get(request.memberId);
                let effect = 'deferred:no-live-handle';
                if (active !== undefined) {
                    effect = 'already-applied';
                    if (!isDeepStrictEqual(previous?.model ?? undefined, current.model ?? undefined)) {
                        // The public model-selection seam records the new route in the Session log: the current turn keeps its fixed route and the next step picks this one up, so no Agent disposal is needed.
                        active.agent.model.select(current.model ?? this.ctx.agentDefaultModel.currentSelection());
                        effect = 'applied';
                    }
                    if (!this.memberRuntime.appliedCapabilitiesMatch(current.memberId, current.capabilities)) {
                        try {
                            effect = await this.applyCapabilityEdit(active, current);
                        }
                        catch (error) {
                            // The rejection stays loud for the caller; the failure is also kept as a routable, member-visible diagnostic and logged before it escapes.
                            const message = error instanceof Error ? error.message : String(error);
                            this.setCapabilityApplyDiagnostic(current.memberId, Object.freeze({
                                class: 'capability-apply',
                                sessionId: active.agent.session.id,
                                detail: `requestId=${request.requestId} operationId=${result.value.receipt.operationId} stage=apply error=${message}`,
                            }));
                            this.ctx.logger.warn(`agent-team: capability apply failed for member '${this.memberLabel(current.memberId)}' session '${active.agent.session.id}' requestId '${request.requestId}' operationId '${result.value.receipt.operationId}' stage 'apply': ${message}`);
                            throw error;
                        }
                    }
                    // The failure slot exists to bridge the gap until the stored intent is
                    // actually in force; an already-applied row retires a stale one too.
                    if (this.memberRuntime.appliedCapabilitiesMatch(current.memberId, current.capabilities)) {
                        this.clearMemberFailure(current.memberId, 'capabilityApply');
                    }
                }
                return Object.freeze({ receipt: result.value.receipt, status: this.memberStatus(current), effect });
            });
        }
        /**
         * Live-apply a capability edit at a turn boundary: the current turn keeps its schemas and catalog; once idle, the next step recomputes them
         * from the new restriction and selection, with the same Session and history. Suspend/remove during the wait cancels the swap.
         */
        async applyCapabilityEdit(active, stored) {
            const memberId = stored.memberId;
            const started = Date.now();
            let boundary = await this.memberRuntime.awaitTurnBoundary(active);
            // A new turn can start after the boundary resolves but before this
            // continuation. Apply only once the Member is still idle immediately
            // before the synchronous swap, preserving that turn's frozen grants.
            while (this.accepting && this.handles.get(memberId) === active && this.runningAgents.has(active.agent.id)) {
                boundary = await this.memberRuntime.awaitTurnBoundary(active);
            }
            if (boundary === 'waited') {
                // Only real waits are logged: an edit applied to an already-idle Member
                // spends no time here and would only add noise.
                this.ctx.logger.info(`agent-team: member '${stored.handle}' session '${stored.sessionId}' stage 'wait-turn' waited ${Date.now() - started}ms for its turn boundary before applying the stored configuration`);
            }
            // Shutdown releases boundary waits before disposing the active handles;
            // it must not install another observer or apply to that retiring scope.
            if (!this.accepting || this.generationSwappedDuringWait(memberId, active, boundary))
                return 'deferred:generation-changed';
            this.memberRuntime.reapplyMemberToolPolicy(stored, this.workerEnabled(), this.extraToolGrants());
            this.memberRuntime.swapSkillSelection(memberId, stored.capabilities?.skills?.allow);
            this.memberRuntime.recordAppliedCapabilities(memberId, stored.capabilities);
            return 'applied';
        }
        /**
         * Whether this Member's live handle was replaced while `applyCapabilityEdit` waited for the turn boundary (suspend, removal, restart),
         * so the queued edit must not apply to the generation it originally targeted.
         */
        generationSwappedDuringWait(memberId, waitedOn, boundary) {
            return boundary === 'waited' && this.handles.get(memberId) !== waitedOn;
        }
        /** Irreversibly remove one Member, archive its Session, and delete its private namespace. */
        async removeMember(request) {
            return this.enqueueLifecycle(request.memberId, async () => {
                const result = await this.requireLedger().removeMember({ ...request, actor: agentTeamHumanActor() });
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
                await this.convergeMemberEffects(result.value.member);
                return result.value;
            });
        }
        /**
         * Archive one Member: commit the archival, dispose its live session (private memory and the Session log stay on disk),
         * and archive the Session from every grouping surface. All active Claims release and the Member's Attention clears.
         */
        async archiveMember(request) {
            return this.enqueueLifecycle(request.memberId, async () => {
                const result = await this.requireLedger().archiveMember({ ...request, actor: agentTeamHumanActor() });
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
                await this.convergeMemberEffects(result.value.member);
                return result.value;
            });
        }
        /** Human-only Task resolution. Business fences are returned as typed outcomes. */
        async changeTask(request) {
            this.requireAccepting();
            this.requireWorkspace(request.workspaceId);
            const result = await this.requireLedger().changeTask({ ...request, actor: agentTeamHumanActor() });
            this.emitCommittedOutcome(result);
            return result.value;
        }
        /** Human-only promotion of a taskless Thread into a real Task plus public Message. */
        async promoteThread(request) {
            this.requireAccepting();
            this.requireWorkspace(request.workspaceId);
            const result = await this.requireLedger().promoteThread({ ...request, actor: agentTeamHumanActor() });
            this.emitCommittedOutcome(result);
            return result.value;
        }
        /**
         * Human-only Task responsibility transfer. It shares the ledger path, the request/result contract, and the
         * authority rules with `transferTaskForAgent`: the Host decides whether the actor may move this Task and whether
         * the target is a legal accountable, so the Client offers targets without re-implementing either judgement. From
         * rules version 3 a target need only take part in the Project, so following the Thread is offered by the dialog
         * rather than required by the Host.
         */
        async transferTask(request) {
            this.requireAccepting();
            this.requireWorkspace(request.workspaceId);
            const result = await this.requireLedger().transferTask({ ...request, actor: agentTeamHumanActor() });
            this.emitCommittedOutcome(result);
            return result.value;
        }
        /** Human-only Workspace participation grant; a pure relation — no Session moves. */
        async joinWorkspace(request) {
            const actor = this.humanCall(request.workspaceId);
            const result = await this.requireLedger().joinWorkspace({ ...request, actor });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        /** Human-only Workspace participation withdrawal and Workspace-scoped cleanup. */
        async leaveWorkspace(request) {
            const actor = this.humanCall(request.workspaceId);
            const result = await this.requireLedger().leaveWorkspace({ ...request, actor });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        /** Human top-level start of a discussion or Task Thread. */
        async startThread(request) {
            return this.startThreadAs(this.humanCall(request.workspaceId), request);
        }
        /** Human Main stream Message. Unread Main stream entries come back as a typed outcome. */
        async postMainMessage(request) {
            return this.postMainMessageAs(this.humanCall(request.workspaceId), request);
        }
        /** Human's durable, atomically acknowledged Main stream read. */
        async readMainStream(request) {
            return this.readMainStreamAs(this.humanCall(request.workspaceId), request);
        }
        /** Human's non-mutating Main stream page with the Human's own unread standing. */
        mainStreamHistory(request) {
            this.requireWorkspace(request.workspaceId);
            return this.requireLedger().mainStreamHistory(agentTeamHumanActor(), request);
        }
        /**
         * Resolve uploaded ids and agent-supplied absolute paths into one attachment metadata list. All paths are validated before anything is copied,
         * so one rejection leaves the cache untouched; each copy takes a request-derived id, so a retry converges instead of writing an orphan.
         */
        async resolveMessageAttachments(request) {
            const fromPaths = [];
            if (request.attachmentPaths !== undefined && request.attachmentPaths.length > 0) {
                for (const absolutePath of request.attachmentPaths)
                    await validatePathAttachment(absolutePath);
                for (const [index, absolutePath] of request.attachmentPaths.entries()) {
                    fromPaths.push(Object.freeze(await copyPathAttachment(attachmentsRoot(), absolutePath, pathAttachmentId(request.requestId, index), request.requestId)));
                }
            }
            return [...fromPaths, ...await this.prepareAttachments(request.attachments)];
        }
        async prepareAttachments(requested) {
            if (requested === undefined || requested.length === 0)
                return [];
            const metadata = [];
            for (const attachmentId of requested) {
                const outcome = await readAttachment(attachmentsRoot(), attachmentId);
                if (outcome.kind === 'missing')
                    throw new Error(`attachment '${attachmentId}' is not in the upload cache`);
                const stored = outcome.attachment;
                metadata.push(Object.freeze({ attachmentId, name: stored.name, byteSize: stored.byteSize, mediaType: stored.mediaType }));
            }
            return metadata;
        }
        /**
         * Derive the stored body: one machine-facing `[attachment] <absolute path>`
         * line per attachment appended to the member-facing text.
         */
        appendAttachmentLines(body, metadata) {
            const trimmed = body.trim();
            if (metadata.length === 0)
                return trimmed;
            const lines = metadata.map(attachment => `[attachment] ${attachmentPayloadPath(attachment.attachmentId, attachment.name)}`);
            return `${trimmed}\n${lines.join('\n')}`;
        }
        /**
         * Upload one composer attachment into the cache; bytes are immutable once
         * written. The requestId is the idempotency key: a retried upload derives
         * the same cache id and replays the original result, while reusing that key
         * for a different payload is refused as a request collision.
         */
        async putAttachment(request) {
            this.requireAccepting();
            this.requireWorkspace(request.workspaceId);
            const bytes = Buffer.from(request.bytesBase64, 'base64');
            if (bytes.byteLength === 0)
                throw new Error('attachment must not be empty');
            if (bytes.byteLength > ATTACHMENT_MAX_BYTES)
                throw new Error(`attachment exceeds the ${ATTACHMENT_MAX_BYTES} byte limit`);
            const mediaType = sanitizeMediaType(request.mediaType);
            return Object.freeze(await writeRequestScopedAttachment(attachmentsRoot(), request.requestId, request.name, mediaType, bytes));
        }
        /**
         * Read one cached attachment back for client display. A gone entry is the
         * one expected failure on this path, so it carries the stable
         * `team/attachment-not-found` code the Client branches on; anything else
         * (unreadable metadata, filesystem trouble) stays an unknown Host error.
         */
        async getAttachment(request) {
            const outcome = await readAttachment(attachmentsRoot(), request.attachmentId);
            if (outcome.kind === 'missing')
                throw new RemoteError('team/attachment-not-found', `attachment '${request.attachmentId}' is no longer cached`, { attachmentId: request.attachmentId });
            const stored = outcome.attachment;
            return Object.freeze({ name: stored.name, mediaType: stored.mediaType, byteSize: stored.byteSize, bytesBase64: stored.bytes.toString('base64') });
        }
        /**
         * Local environment check for the settings page: which DSH line this Host runs against and whether it is inside this bundle's declared range.
         * Human-scoped and read-only; the verdict comes from the Harness's own compatibility evaluator.
         *
         * The wire type and `EnvironmentReport` keep separate field lists on purpose: the contract states every fact as optional because a Transport may withhold any,
         * while the report is stricter. This assignment is where the compiler holds them together.
         */
        environmentForClient(_request) {
            return Object.freeze(reportEnvironment());
        }
        /**
         * Foreign global and Agent-scoped tool names a Human could grant. Activated
         * preset baselines and Team-owned names are absent; discovery is not a
         * per-Member admission snapshot and cannot reopen protected controls.
         */
        toolCatalogForClient(_request) {
            const scoped = this.ctx.agents.list().flatMap((agent) => {
                const scope = scopeOf(agent.ctx);
                return scope === undefined ? [] : this.ctx.tools.schemas(scope);
            });
            const baseline = this.memberRuntime.baselineToolNames();
            const names = [...new Set([...this.ctx.tools.schemas(), ...scoped]
                    .map(tool => tool.name)
                    .filter(name => !baseline.has(name) && !isReservedToolName(name)
                    && extraToolGrantsFrom([name]) !== undefined))]
                .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
            return Object.freeze({ names: Object.freeze(names) });
        }
        /**
         * Human profile read for the settings page and footnote: name and avatar reference from the live Config plus version facts.
         * `latestVersion` is absent until a background refresh observes a newer published release.
         */
        humanProfileForClient(_request) {
            const profile = this.humanProfile();
            const update = this.humanUpdateCheck.snapshot();
            const settingsFence = this.humanProfileSettingsFence();
            return Object.freeze({
                name: profile.name,
                ...(profile.avatarRef === undefined ? {} : { avatarRef: profile.avatarRef }),
                ...(settingsFence === undefined ? {} : { settingsFence }),
                version: HUMAN_PROFILE_VERSION,
                repoUrl: HUMAN_PROFILE_REPO_URL,
                ...(update.latestVersion === undefined ? {} : { latestVersion: update.latestVersion }),
            });
        }
        /**
         * Prepare one avatar and commit its reference as one settings intent. A
         * confirmed settings refusal removes only this request's uncommitted bytes;
         * an uncertain write retains them for recovery.
         */
        async putHumanAvatar(request) {
            this.requireAccepting();
            const expectedRevision = this.humanProfileWriteRevision(request.expectedFence);
            const bytes = Buffer.from(request.bytesBase64, 'base64');
            const written = await writeHumanAvatar(humanAvatarsRoot(), request.name, request.mediaType ?? 'application/octet-stream', bytes);
            try {
                await this.mutateHumanProfile([{ op: 'set', path: ['avatarRef'], value: written.avatarRef }], expectedRevision);
            }
            catch (error) {
                if (errorCode(error) === 'settings/conflict') {
                    await removeHumanAvatar(humanAvatarsRoot(), written.avatarRef).catch((cleanupError) => {
                        this.ctx.logger.warn(`agent-team: could not remove an uncommitted human avatar '${written.avatarRef}': ${errorMessage(cleanupError)}`);
                    });
                }
                throw error;
            }
            return this.humanProfileWriteResult();
        }
        /** Read one human avatar back; removed entries throw and the UI falls back to hue/initial. */
        async getHumanAvatar(request) {
            const stored = await readHumanAvatar(humanAvatarsRoot(), request.avatarRef);
            if (stored === undefined)
                throw new Error(`human avatar '${request.avatarRef}' is no longer stored`);
            return Object.freeze({ name: stored.name, mediaType: stored.mediaType, byteSize: stored.byteSize, bytesBase64: stored.bytes.toString('base64') });
        }
        /** Commit the explicit no-avatar sentinel; old immutable files stay for other profiles or inherited layers. */
        async removeHumanAvatar(request) {
            this.requireAccepting();
            const expectedRevision = this.humanProfileWriteRevision(request.expectedFence);
            await this.mutateHumanProfile([{ op: 'set', path: ['avatarRef'], value: HUMAN_AVATAR_NONE }], expectedRevision);
            return this.humanProfileWriteResult();
        }
        /**
         * Rename the Human against the settings revision the page read. Avatar refs
         * have their own all-or-nothing operations above, so this method cannot turn
         * a Client string into an arbitrary file reference.
         */
        async setHumanProfile(request) {
            this.requireAccepting();
            const name = assertValidHumanName(request.name);
            this.validateHumanProfile({ name });
            const expectedRevision = this.humanProfileWriteRevision(request.expectedFence);
            await this.mutateHumanProfile([{ op: 'set', path: ['name'], value: name }], expectedRevision);
            return this.humanProfileWriteResult();
        }
        /** Current settings revision, or absent when this Host has no settings form to write against. */
        humanProfileRevision() {
            try {
                return this.ctx.get('settings')?.describe().find(row => row.ns === HUMAN_PROFILE_SETTINGS_NAMESPACE)?.revision;
            }
            catch {
                return undefined;
            }
        }
        /** The opaque value a page returns on its next write; it changes with the Host process and every settings revision. */
        humanProfileSettingsFence() {
            const revision = this.humanProfileRevision();
            return revision === undefined ? undefined : `${this.humanProfileHostFence}:${String(revision)}`;
        }
        /** Validate the Host instance before a write can touch avatar bytes, then return the Harness revision to fence. */
        humanProfileWriteRevision(expectedFence) {
            const settings = this.ctx.get('settings');
            if (settings === undefined)
                throw new RemoteError('settings/rejected', 'the settings service is unavailable', { ns: HUMAN_PROFILE_SETTINGS_NAMESPACE });
            const actual = this.humanProfileRevision();
            if (actual === undefined)
                throw new RemoteError('settings/rejected', 'the Human profile settings row is unavailable', { ns: HUMAN_PROFILE_SETTINGS_NAMESPACE });
            const separator = expectedFence.lastIndexOf(':');
            const nonce = separator < 0 ? '' : expectedFence.slice(0, separator);
            const rawRevision = separator < 0 ? '' : expectedFence.slice(separator + 1);
            const expected = /^(0|[1-9][0-9]*)$/.test(rawRevision) ? Number(rawRevision) : Number.NaN;
            if (nonce === '' || !Number.isSafeInteger(expected)) {
                throw new RemoteError('gateway/bad-request', 'invalid Human profile settings fence', {});
            }
            if (nonce !== this.humanProfileHostFence || expected !== actual) {
                throw new RemoteError('settings/conflict', 'the Human profile settings changed since this page read them', {
                    ns: HUMAN_PROFILE_SETTINGS_NAMESPACE, expected, actual,
                });
            }
            return actual;
        }
        /** The profile fields a write answers with, including the fence now in force. */
        humanProfileWriteResult() {
            const profile = this.humanProfile();
            const settingsFence = this.humanProfileSettingsFence();
            return Object.freeze({
                name: profile.name,
                ...(profile.avatarRef === undefined ? {} : { avatarRef: profile.avatarRef }),
                ...(settingsFence === undefined ? {} : { settingsFence }),
            });
        }
        /** Apply one Human-profile intent and preserve the settings service's conflict semantics on the wire. */
        async mutateHumanProfile(ops, expectedRevision) {
            const settings = this.ctx.get('settings');
            if (settings === undefined)
                throw new Error('the settings service is unavailable');
            try {
                // The namespace is the Host row id. A Remote call's fiber belongs to the gateway, not this row.
                await settings.mutate(HUMAN_PROFILE_SETTINGS_NAMESPACE, ops, expectedRevision);
            }
            catch (error) {
                const conflict = settingsConflictOf(error);
                if (conflict !== undefined) {
                    throw new RemoteError('settings/conflict', conflict.message, {
                        ns: HUMAN_PROFILE_SETTINGS_NAMESPACE, expected: conflict.expected, actual: conflict.actual,
                    }, { cause: error });
                }
                throw new RemoteError('team/human-profile-write-uncertain', `the Human profile write did not settle at the revision it read: ${errorMessage(error)}`, { expectedFence: `${this.humanProfileHostFence}:${String(expectedRevision)}` }, { cause: error });
            }
        }
        /**
         * The Human's own sidebar row order. Presentation only: it rides the Host row
         * beside the profile because it must survive a browser, and it never becomes a
         * ledger fact or an Agent-readable preference.
         */
        sidebarOrderForClient(_request) {
            return Object.freeze({ lists: readableSidebarOrders(this.config.sidebarOrder.get().lists) });
        }
        /**
         * Replace one sidebar list's saved order. Last write wins, like the profile
         * beside it: two windows dragging the same list resolve to whichever drop
         * landed last, and the next drag corrects it.
         */
        async setSidebarOrder(request) {
            this.requireAccepting();
            const problem = sidebarOrderKeyProblem(request.key);
            if (problem !== undefined)
                throw new Error(problem);
            const refs = sanitizeSidebarOrderRefs(request.refs);
            const settings = this.ctx.get('settings');
            if (settings === undefined)
                throw new Error('the settings service is unavailable');
            // One gesture, one write: the path addresses this list inside the row's
            // `sidebarOrder.lists` dict, so neither the other Workspaces' lists nor the
            // sibling Host-row groups are restated.
            await settings.mutate(HUMAN_PROFILE_SETTINGS_NAMESPACE, [{ op: 'set', path: ['sidebarOrder', 'lists', request.key], value: refs }]);
            return Object.freeze({ lists: readableSidebarOrders({ ...this.config.sidebarOrder.get().lists, [request.key]: refs }) });
        }
        /** Human existing-Thread reply; unread and revision conflicts are business outcomes. */
        async reply(request) {
            return this.replyAs(this.humanCall(request.workspaceId), request);
        }
        readMessage(request) {
            return this.readMessageAs(this.humanCall(request.workspaceId), request);
        }
        /** Human's personal Attention operation. */
        async changeAttention(request) {
            const actor = this.humanCall(request.workspaceId);
            const result = await this.requireLedger().changeAttention({ ...request, actor });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        /** Human Inbox projection; the Web Client consumes the direct-only slice as its mention queue. */
        inbox(request) {
            this.requireWorkspace(request.workspaceId);
            this.scheduleTaskReminderEvaluation();
            return this.requireLedger().inbox(agentTeamHumanActor(), request);
        }
        taskBoard(request) {
            this.requireWorkspace(request.workspaceId);
            return this.requireLedger().taskBoard(agentTeamHumanActor(), request);
        }
        /** Human's durable, atomically acknowledged Thread read. */
        async readThread(request) {
            const actor = this.humanCall(request.workspaceId);
            const result = await this.requireLedger().readThread({ ...request, actor });
            // A read that made no progress commits no operation and carries no receipt.
            const receipt = result.committed ? result.value.receipt : undefined;
            if (receipt !== undefined)
                this.emitCommitted(receipt);
            return this.withWorkerStates(result.value);
        }
        /** Human-only durable Attention observations for one Thread. */
        threadObservations(request) {
            this.requireWorkspace(request.workspaceId);
            return this.requireLedger().threadObservations(agentTeamHumanActor(), request);
        }
        /** Human's non-mutating bounded Thread history. */
        threadHistory(request) {
            this.requireWorkspace(request.workspaceId);
            return this.withWorkerStates(this.requireLedger().threadHistory(agentTeamHumanActor(), request));
        }
        /** Return the existing bounded public Workspace discovery projection. */
        view(request) {
            this.requireWorkspace(request.workspaceId);
            return this.requireLedger().view(request);
        }
        /** Agent-only start of a discussion or Task Thread; Project owners only. */
        async startThreadForAgent(agent, request) {
            return this.startThreadAs(this.memberCall(agent, request.workspaceId), request);
        }
        /** Agent-only Main stream Message. */
        async postMainMessageForAgent(agent, request) {
            return this.postMainMessageAs(this.memberCall(agent, request.workspaceId), request);
        }
        /** Agent-only Main stream read; a read with nothing to acknowledge commits nothing. */
        async readMainStreamForAgent(agent, request, select) {
            const actor = this.memberCall(agent, request.workspaceId);
            const result = await this.requireLedger().readMainStream({ ...request, actor }, select === undefined ? undefined
                : preview => select(this.mainReadContext(agent, actor, request, preview)));
            if (result.committed && result.value.receipt !== undefined)
                this.emitCommitted(result.value.receipt);
            return this.mainReadContext(agent, actor, request, result.value);
        }
        mainReadContext(agent, actor, request, read) {
            const surface = visibleTeamSurface(agent);
            const unread = read.entries.filter(entry => entry.unread);
            const history = this.requireLedger().mainStreamHistory(actor, { ...request,
                beforeSequence: unread[0]?.sequence ?? read.standing.head + 1, limit: 4 });
            const background = history.entries.filter(entry => entry.kind === 'message'
                && !unread.some(fact => fact.sequence === entry.sequence)
                && !isMainEntryOnSurface(surface, entry, read.projectRef))
                .map(entry => ({ ...entry, unread: false, direct: false }));
            const visibleMessageRefs = unread.flatMap(entry => entry.kind === 'message'
                && isMainEntryOnSurface(surface, entry, read.projectRef) ? [entry.message.messageRef] : []);
            const visibleActivityRefs = unread.flatMap(entry => entry.kind === 'activity'
                && isMainEntryOnSurface(surface, entry, read.projectRef) ? [entry.activity.activityRef] : []);
            // The ledger's page keeps its already-read Thread cards: a card is current
            // state, not unread work, and dropping it hid every Thread the reader had
            // already acknowledged once a newer entry arrived.
            const page = read.entries.filter(entry => entry.kind === 'thread-card');
            const merged = [...page, ...background, ...unread]
                .filter((entry, index, entries) => entries.findIndex(item => item.sequence === entry.sequence) === index)
                .sort((left, right) => left.sequence - right.sequence);
            return { ...read, entries: merged, visibleMessageRefs, visibleActivityRefs };
        }
        mainStreamHistoryForAgent(agent, request) {
            const actor = this.memberActor(agent);
            this.requireAgentWorkspace(actor, request.workspaceId);
            return this.requireLedger().mainStreamHistory(actor, request);
        }
        /** Agent-only existing-Thread reply. */
        async replyForAgent(agent, request) {
            return this.replyAs(this.memberCall(agent, request.workspaceId), request);
        }
        /** Read one Message back verbatim, for the reader that has to answer it. */
        readMessageForAgent(agent, request) {
            return this.readMessageAs(this.memberCall(agent, request.workspaceId), request);
        }
        /** Agent-only personal Attention change. */
        async changeAttentionForAgent(agent, request) {
            const actor = this.memberCall(agent, request.workspaceId);
            const result = await this.requireLedger().changeAttention({ ...request, actor });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        attentionStatusForAgent(agent, request) {
            const actor = this.memberActor(agent);
            this.requireAgentWorkspace(actor, request.workspaceId);
            return this.requireLedger().attentionStatus(actor, request);
        }
        /** The Agent's own Main stream Attention on one Project, answered without writing. */
        mainAttentionStatusForAgent(agent, request) {
            const actor = this.memberActor(agent);
            this.requireAgentWorkspace(actor, request.workspaceId);
            return this.requireLedger().mainAttentionStatus(actor, request);
        }
        /** Agent-only Claim mutation. */
        async changeClaimForAgent(agent, request) {
            const actor = this.memberCall(agent, request.workspaceId);
            const result = await this.requireLedger().changeClaim({ ...request, actor });
            this.emitCommittedOutcome(result);
            return result.value;
        }
        listClaimsForAgent(agent, request) {
            const actor = this.memberActor(agent);
            this.requireAgentWorkspace(actor, request.workspaceId);
            return this.requireLedger().listClaims(actor, request);
        }
        async promoteThreadForAgent(agent, request) {
            const actor = this.memberCall(agent, request.workspaceId);
            const result = await this.requireLedger().promoteThread({ ...request, actor });
            this.emitCommittedOutcome(result);
            return result.value;
        }
        /** Agent-only Task resolution: accept (in_review, never self-executed), close, reopen. */
        async changeTaskForAgent(agent, request) {
            const actor = this.memberCall(agent, request.workspaceId);
            const result = await this.requireLedger().changeTask({ ...request, actor });
            this.emitCommittedOutcome(result);
            // The verifier never holds a Claim on the Task it accepts, so the read-side
            // boundary cannot reach it: its own accept is the only boundary it gets.
            if (result.committed && request.action === 'accept')
                this.deliverAcceptanceBoundary(agent, actor.memberId, 'verifier');
            return result.value;
        }
        /** Agent-only accountability transfer to another enabled Project member or the Human. */
        async transferTaskForAgent(agent, request) {
            const actor = this.memberCall(agent, request.workspaceId);
            const result = await this.requireLedger().transferTask({ ...request, actor });
            this.emitCommittedOutcome(result);
            return result.value;
        }
        taskBoardForAgent(agent, request) {
            const actor = this.memberActor(agent);
            if (request.workspaceId === undefined)
                return this.requireLedger().memberTaskBoard(actor, request);
            this.requireAgentWorkspace(actor, request.workspaceId);
            return this.requireLedger().taskBoard(actor, { ...request, workspaceId: request.workspaceId });
        }
        /**
         * Agent-only read of the caller's own Member reminders. Reading also re-derives
         * what is due, so a Member that just learned it has reminders sees them raised.
         */
        memberRemindersForAgent(agent, request) {
            const actor = this.memberActor(agent);
            if (request.workspaceId !== undefined)
                this.requireAgentWorkspace(actor, request.workspaceId);
            this.scheduleMemberReminderEvaluation();
            return this.requireLedger().memberRemindersOf(actor.memberId);
        }
        /** Agent-only creation of a reminder for the caller itself: a reminder has exactly one recipient. */
        async createMemberReminderForAgent(agent, request) {
            const actor = this.memberCall(agent, request.workspaceId);
            const result = await this.requireLedger().createMemberReminder({ ...request, actor });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        /** Agent-only withdrawal of one of the caller's own reminders. */
        async cancelMemberReminderForAgent(agent, request) {
            const actor = this.memberCall(agent, request.workspaceId);
            const result = await this.requireLedger().cancelMemberReminder({ ...request, actor });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        /** Human read of one Member's reminders, for Member detail. */
        memberRemindersForClient(request) {
            this.requireWorkspace(request.workspaceId);
            const ledger = this.requireLedger();
            if (!ledger.participatesIn(request.memberId, request.workspaceId)) {
                throw new Error(`Member '${request.memberId}' does not participate in Workspace '${request.workspaceId}'`);
            }
            return ledger.memberRemindersOf(request.memberId);
        }
        /** Human withdrawal of one Member's reminder, for Member detail; the Human may withdraw any. */
        async cancelMemberReminderForClient(request) {
            this.requireWorkspace(request.workspaceId);
            const result = await this.requireLedger().cancelMemberReminder({ ...request, actor: agentTeamHumanActor() });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        inboxForAgent(agent, request) {
            this.scheduleTaskReminderEvaluation();
            const actor = this.memberActor(agent);
            if (request.workspaceId === undefined)
                return this.requireLedger().memberInbox(actor, request);
            this.requireAgentWorkspace(actor, request.workspaceId);
            return this.requireLedger().inbox(actor, { ...request, workspaceId: request.workspaceId });
        }
        async readThreadForAgent(agent, request, select) {
            const actor = this.memberCall(agent, request.workspaceId);
            const result = await this.requireLedger().readThread({ ...request, actor }, select === undefined ? undefined
                : preview => select(this.threadReadContext(agent, actor, request, preview)));
            const receipt = result.committed ? result.value.receipt : undefined;
            if (receipt !== undefined)
                this.emitCommitted(receipt);
            const read = this.withWorkerStates(this.threadReadContext(agent, actor, request, result.committed ? result.value : { ...result.value, reminders: [] }));
            if (receipt !== undefined)
                this.afterAcceptanceRead(agent, actor.memberId, read);
            return read;
        }
        /**
         * Attach the durable state of every Worker run bound to this Thread. The states
         * come from the execution records, never from the facts this window returned: a
         * run outside a long Thread's page still stands where its record says.
         */
        withWorkerStates(read) {
            const states = this.requireLedger().threadWorkerStates(read.thread.threadRef);
            if (states.length === 0)
                return read;
            const workerStates = Object.freeze(states.map(entry => {
                // A live run of this Host is the only thing that makes `running` truthful.
                const live = this.workerRegistry.liveState(entry.workerRef);
                return Object.freeze({
                    ...entry,
                    unconfirmed: entry.state === 'running' && live === undefined,
                    ...(live === 'stopping' ? { stopping: true } : {}),
                });
            }));
            return Object.freeze({ ...read, workerStates });
        }
        threadReadContext(agent, actor, request, snapshot) {
            const surface = visibleTeamSurface(agent);
            const unread = snapshot.facts.filter(entry => entry.unread);
            const history = this.requireLedger().threadHistory(actor, { ...request,
                beforeSequence: unread[0]?.fact.sequence ?? snapshot.thread.revision + 1, limit: 4 });
            const anchor = { fact: { kind: 'message', sequence: snapshot.anchor.sequence, message: snapshot.anchor,
                    mentions: snapshot.anchorMentions, occurredAt: snapshot.anchor.occurredAt }, unread: false, direct: false };
            const background = [anchor, ...history.facts.filter(fact => fact.kind === 'message')
                    .map(fact => ({ fact, unread: false, direct: false }))]
                .filter((entry, index, entries) => !unread.some(item => item.fact.sequence === entry.fact.sequence)
                && entries.findIndex(item => item.fact.sequence === entry.fact.sequence) === index
                && !isFactOnSurface(surface, entry, snapshot.thread.threadRef));
            const facts = [...background, ...unread].sort((left, right) => left.fact.sequence - right.fact.sequence);
            const read = this.withReplyContexts({ ...snapshot, facts }, request.workspaceId);
            const visibleMessageRefs = unread.flatMap(entry => entry.fact.kind === 'message'
                && isFactOnSurface(surface, entry, read.thread.threadRef) ? [entry.fact.message.messageRef] : []);
            const visibleActivityRefs = unread.flatMap(entry => entry.fact.kind === 'activity'
                && isFactOnSurface(surface, entry, read.thread.threadRef) ? [entry.fact.activity.activityRef] : []);
            return { ...read, visibleMessageRefs, visibleActivityRefs };
        }
        /**
         * A read that acknowledged the acceptance of work this Member owned hands the reader one reminder to write down what is durable,
         * and, above the acceptance budget, one compaction once the Agent settles. Priced from the committed read, never persisted, never reverses it.
         */
        afterAcceptanceRead(agent, memberId, read) {
            const perspective = this.acceptancePerspective(read, memberId);
            if (perspective === undefined)
                return;
            this.deliverAcceptanceBoundary(agent, memberId, perspective);
        }
        /**
         * Which standing the reader had in the acceptance this read acknowledged: its
         * own Claim, or the Task it was accountable for. An observer following the
         * Thread sees the same accept as unread and gets no boundary.
         */
        acceptancePerspective(read, memberId) {
            const task = read.task;
            if (task === undefined || task.resolution !== 'accepted' || task.status !== 'done')
                return undefined;
            const acknowledged = read.facts.some(entry => entry.unread && entry.fact.kind === 'activity' && entry.fact.activity.kind === 'accept');
            if (!acknowledged)
                return undefined;
            if (this.acceptedOwnWork(read, memberId))
                return 'contributor';
            return task.accountable === memberId ? 'accountable' : undefined;
        }
        /**
         * One boundary per running episode: several accepted reads or accepts in one turn must
         * not queue several identical reminders or race two compactions.
         */
        deliverAcceptanceBoundary(agent, memberId, perspective) {
            // A retiring Agent is about to be disposed; a reminder injected into its
            // Session would be discarded unread.
            if (this.retiringAgents.has(agent))
                return;
            if (this.acceptanceBoundaries.has(agent))
                return;
            this.acceptanceBoundaries.add(agent);
            const engine = this.compactionEngineFor(agent);
            const plan = planAcceptanceContext({ usageTokens: this.measureContext(agent), canCompact: engine !== undefined });
            try {
                // Steered, not followed up: the reminder is about the work this turn is
                // finishing, so it belongs at the next step boundary. A follow-up would
                // wait for a turn end that can be hundreds of steps away.
                agent.steer(createAcceptanceReminder(plan.action, perspective));
            }
            catch (error) {
                this.ctx.logger.warn(`agent-team: could not deliver the acceptance reminder to ${this.memberScope(memberId, agent.id)}: ${failureDetail(error)}`);
                return;
            }
            if (plan.action === 'compact' && engine !== undefined)
                this.scheduleAcceptanceCompaction(agent, memberId, engine);
        }
        /**
         * Whether this read acknowledged an acceptance that concluded the reader's own
         * work. An observer following the Thread sees the same accept as unread, and a
         * boundary that told it to close its books would be describing someone else's
         * finished Task.
         */
        acceptedOwnWork(read, memberId) {
            const ledger = this.requireLedger();
            return read.facts.some(entry => {
                if (!entry.unread || entry.fact.kind !== 'activity')
                    return false;
                const activity = entry.fact.activity;
                if (activity.kind !== 'accept')
                    return false;
                const own = [...activity.acceptedClaimRefs ?? [], ...activity.completedClaimRefs ?? []];
                return own.some(claimRef => ledger.getClaim(claimRef)?.owner === memberId);
            });
        }
        /** Measured context, or undefined when the meter cannot price this Session. */
        measureContext(agent) {
            try {
                return this.ctx.tokenMeter.measure(agent.session).totalTokens;
            }
            catch (error) {
                this.ctx.logger.warn(`agent-team: could not price Session '${agent.id}' for the acceptance boundary: ${failureDetail(error)}`);
                return undefined;
            }
        }
        /** The compaction engine in one Member Agent's preset scope, or undefined when it mounts none. */
        compactionEngineFor(agent) {
            return this.ctx.agentPresets.serviceFor(agent, 'compaction');
        }
        /**
         * Compact once the Agent settles. Acceptance usually lands mid-turn, so the
         * work is deferred to the boundary the engine requires: `compactNow` opens its
         * own maintenance phase, which the loop refuses while a turn is running, and
         * it is the only public entry that compacts without an open turn.
         */
        scheduleAcceptanceCompaction(agent, memberId, engine) {
            void this.runAcceptanceCompaction(agent, memberId, engine).catch(error => {
                this.ctx.logger.warn(`agent-team: acceptance compaction failed for ${this.memberScope(memberId, agent.id)}: ${failureDetail(error)}`);
            });
        }
        async runAcceptanceCompaction(agent, memberId, engine) {
            await Promise.race([agent.whenIdle(), this.shutdown.promise]);
            if (this.shutdownController.signal.aborted || !this.accepting)
                return;
            // Re-read after every wait: a swap or a dispose may have replaced the Agent,
            // and compacting a retiring Session would append a `compaction/start` to a
            // log whose writer is being released.
            if (this.retiringAgents.has(agent) || this.handles.get(memberId)?.agent !== agent)
                return;
            const result = await engine.compactNow(agent, this.shutdownController.signal);
            if (result === null) {
                this.ctx.logger.info(`agent-team: ${this.memberScope(memberId, agent.id)} had no compactable range at its acceptance boundary`);
                return;
            }
            this.ctx.logger.info(`agent-team: compacted ${this.memberScope(memberId, agent.id)} at its acceptance boundary: ${result.shadowedSeqs.length} history item(s), ~${result.shadowedTokenCount} tokens`);
        }
        /**
         * Agent-only direct message: append the audit-only dm-sent operation, then inject the body into the recipient's live session.
         * The commit is the durable fact; a missing handle or failed wake returns a structured delivery error while the DM stays durable for recovery.
         */
        async dmForAgent(agent, request) {
            const actor = this.memberCall(agent, request.workspaceId);
            const result = await this.requireLedger().sendDm({ ...request, actor });
            if (!result.committed)
                return result.value;
            this.emitCommitted(result.value.receipt);
            const recipient = result.value.recipient;
            const handle = this.handles.get(recipient.memberId);
            if (handle === undefined) {
                throw new AgentTeamDmDeliveryError(recipient.memberId, recipient.handle, `DM recorded but not delivered: Agent Member '${recipient.handle}' has no live session; it will find the message in its DM history after recovery`);
            }
            const message = createUserMessage({
                content: [{ type: 'text', text: this.dmRelayText(agent, recipient, request.body.trim(), result.value.receipt.occurredAt, result.value.receipt.operationId, request.workspaceId) }],
                source: { kind: AGENT_TEAM_PLUGIN_ID, form: 'relay' },
            });
            // A cold generation is swapped before the relay lands, and an in-flight swap holds the relay until the successor exists,
            // since delivering into a Session about to be disposed would lose the DM. The handle is re-read afterwards because a swap replaces the Agent.
            const gate = await this.wakeGateFor(handle.agent);
            const recipientAgent = this.handles.get(recipient.memberId)?.agent;
            if (gate !== undefined || recipientAgent === undefined) {
                throw new AgentTeamDmDeliveryError(recipient.memberId, recipient.handle, `DM recorded but not delivered: ${gate?.message ?? 'the Member has no live session after changing generation'}`);
            }
            try {
                // Steering reaches the recipient soonest: it starts a turn when the
                // driver is idle and is claimed at every step boundary otherwise, while
                // the next-turn lane is a FIFO that admits one message per turn, so a
                // follow-up queued behind another one waits for a whole extra turn.
                recipientAgent.steer(message);
            }
            catch (error) {
                throw new AgentTeamDmDeliveryError(recipient.memberId, recipient.handle, `DM recorded but not delivered: ${error instanceof Error ? error.message : String(error)}`);
            }
            return result.value;
        }
        /** Relay body: the DM itself plus one bounded line of adjacent context. */
        dmRelayText(senderAgent, recipient, body, occurredAt, excluding, workspaceId) {
            const sender = this.memberForAgent(senderAgent);
            const prior = this.requireLedger().dmHistoryBetween(senderAgent.id, recipient.memberId, excluding);
            const header = `Direct message from @${sender?.handle ?? 'a Team Member'} at ${formatTeamTimestamp(occurredAt)}:`;
            const context = prior === undefined ? '' : `\n\n[most recent prior DM between you: ${prior}]`;
            return `${header}\nWorkspace: ${workspaceId}\n\n${body}${context}`;
        }
        threadHistoryForAgent(agent, request) {
            const actor = this.memberActor(agent);
            this.requireAgentWorkspace(actor, request.workspaceId);
            const history = this.withWorkerStates(this.requireLedger().threadHistory(actor, request));
            // Paging back to answer something is exactly when the target may sit
            // outside the window, so a history page carries the same context a read does.
            const contexts = this.replyContextsFor(history.facts, request.workspaceId);
            if (contexts.size === 0)
                return history;
            const anchorRef = history.anchor.replyToMessageRef;
            const anchorReplyTo = anchorRef === undefined ? undefined : contexts.get(anchorRef);
            return Object.freeze({
                ...history,
                ...(anchorReplyTo === undefined ? {} : { anchor: Object.freeze({ ...history.anchor, replyTo: anchorReplyTo }) }),
                facts: Object.freeze(history.facts.map(fact => this.withReplyTo(fact, contexts))),
            });
        }
        withReplyContexts(value, workspaceId) {
            const contexts = this.replyContextsFor(value.facts.map(entry => entry.fact), workspaceId);
            if (contexts.size === 0)
                return value;
            // The anchor is read out of the same window and may itself be a reply, so
            // it is decorated from the same resolution rather than left out.
            const anchorRef = value.anchor.replyToMessageRef;
            const anchorReplyTo = anchorRef === undefined ? undefined : contexts.get(anchorRef);
            return Object.freeze({
                ...value,
                ...(anchorReplyTo === undefined ? {} : { anchor: Object.freeze({ ...value.anchor, replyTo: anchorReplyTo }) }),
                facts: Object.freeze(value.facts.map(entry => {
                    const fact = this.withReplyTo(entry.fact, contexts);
                    return fact === entry.fact ? entry : Object.freeze({ ...entry, fact });
                })),
            });
        }
        /** Live participation addresses; paths remain owned by the Harness registry. */
        /** Active Projects the Agent's Member owns, for the per-step Member context; undefined while the ledger predates Project owners. */
        ownedProjectsForAgent(agent) {
            const member = this.memberForAgent(agent);
            const ledger = this.requireLedger();
            if (member === undefined || ledger.status().rulesVersion < 2)
                return undefined;
            return ledger.ownedProjects(member.memberId);
        }
        workspacesForAgent(agent) {
            const actor = this.memberActor(agent);
            const member = this.requireLedger().getMember(actor.memberId);
            return Object.freeze(this.requireLedger().workspacesOf(actor.memberId).map(workspaceId => Object.freeze({
                workspaceId, path: this.ctx.workspaceRegistry.get(workspaceId)?.path, default: workspaceId === member.workspaceId,
            })));
        }
        /** Agent-only bounded discovery projection; participation list carries registry titles when known. */
        viewForAgent(agent, request) {
            const member = this.memberForAgent(agent);
            if (member === undefined)
                throw new Error('Agent is not an active Team Member');
            if (!this.requireLedger().participatesIn(member.memberId, request.workspaceId))
                throw new Error('Member cannot view another Workspace');
            const view = this.requireLedger().view({ ...request, includeWorkspaceDirectory: true }, member.memberId);
            return Object.freeze({ ...view, workspaces: Object.freeze(view.workspaces.map(participation => {
                    const title = this.ctx.workspaceRegistry.get(participation.workspaceId)?.title;
                    return title === undefined ? participation : Object.freeze({ ...participation, title });
                })) });
        }
        validateLedger() {
            this.requireLedger().validate();
        }
        /**
         * Validate the durable ledger for the invariant's mount check. The
         * constructor already re-derived every durable record against its own
         * scratch projection, so this adopts that conclusion once while nothing has
         * committed since; every other call, and every commit-driven validation,
         * replays the whole table again.
         */
        validateLedgerAtMount() {
            this.requireLedger().validateAtMount();
        }
        /**
         * Why a carried-input replay did not run. Each reason is a state the Host
         * accepts and continues from, never an error: a blocked replay would turn a
         * problem in a Session the Member no longer runs in into permanent
         * unavailability.
         */
        skipCarriedInput(memberId, previousSessionId, reason, detail) {
            const member = this.memberLabel(memberId);
            if (reason === 'started-generation') {
                // Nothing is lost: the carried input was delivered after activation (or
                // superseded) before the generation's first own turn could run.
                this.ctx.logger.info(`agent-team: skipping carried-input replay for member '${member}': the current Session '${previousSessionId}' already started a generation`);
                return 0;
            }
            const fault = reason === 'corrupt'
                ? 'is corrupt'
                : 'is refused by the session-format migration';
            this.ctx.logger.warn(`agent-team: previous Session '${previousSessionId}' holding carried input for member '${member}' ${fault}: ${detail}; skipping the replay`);
            return 0;
        }
        async replayCarriedInput(member, agent, generationStarted) {
            const transition = this.requireLedger().lastTransitionForMember(member.memberId);
            if (transition === undefined || transition.targetSessionId !== agent.session.id)
                return 0;
            if (generationStarted && transition.inputFromSeq === undefined)
                return this.skipCarriedInput(member.memberId, agent.session.id, 'started-generation');
            let inspectionEvents;
            let inspectionInherited;
            const previousRead = await this.sessionReader.read(transition.previousSessionId);
            if (!previousRead.ok) {
                const failure = previousRead.failure;
                if (failure.kind === 'corrupt')
                    return this.skipCarriedInput(member.memberId, transition.previousSessionId, 'corrupt', failure.detail);
                if (failure.kind === 'refused')
                    return this.skipCarriedInput(member.memberId, transition.previousSessionId, 'refused', failure.detail);
                throw new StoredSessionReadError(`the previous Session '${transition.previousSessionId}' holding the Member's carried input is unreadable (${failure.kind}): ${failure.detail}`, failure);
            }
            inspectionEvents = previousRead.inspection.events;
            inspectionInherited = previousRead.inspection.inheritedEventCount;
            const state = foldTeamContextProjection(inspectionEvents, { sessionId: transition.previousSessionId, inheritedEventCount: inspectionInherited,
                ...(transition.inputFromSeq === undefined ? {} : { inputFromSeq: transition.inputFromSeq }) });
            const carried = carriedInputOf(state, inspectionEvents);
            if (carried.length === 0)
                return 0;
            const known = new Set();
            for (const event of agent.session.ownEvents()) {
                if (event.type !== 'user/message')
                    continue;
                const id = event.data.id;
                if (id !== undefined)
                    known.add(id);
            }
            for (const pending of [...agent.inbox.nextStep, ...agent.inbox.nextTurn]) {
                known.add(pending.id);
            }
            let redelivered = 0;
            for (const message of carried) {
                if (known.has(message.id))
                    continue;
                agent.followup(message);
                redelivered += 1;
            }
            if (redelivered > 0)
                this.ctx.logger.info(`agent-team: redelivered ${redelivered} carried input message(s) for member '${this.memberLabel(member.memberId)}' after the generation crash recovery`);
            return redelivered;
        }
        /**
         * Jobs this Agent owns that cannot survive a generation swap: any
         * running/stopping job, and any settled job whose terminal output was
         * never reported (disposal would silently discard it). In-place hard
         * compaction is exempt — it never cancels the owner.
         */
        ownedJobsBlockingRecycle(agent) {
            const jobs = agent.ctx.get('jobs');
            if (jobs === undefined)
                return [];
            return jobs.list(agent)
                .filter((job) => job.status === 'running' || job.status === 'stopping' || ((job.status === 'completed' || job.status === 'killed' || job.status === 'failed') && !job.reported))
                .map((job) => `${job.label} (${job.id})`);
        }
        emitCommittedOutcome(result) {
            if (result.committed && result.value.kind === 'committed' && result.value.receipt !== undefined)
                this.emitCommitted(result.value.receipt);
        }
        assertProjectMembersAvailable(memberIds) {
            for (const memberId of memberIds ?? []) {
                const member = this.requireLedger().getMember(memberId);
                if (member === undefined)
                    throw new Error(`unknown Agent Member '${memberId}'`);
                if (this.memberStatus(member).availability !== 'active')
                    throw new Error(`Agent Member '${memberId}' is not available for Project membership`);
            }
        }
        /**
         * Shared append envelope for both message commits: resolve uploads, append through the chosen ledger method, emit the committed receipt,
         * and on failure drop the cache entries this attempt prepared. Keeping the order here once stops send and reply from drifting.
         */
        async commitMessageAs(actor, request, commit) {
            try {
                const metadata = await this.resolveMessageAttachments(request);
                const result = await commit({
                    ...request, body: this.appendAttachmentLines(request.body, metadata),
                    ...(metadata.length === 0 ? {} : { resolvedAttachments: metadata }),
                    actor,
                });
                this.emitCommittedOutcome(result);
                return result.value;
            }
            catch (error) {
                await this.dropUnreferencedPrepared(request, error);
                throw error;
            }
        }
        startThreadAs(actor, request) {
            return this.commitMessageAs(actor, request, authorized => this.requireLedger().startThread(authorized));
        }
        postMainMessageAs(actor, request) {
            return this.commitMessageAs(actor, request, authorized => this.requireLedger().postMainMessage(authorized));
        }
        async readMainStreamAs(actor, request) {
            const result = await this.requireLedger().readMainStream({ ...request, actor });
            // A read that made no progress commits no operation and carries no receipt.
            if (result.committed && result.value.receipt !== undefined)
                this.emitCommitted(result.value.receipt);
            return result.value;
        }
        /** Read one Message back verbatim, whoever is asking. */
        readMessageAs(actor, request) {
            return this.requireLedger().readMessage(actor, request);
        }
        replyAs(actor, request) {
            return this.commitMessageAs(actor, request, authorized => this.requireLedger().reply(authorized));
        }
        /**
         * After a failed message or reply attempt, remove the request-stable cache copies it could have prepared unless a committed Message references them.
         * The ledger's reference set is the guard; uploads are untouched (the GC owns unreferenced ones). Cleanup failures are logged and never mask the original error.
         */
        async dropUnreferencedPrepared(request, cause) {
            const prepared = (request.attachmentPaths ?? []).map((_, index) => pathAttachmentId(request.requestId, index));
            if (prepared.length === 0)
                return;
            let referenced;
            try {
                referenced = this.requireLedger().referencedAttachmentIds();
            }
            catch (failure) {
                this.ctx.logger.warn(`agent-team: could not consult the attachment reference set after a failed message attempt (${String(cause)}): ${String(failure)}`);
                return;
            }
            for (const attachmentId of prepared) {
                if (referenced.has(attachmentId))
                    continue;
                try {
                    await removeAttachment(attachmentsRoot(), attachmentId);
                }
                catch (failure) {
                    this.ctx.logger.warn(`agent-team: could not drop unreferenced prepared attachment '${attachmentId}' after a failed message attempt: ${String(failure)}`);
                }
            }
        }
        /** Fence one Human Remote call: accepting Host, known Workspace, Human actor. */
        humanCall(workspaceId) {
            this.requireAccepting();
            this.requireWorkspace(workspaceId);
            return agentTeamHumanActor();
        }
        /** Fence one Member call: accepting Host, live Member binding, matching Workspace participation. */
        memberCall(agent, workspaceId) {
            this.requireAccepting();
            this.requireWorkspace(workspaceId);
            const actor = this.memberActor(agent);
            this.requireAgentWorkspace(actor, workspaceId);
            return actor;
        }
        memberActor(agent) {
            const member = this.memberForAgent(agent);
            if (member === undefined)
                throw new Error('Agent is not an active Team Member');
            return Object.freeze({ kind: 'member', memberId: member.memberId, handle: member.handle });
        }
        requireAgentWorkspace(actor, workspaceId) {
            if (!this.requireLedger().participatesIn(actor.memberId, workspaceId))
                throw new Error('Member cannot mutate another Workspace');
        }
        /**
         * Reject a model route the Host cannot serve: an unregistered provider has no
         * adapter at all, so the Member would be created and fail its first turn with
         * an unrelated message. Checked here so the caller sees the real reason.
         */
        async assertModelRoute(model) {
            // No route to check: absent keeps the stored selection and null clears it.
            if (model === undefined || model === null)
                return;
            // No LLM service means no adapter to check against. It is read through `get`, not `ctx.llm`: the Host does not hard-inject it,
            // and an undeclared property read throws instead of yielding `undefined`.
            const llm = this.ctx.get('llm');
            const providers = llm === undefined ? undefined : llm.listProviders();
            if (providers !== undefined && !providers.some(provider => provider.id === model.provider)) {
                throw new Error(`provider '${model.provider}' is not registered`);
            }
            // Validate a pinned route's reasoning effort against the adapter's own
            // metadata when the LLM service is reachable; unknown routes defer to the
            // LLM layer's runtime check at call time.
            if (model.reasoningEffort === undefined || llm === undefined)
                return;
            try {
                const resolved = await llm.resolveModelInfo(model.provider, model.model);
                const efforts = resolved.reasoning?.efforts ?? [];
                if (efforts.length > 0 && !efforts.some(effort => effort.id === model.reasoningEffort)) {
                    throw new Error(`reasoning effort '${model.reasoningEffort}' is not supported by ${model.provider}/${model.model}`);
                }
            }
            catch (error) {
                if (error instanceof Error && error.message.includes('is not supported by'))
                    throw error;
            }
        }
        /**
         * Session headers currently durable in the persistence backend. A disposed Session's log is retired without awaiting,
         * so the JSONL backend's transient win32 staging directories (.dsh-mkdir-*) can surface as ENOENT; the idempotent read backs off briefly.
         */
        async persistedSessionHeaders() {
            for (let attempt = 0;; attempt += 1) {
                try {
                    return await this.ctx.sessionPersistence.list();
                }
                catch (error) {
                    if (attempt >= 3 || error?.code !== 'ENOENT')
                        throw error;
                    await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 25));
                }
            }
        }
        /**
         * Register the owner guidance in one Member generation's scope. The provider
         * reads ownership and the Worker switch at every assembly, so a grant, a
         * withdrawal, or a switch flip changes the prompt without re-registering it,
         * and the section is resident: compaction rewrites messages, never sections.
         */
        installProjectOwnerGuidance(agentCtx, member) {
            agentCtx.systemPrompt.section({
                name: PROJECT_OWNER_SECTION,
                order: agentCtx.systemPrompt.getSectionOrder('TEAM_POLICY'),
                text: () => projectOwnerGuidance({
                    ownsProject: (this.ledger?.ownedProjects(member.memberId).length ?? 0) > 0,
                    workerEnabled: this.workerEnabled(),
                }),
            });
        }
        /** Own-scope foreign tools cannot be masked by the current restriction API; make their denied status explicit instead. */
        installToolAvailabilityGuidance(agentCtx, member) {
            agentCtx.systemPrompt.section({
                name: TOOL_AVAILABILITY_SECTION,
                order: agentCtx.systemPrompt.getSectionOrder('TEAM_POLICY'),
                text: () => toolAvailabilityGuidance(this.memberRuntime.visibleUngrantedToolNames(agentCtx, member.memberId)),
            });
        }
        async activateMember(member, knownWorkspacePath, knownSessions, forkedFrom, options) {
            if (this.handles.has(member.memberId))
                return;
            let created;
            try {
                const workspace = this.requireWorkspace(member.workspaceId);
                const workspacePath = knownWorkspacePath ?? workspace.path;
                // Existing Members carry the pre-sanitization ledger path; activation
                // migrates it onto the sanitized directory before provisioning.
                const sanitizedMemoryPath = dshHomePath('agent-team', 'members', memberMemoryDirectoryName(member.memberId));
                await this.memberRuntime.initializePrivateMemory(sanitizedMemoryPath, member.privateMemoryPath);
                const persisted = knownSessions !== undefined ? knownSessions.has(member.sessionId)
                    : await this.sessionPersisted(member.sessionId);
                // A restart or resume meets the same wake boundary a message does: a cold stored generation is replaced instead of resumed.
                // A planned activation of a successor (`forkedFrom`) never re-decides; the swap that built it already did.
                if (forkedFrom === undefined && persisted) {
                    const plan = await this.planWakeForMember(member, undefined);
                    if (plan.action === 'recycle') {
                        this.ctx.logger.info(`agent-team: activating ${this.memberScope(member.memberId, member.sessionId)} swaps its cold generation: idle ${plan.idleMs}ms over ${plan.thresholds.idleMs}ms, context ${plan.contextTokens} over ${plan.thresholds.minContextTokens}`);
                        await this.contextManagement.requestRecycle(member.memberId, member);
                        return;
                    }
                }
                // AgentOptions carries the whole configured route, so a fresh Session records its effort on the first request instead of through a synthetic selection event.
                const selection = member.model ?? this.ctx.agentDefaultModel.currentSelection();
                const agentOptions = { ...selection };
                const setup = async (agentCtx, agent) => {
                    try {
                        await this.ctx.agentPresets.mount(agentCtx, member.presetId);
                        this.memberRuntime.applyMemberToolPolicy(agentCtx, member, this.workerEnabled(), this.extraToolGrants());
                        this.validateMemberPreset(agentCtx);
                    }
                    catch (error) {
                        // Tag composition failures with their own class: the activation
                        // diagnostic routes preset-composition (install/runtime split)
                        // failures by type, not by matching message text.
                        throw new PresetCompositionError(error instanceof Error ? error.message : String(error), { cause: error });
                    }
                    // Only a resumed Session records the configured route, and it inherits the effort its own log recorded for that route; a fresh Session's route rides AgentOptions, exactly as the driver's own resume does.
                    if (persisted)
                        this.applyConfiguredRoute(agent, selection);
                    installModelSelection(agentCtx);
                    this.installProjectOwnerGuidance(agentCtx, member);
                    this.installToolAvailabilityGuidance(agentCtx, member);
                    this.memberRuntime.observeMemberToolPolicyTurns(agentCtx, agent, member.memberId, () => {
                        const current = this.requireLedger().getMember(member.memberId);
                        if (current === undefined)
                            throw new Error(`Member '${member.memberId}' is no longer in the Team ledger`);
                        return { member: current, workerEnabled: this.workerEnabled(), grants: this.extraToolGrants() };
                    });
                    agentCtx.on('session/event', (session, event) => {
                        if (session !== agent.session || event.type !== 'request/header')
                            return;
                        this.adoptMemberRouteFromRequest(member.memberId, agent, session.id, event);
                    });
                    installMemberCompaction(agentCtx, agent, () => this.memberCompactionConfig(), () => this.compactionEngineFor(agent), () => this.retiringAgents.has(agent));
                    agentCtx.on('agent/pre-step', async ({ agent }, next) => {
                        // The original inbox insertion is the durable replay source even if
                        // this driver already claimed it; requeueing can reorder later input.
                        if (this.retiringAgents.has(agent))
                            return { kind: 'reject' };
                        // The Harness resolves tools and assembles the prompt before this
                        // waterfall. Refresh here so a failed baseline is still rejected
                        // before the model request; a late registration reaches the next
                        // step's resolution without ever running after this gate.
                        this.memberRuntime.refreshMemberToolPolicyForStep(agentCtx, member.memberId);
                        const policyFailure = this.memberRuntime.turnToolPolicyFailure(member.memberId);
                        if (policyFailure !== undefined) {
                            this.ctx.logger.warn(`agent-team: refusing a Member turn before any model request: ${policyFailure}`);
                            return { kind: 'reject' };
                        }
                        return next();
                    });
                    return {
                        commit: () => {
                            // The member scope composes no sandbox-policy service, so read the last logged mode from the session log (`sandbox/mode` is log-only).
                            // Re-appending only when the effective mode differs keeps resumed members from growing redundant events.
                            const logged = agent.session.ownEvents().toReversed().find(event => event.type === 'sandbox/mode');
                            if (logged?.data.mode !== 'danger-full-access')
                                setSandboxMode(agent.session, 'danger-full-access');
                        },
                    };
                };
                // The Session this generation replaces, read from the ledger's transition record when the caller names none:
                // a crash between the durable swap commit and this activation recreates the Session from the ledger binding alone.
                // The Host session header does NOT carry it: a rollover's lineage is the ledger's own transition, and `parentSession`
                // now names a subagent's creator, so writing it here would misreport the relation to every reader of the header.
                const lineageParent = forkedFrom ?? (!persisted ? this.requireLedger().previousSessionForMember(member.memberId) : undefined);
                let recoveryCarried = 0;
                created = persisted
                    ? await this.ctx.agents.resume({ resumeSessionId: member.sessionId, agentOptions, setup })
                    : await this.ctx.agents.create({
                        sessionId: member.sessionId,
                        meta: {
                            cwd: workspacePath,
                            agentPreset: member.presetId,
                        },
                        agentOptions,
                        setup,
                    });
                this.memberRuntime.mountMemberSkillProvider(member, created.agent.ctx, member.capabilities?.skills?.allow);
                // Both capability effects are now live: record the intent the surface reflects so a later edit or retry compares against reality.
                this.memberRuntime.recordAppliedCapabilities(member.memberId, member.capabilities);
                await workspace.attachSession(member.sessionId);
                this.handles.set(member.memberId, created);
                this.memberIdle.status(member.memberId, created.agent.status, Date.now());
                this.clearMemberFailure(member.memberId, 'activation');
                this.clearMemberFailure(member.memberId, 'preTurnCancellation');
                this.clearMemberFailure(member.memberId, 'capabilityApply');
                this.nameMemberSession(member, created.agent);
                const generationStarted = created.agent.session.ownEvents().some(event => event.type === 'turn/start');
                // A restart between a durable rollover intent and its swap replays the
                // old Session; the projection still carries the intent, so finish the
                // transition (or keep waiting for the containing turn) from here.
                if (persisted) {
                    const inheritedEventCount = created.agent.session.inheritedEventCount;
                    const state = foldTeamContextProjection(created.agent.session.ownEvents(), { sessionId: created.agent.session.id, inheritedEventCount });
                    if (state.pending !== null)
                        this.contextManagement.recoverPendingTransition(member.memberId, created.agent, member.sessionId);
                    // A restart between a checkpoint's durable result and its quiet follow-up delivery repairs exactly once.
                    this.contextManagement.repairContinuations(created.agent, state);
                    // Carried input redelivery binds to the committed transition target (this Session), so a crash after the binding flipped still replays here.
                    recoveryCarried = await this.replayCarriedInput(member, created.agent, generationStarted);
                }
                else if (lineageParent !== undefined) {
                    recoveryCarried = await this.replayCarriedInput(member, created.agent, generationStarted);
                }
                // Give carried input its own turn before the rederived Inbox notice;
                // steering the notice could otherwise overtake that input.
                if (options?.deferNotify !== true) {
                    this.notifyMember(created.agent, {
                        kind: 'activation',
                        ...(lineageParent === undefined ? {} : { previousSessionId: lineageParent }),
                    }, recoveryCarried > 0);
                }
                this.scheduleTaskReminderEvaluation();
            }
            catch (error) {
                if (created !== undefined) {
                    await this.disposeWithWakeGuard(created);
                    if (this.handles.get(member.memberId) === created)
                        this.handles.delete(member.memberId);
                }
                this.memberRuntime.forgetMember(member.memberId);
                const message = error instanceof Error ? error.message : String(error);
                this.ctx.logger.warn(`agent-team: activation failed for member '${this.memberLabel(member.memberId)}': ${message}`);
                this.setActivationDiagnostic(member.memberId, this.activationDiagnosticOf(error, member.sessionId));
            }
            finally {
                this.emitMemberPresenceChanged(member);
            }
        }
        /**
         * Rebuild one enabled Member in place from its persisted Session. A bundle-row reload prunes the preset roster mount while live agents keep dead scope bindings,
         * so the Member loses its composed tools. Re-running composition needs a fresh Agent; disposal marks the recreated Session unavailable in the Web Client until reopened, as suspend/resume does.
         */
        reactivateMember(memberId) {
            return this.enqueueLifecycle(memberId, async () => {
                const member = this.requireLedger().getMember(memberId);
                if (member === undefined || member.state !== 'enabled')
                    return false;
                const stale = this.handles.get(memberId);
                if (stale !== undefined) {
                    this.handles.delete(memberId);
                    this.memberRuntime.forgetMember(memberId);
                    // The composition-loss diagnostic this heal answers is stale once the
                    // rebuild starts; a later activation must not resurface it.
                    this.emitMemberPresenceChanged(member);
                    await this.disposeWithWakeGuard(stale);
                }
                await this.activateMember(member);
                return this.handles.has(memberId);
            });
        }
        /**
         * Default an untitled Member Session to its handle so the ordinary Session
         * list names it. An explicit rename or any earlier title always wins; the
         * cosmetic default never fails Member activation.
         */
        nameMemberSession(member, agent) {
            const sessionTitle = this.ctx.get('sessionTitle');
            if (sessionTitle === undefined)
                return;
            try {
                if (sessionTitle.get(agent.session) !== undefined)
                    return;
                sessionTitle.rename(agent.session, member.handle);
            }
            catch {
                // The composition may carry no session-title service, or the rename may
                // race its disposal; the Member works identically without the title.
            }
        }
        validateMemberPreset(agentCtx) {
            const scope = scopeOf(agentCtx);
            const teamMessage = this.ctx.tools.get('team_message', scope);
            if (teamMessage?.[AGENT_TEAM_PRESET_MARKER] !== true) {
                // Different module instances of @deepseek-ai/dsh-scope (commonly from running the CLI from source via tsx).
                if (scope === undefined)
                    throw new Error(teamPresetScopeMismatchMessage(isTsxDevMode()));
                throw new Error('selected preset is not team-enabled');
            }
            // The preset's own surface, not the Member's restricted view: a Host switch
            // may withdraw `team_worker` from the Member without the preset losing it.
            const presetScope = scope === undefined ? undefined : scopeParentOf(scope);
            const available = new Set(this.ctx.tools.schemas(presetScope ?? scope).map(tool => tool.name));
            const missing = AGENT_TEAM_TOOL_NAMES.filter(name => !available.has(name));
            if (missing.length > 0)
                throw new Error(`team-enabled preset is missing tools: ${missing.join(', ')}`);
        }
        /**
         * The states with no live surface at all. Each reports a literal `pending`
         * capability: no apply can be in force there, and a literal cannot inherit a
         * stale applied-record left behind by a torn-down surface.
         */
        memberStatus(member) {
            if (member.state !== 'enabled') {
                return Object.freeze({ member, availability: member.state, presence: 'unavailable', capabilityState: 'pending' });
            }
            const failures = this.memberFailures.get(member.memberId);
            if (failures?.activation !== undefined)
                return Object.freeze({ member, availability: 'unavailable', presence: 'unavailable', capabilityState: 'pending', diagnostic: failures.activation });
            const handle = this.handles.get(member.memberId);
            if (handle === undefined)
                return Object.freeze({ member, availability: 'unavailable', presence: 'unavailable', capabilityState: 'pending' });
            const capabilityState = this.memberRuntime.appliedCapabilitiesMatch(member.memberId, member.capabilities) ? 'applied' : 'pending';
            // A rollover commits its ledger binding before the old generation retires
            // and the new one activates; during that window the live handle still runs
            // the previous Session. The Member stays visible but must not report the
            // new binding as active — a Client following the row would otherwise open
            // a Session that does not exist yet.
            if (handle.agent.id !== member.sessionId)
                return Object.freeze({ member, availability: 'unavailable', presence: 'unavailable', capabilityState, diagnostic: { class: 'rollover', detail: 'context rollover in progress' } });
            if (this.ctx.agentPresets.composedPreset(handle.agent.ctx) === undefined) {
                return Object.freeze({ member, availability: 'active', presence: 'error', capabilityState, diagnostic: { class: 'preset-composition', detail: ORPHANED_MEMBER_DIAGNOSTIC } });
            }
            if (failures?.runtime !== undefined)
                return Object.freeze({ member, availability: 'active', presence: 'error', capabilityState, diagnostic: { class: 'runtime', detail: failures.runtime } });
            if (failures?.preTurnCancellation !== undefined)
                return Object.freeze({ member, availability: 'active', presence: 'error', capabilityState, diagnostic: failures.preTurnCancellation });
            // A failed apply outranks the plain success row but not a live runtime
            // error: the Member runs, yet its stored configuration is ahead of the
            // surface until the effect lands. The warning digest rides along — the
            // unknown-name signal and the apply failure answer different questions.
            if (failures?.capabilityApply !== undefined) {
                const capabilityWarnings = this.memberRuntime.capabilityWarningsFor(member.memberId);
                return Object.freeze({
                    member, availability: 'active', presence: 'error', capabilityState, diagnostic: failures.capabilityApply,
                    ...(capabilityWarnings === undefined ? {} : { capabilityWarnings }),
                });
            }
            const capabilityWarnings = this.memberRuntime.capabilityWarningsFor(member.memberId);
            return Object.freeze({
                member, availability: 'active', presence: handle.agent.status === 'running' ? 'working' : 'available',
                capabilityState,
                ...(capabilityWarnings === undefined ? {} : { capabilityWarnings }),
            });
        }
        setMemberFailure(memberId, slot, message) {
            const failures = this.memberFailures.get(memberId) ?? {};
            failures[slot] = message;
            this.memberFailures.set(memberId, failures);
        }
        setActivationDiagnostic(memberId, diagnostic) {
            const failures = this.memberFailures.get(memberId) ?? {};
            failures.activation = Object.freeze(diagnostic);
            this.memberFailures.set(memberId, failures);
        }
        /** Store the post-commit configuration apply failure; cleared when the effect lands or a later activation succeeds. */
        setCapabilityApplyDiagnostic(memberId, diagnostic) {
            const failures = this.memberFailures.get(memberId) ?? {};
            failures.capabilityApply = Object.freeze(diagnostic);
            this.memberFailures.set(memberId, failures);
        }
        /**
         * Route one activation failure to its diagnostic class: preset composition failures by error class, session failures by the seam's typed classification,
         * everything else as an unclassified activation failure.
         */
        activationDiagnosticOf(error, sessionId) {
            if (error instanceof PresetCompositionError)
                return { class: 'preset-composition', detail: error.message };
            const failure = error instanceof StoredSessionReadError ? error.failure : sessionFailureOf(error, sessionId);
            if (failure !== undefined) {
                const shared = { detail: failure.detail, ...(failure.location === undefined ? {} : { location: failure.location }), sessionId: failure.sessionId };
                return failure.kind === 'refused' ? { class: 'session-refused', ...shared } : { class: 'session-unreadable', ...shared };
            }
            return { class: 'activation', detail: error instanceof Error ? error.message : String(error) };
        }
        clearMemberFailure(memberId, slot) {
            const failures = this.memberFailures.get(memberId);
            if (failures === undefined || failures[slot] === undefined)
                return false;
            if (Object.keys(failures).length === 1)
                this.memberFailures.delete(memberId);
            else
                delete failures[slot];
            return true;
        }
        requireWorkspace(workspaceId) {
            const workspace = this.ctx.workspaceRegistry.get(workspaceId);
            if (workspace === undefined)
                throw new Error(`unknown Workspace '${workspaceId}'`);
            return workspace;
        }
        /** Coalesce event-driven checks; reminders themselves never recursively schedule another pass. */
        scheduleTaskReminderEvaluation() {
            if (!this.accepting || this.ledger === undefined)
                return;
            this.reminderEvaluationRequested = true;
            void this.evaluateTaskReminders();
        }
        evaluateTaskReminders() {
            this.reminderEvaluationTail = this.reminderEvaluationTail.then(async () => {
                if (this.ledger === undefined)
                    return;
                do {
                    this.reminderEvaluationRequested = false;
                    const nowMs = Date.now();
                    const idleMs = (memberId) => this.memberIdle.idleMs(memberId, nowMs);
                    const candidates = this.requireLedger().planReminders(nowMs, idleMs);
                    for (const candidate of candidates) {
                        const receipt = await this.requireLedger().raiseReminder(candidate, nowMs, idleMs);
                        if (receipt !== undefined)
                            this.emitCommitted(receipt);
                    }
                } while (this.reminderEvaluationRequested);
            }).catch(error => {
                this.ctx.logger.warn(`agent-team: Task reminder evaluation failed: ${failureDetail(error)}`);
            });
            return this.reminderEvaluationTail;
        }
        // ── Project subscriptions ────────────────────────────────────────────────
        /**
         * Open the scheduler's private store and give every timer subscription its
         * first due instant. Boot never resets a persisted due instant or a
         * publication window: a Host that was away catches up once instead of
         * restarting the window.
         */
        async startSubscriptionRuntime(domain) {
            this.subscriptionDomain = domain;
            const table = domain.table('checkpoints');
            this.subscriptionTable = table;
            this.subscriptionRunsTable = domain.table('runs');
            this.subscriptionDeliveriesTable = domain.table('deliveries');
            this.subscriptionReplaysTable = domain.table('replays');
            this.subscriptionAdmissionsTable = domain.table('admissions');
            for (const [subscriptionRef, checkpoint] of table.entries())
                this.subscriptionCheckpoints.set(subscriptionRef, checkpoint);
            // A deletion that could not finish its cleanup — a crash between the ledger
            // commit and the row drops, or a storage fault — leaves rows nobody will ever
            // read. Boot converges them instead of trusting the caller to have done it.
            await this.convergeSubscriptionPrivateState();
            const scheduler = new SubscriptionScheduler({
                now: () => Date.now(),
                random: () => Math.random(),
                schedule: (run, delayMs) => {
                    const timer = setTimeout(run, delayMs);
                    // A pending timer must never be the reason the Host process stays alive.
                    timer.unref();
                    return timer;
                },
                cancel: handle => { clearTimeout(handle); },
                log: message => { this.ctx.logger.warn(`agent-team: ${message}`); },
                // Every subscription, deleted ones included: a run that started before a
                // deletion still names the record it came from.
                subscriptions: () => this.ledger === undefined ? [] : this.ledger.subscriptions(),
                // What admission re-reads before it spends a slot: a queued entry holds a
                // snapshot, and a delete or an archive must still stop it. A ref the
                // ledger never stored is a create's draft trial, which has no record to
                // reconcile against.
                current: subscriptionRef => this.ledger?.subscription(subscriptionRef),
                projectActive: subscription => this.requireLedger().getProject(subscription.projectRef)?.state === 'active',
                workspacePath: subscription => this.subscriptionWorkspaceRoot(subscription),
                pending: subscriptionRef => this.requireLedger().pendingSubscriptionEvents(subscriptionRef)
                    .map(entry => ({ acceptedSequence: entry.acceptedSequence, eventId: entry.event.id })),
                run: subscription => this.runTimerSubscription(subscription),
                publish: (subscription, acceptedSequence, eventId) => this.commitSubscriptionPublication(subscription, acceptedSequence, eventId),
                pauseForFailures: subscription => this.commitFailurePause(subscription),
                checkpoint: subscriptionRef => this.subscriptionCheckpoints.get(subscriptionRef) ?? { subscriptionRef, ...INITIAL_CHECKPOINT },
                timerReady: subscriptionRef => !this.resumeNeedsCheckpoint(subscriptionRef) &&
                    !this.admissionRecordsOf(subscriptionRef).some(record => record.failureStreak !== undefined),
                save: (subscriptionRef, change) => this.updateCheckpoint(subscriptionRef, change),
            });
            this.subscriptionScheduler = scheduler;
            await scheduler.settleBoot();
            scheduler.start();
            // Deliveries accepted before the last shutdown are due now: the queue is
            // durable, so a boot is the moment it resumes rather than a fresh start.
            void this.pumpWebhookAdmissions();
            this.admissionPumpTimer = setInterval(() => { void this.pumpWebhookAdmissions(); }, WEBHOOK_PUMP_INTERVAL_MS);
            this.admissionPumpTimer.unref?.();
        }
        /**
         * Change one checkpoint, under the subscription's write lock.
         *
         * A checkpoint is one row that four writers touch: a run settling its due
         * instant, a spent delivery being counted, the publish window advancing, and a
         * success clearing the streak. Each of them changes one field, so a writer that
         * composed its record from an earlier read drops whatever the others committed
         * meanwhile — and the loss is silent, because the last write wins. This is the
         * only form of checkpoint write there is.
         *
         * `change` runs on the record read inside the lock, and `undefined` means the
         * ledger no longer serves the subscription: nothing is written, so a run that
         * finished after the deletion cannot recreate the row the deletion dropped.
         */
        updateCheckpoint(subscriptionRef, change) {
            return this.serializeSubscriptionWrite(subscriptionRef, () => this.updateCheckpointLocked(subscriptionRef, change));
        }
        /** {@link updateCheckpoint} for a caller that already holds the subscription's lock. */
        async updateCheckpointLocked(subscriptionRef, change) {
            const subscription = this.writableSubscription(subscriptionRef);
            if (subscription === undefined)
                return undefined;
            const checkpoint = change(this.checkpointFor(subscriptionRef));
            // Persist first, project second: a failed write must leave the live
            // checkpoint where the durable one still is, or a storage error would look
            // like a saved wake-up that no restart finds.
            await this.subscriptionTable?.put(subscriptionRef, checkpoint);
            this.subscriptionCheckpoints.set(subscriptionRef, checkpoint);
            return checkpoint;
        }
        /**
         * The success linearization: end the streak, in the segment that accepted the
         * output. Its caller holds the subscription's write lock, so no delivery the
         * ingress counts can land between the accept and this write — the streak it
         * clears is exactly the defeats counted before the accept, and one that
         * arrives afterwards starts a new streak.
         */
        async clearSubscriptionFailuresLocked(subscriptionRef, accepted, sourceRevision) {
            try {
                if (this.writableSubscription(subscriptionRef)?.revision !== sourceRevision)
                    return;
                await this.updateCheckpointLocked(subscriptionRef, checkpoint => {
                    const { countedAdmissionRef: _counted, ...rest } = checkpoint;
                    return Object.freeze({ ...rest, consecutiveFailures: 0,
                        failureResumeSequence: this.requireLedger().subscriptionResumeSequence(subscriptionRef),
                        failureSuccessEpoch: (checkpoint.failureSuccessEpoch ?? 0) + 1,
                        ...(accepted ? { lastSuccessAt: new Date().toISOString() } : {}) });
                });
            }
            catch (error) {
                // The output is already in the ledger: a count that cannot be cleared is
                // no reason to call a delivered run a failure, and the next success
                // clears it again.
                this.ctx.logger.warn(`agent-team: could not clear the failure count of '${subscriptionRef}': ${failureDetail(error)}`);
            }
        }
        checkpointFor(subscriptionRef) {
            return this.subscriptionCheckpoints.get(subscriptionRef) ?? { subscriptionRef, ...INITIAL_CHECKPOINT };
        }
        webhookFailureStreak(subscriptionRef) {
            return {
                resumeSequence: this.requireLedger().subscriptionResumeSequence(subscriptionRef),
                successEpoch: this.checkpointFor(subscriptionRef).failureSuccessEpoch ?? 0,
            };
        }
        resumeNeedsCheckpoint(subscriptionRef) {
            const stored = this.checkpointFor(subscriptionRef).failureResumeSequence;
            // A legacy checkpoint already reflects any legacy resume we can observe.
            return stored !== undefined && stored !== this.requireLedger().subscriptionResumeSequence(subscriptionRef);
        }
        async repairWebhookCheckpointLocked(subscriptionRef) {
            const checkpoint = this.checkpointFor(subscriptionRef);
            if (this.resumeNeedsCheckpoint(subscriptionRef)) {
                const { countedAdmissionRef: _counted, ...rest } = checkpoint;
                await this.updateCheckpointLocked(subscriptionRef, () => Object.freeze({ ...rest, consecutiveFailures: 0,
                    failureResumeSequence: this.requireLedger().subscriptionResumeSequence(subscriptionRef) }));
            }
            else if (checkpoint.countedAdmissionRef !== undefined &&
                this.subscriptionAdmissionsTable?.get(admissionKey(subscriptionRef, checkpoint.countedAdmissionRef)) === undefined) {
                await this.forgetCountedAdmissionLocked(subscriptionRef, checkpoint.countedAdmissionRef);
            }
        }
        async forgetCountedAdmissionLocked(subscriptionRef, admissionRef) {
            const { countedAdmissionRef, ...rest } = this.checkpointFor(subscriptionRef);
            if (countedAdmissionRef === admissionRef)
                await this.updateCheckpointLocked(subscriptionRef, () => Object.freeze(rest));
        }
        /**
         * The stored record when its private state may still be written: it exists, it
         * is not deleted, and its Project still runs. Every private write reads the
         * ledger through this first — a terminal barrier that only the caller checks
         * is a barrier the next caller forgets.
         */
        writableSubscription(subscriptionRef) {
            const stored = this.ledger?.subscription(subscriptionRef);
            if (stored === undefined || stored.state === 'deleted')
                return undefined;
            return this.ledger?.getProject(stored.projectRef)?.state === 'active' ? stored : undefined;
        }
        /**
         * Every private row naming one subscription. A checkpoint is keyed by the ref
         * itself; the other tables put the ref before a `|`, and a ref never contains
         * one, so the key prefix is the ref either way.
         */
        privateKeysOf(table, subscriptionRef) {
            const prefix = `${subscriptionRef}|`;
            return [...table.keys()].filter(key => key === subscriptionRef || key.startsWith(prefix));
        }
        /** The private tables a subscription owns, each with the word a failed delete logs it as. */
        subscriptionPrivateTables() {
            return [
                [this.subscriptionTable, 'checkpoint'],
                [this.subscriptionRunsTable, 'run'],
                [this.subscriptionDeliveriesTable, 'delivery'],
                [this.subscriptionReplaysTable, 'replay'],
                [this.subscriptionAdmissionsTable, 'admission'],
            ];
        }
        /**
         * Drop one subscription's private state, ordered against its other private
         * writes by the same lock.
         *
         * A cleanup that ran beside a replay's own answer commit could delete the rows
         * first and see them written back after: the deleting side must take the lock
         * the writing side holds, so either the write finishes and the cleanup drops
         * it, or the cleanup lands first and the write's barrier read finds nothing
         * live and writes nothing.
         */
        forgetSubscriptionPrivateState(subscriptionRef) {
            return this.serializeSubscriptionWrite(subscriptionRef, () => this.dropSubscriptionPrivateState(subscriptionRef));
        }
        /**
         * Drop every private row of one subscription: its checkpoint, its runs, its
         * failed deliveries, and the answers already given to replay requests. Awaited,
         * so a caller that reported the deletion has actually cleaned up; a row that
         * will not delete is logged and left to the boot sweep, never retried here.
         */
        async dropSubscriptionPrivateState(subscriptionRef) {
            this.subscriptionCheckpoints.delete(subscriptionRef);
            for (const [table, label] of this.subscriptionPrivateTables()) {
                if (table === undefined)
                    continue;
                for (const key of this.privateKeysOf(table, subscriptionRef)) {
                    try {
                        await table.delete(key);
                    }
                    catch (error) {
                        this.ctx.logger.warn(`agent-team: could not drop a ${label} record: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
        }
        /**
         * Convergence at boot: a deletion that never finished its cleanup — a crash
         * between the ledger commit and the row drops, or a storage fault — must not
         * leave rows that nobody can read or ever remove. A dead subscription is one
         * the ledger no longer serves, which covers both a deletion and an archived
         * Project.
         */
        async convergeSubscriptionPrivateState() {
            for (const [table, label] of this.subscriptionPrivateTables()) {
                if (table === undefined)
                    continue;
                // Snapshot the keys: this loop deletes the rows it is walking.
                for (const key of Array.from(table.keys())) {
                    const cut = key.indexOf('|');
                    const subscriptionRef = (cut < 0 ? key : key.slice(0, cut));
                    if (this.writableSubscription(subscriptionRef) !== undefined)
                        continue;
                    this.subscriptionCheckpoints.delete(subscriptionRef);
                    try {
                        await table.delete(key);
                    }
                    catch (error) {
                        this.ctx.logger.warn(`agent-team: could not drop the stale ${label} record of '${subscriptionRef}': ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
        }
        /** The Project's Workspace root as the Host's own registry holds it — never the process cwd. */
        subscriptionWorkspaceRoot(subscription) {
            const project = this.ledger?.getProject(subscription.projectRef);
            return project === undefined ? undefined : this.ctx.workspaceRegistry.get(project.workspaceId)?.path;
        }
        shellExecutor() {
            return this.ctx.get('shell');
        }
        credentialProvider() {
            return this.ctx.get('credentials');
        }
        /**
         * The mounted executor's family answer, decided by behavior once and cached;
         * a refusal is retried because the executor may be mounted later.
         */
        mountedShellProbe() {
            if (this.subscriptionShellProbe === undefined) {
                this.subscriptionShellProbe = probeShellFamily(this.shellExecutor()).then(answer => {
                    if (answer.family === undefined)
                        this.subscriptionShellProbe = undefined;
                    return answer;
                });
            }
            return this.subscriptionShellProbe;
        }
        async executeSubscriptionRun(subscription, trigger, extra = {}) {
            const probe = await this.mountedShellProbe();
            return runSubscriptionScript({
                executor: this.shellExecutor(),
                credentials: this.credentialProvider(),
                liveShell: probe.family,
                ...(probe.failure === undefined ? {} : { liveShellFailure: probe.failure }),
                subscription,
                trigger,
                workspaceRoot: this.subscriptionWorkspaceRoot(subscription),
                lastSuccessAt: this.checkpointFor(subscription.subscriptionRef).lastSuccessAt,
                ...(extra.stdin === undefined ? {} : { stdin: extra.stdin }),
                ...(extra.deliveryId === undefined ? {} : { deliveryId: extra.deliveryId }),
            });
        }
        /**
         * Record one finished run in the subscription's private history. A draft the
         * ledger never stored — a create's trial — has no subscription to keep a
         * record under, and a deletion drops the records it wrote.
         *
         * The record is one row of the same private state the deletion cleans up, so
         * it is written under the subscription's write lock and reads the barrier
         * there, beside the `put` and the eviction that belongs with it: a deletion
         * that committed first owns the rows and this write refuses, and one that
         * commits while this segment runs waits for it and then drops what it wrote.
         * The script already finished, so the lock is held for one write, not a run.
         *
         * The answer says whether the record was written. A private write that fails
         * is a diagnostic failure, never a failed run: the ledger already holds what
         * the run produced.
         */
        recordSubscriptionRun(record) {
            const table = this.subscriptionRunsTable;
            if (table === undefined)
                return Promise.resolve(false);
            return this.serializeSubscriptionWrite(record.subscriptionRef, async () => {
                if (this.writableSubscription(record.subscriptionRef) === undefined)
                    return false;
                try {
                    await table.put(subscriptionRunKey(record), record);
                    for (const key of evictedRunKeys(subscriptionRunKeysOf(table.keys(), record.subscriptionRef)))
                        await table.delete(key);
                    return true;
                }
                catch (error) {
                    this.ctx.logger.warn(`agent-team: could not record a run of '${record.subscriptionRef}': ${failureDetail(error)}`);
                    return false;
                }
            });
        }
        /**
         * One run end to end: execute the pinned definition, then commit what it
         * printed. The record is written after the accept, because a run succeeded at
         * the instant its output became durable — the same instant that clears the
         * failure count.
         *
         * `runRef` and `recorded` are separate answers on purpose: the ref names the
         * run whatever happened to the private copy, and `recorded` says whether the
         * copy exists. A caller that treated a missing record as a failed run would
         * report a delivered output as undelivered and run it again.
         *
         * `undefined` means the subscription or its Project stopped being live while
         * the script ran. That is a terminal barrier, not a failure of the script, and
         * it writes nothing: the records it would touch were dropped with the
         * subscription, so writing here would recreate them with nobody to clean up.
         */
        async runSubscriptionOnce(subscription, trigger, extra = {}) {
            const startedAt = Date.now();
            const report = await this.executeSubscriptionRun(subscription, trigger, {
                ...(extra.stdin === undefined ? {} : { stdin: extra.stdin }),
                ...(extra.scriptDeliveryId === undefined && extra.delivery === undefined
                    ? {} : { deliveryId: extra.scriptDeliveryId ?? extra.delivery.deliveryRef }),
            });
            // `eventCount` is what this run had accepted into the ledger, so it is known
            // only once the deduplication has run — never the count the script printed,
            // which counts what was already known as if it were new.
            const finish = async (outcome, category, eventCount) => {
                const record = runRecordOf({ subscription, trigger, startedAt, durationMs: Date.now() - startedAt, category, eventCount, report,
                    ...(extra.delivery === undefined ? {} : { delivery: extra.delivery }) });
                return { outcome, report, runRef: record.runRef, eventCount, recorded: await this.recordSubscriptionRun(record) };
            };
            if (!report.ok)
                return finish('failed', failureCategory(report), 0);
            const committed = await this.commitRunOutput(subscription, report, extra.requestId, extra.holdEvents);
            if (committed === undefined)
                return undefined;
            if (committed.outcome === 'empty')
                return finish('empty', 'empty', 0);
            if (committed.outcome === 'backlog')
                return finish('backlog', 'backlog-full', 0);
            if (committed.outcome === 'deferred')
                return finish('deferred', 'backlog-full', 0);
            return finish('accepted', 'accepted', committed.eventCount);
        }
        /**
         * Commit what one run printed: drop the ids the subscription already knows,
         * accept the rest, and end the failure streak — all in one segment under the
         * subscription's write lock.
         *
         * They belong together because the clear is only honest for defeats counted
         * before it. A delivery the ingress counted beside the run must fall either
         * inside the streak this success ends or outside it entirely, and nothing but
         * the lock can say which: read the count, accept, then clear leaves the window
         * where a defeat lands in between and is cleared with the rest. The script
         * runs outside the lock — holding it for the script would stall every delivery
         * for its whole duration.
         *
         * `undefined` means the subscription or its Project stopped being live while
         * the script ran: a terminal barrier, not a failure of the script, and it
         * writes nothing at all.
         */
        commitRunOutput(subscription, report, requestId, holdEvents) {
            const subscriptionRef = subscription.subscriptionRef;
            const ledger = this.requireLedger();
            return this.serializeSubscriptionWrite(subscriptionRef, async () => {
                // Nothing admits this write but its caller, so the barrier is read here,
                // inside the lock, rather than from the snapshot the run started with.
                if (this.writableSubscription(subscriptionRef) === undefined)
                    return undefined;
                const known = ledger.subscriptionKnownIds(subscriptionRef);
                const fresh = report.events.filter(event => !known.has(event.id));
                const decision = await this.acceptFreshEvents(subscription, fresh, requestId ?? randomUUID(), holdEvents);
                if (decision.outcome === 'dropped')
                    return undefined;
                return Object.freeze({ outcome: decision.outcome, eventCount: decision.outcome === 'accepted' ? decision.eventCount : 0 });
            });
        }
        /**
         * Accept one run's new events, or say why they wait. The caller holds the write
         * lock and has read the terminal barrier in it. No room is not a failure: `hold`
         * keeps a batch its request can never fetch again.
         */
        async acceptFreshEvents(subscription, events, requestId, hold) {
            const ledger = this.requireLedger();
            const subscriptionRef = subscription.subscriptionRef;
            if (events.length === 0) {
                // Nothing new is a success that accepts nothing: it ends the streak and
                // leaves the waterline where it was.
                await this.clearSubscriptionFailuresLocked(subscriptionRef, false, subscription.revision);
                return Object.freeze({ outcome: 'empty' });
            }
            if (events.length > SUBSCRIPTION_PENDING_MAX) {
                this.ctx.logger.warn(`agent-team: subscription '${subscriptionRef}' printed ${events.length} events, past the ${SUBSCRIPTION_PENDING_MAX} it can still publish; this batch was refused`);
                return Object.freeze({ outcome: 'backlog' });
            }
            const pending = ledger.pendingSubscriptionEvents(subscriptionRef).length;
            if (pending + events.length > SUBSCRIPTION_PENDING_MAX) {
                this.ctx.logger.warn(`agent-team: subscription '${subscriptionRef}' already holds ${pending} unpublished events; ${events.length} more wait for room`);
                if (hold !== undefined)
                    await hold(events);
                return Object.freeze({ outcome: 'deferred' });
            }
            const project = ledger.getProject(subscription.projectRef);
            if (project === undefined)
                return Object.freeze({ outcome: 'dropped' });
            try {
                const result = await ledger.acceptSubscriptionEvents({
                    requestId, workspaceId: project.workspaceId,
                    projectRef: subscription.projectRef, subscriptionRef, subscriptionRevision: subscription.revision,
                    scriptHash: subscription.script.sha256, events, actor: agentTeamHostActor(),
                });
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
            }
            catch (error) {
                // A subscription deleted, or a Project archived, while the script ran
                // is a terminal barrier rather than a failure of the script.
                const message = error instanceof Error ? error.message : String(error);
                if (!message.includes('subscription_deleted') && !message.includes('archived'))
                    throw error;
                this.ctx.logger.warn(`agent-team: subscription '${subscriptionRef}' finished after it stopped being live; the output was dropped`);
                return Object.freeze({ outcome: 'dropped' });
            }
            await this.clearSubscriptionFailuresLocked(subscriptionRef, true, subscription.revision);
            return Object.freeze({ outcome: 'accepted', eventCount: events.length });
        }
        /**
         * One timer run for the scheduler. The outcome tells it whether to count a
         * failure, so a run that printed nothing new never pauses a subscription. A
         * batch past the unpublished ceiling is a failure — the script printed more
         * than the Project can still take — while a subscription already at the
         * ceiling never reaches this method: admission skips it before it starts.
         */
        async runTimerSubscription(subscription) {
            const subscriptionRef = subscription.subscriptionRef;
            const ledger = this.requireLedger();
            const project = ledger.getProject(subscription.projectRef);
            // The subscription or its Project stopped being live before the run got a
            // slot: nothing to record, and nothing the script could have done.
            if (project === undefined || ledger.subscription(subscriptionRef)?.state === 'deleted')
                return 'dropped';
            const run = await this.runSubscriptionOnce(subscription, 'interval');
            if (run === undefined)
                return 'dropped';
            if (ledger.subscription(subscriptionRef)?.revision !== subscription.revision)
                return 'dropped';
            if (run.outcome === 'failed') {
                this.ctx.logger.warn(`agent-team: subscription '${subscriptionRef}' run failed: ${run.report.reason ?? 'unknown reason'}`);
            }
            return run.outcome;
        }
        async commitSubscriptionPublication(subscription, acceptedSequence, eventId) {
            const project = this.requireLedger().getProject(subscription.projectRef);
            if (project === undefined)
                return;
            const result = await this.requireLedger().publishSubscriptionEvent({
                requestId: randomUUID(), workspaceId: project.workspaceId, projectRef: subscription.projectRef,
                subscriptionRef: subscription.subscriptionRef, acceptedSequence, eventId, actor: agentTeamHostActor(),
            });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
        }
        /** Three failed runs in a row pause a subscription: the ledger records it and the Main stream tells every owner. */
        async commitFailurePause(subscription) {
            const ledger = this.requireLedger();
            const project = ledger.getProject(subscription.projectRef);
            const current = ledger.subscription(subscription.subscriptionRef);
            if (project?.state !== 'active' || current?.state !== 'active' || current.revision !== subscription.revision)
                return;
            const result = await ledger.pauseSubscription({
                requestId: randomUUID(), workspaceId: project.workspaceId, projectRef: current.projectRef,
                subscriptionRef: current.subscriptionRef, expectedRevision: subscription.revision, actor: agentTeamHostActor(), reason: 'failures',
            });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
        }
        subscriptionListEntries(request, select) {
            const ledger = this.requireLedger();
            const entries = ledger.subscriptionsOfProject(request.projectRef).map(stored => {
                const subscriptionRef = stored.subscriptionRef;
                const accepted = ledger.subscriptionEvents(subscriptionRef);
                const lastRun = this.runRecordsOf(subscriptionRef)[0];
                const dueAt = this.checkpointFor(subscriptionRef).dueAt;
                return Object.freeze({
                    subscription: select(stored),
                    unpublished: ledger.pendingSubscriptionEvents(subscriptionRef).length,
                    eventCount: accepted.length,
                    ...(accepted.length === 0 ? {} : { lastEventAt: accepted.at(-1).acceptedAt }),
                    ...(lastRun === undefined ? {} : { lastRun: runSummaryOf(lastRun) }),
                    ...(dueAt === undefined ? {} : { nextRunAt: new Date(dueAt).toISOString() }),
                });
            });
            return Object.freeze({ entries: Object.freeze(entries) });
        }
        listSubscriptions(actor, request) {
            this.requireLedger().assertSubscriptionReadAuthority(actor, request.projectRef, request.workspaceId);
            return this.subscriptionListEntries(request, subscription => subscription);
        }
        /** Agent discovery returns no script, credential reference or webhook arm, even to a Project member. */
        subscriptionsForAgent(agent, request) {
            const actor = this.memberCall(agent, request.workspaceId);
            this.requireLedger().assertSubscriptionMetadataAuthority(actor, request.projectRef, request.workspaceId);
            return this.subscriptionListEntries(request, subscription => {
                const { script: _script, credentials: _credentials, webhook: _webhook, ...metadata } = subscription;
                return metadata;
            });
        }
        subscriptionsForClient(request) {
            return this.listSubscriptions(this.humanCall(request.workspaceId), request);
        }
        /**
         * One subscription's recorded runs, newest first. Two runs can start in the
         * same millisecond, so the answer is ordered by start instant and falls back
         * to the ref: the key order alone is only start order while instants differ.
         */
        runRecordsOf(subscriptionRef) {
            const table = this.subscriptionRunsTable;
            if (table === undefined)
                return [];
            const records = subscriptionRunKeysOf(table.keys(), subscriptionRef)
                .map(key => table.get(key))
                .filter((record) => record !== undefined);
            return Object.freeze(records.sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt)
                || (left.runRef < right.runRef ? -1 : 1)));
        }
        /**
         * Start one Worker for the calling Member. The target is resolved and ownership
         * of its Project checked before anything is written or started, and that binding
         * is what the run's result follows from then on: a bound run reports in its
         * Thread and wakes this Member through the Inbox, an unbound one keeps the
         * direct parent result. It reads only the handle's identity, `ctx.get(
         * 'workingDirectory')` and the `session` passed to it, which is the stub surface
         * a lane without a real Session needs; `worker-host-thread.spec.ts` pins it.
         */
        async workerStartForAgent(agent, request) {
            const actor = this.memberActor(agent);
            const target = this.workerDelegationTarget(request);
            const workingDirectory = agent.ctx.get('workingDirectory');
            const cwd = request.cwd ?? workingDirectory?.get(agent.session);
            return this.workerRegistry.start({ actor, parent: agent }, {
                requestId: request.requestId,
                workspaceId: target.workspaceId,
                projectRef: target.projectRef,
                ...(target.kind === 'thread' ? { threadRef: target.threadRef } : {}),
                ...(target.kind === 'thread' && target.taskRef !== undefined ? { taskRef: target.taskRef } : {}),
                ...(request.engine === undefined ? {} : { engine: request.engine }),
                task: request.task,
                ...(cwd === undefined ? {} : { cwd }),
            });
        }
        /** The Project a delegation belongs to, taken from its target; every refusal precedes any write. */
        workerDelegationTarget(request) {
            const target = this.requireLedger().delegationTarget({ projectRef: request.projectRef,
                threadRef: request.threadRef, taskRef: request.taskRef });
            switch (target.kind) {
                case 'project':
                case 'thread': return target;
                case 'target-required':
                    throw new WorkerRefusal('worker_target_required', 'A delegation names the Thread, Task, or Project it works on.');
                case 'project-unknown':
                    throw new WorkerRefusal('worker_project_unknown', `${target.projectRef} is not a Project in this Team.`);
                case 'thread-unknown':
                    throw new WorkerRefusal('worker_thread_unknown', `${target.threadRef} is not a Thread in this Team.`);
                case 'task-unknown':
                    throw new WorkerRefusal('worker_task_unknown', `${target.taskRef} is not a Task in this Team.`);
                case 'target-conflict':
                    throw new WorkerRefusal('worker_target_conflict', `Task ${target.taskRef} is not in Thread ${target.threadRef}.`);
                case 'project-conflict':
                    throw new WorkerRefusal('worker_target_conflict', `Project ${target.projectRef} does not contain Thread ${target.threadRef}.`);
            }
        }
        /** Every Worker this Host started, for the caller's own inspection. */
        workerRunsForAgent(agent) {
            this.memberActor(agent);
            return this.workerRegistry.list();
        }
        /**
         * Stop one Worker this Host holds. Only the Member who delegated the run may
         * stop it through the tool; the start conditions — the settings switch, current
         * ownership, an enabled engine — are deliberately not re-applied, so a run
         * stays stoppable after any of them changes.
         */
        async workerStopForAgent(agent, request) {
            const actor = this.memberActor(agent);
            const ledger = this.requireLedger();
            const execution = ledger.workerExecution(request.workerRef);
            if (execution === undefined)
                throw new WorkerRefusal('worker_unknown', `No Worker '${request.workerRef}' was started by this Team.`);
            if (execution.initiatedBy !== actor.memberId) {
                throw new WorkerRefusal('worker_stop_forbidden', `Only the Member who delegated Worker '${request.workerRef}' or the Human may stop it.`);
            }
            if (this.workerRegistry.get(request.workerRef) === undefined) {
                if (execution.state === 'running') {
                    throw new WorkerRefusal('worker_unconfirmed', `Worker '${request.workerRef}' was started by a Host that no longer `
                        + 'holds its handle, so this Host cannot confirm or stop it; its result stays unconfirmed.');
                }
                throw new WorkerRefusal('worker_already_ended', `Worker '${request.workerRef}' already ended: ${execution.state}.`);
            }
            return this.workerRegistry.stop(request.workerRef, actor);
        }
        /**
         * One Member's instruction to an execution it delegated. A live execution
         * takes it now; an ended execution is resumed as a new linked execution in
         * the same native conversation. The immutable chain and ledger decide which
         * execution owns the next turn, never a process-local native id.
         */
        async workerSteerForAgent(agent, request) {
            const actor = this.memberActor(agent);
            const ledger = this.requireLedger();
            const execution = ledger.workerExecution(request.workerRef);
            if (execution === undefined)
                throw new WorkerRefusal('worker_unknown', `No Worker '${request.workerRef}' was started by this Team.`);
            const instruction = request.instruction.trim();
            if (instruction === '')
                throw new WorkerRefusal('worker_steer_required', 'A steer needs the instruction the Worker should take on.');
            const normalized = { requestId: request.requestId, instruction };
            const chain = this.workerChain(execution);
            const chainTail = chain.at(-1);
            const nativeSessionId = chain.findLast(item => item.nativeSessionId !== undefined)?.nativeSessionId;
            const knownTail = nativeSessionId === undefined ? undefined : ledger.workerLatestInNativeSession(nativeSessionId);
            const target = knownTail ?? chainTail;
            const receiptRefs = new Set([...chain.map(item => item.workerRef), target.workerRef]);
            // Request-id identity comes before authorization or state: another Member's
            // reuse is a collision, not an instruction this Member may apply anywhere.
            const priorReceipt = await this.workerRegistry.steerReceipt([...receiptRefs], actor, normalized);
            if (priorReceipt !== undefined)
                return priorReceipt;
            const durable = ledger.workerStartedByRequest(request.requestId);
            if (durable !== undefined) {
                const sameConversation = nativeSessionId !== undefined
                    && ledger.workerNativeSessionOf(durable.workerRef) === nativeSessionId;
                if (durable.task !== instruction || durable.initiatedBy !== actor.memberId
                    || durable.continuedFrom === undefined
                    || (!this.workerChainContains(durable, execution.workerRef) && !sameConversation)) {
                    throw new WorkerRefusal('worker_steer_conflict', `Request id '${request.requestId}' already started another execution; `
                        + 'use a new request id for this instruction.');
                }
                if (durable.state === 'running' && this.workerRegistry.get(durable.workerRef) === undefined) {
                    throw new WorkerRefusal('worker_unconfirmed', `Worker '${durable.workerRef}' was started by a Host that no longer holds its `
                        + 'handle, so it cannot be steered.');
                }
                return Object.freeze({ workerRef: durable.workerRef, engine: durable.engine, state: 'started',
                    ...(durable.continuedFrom === undefined ? {} : { continuedFrom: durable.continuedFrom }),
                    runState: this.workerRegistry.liveState(durable.workerRef) ?? durable.state });
            }
            if (execution.initiatedBy !== actor.memberId) {
                throw new WorkerRefusal('worker_steer_forbidden', `Only the Member who delegated Worker '${request.workerRef}' may add an `
                    + 'instruction to it.');
            }
            // Same-text dedupe is durable and tied to the receiving execution. Checking
            // it here, before a running-without-handle refusal or an ended-tail resume,
            // makes a fresh alias answer the original receipt without native history.
            const textAlias = await this.workerRegistry.steerTextAlias(actor, normalized, {
                workerRef: target.workerRef,
                initiatedBy: target.initiatedBy,
                continuedFrom: target.workerRef,
                allowSubmitted: target.state === 'running',
            });
            if (textAlias !== undefined)
                return textAlias;
            if (target.state === 'running') {
                if (this.workerRegistry.get(target.workerRef) === undefined) {
                    throw new WorkerRefusal('worker_unconfirmed', `Worker '${target.workerRef}' was started by a Host that no longer holds its `
                        + 'handle, so this Host cannot reach its engine session; its result stays unconfirmed.');
                }
                return this.workerRegistry.steer(target.workerRef, actor, normalized);
            }
            return this.workerRegistry.continueFrom({ actor, parent: agent }, target, normalized);
        }
        /** Follow the immutable `continuedFrom` chain from a caller's ref to its newest execution. */
        workerChain(start) {
            const ledger = this.requireLedger();
            const chain = [];
            let current = start;
            const seen = new Set();
            while (!seen.has(current.workerRef)) {
                seen.add(current.workerRef);
                chain.push(current);
                const next = ledger.workerSuccessor(current.workerRef);
                if (next === undefined)
                    return Object.freeze(chain);
                current = next;
            }
            throw new WorkerRefusal('worker_unknown', `Worker '${start.workerRef}' has a cyclic continuation chain.`);
        }
        /** Whether one execution belongs to the chain rooted at a caller's requested ref. */
        workerChainContains(execution, workerRef) {
            const ledger = this.requireLedger();
            let current = execution;
            const seen = new Set();
            while (current !== undefined && !seen.has(current.workerRef)) {
                if (current.workerRef === workerRef)
                    return true;
                seen.add(current.workerRef);
                current = current.continuedFrom === undefined ? undefined : ledger.workerExecution(current.continuedFrom);
            }
            return false;
        }
        /** One run's shape for the Human's list, whichever record of it is being read. */
        workerRunViewOf(run, state) {
            return Object.freeze({ workerRef: run.workerRef, projectRef: run.projectRef, engine: run.engine, state,
                task: workerTaskPreview(run.task), startedAt: run.startedAt,
                ...(run.threadRef === undefined ? {} : { threadRef: run.threadRef }),
                ...(run.taskRef === undefined ? {} : { taskRef: run.taskRef }) });
        }
        /**
         * One Member's Worker runs for the Human's edit surface: what this Host still
         * holds (running or stopping), the records a previous Host left running, which
         * are listed as unconfirmed and offer no stop control, and the newest ended
         * runs, each with the state it really ended in. It is one window of five rows:
         * the live and unconfirmed runs hold their seats first, and the newest endings
         * fill the rest. A failed run has to stay reachable after its process exited,
         * or the diagnostic behind it has no door.
         */
        workerRunsForClient(request) {
            this.requireWorkspace(request.workspaceId);
            const ledger = this.requireLedger();
            const runs = [];
            const seen = new Set();
            for (const run of this.workerRegistry.runsOf(request.memberId)) {
                // A run that already ended stays in the registry as its own record; the
                // Human's list offers only what can still be stopped.
                const live = this.workerRegistry.liveState(run.workerRef);
                if (live === undefined)
                    continue;
                const execution = ledger.workerExecution(run.workerRef);
                if (execution === undefined || ledger.getProject(execution.projectRef)?.workspaceId !== request.workspaceId)
                    continue;
                seen.add(run.workerRef);
                runs.push(this.workerRunViewOf(execution, live));
            }
            // The Workspace and Member filters run before the bound, so a Member's window
            // is their own, not whatever survived another filter. The rows above already
            // hold their seats: the list is five rows, not five endings plus whatever is
            // running, and a live run is never the one the bound drops.
            const ended = [];
            for (const execution of ledger.workerExecutionsOfMember(request.memberId)) {
                if (seen.has(execution.workerRef))
                    continue;
                if (ledger.getProject(execution.projectRef)?.workspaceId !== request.workspaceId)
                    continue;
                if (execution.state === 'running') {
                    runs.push(this.workerRunViewOf(execution, 'unconfirmed'));
                    continue;
                }
                ended.push(execution);
            }
            for (const execution of newestEndedRuns(ended, Math.max(0, WORKER_RUN_LIST_LIMIT - runs.length))) {
                runs.push(this.workerRunViewOf(execution, execution.state));
            }
            return Object.freeze({ runs: Object.freeze(runs) });
        }
        /**
         * The Human's stop of one execution from a Member's edit surface. It runs the
         * same Host stop transaction as the Member's tool, but answers with structured
         * facts instead of a refusal the Client would have to read a sentence out of:
         * an ending the engine decided, a cleanup still in flight, or a handle this
         * Host no longer holds. Authorization and an unknown run stay refusals.
         */
        async stopWorkerForClient(request) {
            this.requireWorkspace(request.workspaceId);
            const ledger = this.requireLedger();
            const execution = ledger.workerExecution(request.workerRef);
            if (execution === undefined)
                throw new WorkerRefusal('worker_unknown', `No Worker '${request.workerRef}' was started by this Team.`);
            if (execution.initiatedBy !== request.memberId) {
                throw new WorkerRefusal('worker_stop_forbidden', `Worker '${request.workerRef}' was delegated by another Member; `
                    + 'this surface lists only that Member\'s runs.');
            }
            if (ledger.getProject(execution.projectRef)?.workspaceId !== request.workspaceId) {
                throw new WorkerRefusal('worker_stop_forbidden', `Worker '${request.workerRef}' does not belong to a Project of this Workspace.`);
            }
            const ended = (state, settled) => Object.freeze({ kind: 'ended', workerRef: request.workerRef, state,
                ...(settled?.settledAt === undefined ? {} : { settledAt: settled.settledAt }),
                ...(settled?.diagnostic === undefined ? {} : { diagnostic: settled.diagnostic }) });
            if (this.workerRegistry.get(request.workerRef) === undefined) {
                if (execution.state === 'running') {
                    return Object.freeze({ kind: 'unconfirmed', workerRef: request.workerRef,
                        message: `Worker '${request.workerRef}' was started by a Host that no longer holds its handle, `
                            + 'so it cannot be confirmed or stopped; its result stays unconfirmed.' });
                }
                return ended(execution.state, execution);
            }
            try {
                const stopped = await this.workerRegistry.stop(request.workerRef, agentTeamHumanActor());
                if (stopped.state === 'running' || stopped.state === 'unconfirmed') {
                    return Object.freeze({ kind: 'pending', workerRef: request.workerRef,
                        message: `Worker '${request.workerRef}' is still stopping; the engine has not confirmed its cleanup yet.` });
                }
                return ended(stopped.state, stopped);
            }
            catch (error) {
                if (!(error instanceof WorkerRefusal))
                    throw error;
                // Both of these are endings the Host already recorded, so the receipt
                // carries the state and the sentence rather than a bare refusal.
                if (error.code === 'worker_stop_unconfirmed' || error.code === 'worker_already_ended') {
                    const recorded = this.requireLedger().workerExecution(request.workerRef);
                    if (recorded !== undefined && recorded.state !== 'running') {
                        return ended(recorded.state, recorded);
                    }
                }
                if (error.code === 'worker_stop_pending') {
                    return Object.freeze({ kind: 'pending', workerRef: request.workerRef, message: error.message });
                }
                throw error;
            }
        }
        /**
         * One run's diagnostic for the Member who delegated it, read by its Team-owned
         * ref. The summary is the sentence the Thread already carries; the rest is what
         * the engine's own record still answers, read on demand and never stored. Only
         * the initiating Member and the Human may ask — everyone else is refused, so a
         * Project's other Members keep seeing exactly what the Thread published.
         */
        async workerInspectForAgent(agent, request) {
            const actor = this.memberActor(agent);
            const execution = this.requireLedger().workerExecution(request.workerRef);
            if (execution === undefined)
                throw new WorkerRefusal('worker_unknown', `No Worker '${request.workerRef}' was started by this Team.`);
            if (execution.initiatedBy !== actor.memberId) {
                throw new WorkerRefusal('worker_inspect_forbidden', `Only the Member who delegated Worker '${request.workerRef}' `
                    + 'or the Human may read its diagnostic.');
            }
            return this.workerInspectionOf(execution);
        }
        /**
         * The Human's read of one execution's diagnostic from a Member's edit surface.
         * It runs the same look-up as the Member's tool, but the surface names the
         * Member it is showing, so a run that Member did not initiate is refused here
         * rather than answered from a list the Human never asked about.
         */
        async inspectWorkerForClient(request) {
            this.requireWorkspace(request.workspaceId);
            const ledger = this.requireLedger();
            const execution = ledger.workerExecution(request.workerRef);
            if (execution === undefined)
                throw new WorkerRefusal('worker_unknown', `No Worker '${request.workerRef}' was started by this Team.`);
            if (execution.initiatedBy !== request.memberId) {
                throw new WorkerRefusal('worker_inspect_forbidden', `Worker '${request.workerRef}' was delegated by another Member; `
                    + 'this surface reads only that Member\'s runs.');
            }
            if (ledger.getProject(execution.projectRef)?.workspaceId !== request.workspaceId) {
                throw new WorkerRefusal('worker_inspect_forbidden', `Worker '${request.workerRef}' does not belong to a Project of this Workspace.`);
            }
            return this.workerInspectionOf(execution);
        }
        /**
         * Build one run's report. A run that has not ended has no anchors yet — they are
         * written with its ending — so the report says that instead of asking the engine
         * for a record the Team has not been told how to find.
         */
        async workerInspectionOf(execution) {
            const live = this.workerRegistry.liveState(execution.workerRef);
            const unconfirmed = execution.state === 'running' && live === undefined;
            const history = execution.state === 'running'
                ? { kind: 'unpersisted', reason: unconfirmed
                        ? 'The Host that started this run no longer holds its handle, so its ending was never recorded and there is no native record to look up.'
                        : 'The run has not ended yet; its native record is read once it does.' }
                : await readWorkerHistory(execution);
            const summary = execution.state === 'running'
                ? unconfirmed
                    ? 'This Host no longer holds the run\'s handle, so its result cannot be confirmed.'
                    : 'The run is still going.'
                : execution.diagnostic ?? `The run ended as ${execution.state}.`;
            return Object.freeze({
                workerRef: execution.workerRef,
                projectRef: execution.projectRef,
                engine: execution.engine,
                state: execution.state,
                unconfirmed,
                startedAt: execution.startedAt,
                ...(execution.settledAt === undefined ? {} : { settledAt: execution.settledAt }),
                ...(execution.threadRef === undefined ? {} : { threadRef: execution.threadRef }),
                ...(execution.taskRef === undefined ? {} : { taskRef: execution.taskRef }),
                summary,
                ...(execution.stage === undefined ? {} : { stage: execution.stage }),
                native: Object.freeze({
                    ...(execution.nativeSessionId === undefined ? {} : { threadId: execution.nativeSessionId }),
                    ...(execution.nativeTurnId === undefined ? {} : { turnId: execution.nativeTurnId }),
                    ...(execution.nativeTurnIds === undefined ? {} : { turnIds: execution.nativeTurnIds }),
                    ...(execution.nativeInputIds === undefined ? {} : { inputIds: execution.nativeInputIds }),
                    ...(execution.nativeStorage === undefined ? {} : { storage: execution.nativeStorage }),
                }),
                history,
            });
        }
        /** One run as the caller may read it: the summary always, the output only an owner. */
        logEntryOf(record, seesOutput) {
            const summary = runSummaryOf(record);
            if (!seesOutput)
                return Object.freeze({ ...summary });
            return Object.freeze({ ...summary, ...(record.reason === undefined ? {} : { reason: record.reason }),
                stdoutTail: record.stdoutTail, stderrTail: record.stderrTail, scriptHash: record.scriptHash, attempt: record.attempt,
                ...(record.deliveryRef === undefined ? {} : { deliveryRef: record.deliveryRef }) });
        }
        /**
         * What a subscription's recent runs did. Every Project member may read the
         * summary; the halves only an owner reads are the script's own output and the
         * sentence a failure explains itself with, because the script runs with the
         * Project's credentials and its output may carry what they unlocked.
         */
        subscriptionLogs(actor, request) {
            const ledger = this.requireLedger();
            ledger.assertSubscriptionReadAuthority(actor, request.projectRef, request.workspaceId);
            const subscription = ledger.subscription(request.subscriptionRef);
            if (subscription === undefined || subscription.projectRef !== request.projectRef) {
                throw new Error(`subscription '${request.subscriptionRef}' does not belong to Project '${request.projectRef}'`);
            }
            if (subscription.state === 'deleted')
                throw new Error(`subscription '${request.subscriptionRef}' is deleted (subscription_deleted)`);
            const seesOutput = actor.kind === 'human'
                || (actor.kind === 'member' && ledger.projectOwnerIds(request.projectRef).includes(actor.memberId));
            const limit = Math.min(Math.max(request.limit ?? SUBSCRIPTION_RUN_HISTORY_LIMIT, 1), SUBSCRIPTION_RUN_HISTORY_LIMIT);
            return Object.freeze({ subscription,
                runs: Object.freeze(this.runRecordsOf(request.subscriptionRef).slice(0, limit).map(record => this.logEntryOf(record, seesOutput))) });
        }
        /** An Agent Member reads one subscription's runs; the authority split decides what it sees. */
        subscriptionLogsForAgent(agent, request) {
            return this.subscriptionLogs(this.memberCall(agent, request.workspaceId), request);
        }
        /** The Human page reads the same records, and always carries the output. */
        subscriptionLogsForClient(request) {
            return this.subscriptionLogs(this.humanCall(request.workspaceId), request);
        }
        /**
         * The delivery records of one subscription, still failing. They outlive the
         * run records on purpose: the run that failed may be evicted long before an
         * owner gets to replay the request that produced it.
         */
        deliveryRecordsOf(subscriptionRef) {
            const table = this.subscriptionDeliveriesTable;
            if (table === undefined)
                return [];
            const records = deliveryKeysOf(table.keys(), subscriptionRef)
                .map(key => table.get(key))
                .filter((record) => record !== undefined);
            return Object.freeze(records);
        }
        subscriptionDeliveries(actor, request) {
            const ledger = this.requireLedger();
            // A failed delivery holds the request body it arrived with, so the list is
            // the owners' read, not every member's.
            ledger.assertSubscriptionAuthority(actor, request.projectRef, request.workspaceId);
            const subscription = ledger.subscription(request.subscriptionRef);
            if (subscription === undefined || subscription.projectRef !== request.projectRef) {
                throw new Error(`subscription '${request.subscriptionRef}' does not belong to Project '${request.projectRef}'`);
            }
            if (subscription.state === 'deleted')
                throw new Error(`subscription '${request.subscriptionRef}' is deleted (subscription_deleted)`);
            const records = this.deliveryRecordsOf(request.subscriptionRef);
            const failures = failedDeliveries(records, Date.now(), this.replayedDeliveryRefs(request.subscriptionRef, records));
            return Object.freeze({ deliveries: Object.freeze(failures.map(deliveryEntryOf)) });
        }
        /** An Agent owner lists the deliveries whose automatic retries are spent. */
        subscriptionDeliveriesForAgent(agent, request) {
            return this.subscriptionDeliveries(this.memberCall(agent, request.workspaceId), request);
        }
        /** The same list for the Human's page: the failed deliveries an owner reads and replays. */
        subscriptionDeliveriesForClient(request) {
            return this.subscriptionDeliveries(this.humanCall(request.workspaceId), request);
        }
        /**
         * One subscription's private read-modify-write steps, run one at a time: the ingress
         * is the only writer the scheduler does not admit, and two deliveries arriving
         * together would otherwise read the same failure count and lose one increment.
         */
        serializeSubscriptionWrite(subscriptionRef, task) {
            const previous = this.subscriptionWriteTails.get(subscriptionRef) ?? Promise.resolve();
            const next = previous.then(task, task);
            const settled = next.then(() => { }, () => { });
            this.subscriptionWriteTails.set(subscriptionRef, settled);
            void settled.then(() => {
                if (this.subscriptionWriteTails.get(subscriptionRef) === settled)
                    this.subscriptionWriteTails.delete(subscriptionRef);
            });
            return next;
        }
        /** Every admission one subscription still owes work for, in no particular order. */
        admissionRecordsOf(subscriptionRef) {
            const table = this.subscriptionAdmissionsTable;
            if (table === undefined)
                return [];
            return admissionKeysOf(table.keys(), subscriptionRef)
                .map(key => table.get(key))
                .filter((record) => record !== undefined);
        }
        /**
         * The public entry's whole decision: whether this request becomes durable work. A
         * `queued` answer means the row is already written, so a restart before the 202
         * loses nothing; a storage failure throws and the entry answers 5xx. The token
         * resolves against the ledger's armed addresses, so a reset, a dropped trigger, a
         * deletion and an archive all answer "no such address" — while a delivery already
         * queued keeps its row, because a reset moves an address, not a queue.
         */
        async intakeWebhookDelivery(request) {
            const ledger = this.requireLedger();
            const claimed = ledger.subscriptionByWebhookToken(request.token);
            if (claimed === undefined)
                return Object.freeze({ kind: 'not-found' });
            const table = this.subscriptionAdmissionsTable;
            if (table === undefined)
                throw new Error('the subscription store is not open, so this delivery cannot be queued');
            return this.serializeSubscriptionWrite(claimed.subscriptionRef, async () => {
                // Read the barriers under the write lock: a delete, archive or pause that
                // landed while this request waited must win over it.
                const live = this.writableSubscription(claimed.subscriptionRef);
                if (live === undefined)
                    return Object.freeze({ kind: 'not-found' });
                // The token is proof only while it is the one the ledger arms now: a reset that
                // committed while this request waited moved it.
                if (ledger.subscriptionByWebhookToken(request.token)?.subscriptionRef !== live.subscriptionRef) {
                    return Object.freeze({ kind: 'not-found' });
                }
                if (live.state === 'paused')
                    return Object.freeze({ kind: 'paused' });
                if (this.admissionRecordsOf(live.subscriptionRef).length >= WEBHOOK_QUEUE_LIMIT) {
                    return Object.freeze({ kind: 'queue-full', retryAfterSeconds: WEBHOOK_QUEUE_RETRY_AFTER_SECONDS });
                }
                const admissionRef = admissionRefFor(randomUUID());
                const record = Object.freeze({
                    admissionRef,
                    subscriptionRef: live.subscriptionRef,
                    projectRef: live.projectRef,
                    deliveryRef: admissionDeliveryRef(admissionRef, request.headers),
                    receivedRevision: live.revision,
                    receivedScriptHash: live.script.sha256,
                    script: live.script,
                    credentials: live.credentials,
                    headers: Object.freeze({ ...request.headers }),
                    body: request.body,
                    receivedAt: new Date().toISOString(),
                    attempts: 0,
                    state: 'queued',
                });
                await table.put(admissionKey(live.subscriptionRef, admissionRef), record);
                return Object.freeze({ kind: 'queued', admissionRef });
            });
        }
        /**
         * Run what is due, one delivery per subscription per pass, through the scheduler's
         * admission so the four slots and the per-subscription mutex hold as they do for a
         * timer. A pass never throws out of the loop: the queue is durable, so a failed pass
         * leaves the rows for the next one.
         *
         * The queue is what owes work, not the trigger: a subscription edited into a
         * timer-only one stops serving its address, but a request already answered 202 is
         * still owed its run under the definition it arrived with.
         */
        async pumpWebhookAdmissions() {
            if (this.admissionPumpRunning || this.ledger === undefined)
                return;
            this.admissionPumpRunning = true;
            try {
                for (const subscription of this.ledger.subscriptions()) {
                    if (subscription.state === 'deleted')
                        continue;
                    try {
                        const { countedAdmissionRef } = this.checkpointFor(subscription.subscriptionRef);
                        if (this.resumeNeedsCheckpoint(subscription.subscriptionRef) || (countedAdmissionRef !== undefined &&
                            this.subscriptionAdmissionsTable?.get(admissionKey(subscription.subscriptionRef, countedAdmissionRef)) === undefined)) {
                            await this.serializeSubscriptionWrite(subscription.subscriptionRef, () => this.repairWebhookCheckpointLocked(subscription.subscriptionRef));
                        }
                        const records = this.admissionRecordsOf(subscription.subscriptionRef);
                        const exhausted = records.find(record => record.state === 'exhausted');
                        if (exhausted !== undefined) {
                            // Pausing stops scripts, not settlement of an attempt that already ended.
                            // Settlement comes first and one row at a time, so a queue holding several
                            // spent deliveries settles one per pass and runs nothing until the last is
                            // gone: the 5s pass interval makes that wait, not a lock or a retry ladder.
                            await this.serializeSubscriptionWrite(subscription.subscriptionRef, () => this.finishExhaustedWebhookAdmissionLocked(exhausted));
                        }
                        else if (subscription.state === 'active') {
                            // One delivery per subscription per pass, oldest arrival first, so a busy
                            // subscription cannot hold the pass away from the others.
                            const due = dueAdmissions(records, Date.now())[0];
                            if (due !== undefined)
                                await this.runWebhookAdmission(subscription, due);
                        }
                    }
                    catch (error) {
                        this.ctx.logger.warn(`agent-team: the webhook queue pass for '${subscription.subscriptionRef}' stopped: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
            finally {
                this.admissionPumpRunning = false;
            }
        }
        /** One due delivery: run it, then settle its row from what the run reported. */
        async runWebhookAdmission(subscription, record) {
            const live = this.writableSubscription(subscription.subscriptionRef);
            if (live === undefined) {
                await this.dropWebhookAdmission(record);
                return;
            }
            if (live.state !== 'active')
                return;
            // An accept the ledger already holds is this delivery's success, whatever its row
            // still says: a Host that stopped before removing it costs a read, not a second run.
            const attempt = record.attempts + 1;
            const requestId = admissionAttemptRequestId(record.admissionRef, attempt);
            if (this.acceptedRequestEvents(record.subscriptionRef, requestId) !== undefined) {
                await this.dropWebhookAdmission(record);
                return;
            }
            // A row that already holds a validated batch owes no script: only its accept,
            // retried until the queue has room.
            if (record.heldEvents !== undefined) {
                await this.enqueueHeldAdmission(record, requestId);
                return;
            }
            // The definition the payload arrived under, not the one that stands now.
            const source = this.replaySource(live, record, 'received');
            const execute = async () => {
                // A queued run can get its slot after a resume committed but failed to
                // clear the checkpoint. Let the next pass repair the count before running.
                if (this.resumeNeedsCheckpoint(record.subscriptionRef))
                    return;
                const failureStreak = this.webhookFailureStreak(record.subscriptionRef);
                const run = await this.runSubscriptionOnce(source, 'webhook', {
                    stdin: webhookStdin(record.headers, record.body),
                    scriptDeliveryId: record.admissionRef,
                    delivery: { deliveryRef: record.deliveryRef, attempt },
                    requestId,
                    holdEvents: events => this.holdAdmissionEvents(record, events),
                });
                // A held batch owes acceptance, not a failure. Keep the slot through
                // settlement so a queued timer cannot run before an exhausted pause.
                if (run === undefined || run.outcome === 'deferred')
                    return;
                if (run.outcome === 'accepted' || run.outcome === 'empty') {
                    await this.dropWebhookAdmission(record);
                    return;
                }
                const failure = run.report.ok
                    ? `this run produced more events than the Project can hold (${SUBSCRIPTION_PENDING_MAX} unpublished)`
                    : run.report.reason ?? 'the run failed';
                await this.retryOrFailWebhookAdmission(live, record, failure, run.outcome !== 'backlog', failureStreak);
            };
            const scheduler = this.subscriptionScheduler;
            try {
                await (scheduler === undefined ? execute() : scheduler.runAdmitted(live, 'run', execute));
            }
            finally {
                // A refusal to grant a slot keeps the row unless the ledger is terminal.
                if (this.writableSubscription(record.subscriptionRef) === undefined)
                    await this.dropWebhookAdmission(record);
            }
        }
        /** Keep one run's batch on its delivery row: called inside the accept step's lock and barrier read. */
        async holdAdmissionEvents(record, events) {
            const table = this.subscriptionAdmissionsTable;
            const key = admissionKey(record.subscriptionRef, record.admissionRef);
            if (record.state === 'exhausted' || table === undefined || table.get(key) === undefined)
                return;
            const { nextAttemptAt: _due, lastError: _error, ...waiting } = record;
            await table.put(key, Object.freeze({ ...waiting, state: 'queued', heldEvents: Object.freeze([...events]) }));
        }
        /**
         * Retry only the accept for a held batch: the payload's one run already happened.
         * A batch whose ids another run published meanwhile owes nothing and leaves too.
         */
        enqueueHeldAdmission(record, requestId) {
            const ledger = this.requireLedger();
            const subscriptionRef = record.subscriptionRef;
            return this.serializeSubscriptionWrite(subscriptionRef, async () => {
                const table = this.subscriptionAdmissionsTable;
                const key = admissionKey(subscriptionRef, record.admissionRef);
                if (table === undefined || table.get(key) === undefined)
                    return;
                // The barrier is read here, inside the lock: a deletion that landed since the
                // pass began owns the rows, and recreating one would strand it.
                if (this.writableSubscription(subscriptionRef) === undefined) {
                    await table.delete(key);
                    return;
                }
                const known = ledger.subscriptionKnownIds(subscriptionRef);
                const fresh = (record.heldEvents ?? []).filter(event => !known.has(event.id));
                if (fresh.length === 0) {
                    await table.delete(key);
                    return;
                }
                const live = this.writableSubscription(subscriptionRef);
                if (live === undefined) {
                    await table.delete(key);
                    return;
                }
                // The batch ran under the definition the payload arrived under, so the
                // accept attributes it to that revision even when an update landed since.
                const decision = await this.acceptFreshEvents(this.replaySource(live, record, 'received'), fresh, requestId);
                // Every answer but `deferred` settles the row: the batch is in the ledger, or
                // the record it would land on is gone.
                if (decision.outcome === 'accepted' || decision.outcome === 'empty' || decision.outcome === 'dropped')
                    await table.delete(key);
            });
        }
        /**
         * Count one attempt and decide what the delivery owes next: another try on the
         * 1/5/30 ladder, or the failed-delivery record an owner replays. One delivery is one
         * failure however many attempts it took. `retryable` is false for a failure no retry
         * can change, which sends it straight to that record.
         */
        retryOrFailWebhookAdmission(subscription, record, failure, retryable, failureStreak) {
            return this.serializeSubscriptionWrite(record.subscriptionRef, async () => {
                const table = this.subscriptionAdmissionsTable;
                if (record.state === 'exhausted' || table === undefined)
                    return;
                const key = admissionKey(record.subscriptionRef, record.admissionRef);
                if (table.get(key) === undefined)
                    return;
                const attempts = record.attempts + 1;
                const delay = retryable ? webhookRetryDelayMs(attempts) : undefined;
                const live = this.writableSubscription(record.subscriptionRef);
                if (live === undefined) {
                    await table.delete(key);
                    return;
                }
                if (delay !== undefined) {
                    await table.put(key, Object.freeze({ ...record, attempts, state: 'retrying',
                        nextAttemptAt: new Date(Date.now() + delay).toISOString(), lastError: failure }));
                    return;
                }
                // These tables cannot commit together. Keep the decision on the admission
                // until the replay record is durable, so recovery does not run the script again.
                // Both state-only fields come off here: the record that becomes `exhausted`
                // keeps neither a retry instant nor a held batch, as its type and schema say.
                const { nextAttemptAt: _due, heldEvents: _held, ...spent } = record;
                const earlier = this.deliveryRecordForSettlement(this.subscriptionDeliveriesTable?.get(deliveryKey(record.subscriptionRef, record.deliveryRef)), record.admissionRef);
                const exhausted = Object.freeze({ ...spent, attempts, state: 'exhausted', lastError: failure,
                    ...(earlier === undefined && live.revision === record.receivedRevision ? { failureStreak } : {}) });
                await table.put(key, exhausted);
                await this.finishExhaustedWebhookAdmissionLocked(exhausted);
                this.ctx.logger.warn(`agent-team: a webhook delivery for '${subscription.subscriptionRef}' spent its retries: ${failure}`);
            });
        }
        /**
         * A stored failure still owns its delivery while it is live, or while it belongs
         * to the same unfinished admission. An expired record from a different
         * admission is a fresh provider delivery and must not suppress its count.
         */
        deliveryRecordForSettlement(record, admissionRef) {
            if (record === undefined)
                return undefined;
            if (Date.parse(record.expiresAt) > Date.now())
                return record;
            return record.admissionRef !== undefined && record.admissionRef === admissionRef ? record : undefined;
        }
        async finishExhaustedWebhookAdmissionLocked(admission) {
            const table = this.subscriptionAdmissionsTable;
            if (table === undefined || this.subscriptionDeliveriesTable === undefined)
                return;
            const key = admissionKey(admission.subscriptionRef, admission.admissionRef);
            const record = table.get(key);
            if (record?.state !== 'exhausted')
                return;
            const live = this.writableSubscription(record.subscriptionRef);
            if (live !== undefined) {
                await this.recordFailedDeliveryLocked(live, {
                    deliveryRef: record.deliveryRef,
                    admissionRef: record.admissionRef,
                    receivedRevision: record.receivedRevision,
                    receivedAt: Date.parse(record.receivedAt),
                    script: record.script,
                    credentials: record.credentials,
                    body: webhookStdin(record.headers, record.body),
                    attempts: record.attempts,
                    lastError: record.lastError,
                });
                // The definition can change while the failure row is being written.
                const current = this.writableSubscription(record.subscriptionRef);
                const streak = this.webhookFailureStreak(record.subscriptionRef);
                if (current?.revision === record.receivedRevision && record.failureStreak?.resumeSequence === streak.resumeSequence &&
                    record.failureStreak.successEpoch === streak.successEpoch) {
                    const checkpoint = this.checkpointFor(record.subscriptionRef);
                    const settled = checkpoint.countedAdmissionRef === record.admissionRef ? checkpoint :
                        await this.updateCheckpointLocked(record.subscriptionRef, current => Object.freeze({ ...current,
                            consecutiveFailures: current.consecutiveFailures + 1, countedAdmissionRef: record.admissionRef }));
                    if (settled !== undefined && settled.consecutiveFailures >= SUBSCRIPTION_FAILURES_BEFORE_PAUSE) {
                        await this.commitFailurePause(current);
                    }
                }
            }
            await table.delete(key);
            await this.forgetCountedAdmissionLocked(record.subscriptionRef, record.admissionRef);
            // Keep the replay row as the deduplication proof until the queue row is gone.
            if (live !== undefined)
                await this.pruneDeliveries(live.subscriptionRef, Date.now());
        }
        /** Take a delivery out of the queue: its output was accepted, so no work is owed. */
        dropWebhookAdmission(record) {
            return this.serializeSubscriptionWrite(record.subscriptionRef, async () => {
                await this.subscriptionAdmissionsTable?.delete(admissionKey(record.subscriptionRef, record.admissionRef));
            });
        }
        /**
         * The ingress seam: a delivery whose automatic retries are spent becomes a
         * record an owner can read and replay. `deliveryRef` is the ingress's own
         * stable id, so a repeated admission of the same delivery replaces its attempt
         * count and error instead of adding a second row — and counts nothing, because
         * the delivery already counted once when its retries ran out.
         */
        async recordFailedDelivery(subscription, input) {
            await this.serializeSubscriptionWrite(subscription.subscriptionRef, async () => {
                const fresh = await this.recordFailedDeliveryLocked(subscription, input);
                const current = this.writableSubscription(subscription.subscriptionRef);
                if (fresh && current?.revision === input.receivedRevision)
                    await this.countDeliveryFailure(current);
                await this.pruneDeliveries(subscription.subscriptionRef, Date.now());
            });
        }
        async recordFailedDeliveryLocked(subscription, input) {
            const table = this.subscriptionDeliveriesTable;
            if (table === undefined)
                return false;
            // Nothing admits this write but its caller, so the terminal barrier is read
            // here: a delivery that arrives for a deleted subscription — or one whose
            // Project was archived — must not recreate the rows the deletion dropped.
            const live = this.writableSubscription(subscription.subscriptionRef);
            if (live === undefined) {
                this.ctx.logger.warn(`agent-team: a spent delivery for '${subscription.subscriptionRef}' arrived after the subscription stopped being live; it was dropped`);
                return false;
            }
            const key = deliveryKey(live.subscriptionRef, input.deliveryRef);
            const earlier = this.deliveryRecordForSettlement(table.get(key), input.admissionRef);
            await table.put(key, deliveryRecordOf(live, input, earlier));
            return earlier === undefined;
        }
        /**
         * Count the failure a spent delivery stands for, and pause the subscription at
         * the threshold. Its caller holds the subscription's write lock, so the count
         * it reads is the one the previous delivery committed.
         */
        async countDeliveryFailure(subscription) {
            const settled = await this.updateCheckpointLocked(subscription.subscriptionRef, checkpoint => Object.freeze({
                ...checkpoint, consecutiveFailures: checkpoint.consecutiveFailures + 1
            }));
            if (settled === undefined)
                return;
            if (settled.consecutiveFailures >= SUBSCRIPTION_FAILURES_BEFORE_PAUSE)
                await this.commitFailurePause(subscription);
        }
        /** Drop what expired, then what no longer fits: the newest ten deliveries are the ones kept. */
        async pruneDeliveries(subscriptionRef, now) {
            const table = this.subscriptionDeliveriesTable;
            if (table === undefined)
                return;
            const records = this.deliveryRecordsOf(subscriptionRef);
            const expired = records.filter(record => Date.parse(record.expiresAt) <= now);
            const evicted = evictedDeliveries(records.filter(record => !expired.includes(record)), SUBSCRIPTION_DELIVERY_LIMIT);
            for (const record of [...expired, ...evicted])
                await table.delete(deliveryKey(record.subscriptionRef, record.deliveryRef));
            // A replay answer names a delivery and explains it; once the delivery is
            // gone the answer has nothing left to mean, so it goes with the row.
            const replays = this.subscriptionReplaysTable;
            if (replays === undefined)
                return;
            const alive = new Set(this.deliveryRecordsOf(subscriptionRef).map(record => record.deliveryRef));
            for (const key of replayKeysOf(replays.keys(), subscriptionRef)) {
                const record = replays.get(key);
                if (record !== undefined && alive.has(record.deliveryRef) && Date.parse(record.expiresAt) > now)
                    continue;
                await replays.delete(key);
            }
        }
        /** One delivery of one subscription, or `undefined` once its retention ran out. */
        deliveryRecordOf(subscriptionRef, deliveryRef) {
            const record = this.subscriptionDeliveriesTable?.get(deliveryKey(subscriptionRef, deliveryRef));
            return record === undefined || Date.parse(record.expiresAt) <= Date.now() ? undefined : record;
        }
        /**
         * The deliveries whose replay already delivered, named by whichever record
         * survived it: the tombstone on the delivery, the answer the request wrote, or
         * — when both private writes were lost — the accept the ledger holds under
         * that request id. One reading, because the failure list and the "already
         * replayed" refusal must never disagree about the same delivery.
         *
         * An output the ledger accepted is durable whatever the private copies say, so
         * a request that is only `running` still counts once its accept exists. A run
         * that printed nothing new leaves no accept; a request whose answer and
         * tombstone both went missing is then indistinguishable from one that never
         * delivered, and it stays a failure to replay under a new id.
         */
        replayedDeliveryRefs(subscriptionRef, records) {
            const replayed = new Set(records.filter(record => record.replay?.succeeded === true).map(record => record.deliveryRef));
            const table = this.subscriptionReplaysTable;
            if (table === undefined)
                return replayed;
            const now = Date.now();
            for (const key of replayKeysOf(table.keys(), subscriptionRef)) {
                const answer = table.get(key);
                if (answer === undefined || Date.parse(answer.expiresAt) <= now)
                    continue;
                // A row written before intents existed carries no state and is an answer.
                const delivered = answer.state === 'running'
                    ? this.acceptedRequestEvents(subscriptionRef, answer.requestId) !== undefined
                    : answer.succeeded === true;
                if (delivered)
                    replayed.add(answer.deliveryRef);
            }
            return replayed;
        }
        /**
         * The events one request id already accepted into the ledger, if it did. Every
         * accept commits under a request id the caller can name again — a replay's own
         * calls, and a webhook attempt's own id — so this is where a caller recovers the
         * answer when its private copy could not be written: the output is already
         * durable, and running the script a second time would publish what the ledger
         * already holds.
         */
        acceptedRequestEvents(subscriptionRef, requestId) {
            const operation = this.ledger?.committedOperation(requestId);
            if (operation?.kind !== 'team/subscription-events-accepted')
                return undefined;
            if (operation.data.subscriptionRef !== subscriptionRef)
                return undefined;
            return operation.data.events.length;
        }
        /** The answer one request already got, or `undefined` when it has asked for nothing yet. */
        replayRecordOf(subscriptionRef, requestId) {
            const record = this.subscriptionReplaysTable?.get(replayKey(subscriptionRef, requestId));
            return record === undefined || Date.parse(record.expiresAt) <= Date.now() ? undefined : record;
        }
        /**
         * The definition a replay or a queued delivery runs. `current` is the definition
         * as it stands now, because replaying is how an owner confirms a fix; `received`
         * is the version the payload arrived under, because an automatic retry must run
         * the bytes it was queued against, not a script that changed under it.
         */
        replaySource(subscription, record, version) {
            if (version === 'current')
                return subscription;
            return Object.freeze({ ...subscription, revision: record.receivedRevision, script: record.script, credentials: record.credentials });
        }
        /**
         * The record a real run may start from, or the error that says why it may not.
         * Deleted and archived are terminal barriers, and a paused subscription runs
         * nothing — a replay is a run, so it needs a resume first.
         */
        runTarget(subscriptionRef, projectRef) {
            const ledger = this.requireLedger();
            const subscription = ledger.subscription(subscriptionRef);
            if (subscription === undefined || subscription.projectRef !== projectRef) {
                throw new Error(`subscription '${subscriptionRef}' does not belong to Project '${projectRef}'`);
            }
            if (subscription.state === 'deleted')
                throw new Error(`subscription '${subscriptionRef}' is deleted (subscription_deleted)`);
            if (subscription.state === 'paused') {
                throw new Error(`subscription '${subscriptionRef}' is paused, so it cannot run this delivery (subscription_paused)`);
            }
            if (ledger.getProject(projectRef)?.state !== 'active') {
                throw new Error(`the Project of subscription '${subscriptionRef}' is archived (project_archived)`);
            }
            return subscription;
        }
        /** The answer a request already got, rebuilt from the private record so a retried call reads the same. */
        replayResultOf(answered) {
            const delivery = this.deliveryRecordOf(answered.subscriptionRef, answered.deliveryRef);
            if (delivery === undefined)
                throw new Error(`delivery '${answered.deliveryRef}' is unknown or has expired`);
            return Object.freeze({ kind: answered.succeeded === true ? 'replayed' : 'replay-failed', delivery: deliveryEntryOf(delivery),
                eventCount: answered.eventCount ?? 0, ...(answered.runRef === undefined ? {} : { runRef: answered.runRef }),
                ...(answered.reason === undefined ? {} : { reason: answered.reason }) });
        }
        /**
         * Run one failed delivery again, now. A replay publishes what the script
         * prints exactly like a timer run, so the same commit decides its success: one
         * that delivers ends the streak — including one that printed nothing new —
         * while a replay whose script fails counts nothing, because the retry loop
         * already gave up on this delivery and an owner asking again is not the
         * subscription failing.
         *
         * It is a run, so it is admitted like one — the same four slots, the same
         * per-subscription exclusion, the same convergence when the Host stops — and
         * the rest happens inside that admission, where a second call for the same
         * request id cannot start beside it.
         */
        async replaySubscriptionDelivery(actor, request) {
            this.requireAccepting();
            const ledger = this.requireLedger();
            // A replay runs a script against the Project's Workspace, so it is an owner
            // action like a trial, not something any reader may trigger.
            ledger.assertSubscriptionAuthority(actor, request.projectRef, request.workspaceId);
            const subscription = this.runTarget(request.subscriptionRef, request.projectRef);
            const version = request.version ?? 'current';
            const execute = () => this.replayLocked(subscription, request, version);
            const scheduler = this.subscriptionScheduler;
            return scheduler === undefined ? execute() : scheduler.runAdmitted(subscription, 'run', execute);
        }
        async replayLocked(subscription, request, version) {
            // Admission re-reads the ledger, but this reads it once more for the run
            // itself: the record to run against is the one that stands now, not the
            // snapshot the entry queued with.
            const live = this.runTarget(request.subscriptionRef, request.projectRef);
            const intent = this.replayRecordOf(live.subscriptionRef, request.requestId);
            if (intent !== undefined) {
                // One request id names one intent, and the record is written before the
                // script runs. Naming a different delivery or version under it is a
                // collision, not a second run — even when no answer survived to say so.
                if (intent.deliveryRef !== request.deliveryRef || intent.version !== version) {
                    throw new Error(`request '${request.requestId}' already replayed delivery '${intent.deliveryRef}' (${intent.version}); one request id cannot name a second replay (replay_request_conflict)`);
                }
                if (intent.state === 'settled')
                    return this.replayResultOf(intent);
                // The run may have started and never recorded its answer. An accept the
                // ledger holds under this request id is the answer that survived; without
                // one there is nothing to stand on, and running the script again would be
                // guessing at what the first attempt did.
                const accepted = this.acceptedRequestEvents(live.subscriptionRef, request.requestId);
                if (accepted === undefined) {
                    const delivery = this.deliveryRecordOf(live.subscriptionRef, intent.deliveryRef);
                    if (delivery === undefined)
                        throw new Error(`delivery '${intent.deliveryRef}' is unknown or has expired`);
                    return Object.freeze({ kind: 'replay-failed', delivery: deliveryEntryOf(delivery), eventCount: 0,
                        reason: 'an earlier attempt for this request started and never recorded its answer, so it was not run again; replay the delivery under a new request id' });
                }
                const delivery = this.deliveryRecordOf(live.subscriptionRef, intent.deliveryRef);
                if (delivery === undefined)
                    throw new Error(`delivery '${intent.deliveryRef}' is unknown or has expired`);
                // The output is in the ledger: settle the answer that was lost, then say
                // what the run did.
                await this.settleReplayIntent(delivery, Object.freeze({ ...intent, state: 'settled', succeeded: true,
                    eventCount: accepted, ...(intent.runRef === undefined ? {} : { runRef: intent.runRef }) }));
                return Object.freeze({ kind: 'replayed', delivery: deliveryEntryOf(delivery), eventCount: accepted,
                    ...(intent.runRef === undefined ? {} : { runRef: intent.runRef }) });
            }
            const record = this.deliveryRecordOf(live.subscriptionRef, request.deliveryRef);
            if (record === undefined)
                throw new Error(`delivery '${request.deliveryRef}' is unknown or has expired`);
            // A replay that delivered took the delivery off the failed list; a second,
            // different request must not run it again and publish the same output twice.
            // The tombstone is only one of the records that can say so: an answer or a
            // ledger accept under a request id that never got one counts the same, or a
            // lost tombstone would let the same delivery run once more.
            if (this.replayedDeliveryRefs(live.subscriptionRef, this.deliveryRecordsOf(live.subscriptionRef)).has(record.deliveryRef)) {
                throw new Error(`delivery '${request.deliveryRef}' was already replayed successfully (delivery_replayed)`);
            }
            // The intent goes down before the script does: from here a retry either
            // collides, reads the answer, or is told the attempt never finished. A call
            // that cannot record it does not run the script at all.
            await this.recordReplayIntent(live, record, request.requestId, version);
            const source = this.replaySource(live, record, version);
            const run = await this.runSubscriptionOnce(source, 'webhook', { stdin: record.body, delivery: { deliveryRef: record.deliveryRef, attempt: record.attempts }, requestId: request.requestId,
                ...(record.admissionRef === undefined ? {} : { scriptDeliveryId: record.admissionRef }) });
            if (run === undefined) {
                return Object.freeze({ kind: 'replay-failed', delivery: deliveryEntryOf(record), eventCount: 0,
                    reason: 'the replay finished after the subscription stopped being live, so nothing was delivered' });
            }
            const succeeded = run.outcome === 'accepted' || run.outcome === 'empty';
            const reason = run.report.ok
                ? run.outcome === 'backlog'
                    ? `the Project already holds ${SUBSCRIPTION_PENDING_MAX} unpublished events, so this output was refused`
                    : run.outcome === 'deferred'
                        ? `the Project has no room in its unpublished queue for this output yet (${SUBSCRIPTION_PENDING_MAX} at most), so it was not replayed`
                        : undefined
                : run.report.reason;
            const answer = Object.freeze({
                subscriptionRef: source.subscriptionRef, projectRef: source.projectRef, requestId: request.requestId,
                deliveryRef: record.deliveryRef, version, state: 'settled', runRef: run.runRef, eventCount: run.eventCount, succeeded,
                ...(reason === undefined ? {} : { reason }), expiresAt: record.expiresAt,
            });
            const kept = await this.settleReplayIntent(record, answer);
            // The deletion owns the rows; the ledger still owns what happened. An output
            // the ledger accepted before the deletion *was* delivered, and answering
            // otherwise would contradict the ledger's own record of it. A run that
            // printed nothing new has no such record to stand on, so a deletion that
            // landed first leaves it with nothing to claim.
            if (!kept && run.outcome !== 'accepted') {
                return Object.freeze({ kind: 'replay-failed', delivery: deliveryEntryOf(record), eventCount: 0,
                    reason: 'the replay finished after the subscription stopped being live, so nothing was delivered' });
            }
            return Object.freeze({ kind: succeeded ? 'replayed' : 'replay-failed', delivery: deliveryEntryOf(record), eventCount: run.eventCount,
                runRef: run.runRef, ...(reason === undefined ? {} : { reason }),
                ...(succeeded ? {} : { stdoutTail: failureTail(run.report.stdout), stderrTail: failureTail(run.report.stderr) }) });
        }
        /**
         * Record that this request is about to run — before it runs.
         *
         * It is the one write that makes a request id an intent rather than a hope:
         * once it lands, a retry cannot silently take a different delivery, cannot
         * read a competing version, and cannot mistake an unfinished attempt for a
         * fresh one. A call that cannot record it must not run the script, so this
         * rejects instead of logging, and the caller's retry starts from nothing.
         */
        recordReplayIntent(subscription, record, requestId, version) {
            return this.serializeSubscriptionWrite(subscription.subscriptionRef, async () => {
                if (this.writableSubscription(subscription.subscriptionRef) === undefined) {
                    throw new Error(`subscription '${subscription.subscriptionRef}' stopped being live, so this replay did not run (subscription_deleted)`);
                }
                const table = this.subscriptionReplaysTable;
                if (table === undefined)
                    throw new Error('the subscription store is not open, so this replay cannot be recorded and did not run');
                const intent = Object.freeze({
                    subscriptionRef: subscription.subscriptionRef, projectRef: subscription.projectRef, requestId,
                    deliveryRef: record.deliveryRef, version, state: 'running', expiresAt: record.expiresAt,
                });
                await table.put(replayKey(subscription.subscriptionRef, requestId), intent);
            });
        }
        /**
         * Settle one replay's answer — the request record that holds it and the
         * delivery's own tombstone — behind one barrier read, under the
         * subscription's write lock.
         *
         * The lock is what orders this segment against a deletion. The cleanup takes
         * the same lock, so a delete either runs first — and this finds nothing
         * writable, writes nothing, and reports that it did not — or runs after, and
         * drops every row this wrote. A barrier read once and then followed by awaits
         * is a barrier a delete lands behind: that is exactly how a deleted
         * subscription got its delivery row back.
         *
         * The answer is written first, because it is the authority a retry reads; the
         * tombstone is the second guard, so losing it costs one duplicate check that
         * the deduplication waterline covers anyway. A storage fault in either is
         * logged: by now the output is in the ledger, so a private copy that fails
         * cannot turn a delivered replay into an ungraspable answer.
         */
        settleReplayIntent(record, answer) {
            return this.serializeSubscriptionWrite(answer.subscriptionRef, async () => {
                if (this.writableSubscription(answer.subscriptionRef) === undefined)
                    return false;
                const write = async (label, task) => {
                    try {
                        await task();
                    }
                    catch (error) {
                        this.ctx.logger.warn(`agent-team: could not record the ${label} of a replay of '${answer.subscriptionRef}': ${failureDetail(error)}`);
                    }
                };
                await write('request answer', () => this.subscriptionReplaysTable === undefined ? Promise.resolve()
                    : this.subscriptionReplaysTable.put(replayKey(answer.subscriptionRef, answer.requestId), answer));
                const table = this.subscriptionDeliveriesTable;
                // Merge into the row as it stands: the ingress may have replaced the
                // attempt count and error while this replay ran, and those are newer.
                const current = table?.get(deliveryKey(record.subscriptionRef, record.deliveryRef)) ?? record;
                await write('delivery answer', () => table === undefined ? Promise.resolve() : table.put(deliveryKey(current.subscriptionRef, current.deliveryRef), Object.freeze({ ...current,
                    replay: Object.freeze({ requestId: answer.requestId, succeeded: answer.succeeded === true,
                        ...(answer.runRef === undefined ? {} : { runRef: answer.runRef }),
                        ...(answer.reason === undefined ? {} : { reason: answer.reason }) }) })));
                return true;
            });
        }
        /** An Agent owner replays one failed delivery; the request id makes a retried call a no-op. */
        replaySubscriptionDeliveryForAgent(agent, request) {
            return this.replaySubscriptionDelivery(this.memberCall(agent, request.workspaceId), request);
        }
        replaySubscriptionDeliveryForClient(request) {
            return this.replaySubscriptionDelivery(this.humanCall(request.workspaceId), request);
        }
        /**
         * Read the script a create or update names. A path is resolved against the
         * calling Agent's own working directory, the one its bash tool uses; a Human
         * page has no such directory and must paste the content.
         */
        async snapshotSubscriptionScript(source, agent) {
            const content = 'scriptContent' in source ? source.scriptContent : await this.readAgentScript(source.scriptPath, agent);
            const probe = await this.mountedShellProbe();
            if (probe.family === undefined) {
                // The refusal has to name why: the executor is usually mounted.
                throw new Error(`the Host's shell executor could not answer a probe, so a script cannot be snapshotted: ${probe.failure ?? 'no reason was recorded'}`);
            }
            const snapshot = snapshotScript(content, probe.family);
            if (!snapshot.ok)
                throw new Error(`this script cannot be stored: ${snapshot.reason}`);
            return snapshot.script;
        }
        async readAgentScript(scriptPath, agent) {
            if (agent === undefined)
                throw new Error('a script path needs an Agent working directory; paste the script content instead');
            const workingDirectory = agent.ctx.get('workingDirectory');
            const cwd = workingDirectory?.get(agent.session);
            if (cwd === undefined)
                throw new Error('this Session has no working directory, so a script path cannot be resolved');
            const resolved = isAbsolute(scriptPath) ? scriptPath : join(cwd, scriptPath);
            const bytes = await readFile(resolved).catch((error) => {
                throw new Error(`cannot read '${scriptPath}': ${error instanceof Error ? error.message : String(error)}`);
            });
            if (bytes.byteLength > SUBSCRIPTION_SCRIPT_MAX_BYTES) {
                throw new Error(`'${scriptPath}' is ${bytes.byteLength} bytes; the limit is ${SUBSCRIPTION_SCRIPT_MAX_BYTES}`);
            }
            return bytes.toString('utf8');
        }
        missingCredentialMessage(missing) {
            return `the Host has no configured credential for ${missing.map(ref => `'${ref}'`).join(', ')}`;
        }
        trialFailureOf(report) {
            return Object.freeze({ reason: report.reason ?? 'the trial run failed', stdoutTail: failureTail(report.stdout), stderrTail: failureTail(report.stderr) });
        }
        /**
         * A trial runs under the same execution path as a live run, so validation
         * cannot pass a script production would refuse — and through the same
         * admission, so five creates in parallel still run four scripts at most.
         *
         * `record` is false for a create draft's trial: there is no stored definition
         * for that run to describe, and its throwaway ref would leave a run record
         * nobody can ever read or retire. An edit draft does name a stored
         * subscription, so its trial is recorded like any other test run.
         */
        trialSubscriptionRun(subscription, record = true) {
            const execute = async () => {
                const startedAt = Date.now();
                const report = await this.executeSubscriptionRun(subscription, 'test');
                // A trial writes no checkpoint: it neither counts towards the failure
                // pause nor clears it, and passing never moves the success waterline. It
                // is recorded, because an owner asking "did my fix pass?" reads the same
                // history as the runs — and it counts no events, because it publishes none.
                if (record) {
                    await this.recordSubscriptionRun(runRecordOf({ subscription, trigger: 'test', startedAt, durationMs: Date.now() - startedAt,
                        category: report.ok ? 'verified' : failureCategory(report), eventCount: 0, report }));
                }
                return report;
            };
            const scheduler = this.subscriptionScheduler;
            return scheduler === undefined ? execute() : scheduler.runTrial(subscription, execute);
        }
        /** The subscription-shaped draft a create trial runs as: it is never stored. */
        draftSubscription(actor, definition) {
            const createdBy = actor.kind === 'host' ? AGENT_TEAM_HUMAN_MEMBER_ID : actor.memberId;
            return Object.freeze({
                subscriptionRef: `subscription:trial-${randomUUID()}`,
                projectRef: definition.projectRef, name: definition.name, triggers: definition.triggers, script: definition.script,
                credentials: definition.credentials, revision: 1, state: 'active',
                createdBy, notify: Object.freeze([...(definition.notify ?? [createdBy])].sort()),
                createdAt: new Date().toISOString(),
            });
        }
        /**
         * The triggers a create or edit asks for. A timer is named by its interval; an
         * address is not, so only an explicit `false` drops one a provider already posts to.
         */
        subscriptionTriggersOf(request, prior) {
            const webhook = request.webhook ?? prior?.webhook;
            return Object.freeze({
                ...(request.intervalMinutes === undefined ? {} : { interval: Object.freeze({ minutes: request.intervalMinutes }) }),
                ...(webhook === true ? { webhook: true } : {}),
            });
        }
        /**
         * The origin hook addresses hang from, or a refusal naming the setting to
         * write. Arming an address nobody can reach would answer the caller with a
         * URL that cannot work, so the write stops here instead.
         */
        webhookOrigin() {
            const origin = this.config.webhook.get().publicOrigin;
            const refusal = webhookOriginRefusal(origin);
            if (refusal !== undefined)
                throw new Error(refusal);
            return origin;
        }
        /** The one answer an arming write gives: the complete address, once, or nothing when it armed none. */
        armedAddress(origin, token) {
            return token === undefined ? {} : { webhookAddress: webhookAddress(origin, token) };
        }
        /** A retry's answer for a write that already committed: the subscription stands, and an address it armed once is not handed out again. */
        replayedSubscriptionWrite(result, addressArmed) {
            return Object.freeze({ kind: 'changed', subscription: result.subscription, activity: result.activity,
                ...(addressArmed && result.subscription.triggers.webhook === true ? { webhookAddressGone: true } : {}) });
        }
        async createSubscriptionAs(actor, request, agent) {
            this.requireAccepting();
            const ledger = this.requireLedger();
            ledger.assertSubscriptionAuthority(actor, request.projectRef, request.workspaceId);
            const requestIntent = Object.freeze({
                ...(request.intervalMinutes === undefined ? {} : { intervalMinutes: request.intervalMinutes }),
                ...(request.webhook === undefined ? {} : { webhook: request.webhook }),
                scriptSource: 'scriptPath' in request.script
                    ? Object.freeze({ kind: 'path', path: request.script.scriptPath })
                    : Object.freeze({ kind: 'content' }),
                baseline: request.baseline ?? 'current-output',
            });
            const replayed = ledger.subscriptionWriteReplay({ kind: 'create', requestId: request.requestId, workspaceId: request.workspaceId,
                projectRef: request.projectRef, actor, name: request.name, intervalMinutes: request.intervalMinutes, webhook: request.webhook,
                script: request.script, credentials: request.credentials, notify: request.notify, baseline: requestIntent.baseline });
            if (replayed !== undefined)
                return this.replayedSubscriptionWrite(replayed.value, replayed.addressArmed);
            const script = await this.snapshotSubscriptionScript(request.script, agent);
            const triggers = this.subscriptionTriggersOf(request);
            const credentials = Object.freeze([...(request.credentials ?? [])]);
            const name = request.name.trim();
            const problem = subscriptionDefinitionProblem({ name, triggers, script, credentials });
            if (problem !== undefined)
                throw new Error(`this subscription cannot be created: ${problem}`);
            const notifyProblem = ledger.subscriptionNotifyProblem(request.projectRef, request.notify);
            if (notifyProblem !== undefined)
                throw new Error(`this subscription cannot be created: ${notifyProblem}`);
            const missing = await missingCredentials(this.credentialProvider(), credentials);
            if (missing.length > 0)
                throw new Error(this.missingCredentialMessage(missing));
            const origin = triggers.webhook === true ? this.webhookOrigin() : undefined;
            const trial = await this.trialSubscriptionRun(this.draftSubscription(actor, { projectRef: request.projectRef, name, triggers, script, credentials, notify: request.notify }));
            if (!trial.ok)
                return Object.freeze({ kind: 'trial-failed', failure: this.trialFailureOf(trial) });
            const baselineIds = (request.baseline ?? 'current-output') === 'current-output' ? baselineIdsOf(trial.events) : [];
            const result = await ledger.createSubscription({
                requestId: request.requestId, workspaceId: request.workspaceId, projectRef: request.projectRef, name, triggers, script,
                credentials, notify: request.notify, baselineIds, actor,
            }, requestIntent);
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return Object.freeze({ kind: 'changed', subscription: result.value.subscription, activity: result.value.activity,
                ...(origin === undefined ? {} : this.armedAddress(origin, result.value.webhookToken)) });
        }
        async createSubscriptionForAgent(agent, request) {
            return this.createSubscriptionAs(this.memberCall(agent, request.workspaceId), request, agent);
        }
        /** Human creation from a page: the content is pasted, because a Human has no Session working directory. */
        async createSubscription(request) {
            return this.createSubscriptionAs(this.humanCall(request.workspaceId), request, undefined);
        }
        async updateSubscriptionAs(actor, request, agent) {
            this.requireAccepting();
            const ledger = this.requireLedger();
            ledger.assertSubscriptionAuthority(actor, request.projectRef, request.workspaceId);
            const requestIntent = Object.freeze({
                ...(request.intervalMinutes === undefined ? {} : { intervalMinutes: request.intervalMinutes }),
                ...(request.webhook === undefined ? {} : { webhook: request.webhook }),
                scriptSource: 'scriptPath' in request.script
                    ? Object.freeze({ kind: 'path', path: request.script.scriptPath })
                    : Object.freeze({ kind: 'content' }),
            });
            const replayed = ledger.subscriptionWriteReplay({ kind: 'update', requestId: request.requestId, workspaceId: request.workspaceId,
                projectRef: request.projectRef, subscriptionRef: request.subscriptionRef, expectedRevision: request.expectedRevision,
                actor, name: request.name, intervalMinutes: request.intervalMinutes, webhook: request.webhook,
                script: request.script, credentials: request.credentials, notify: request.notify });
            if (replayed !== undefined)
                return this.replayedSubscriptionWrite(replayed.value, replayed.addressArmed);
            const prior = ledger.subscription(request.subscriptionRef);
            if (prior === undefined || prior.projectRef !== request.projectRef) {
                throw new Error(`subscription '${request.subscriptionRef}' does not belong to Project '${request.projectRef}'`);
            }
            if (prior.state === 'deleted')
                throw new Error(`subscription '${request.subscriptionRef}' is deleted (subscription_deleted)`);
            const script = await this.snapshotSubscriptionScript(request.script, agent);
            const triggers = this.subscriptionTriggersOf(request, prior.triggers);
            const credentials = Object.freeze([...(request.credentials ?? [])]);
            const name = request.name.trim();
            const problem = subscriptionDefinitionProblem({ name, triggers, script, credentials });
            if (problem !== undefined)
                throw new Error(`this subscription cannot be updated: ${problem}`);
            const notifyProblem = ledger.subscriptionNotifyProblem(request.projectRef, request.notify);
            if (notifyProblem !== undefined)
                throw new Error(`this subscription cannot be updated: ${notifyProblem}`);
            const missing = await missingCredentials(this.credentialProvider(), credentials);
            if (missing.length > 0)
                throw new Error(this.missingCredentialMessage(missing));
            // An edit that keeps the address needs no origin check here: the address it
            // already has stays valid, and only arming a new one depends on the setting.
            const origin = triggers.webhook === true && prior.webhook === undefined ? this.webhookOrigin() : undefined;
            // The trial keeps the existing waterline: an id that appeared between two
            // polls must not be swallowed by an edit.
            const trial = await this.trialSubscriptionRun(Object.freeze({ ...prior, name, triggers, script, credentials }));
            if (!trial.ok)
                return Object.freeze({ kind: 'trial-failed', failure: this.trialFailureOf(trial) });
            const result = await ledger.updateSubscription({
                requestId: request.requestId, workspaceId: request.workspaceId, projectRef: request.projectRef, subscriptionRef: request.subscriptionRef,
                expectedRevision: request.expectedRevision, name, triggers, script, credentials, notify: request.notify, actor,
            }, requestIntent);
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return Object.freeze({ kind: 'changed', subscription: result.value.subscription, activity: result.value.activity,
                ...(origin === undefined ? {} : this.armedAddress(origin, result.value.webhookToken)) });
        }
        async updateSubscriptionForAgent(agent, request) {
            return this.updateSubscriptionAs(this.memberCall(agent, request.workspaceId), request, agent);
        }
        async updateSubscription(request) {
            return this.updateSubscriptionAs(this.humanCall(request.workspaceId), request, undefined);
        }
        async testSubscription(request, actor) {
            this.requireAccepting();
            const ledger = this.requireLedger();
            ledger.assertSubscriptionAuthority(actor, request.projectRef, request.workspaceId);
            const subscription = ledger.subscription(request.subscriptionRef);
            if (subscription === undefined || subscription.projectRef !== request.projectRef) {
                throw new Error(`subscription '${request.subscriptionRef}' does not belong to Project '${request.projectRef}'`);
            }
            if (subscription.state === 'deleted')
                throw new Error(`subscription '${request.subscriptionRef}' is deleted (subscription_deleted)`);
            const trial = await this.trialSubscriptionRun(subscription);
            return trial.ok
                ? Object.freeze({ kind: 'tested', events: trial.events, stdoutTail: failureTail(trial.stdout), stderrTail: failureTail(trial.stderr) })
                : Object.freeze({ kind: 'trial-failed', failure: this.trialFailureOf(trial) });
        }
        async testSubscriptionForAgent(agent, request) {
            const actor = this.memberCall(agent, request.workspaceId);
            return this.testSubscription(request, actor);
        }
        /** A trial run never changes durable state, so the Human path can offer it before any edit. */
        async testSubscriptionForClient(request) {
            return this.testSubscription(request, this.humanCall(request.workspaceId));
        }
        /**
         * A page's trial of the definition its form holds. No Team fact is written:
         * the script runs through the same validation and executor as a save, and the
         * answer names the snapshot and revision the Client may bind Save to. An edit
         * draft does leave one private test run, like any other trial of a stored
         * subscription; a create draft leaves nothing, because its throwaway ref would
         * belong to no stored definition. Save still re-runs the trial in create/
         * update, so a cached pass is never trusted.
         */
        async testSubscriptionDraft(request) {
            this.requireAccepting();
            const actor = this.humanCall(request.workspaceId);
            const ledger = this.requireLedger();
            ledger.assertSubscriptionAuthority(actor, request.projectRef, request.workspaceId);
            const prior = request.subscriptionRef === undefined ? undefined : ledger.subscription(request.subscriptionRef);
            if (request.subscriptionRef !== undefined) {
                if (prior === undefined || prior.projectRef !== request.projectRef) {
                    throw new Error(`subscription '${request.subscriptionRef}' does not belong to Project '${request.projectRef}'`);
                }
                if (prior.state === 'deleted')
                    throw new Error(`subscription '${request.subscriptionRef}' is deleted (subscription_deleted)`);
                if (request.expectedRevision === undefined) {
                    throw new Error(`a draft trial of '${prior.subscriptionRef}' needs the revision the form started from`);
                }
                if (request.expectedRevision !== prior.revision) {
                    throw new Error(`subscription '${prior.subscriptionRef}' is at revision ${prior.revision}, not ${request.expectedRevision} (stale_revision)`);
                }
            }
            else if (request.expectedRevision !== undefined) {
                throw new Error('a draft trial without a subscription cannot name a revision');
            }
            const script = await this.snapshotSubscriptionScript({ scriptContent: request.scriptContent }, undefined);
            const triggers = this.subscriptionTriggersOf(request);
            // Arming is refused before the script runs when the Host has no address to
            // arm, so the form hears the same reason a save would give it — once.
            if (triggers.webhook === true)
                this.webhookOrigin();
            const credentials = Object.freeze([...(request.credentials ?? [])]);
            const name = request.name.trim();
            const problem = subscriptionDefinitionProblem({ name, triggers, script, credentials });
            if (problem !== undefined)
                throw new Error(`this subscription cannot be saved: ${problem}`);
            const missing = await missingCredentials(this.credentialProvider(), credentials);
            if (missing.length > 0)
                throw new Error(this.missingCredentialMessage(missing));
            // An edit keeps the stored definition as the base, so the trial sees the
            // baseline and revision the save would keep; a create draft has neither.
            const draft = prior === undefined
                ? this.draftSubscription(actor, { projectRef: request.projectRef, name, triggers, script, credentials })
                : Object.freeze({ ...prior, name, triggers, script, credentials });
            const trial = await this.trialSubscriptionRun(draft, prior !== undefined);
            const outcome = trial.ok
                ? Object.freeze({ kind: 'tested', events: trial.events, stdoutTail: failureTail(trial.stdout), stderrTail: failureTail(trial.stderr) })
                : Object.freeze({ kind: 'trial-failed', failure: this.trialFailureOf(trial) });
            return Object.freeze({ ...outcome, scriptHash: script.sha256, revision: draft.revision });
        }
        async pauseSubscriptionForAgent(agent, request) {
            return this.changeSubscriptionStateAs(this.memberCall(agent, request.workspaceId), request, 'paused');
        }
        async pauseSubscription(request) {
            return this.changeSubscriptionStateAs(this.humanCall(request.workspaceId), request, 'paused');
        }
        async resumeSubscriptionForAgent(agent, request) {
            return this.resumeSubscriptionAs(this.memberCall(agent, request.workspaceId), request);
        }
        async resumeSubscription(request) {
            return this.resumeSubscriptionAs(this.humanCall(request.workspaceId), request);
        }
        async resetSubscriptionWebhookForAgent(agent, request) {
            return this.resetSubscriptionWebhookAs(this.memberCall(agent, request.workspaceId), request);
        }
        async resetSubscriptionWebhook(request) {
            return this.resetSubscriptionWebhookAs(this.humanCall(request.workspaceId), request);
        }
        /**
         * Replace the address an outside service posts to. The revision does not
         * move: deliveries already accepted keep the version they arrived under, and
         * only the old address stops resolving.
         *
         * It takes the write lock the entry re-reads the token under, so a request carrying
         * the old address is queued before the reset or answered 404, never after it.
         */
        async resetSubscriptionWebhookAs(actor, request) {
            this.requireAccepting();
            const ledger = this.requireLedger();
            ledger.assertSubscriptionAuthority(actor, request.projectRef, request.workspaceId);
            // The retry of a reset answers from the ledger: the new address armed once
            // is not re-fetched, and the result says so instead of staying silent.
            const replayed = ledger.subscriptionWriteReplay({ ...request, actor });
            if (replayed !== undefined)
                return this.replayedSubscriptionWrite(replayed.value, replayed.addressArmed);
            const origin = this.webhookOrigin();
            const result = await this.serializeSubscriptionWrite(request.subscriptionRef, () => ledger.resetSubscriptionWebhook({ ...request, actor }));
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            return Object.freeze({ kind: 'changed', subscription: result.value.subscription, activity: result.value.activity,
                ...this.armedAddress(origin, result.value.webhookToken) });
        }
        async deleteSubscriptionForAgent(agent, request) {
            return this.changeSubscriptionStateAs(this.memberCall(agent, request.workspaceId), request, 'deleted');
        }
        async deleteSubscription(request) {
            return this.changeSubscriptionStateAs(this.humanCall(request.workspaceId), request, 'deleted');
        }
        async changeSubscriptionStateAs(actor, request, state) {
            this.requireAccepting();
            const ledger = this.requireLedger();
            ledger.assertSubscriptionAuthority(actor, request.projectRef, request.workspaceId);
            const result = state === 'paused'
                ? await ledger.pauseSubscription({ ...request, actor, reason: 'manual' })
                : await ledger.deleteSubscription({ ...request, actor });
            if (result.committed)
                this.emitCommitted(result.value.receipt);
            // Awaited: the caller that is told the subscription is deleted must not see
            // its records come back a moment later. A row that will not delete is logged
            // here and converged at the next boot.
            if (state === 'deleted')
                await this.forgetSubscriptionPrivateState(request.subscriptionRef);
            return Object.freeze({ kind: 'changed', subscription: result.value.subscription, activity: result.value.activity });
        }
        /** Resume is a trial run first: a subscription that cannot run must not come back to life. */
        async resumeSubscriptionAs(actor, request) {
            this.requireAccepting();
            const ledger = this.requireLedger();
            ledger.assertSubscriptionAuthority(actor, request.projectRef, request.workspaceId);
            const subscription = ledger.subscription(request.subscriptionRef);
            if (subscription === undefined || subscription.projectRef !== request.projectRef) {
                throw new Error(`subscription '${request.subscriptionRef}' does not belong to Project '${request.projectRef}'`);
            }
            if (subscription.state === 'deleted')
                throw new Error(`subscription '${request.subscriptionRef}' is deleted (subscription_deleted)`);
            // The retry of a resume answers from the ledger, so the script runs once.
            const replayed = ledger.subscriptionWriteReplay({ ...request, actor });
            if (replayed !== undefined) {
                await this.serializeSubscriptionWrite(request.subscriptionRef, () => this.repairWebhookCheckpointLocked(request.subscriptionRef));
                return this.replayedSubscriptionWrite(replayed.value, replayed.addressArmed);
            }
            const trial = await this.trialSubscriptionRun(subscription);
            if (!trial.ok)
                return Object.freeze({ kind: 'trial-failed', failure: this.trialFailureOf(trial) });
            return this.serializeSubscriptionWrite(request.subscriptionRef, async () => {
                // Capture the previous ledger resume before the first new-format resume
                // can commit; absence alone cannot distinguish a legacy checkpoint.
                if (this.checkpointFor(request.subscriptionRef).failureResumeSequence === undefined) {
                    await this.updateCheckpointLocked(request.subscriptionRef, checkpoint => Object.freeze({ ...checkpoint,
                        failureResumeSequence: ledger.subscriptionResumeSequence(request.subscriptionRef) }));
                }
                const result = await ledger.resumeSubscription({ ...request, actor });
                if (result.committed)
                    this.emitCommitted(result.value.receipt);
                await this.repairWebhookCheckpointLocked(request.subscriptionRef);
                return Object.freeze({ kind: 'changed', subscription: result.value.subscription, activity: result.value.activity });
            });
        }
        async baselineSubscriptionForAgent(agent, request) {
            return this.baselineSubscriptionAs(this.memberCall(agent, request.workspaceId), request);
        }
        async baselineSubscription(request) {
            return this.baselineSubscriptionAs(this.humanCall(request.workspaceId), request);
        }
        async baselineSubscriptionAs(actor, request) {
            this.requireAccepting();
            const ledger = this.requireLedger();
            ledger.assertSubscriptionAuthority(actor, request.projectRef, request.workspaceId);
            const result = await ledger.baselineSubscription({ requestId: request.requestId, workspaceId: request.workspaceId,
                projectRef: request.projectRef, subscriptionRef: request.subscriptionRef, ids: request.ids, actor });
            if (result.committed)
                this.emitCommitted(result.value);
            const subscription = ledger.subscription(request.subscriptionRef);
            if (subscription === undefined)
                throw new Error(`subscription '${request.subscriptionRef}' is gone`);
            return Object.freeze({ kind: 'baselined', subscription, added: Object.freeze([...request.ids]) });
        }
        /**
         * Record that these Member reminders reached a turn, one operation per
         * reminder. The write is the Host's own, so a failure degrades to a retry
         * rather than a log line: the occurrence is still owed, and a coverage that
         * still names it would keep the same durable facts from ever being delivered
         * again.
         */
        consumeMemberReminders(carried) {
            if (!this.accepting || this.ledger === undefined || carried.reminders.length === 0)
                return;
            void this.requireLedger().consumeMemberReminders(carried.memberId, carried.reminders).then(receipts => {
                this.memberReminderConsumeFailures.delete(carried.memberId);
                for (const receipt of receipts)
                    this.emitCommitted(receipt);
            }).catch(error => {
                this.retryMemberReminderConsumption(carried, error);
            });
        }
        /**
         * A consumption write that failed leaves the occurrence unread, so the coverage
         * the notice earned for it falls with it — otherwise the next redelivery sees
         * the same durable facts as already answered and stays silent. The retry is
         * active: the live Session is rederived now instead of waiting for an unrelated
         * Team fact or a restart. It is bounded, because every retry spends one of the
         * Member's turns and a persistent outage must not spend them forever; standing
         * down still leaves the occurrence owed and the coverage dropped.
         */
        retryMemberReminderConsumption(carried, error) {
            const failures = (this.memberReminderConsumeFailures.get(carried.memberId) ?? 0) + 1;
            this.memberReminderConsumeFailures.set(carried.memberId, failures);
            this.dropInboxCoverage(carried.memberId);
            const scope = this.memberScope(carried.memberId);
            const detail = failureDetail(error);
            if (failures > MAX_MEMBER_REMINDER_CONSUME_RETRIES) {
                this.ctx.logger.warn(`agent-team: could not record Member reminder consumption for ${scope} after ${failures} consecutive failure(s): ${detail}; the occurrence stays unread and is delivered by the next Team fact touching this Member`);
                return;
            }
            this.ctx.logger.warn(`agent-team: could not record Member reminder consumption for ${scope} on attempt ${failures} of at most ${MAX_MEMBER_REMINDER_CONSUME_RETRIES}: ${detail}; the coverage is dropped and the notice is rederived`);
            // A Member without a live Session, or one mid-swap, is rederived by its own
            // activation; the dropped coverage is what keeps the occurrence owed until then.
            const handle = this.accepting ? this.handles.get(carried.memberId) : undefined;
            if (handle === undefined) {
                this.ctx.logger.debug(`agent-team: Member reminder consumption retry for ${scope} has no live session to rederive: the occurrence stays unread until the next Team fact or activation`);
                return;
            }
            this.notifyMember(handle.agent, { kind: 'consumption-retry' });
        }
        /**
         * Member reminders are time promises in the ledger, so the Host only decides
         * when to look: on any commit that could have changed them, on boot, and on a
         * timer armed to the next occurrence. Evaluation never waits for a turn.
         */
        scheduleMemberReminderEvaluation() {
            if (!this.accepting || this.ledger === undefined)
                return;
            this.reminderEvaluationRequested = true;
            void this.evaluateMemberReminders();
        }
        evaluateMemberReminders() {
            this.reminderEvaluationTail = this.reminderEvaluationTail.then(async () => {
                if (this.ledger === undefined)
                    return;
                do {
                    this.reminderEvaluationRequested = false;
                    const nowMs = Date.now();
                    for (const candidate of this.requireLedger().planMemberReminders(nowMs)) {
                        const receipt = await this.requireLedger().raiseMemberReminder(candidate);
                        // A baseline that moved while the write waited raises nothing; the
                        // rearmed timer brings the same occurrence back.
                        if (receipt !== undefined)
                            this.emitCommitted(receipt);
                    }
                    this.armMemberReminderTimer(nowMs);
                } while (this.reminderEvaluationRequested);
            }).catch(error => {
                this.ctx.logger.warn(`agent-team: Member reminder evaluation failed: ${failureDetail(error)}`);
            });
            return this.reminderEvaluationTail;
        }
        /** Arm one timer for the soonest pending occurrence; nothing pending disarms it. */
        armMemberReminderTimer(nowMs) {
            if (this.memberReminderTimer !== undefined)
                clearTimeout(this.memberReminderTimer);
            this.memberReminderTimer = undefined;
            if (!this.accepting || this.ledger === undefined)
                return;
            const at = this.requireLedger().nextMemberReminderWakeAt(nowMs);
            if (at === undefined)
                return;
            const delay = Math.min(Math.max(0, at - Date.now()), MEMBER_REMINDER_TIMER_MAX_DELAY_MS);
            this.memberReminderTimer = setTimeout(() => {
                this.memberReminderTimer = undefined;
                this.scheduleMemberReminderEvaluation();
            }, delay);
            this.memberReminderTimer.unref?.();
        }
        requireLedger() {
            if (this.ledger === undefined || this.domain === undefined)
                throw new Error('agent-team service is not initialized');
            return this.ledger;
        }
        requireAccepting() {
            if (!this.accepting)
                throw new Error('agent-team service is shutting down');
        }
        emitCommitted(receipt) {
            // Nothing after the ledger append may turn a committed operation into a failed Remote call; effects that run third-party code go through `afterCommit`.
            // Order: listeners, Client invalidation, participation notice, wakes.
            this.afterCommit('commit listener dispatch', () => this.ctx.emit('agent-team/committed', { receipt }));
            const operation = this.ledger?.getOperation(receipt.operationId);
            if (operation === undefined) {
                this.afterCommit('change invalidation', () => this.emitChanged());
                return;
            }
            const ledger = this.requireLedger();
            this.afterCommit('change invalidation', () => this.emitChanged(ledger.changeScopesOf(operation)));
            if (operation.kind !== 'team/reminder-raised')
                this.scheduleTaskReminderEvaluation();
            // Member lifecycle decides which reminders still time (suspended keeps
            // timing, archived and inactive cancel), and the reminder kinds move them.
            if (operation.kind.startsWith('team/member-'))
                this.scheduleMemberReminderEvaluation();
            if (operation.kind === 'team/member-workspace-joined' || operation.kind === 'team/member-workspace-left') {
                this.afterCommit('participation notice', () => {
                    const agent = this.handles.get(operation.data.memberId)?.agent;
                    if (agent === undefined)
                        return;
                    const path = this.ctx.workspaceRegistry.get(operation.data.workspaceId)?.path;
                    const text = `Team participation changed: you have ${operation.kind === 'team/member-workspace-joined' ? 'joined' : 'left'} Workspace ${operation.data.workspaceId}${path === undefined ? ' (path unavailable)' : ` (${JSON.stringify(path)})`}.\nCurrent Workspace ids: ${ledger.workspacesOf(operation.data.memberId).join(', ')}. This replaces earlier participation information. Your Session and cwd have not moved.`;
                    const notice = createUserMessage({ content: [{ type: 'text', text }],
                        source: { kind: AGENT_TEAM_PLUGIN_ID, form: 'notice', summary: 'Team Workspace participation changed' } });
                    // Delivered from durable facts; a failed wake cannot roll back the
                    // committed participation — the next notice rederives it. A queued
                    // user message keeps its precedence: the notice must not take the step
                    // the Member's own input was waiting for.
                    if (agent.inbox.nextTurn.some(message => message.source.kind === 'user'))
                        agent.followup(notice);
                    else
                        agent.steer(notice);
                });
            }
            const affectedMembers = ledger.affectedMembersOf(operation);
            const deferNotifications = affectedMembers.length >= NOTIFICATION_QUEUE_THRESHOLD;
            for (const memberId of affectedMembers) {
                const handle = this.handles.get(memberId);
                if (handle !== undefined) {
                    this.afterCommit(`notification for '${this.memberLabel(memberId)}'`, () => this.notifyMember(handle.agent, { kind: 'commit', receipt, operationKind: operation.kind }), deferNotifications, memberId);
                    continue;
                }
                this.afterCommit(`transition repair for '${this.memberLabel(memberId)}'`, () => {
                    void this.finishRecordedTransitionThenNotify(memberId, { kind: 'commit', receipt, operationKind: operation.kind });
                });
            }
        }
        async finishRecordedTransitionThenNotify(memberId, cause) {
            if (!this.accepting || this.contextManagement.isTransitioning(memberId))
                return;
            let finished = false;
            try {
                finished = await this.enqueueLifecycle(memberId, async () => {
                    const member = this.requireLedger().getMember(memberId);
                    if (member === undefined || member.state !== 'enabled' || this.handles.has(memberId))
                        return false;
                    // The swap that owns this Member is still running: its own activation
                    // is the effect this would duplicate.
                    if (this.contextManagement.isTransitioning(memberId))
                        return false;
                    if (this.requireLedger().lastTransitionForMember(memberId) === undefined)
                        return false;
                    await this.finishMemberTransition(memberId);
                    return true;
                });
            }
            catch (error) {
                if (!this.accepting)
                    return;
                this.ctx.logger.warn(`agent-team: could not finish the recorded Session transition for ${this.memberScope(memberId)}: ${failureDetail(error)}`);
                return;
            }
            if (!finished)
                return;
            const live = this.handles.get(memberId);
            if (live === undefined) {
                this.ctx.logger.warn(`agent-team: ${this.memberScope(memberId)} is still without a live session after finishing its recorded Session transition: ${this.memberFailures.get(memberId)?.activation?.detail ?? 'activation did not report a reason'}; it stays unavailable until Member recovery or the next startup retries the activation`);
                return;
            }
            this.notifyMember(live.agent, cause);
        }
        /**
         * Run one effect that follows the ledger append. The operation is durable by now, so a delivery or listener failure degrades to a log line;
         * a failed Inbox wake clears its own signature so the next commit retries the same durable facts without a second operation.
         * Synchronous invariant divergence is re-raised on the caller's frame; deferred notification effects report it at error level because the commit has already returned.
         */
        afterCommit(label, effect, deferNotification = false, notificationMemberId) {
            const pendingNotification = notificationMemberId === undefined ? undefined : this.notificationEffectTails.get(notificationMemberId);
            if (notificationMemberId !== undefined && (deferNotification || pendingNotification !== undefined)) {
                const previous = pendingNotification ?? Promise.resolve();
                const queued = previous.then(() => new Promise(resolve => {
                    setImmediate(() => {
                        try {
                            // Durable facts are rederived during the next activation if shutdown wins the race.
                            if (this.accepting)
                                effect();
                        }
                        catch (error) {
                            // A deferred effect has no caller frame to re-raise on, so an
                            // invariant divergence is reported at the level the synchronous
                            // path reserves for it instead of folding into the retry warn.
                            if (error instanceof AgentTeamInvariantError)
                                this.ctx.logger.error(`agent-team: post-commit ${label} violated an invariant: ${error.message}`);
                            else
                                this.ctx.logger.warn(`agent-team: post-commit ${label} failed: ${error instanceof Error ? error.message : String(error)}`);
                        }
                        finally {
                            resolve();
                        }
                    });
                }));
                this.notificationEffectTails.set(notificationMemberId, queued);
                void queued.then(() => {
                    if (this.notificationEffectTails.get(notificationMemberId) !== queued)
                        return;
                    this.notificationEffectTails.delete(notificationMemberId);
                });
                return;
            }
            try {
                effect();
            }
            catch (error) {
                if (error instanceof AgentTeamInvariantError)
                    throw error;
                this.ctx.logger.warn(`agent-team: post-commit ${label} failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        /**
         * Presence-only invalidation: Agent running/idle/activation/failure changes
         * alter no durable projection, so only members/presence subscribers wake —
         * the workspace catalog and the scope-less Inbox subscriptions stay parked.
         */
        emitPresenceChanged(workspaceId) {
            this.emitChanged([{ kind: 'presence', workspaceId }]);
        }
        /** Presence invalidation in every Workspace the Member participates in — each panel listing it must refresh. */
        emitMemberPresenceChanged(member) {
            for (const workspaceId of this.requireLedger().workspacesOf(member.memberId))
                this.emitPresenceChanged(workspaceId);
        }
        /**
         * The correlation group every Member-scoped diagnostic line carries: ledger Member id and owning Session, with the renameable handle as context.
         * The Session resolves from the live generation first, then the ledger binding.
         */
        memberScope(memberId, sessionId) {
            const handle = this.ledger?.getMember(memberId)?.handle;
            const session = sessionId ?? this.handles.get(memberId)?.agent.session.id ?? this.ledger?.getMember(memberId)?.sessionId;
            return `member '${handle ?? memberId}' memberId '${memberId}'${session === undefined ? '' : ` session '${session}'`}`;
        }
        notificationCauseText(cause) {
            if (cause.kind === 'commit') {
                return `requestId '${cause.receipt.requestId}' operationId '${cause.receipt.operationId}' operation '${cause.operationKind}' sequence ${cause.receipt.sequence}`;
            }
            if (cause.kind === 'transition') {
                return `session transition requestId '${cause.requestId}' previousSession '${cause.previousSessionId}'`;
            }
            if (cause.kind === 'activation') {
                return cause.previousSessionId === undefined
                    ? 'Member activation'
                    : `Member activation previousSession '${cause.previousSessionId}'`;
            }
            if (cause.kind === 'consumption-retry')
                return 'Member reminder consumption write failed';
            return 'running transition';
        }
        /**
         * The delivery plan for one redelivery. `deliveredReminders` narrows the
         * coverage to the occurrences a notice actually rendered: the plan decides
         * that an attempt is owed, the notice earns what it covers.
         */
        inboxDeliveryPlan(input) {
            return planInboxDelivery({
                threads: input.notifications,
                main: input.main.map(({ project, entries }) => ({ projectRef: project.projectRef, entries })),
                reminders: (input.memberReminders ?? []).map(entry => ({ reminderRef: entry.reminder.reminderRef, sequence: entry.sequence })),
                deliveredReminders: input.deliveredReminders,
                covered: input.previous?.covered, undelivered: input.previous?.undelivered
            });
        }
        notificationIdentity(notifications, main = [], memberReminders = []) {
            let newest = 0;
            for (const { item } of notifications)
                newest = Math.max(newest, item.newestSequence);
            for (const { entries } of main)
                newest = Math.max(newest, entries.at(-1)?.sequence ?? 0);
            for (const entry of memberReminders)
                newest = Math.max(newest, entry.sequence);
            return `${notifications.length} unread Thread(s)${main.length === 0 ? '' : `, ${main.length} Project Main stream(s)`}`
                + `${memberReminders.length === 0 ? '' : `, ${memberReminders.length} due Member reminder(s)`}, newest unread fact sequence ${newest}`;
        }
        /**
         * Wake from durable unread state with bounded facts. One correlated line states what the wake did: its cause, the attempt it spent,
         * and whether the notice was queued, already carried by a recovery instruction, skipped, or failed. A queued notice is delivery intent, not evidence the model read it.
         * A delivery failure is contained here: the operation is already durable. A synchronous invariant divergence leaves on the caller's frame; a deferred one is logged by afterCommit.
         */
        notifyMember(agent, cause, sequenced = false) {
            const member = this.memberForAgent(agent);
            if (member === undefined) {
                this.ctx.logger.debug(`agent-team: Team Inbox notice not attempted for session '${agent.id}' cause ${this.notificationCauseText(cause)}: the Agent is not a Team Member`);
                return;
            }
            if (member.state !== 'enabled') {
                this.ctx.logger.debug(`agent-team: Team Inbox notice not attempted for ${this.memberScope(member.memberId, agent.id)} cause ${this.notificationCauseText(cause)}: the Member is ${member.state}`);
                return;
            }
            const events = agent.status === 'idle' ? logEventsOf(agent) : undefined;
            const atWake = agent.status === 'idle' && (this.contextManagement.isTransitioning(member.memberId)
                || this.cheapWakePlan(events).action === 'measure-context');
            if (atWake) {
                void this.notifyMemberAtWake(member.memberId, agent, cause, sequenced);
                return;
            }
            // A swap already in flight delivers nothing into the Session it retires:
            // the successor's rederived Inbox carries these same durable facts.
            if (this.contextManagement.isTransitioning(member.memberId))
                return;
            this.deliverInboxNotice(agent, member, cause, sequenced);
        }
        async notifyMemberAtWake(memberId, agent, cause, sequenced) {
            this.scheduleTaskReminderEvaluation();
            this.scheduleMemberReminderEvaluation();
            let gate;
            try {
                gate = await this.wakeGateFor(agent);
            }
            catch (error) {
                gate = new Error(failureDetail(error));
            }
            const live = this.handles.get(memberId)?.agent;
            const member = live === undefined ? undefined : this.memberForAgent(live);
            // Absent or a different live Agent means this wake swapped the generation:
            // the swap rederives the Inbox for its successor, so delivering here would
            // duplicate the very facts that rederivation already carries.
            if (live === undefined || member === undefined || live !== agent)
                return;
            if (gate !== undefined) {
                this.ctx.logger.warn(`agent-team: Team Inbox notice not delivered for ${this.memberScope(memberId, agent.id)} cause ${this.notificationCauseText(cause)}: ${gate.message}; the durable unread facts stay unread and rederive on the next commit`);
                return;
            }
            this.deliverInboxNotice(live, member, cause, sequenced);
        }
        deliverInboxNotice(agent, member, cause, sequenced = false) {
            const material = this.requireLedger().notificationSnapshot(member.memberId);
            const notifications = material.threads;
            const mainNotifications = material.main;
            const memberReminders = material.memberReminders;
            const scope = this.memberScope(member.memberId, agent.id);
            const causeText = this.notificationCauseText(cause);
            if (notifications.length === 0 && mainNotifications.length === 0 && memberReminders.length === 0) {
                this.dropInboxCoverage(member.memberId);
                this.ctx.logger.debug(`agent-team: Team Inbox notice not attempted for ${scope} cause ${causeText}: the Member has no unread Team facts`);
                return;
            }
            // Any ordinary next-turn input already queued (a rollover's or recovery's
            // carried messages) forces sequencing regardless of the caller: a steer
            // would claim the nearest step boundary and leapfrog the carried turn.
            if (!sequenced) {
                sequenced = agent.inbox.nextTurn.some(message => message.source.kind === 'user');
            }
            const previous = this.inboxNoticeDeliveries.get(member.memberId);
            const plan = this.inboxDeliveryPlan({ notifications, main: mainNotifications, memberReminders, previous });
            const facts = this.notificationIdentity(notifications, mainNotifications, memberReminders);
            // An unchanged rederivation spends no attempt: the delivery already made
            // for these facts stands, which is what keeps a repeated commit's logging
            // bounded.
            if (plan.trigger === undefined) {
                this.ctx.logger.debug(`agent-team: Team Inbox notice not attempted for ${scope} cause ${causeText}: ${plan.signature === ''
                    ? 'the Member has no unread Team facts'
                    : `the same unread facts (${facts}) already have a delivery attempt`}`);
                return;
            }
            const pending = [...agent.inbox.nextStep, ...agent.inbox.nextTurn];
            // steerResume already combines the recovery instruction and these durable
            // facts. Its synchronous running transition must not replace that notice.
            if (pending.some(message => this.isRecoveryNotice(message))) {
                // Only the occurrences that recovery instruction actually rendered are
                // answered by it. One raised after it was queued was never in its text, so
                // it stays out of `covered` and stays owed: the claim of that instruction
                // rederives the Inbox and delivers it.
                const recovery = pending.find(message => this.isRecoveryNotice(message));
                this.coverInboxFacts(member.memberId, this.inboxDeliveryPlan({ notifications, main: mainNotifications,
                    deliveredReminders: this.memberReminderWakes.get(recovery.id)?.reminders ?? [], previous }));
                this.ctx.logger.info(`agent-team: Team Inbox notice carried by the queued recovery instruction for ${scope} cause ${causeText} (${facts}): queued with that recovery instruction, not yet read by the model`);
                return;
            }
            const existingInboxHint = pending.find(message => this.isInboxNotice(message));
            if (existingInboxHint !== undefined)
                this.removeExpectedTeamWake(agent, existingInboxHint);
            const notice = this.notificationText(agent, notifications, member.memberId, mainNotifications, plan, '', memberReminders, material.workers);
            const hint = createUserMessage({
                content: [{ type: 'text', text: notice.text }],
                source: { kind: AGENT_TEAM_PLUGIN_ID, form: 'notice', summary: TEAM_INBOX_NOTICE_SUMMARY, teamFacts: teamMessageSurface(notice.text, notice.messages, notice.activities) },
            });
            this.trackTeamWake(agent, hint);
            // A Member reminder is consumed when its notice reaches a turn, so the queued
            // message carries the occurrences it rendered for the claim that reads them.
            if (notice.deliveredReminders.length > 0) {
                this.memberReminderWakes.set(hint.id, { memberId: member.memberId, reminders: notice.deliveredReminders });
            }
            // Coverage is what the notice rendered, not what the plan offered: an
            // occurrence the detail cap or the character budget dropped never reached
            // the Member, so it is not answered and stays unread.
            const earned = notice.deliveredReminders.length === memberReminders.length ? plan
                : this.inboxDeliveryPlan({ notifications, main: mainNotifications, memberReminders, deliveredReminders: notice.deliveredReminders, previous });
            const attempt = this.beginInboxDelivery(member.memberId, earned, notice.undelivered);
            try {
                // Steer normally claims the nearest step boundary — which would
                // preempt carried input that a swap or crash recovery queued as
                // ordinary next-turn messages. The sequenced mode enqueues the
                // rederived Inbox as its own follow-up turn instead, so the delivery
                // order stays carried input → rederived Inbox.
                if (sequenced)
                    agent.followup(hint);
                else
                    agent.steer(hint);
            }
            catch (error) {
                this.dropInboxCoverage(member.memberId);
                if (error instanceof AgentTeamInvariantError)
                    throw error;
                this.ctx.logger.warn(`agent-team: Team Inbox notice delivery failed for ${scope} cause ${causeText} attempt ${attempt} (${facts}): ${failureDetail(error)}; the operation is committed and stands, and the failed delivery stands as an attempt so the next fact touching this Member rederives and retries it`);
                return;
            }
            this.ctx.logger.info(`agent-team: Team Inbox notice queued for ${scope} cause ${causeText} attempt ${attempt} delivery ${plan.trigger} lane '${sequenced ? 'follow-up turn' : 'next step'}' (${facts}): queued for the Member's next step, not yet read by the model`);
        }
        /**
         * One line per automatic-recovery state change (classified family, counted occurrence, armed wait, fired wakeup, stand-down, end of tracking),
         * so no stop is silent and the automatic path is explainable without debug output.
         */
        reportRecovery(fact) {
            const scope = this.memberScope(fact.memberId);
            if (fact.kind === 'scheduled') {
                this.ctx.logger.info(`agent-team: automatic recovery scheduled for ${scope} errorKind '${fact.errorKind}' occurrence ${fact.consecutiveFailures}/${fact.maxConsecutiveErrors} wait ${fact.delayMs}ms`);
                return;
            }
            if (fact.kind === 'woke') {
                this.ctx.logger.debug(`agent-team: automatic recovery wait elapsed for ${scope} after ${fact.consecutiveFailures} consecutive recoverable error(s): attempting the automatic continuation`);
                return;
            }
            if (fact.kind === 'stood-down') {
                this.ctx.logger.warn(`agent-team: automatic recovery stood down for ${scope} after ${fact.consecutiveFailures}/${fact.maxConsecutiveErrors} consecutive '${fact.errorKind}' errors: leaving the Member in error for the operator, with no further automatic wakeup until a clean turn or a manual recovery`);
                return;
            }
            this.ctx.logger.info(`agent-team: automatic recovery cleared for ${scope} reason '${fact.reason}' after ${fact.consecutiveFailures} consecutive recoverable error(s) with ${fact.pendingWakes} pending wakeup(s)${fact.stoodDown ? ', stood down' : ''}${fact.detail === undefined ? '' : `: ${fact.detail}`}`);
        }
        isInboxNotice(message) {
            const source = message.source;
            return isAgentTeamSource(source)
                && source.form === 'notice' && source.summary === TEAM_INBOX_NOTICE_SUMMARY;
        }
        /** Every Team-authored notice, including the acceptance reminder: a queued one is Host context, not the Member's own unfinished input, so it must not pin the current generation. */
        isTeamWake(message) {
            return this.isInboxNotice(message) || this.isRecoveryNotice(message) || isAcceptanceNotice(message);
        }
        trackTeamWake(agent, message) {
            const member = this.memberForAgent(agent);
            if (member === undefined)
                return;
            this.pendingTeamWakes.set(message.id, { memberId: member.memberId, sessionId: agent.id });
        }
        /** Remove a Team notice that Host code is replacing or disposing on purpose. */
        removeExpectedTeamWake(agent, message) {
            this.expectedInboxDiscards.add(message.id);
            // The occurrences this message carried were never read, so nothing may
            // consume them: its successor rederives them from the durable unread.
            this.memberReminderWakes.delete(message.id);
            if (!agent.inbox.remove(message.id)) {
                this.expectedInboxDiscards.delete(message.id);
                this.pendingTeamWakes.delete(message.id);
            }
        }
        expectPendingTeamWakes(agent) {
            for (const pending of [...agent.inbox.nextStep, ...agent.inbox.nextTurn]) {
                if (this.isTeamWake(pending))
                    this.removeExpectedTeamWake(agent, pending);
            }
        }
        /**
         * Dispose a Member handle after pre-declaring its queued Team wakes: tearing
         * a Session down discards whatever it had queued, which must not be read as a
         * pre-turn cancellation of work the Member never refused.
         */
        disposeWithWakeGuard(handle) {
            this.expectPendingTeamWakes(handle.agent);
            return handle.dispose();
        }
        setPreTurnCancellation(memberId, sessionId) {
            const failures = this.memberFailures.get(memberId) ?? {};
            failures.preTurnCancellation = Object.freeze({
                class: 'runtime',
                detail: 'Team wake was canceled before the Member started a turn; the Harness did not report a cancellation reason.',
                sessionId,
                source: 'agent/inbox/discarded',
                occurredAt: new Date().toISOString(),
            });
            this.memberFailures.set(memberId, failures);
        }
        isRecoveryNotice(message) {
            const source = message.source;
            return isAgentTeamSource(source)
                && source.form === 'notice' && source.summary === TEAM_RECOVERY_NOTICE_SUMMARY;
        }
        notificationText(agent, notifications, readerId, main = [], deliveryPlan, prefix = '', memberReminders = [], workers = []) {
            const plan = deliveryPlan ?? (readerId === undefined ? undefined : this.inboxDeliveryPlan({ notifications, main }));
            return renderInboxNotice({ notifications, main, memberReminders, workers, readerId, deliveryPlan: plan, prefix,
                surface: visibleTeamSurface(agent), lookup: {
                    printableSender: memberId => this.printableSender(memberId),
                    isProjectOwner: (reader, projectRef) => this.requireLedger().projectOwnerIds(projectRef).includes(reader),
                    repliesToLine: (message, workspaceId) => this.repliesToLine(message, workspaceId),
                    claimOwner: claimRef => this.requireLedger().getClaim(claimRef)?.owner,
                } });
        }
        async disposeMemberSession(memberId, member) {
            this.clearMemberRecoveryState(member);
            const handle = this.handles.get(memberId);
            if (handle !== undefined) {
                // Disposal cancels the Member's turn and then waits for the Agent to
                // quiesce, session write path included: that is external execution, not
                // the Member's own turn, so it logs under its own stage.
                await this.waitLogged('wait-external', { label: this.memberLabel(memberId), sessionId: member.sessionId }, 'for the Agent to release its Session write path', () => this.disposeWithWakeGuard(handle));
                this.handles.delete(memberId);
            }
            this.memberRuntime.forgetMember(memberId);
            this.memberIdle.forget(memberId);
            this.clearMemberFailure(memberId, 'activation');
            this.clearMemberFailure(memberId, 'preTurnCancellation');
        }
        clearMemberRecoveryState(member) {
            this.recovery.stopTracking(member.memberId, 'session-disposed');
            this.clearMemberFailure(member.memberId, 'runtime');
            this.clearMemberFailure(member.memberId, 'preTurnCancellation');
            this.clearMemberNotificationState(member.memberId);
        }
        /** Forget a Member's notice delivery entirely: a new generation starts over. */
        clearMemberNotificationState(memberId) {
            this.inboxNoticeDeliveries.delete(memberId);
        }
        /** Record that the queued notice now answers these facts, keeping the attempt count. */
        coverInboxFacts(memberId, plan) {
            this.inboxNoticeDeliveries.set(memberId, { covered: plan.delivered, attempt: this.inboxNoticeDeliveries.get(memberId)?.attempt ?? 0,
                undelivered: this.inboxNoticeDeliveries.get(memberId)?.undelivered ?? [] });
        }
        /** Spend one delivery attempt and mark the facts it covers; the count rises first so a failed wake still reports the attempt it spent. */
        beginInboxDelivery(memberId, plan, undelivered) {
            const attempt = (this.inboxNoticeDeliveries.get(memberId)?.attempt ?? 0) + 1;
            // `delivered` is what this notice actually answered, so an unchanged
            // rederivation of the same facts stands down; `signature` is only for the log.
            this.inboxNoticeDeliveries.set(memberId, { covered: plan.delivered, attempt, undelivered });
            return attempt;
        }
        /**
         * Drop the fact coverage but keep the attempt count, so the next commit retries the same facts as the next attempt.
         */
        dropInboxCoverage(memberId) {
            const delivery = this.inboxNoticeDeliveries.get(memberId);
            if (delivery !== undefined) {
                this.inboxNoticeDeliveries.set(memberId, { covered: '', attempt: delivery.attempt, undelivered: delivery.undelivered });
            }
        }
        /**
         * Wake waiters for one committed or lifecycle change. Undefined broadcasts to everyone; an empty scope list invalidates nobody;
         * otherwise global and matching scoped waiters wake. Presence-only scopes wake only matching presence waiters.
         * Each waiter receives the version of its own scope's domain; nothing here advances the projection version.
         */
        emitChanged(scopes) {
            const touchesProjection = scopes === undefined || scopes.some(scope => scope.kind !== 'presence');
            const touchesPresence = scopes !== undefined && scopes.some(scope => scope.kind === 'presence');
            if (!touchesProjection && !touchesPresence)
                return;
            if (touchesPresence)
                this.presenceEpoch += 1;
            for (const waiter of this.changeWaiters) {
                const waiterScope = waiter.scope;
                if (scopes !== undefined && (waiterScope === undefined ? !touchesProjection : !scopes.some(scope => sameChangeScope(scope, waiterScope))))
                    continue;
                waiter.wake(this.changeVersionOf(waiterScope));
            }
        }
        /**
         * The cursor domain of one scope: presence scopes count process-local edge wakes, every other scope compares against the ledger position of the newest shared-projection commit.
         * Keeping them separate stops a presence edge from invalidating a projection subscriber.
         */
        changeVersionOf(scope) {
            if (scope?.kind === 'presence')
                return this.presenceEpoch;
            return this.ledger?.projectionSequence() ?? 0;
        }
        validateChangeScope(scope) {
            if (scope === undefined)
                return undefined;
            const ref = scope.kind === 'workspace' || scope.kind === 'presence' ? scope.workspaceId : scope.kind === 'project' ? scope.projectRef : scope.threadRef;
            if (typeof ref !== 'string' || ref.length === 0)
                throw new Error(`change scope of kind '${scope.kind}' requires a non-empty ref`);
            return scope;
        }
        /** Serialize one Member's lifecycle operations in submission order; a long wait inside one holds only this chain. */
        enqueueLifecycle(memberId, operation) {
            return this.chainLifecycle(this.memberLifecycleTails, this.enteredMemberChains, memberId, operation);
        }
        /** Serialize lifecycle operations against a Member id that does not exist until the commit answers: concurrent duplicates of one add request. */
        enqueueAddition(requestId, operation) {
            return this.chainLifecycle(this.additionLifecycleTails, this.enteredAdditionChains, requestId, operation);
        }
        chainLifecycle(tails, entered, key, operation) {
            this.requireAccepting();
            if (entered.getStore()?.has(key) === true)
                return operation();
            const previous = tails.get(key) ?? Promise.resolve();
            const result = previous.then(() => entered.run(new Set([...entered.getStore() ?? [], key]), operation));
            const tail = result.then(() => { }, () => { });
            tails.set(key, tail);
            // Prune settled chains so a removed Member leaves nothing behind; a newer
            // chain on the same key keeps its own entry.
            void tail.then(() => { if (tails.get(key) === tail)
                tails.delete(key); });
            return result;
        }
    };
})();
export default AgentTeam;
export function lastActivityTime(events) {
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const time = events[index]?.time;
        if (typeof time === 'number' && Number.isFinite(time))
            return time;
    }
    return null;
}
export function logEventsOf(agent) {
    try {
        return agent.session.ownEvents();
    }
    catch {
        return undefined;
    }
}
