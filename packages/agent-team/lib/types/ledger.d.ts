import type { KvTable } from '@deepseek-ai/dsh-storage-domain';
import type { SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session';
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace';
import type { AgentTeamAddMemberRequest, AgentTeamMainStreamHistory, AgentTeamMainStreamHistoryRequest, AgentTeamMainStreamReadRequest, AgentTeamMainStreamReadResult, AgentTeamMainTimelineEntry, AgentTeamPostMainMessageRequest, AgentTeamPostMainMessageResult, AgentTeamStartThreadRequest, AgentTeamStartThreadResult, AgentTeamAttachmentId, AgentTeamAgentMember, AgentTeamActor, AgentTeamArchiveProjectRequest, AgentTeamArchiveProjectResult, AgentTeamArchiveMemberRequest, AgentTeamArchiveMemberResult, AgentTeamProject, AgentTeamChangeScope, AgentTeamProjectRef, AgentTeamClaim, AgentTeamClaimList, AgentTeamClaimRequest, AgentTeamClaimResult, AgentTeamClaimRef, AgentTeamCreateProjectRequest, AgentTeamCreateProjectResult, AgentTeamCreateSubscriptionRequestIntent, AgentTeamDmRequest, AgentTeamDmResult, AgentTeamHostActor, AgentTeamHumanActor, AgentTeamInbox, AgentTeamInboxRequest, AgentTeamInboxItem, AgentTeamTaskBoard, AgentTeamTaskBoardRequest, AgentTeamJoinProjectRequest, AgentTeamMemberActor, AgentTeamMemberId, AgentTeamMemberReminderView, AgentTeamMemberReminderCreateRequest, AgentTeamMemberReminderCreateResult, AgentTeamMemberReminderCancelRequest, AgentTeamMemberReminderCancelResult, AgentTeamMemberReminderOccurrenceRef, AgentTeamUnreadMemberReminder, AgentTeamMessageRef, AgentTeamOperation, AgentTeamOperationId, AgentTeamOperationReceipt, AgentTeamRemoveProjectMemberRequest, AgentTeamJoinWorkspaceRequest, AgentTeamJoinWorkspaceResult, AgentTeamLeaveWorkspaceRequest, AgentTeamLeaveWorkspaceResult, AgentTeamRemoveMemberRequest, AgentTeamRemoveMemberResult, AgentTeamReplyRequest, AgentTeamReplyResult, AgentTeamRequestId, AgentTeamResolvedMessageRef, AgentTeamReadMessageRequest, AgentTeamReadMessageResult, AgentTeamResolvedTaskRef, AgentTeamResolvedThreadRef, AgentTeamMessageAttachment, AgentTeamSetMemberStateRequest, AgentTeamStatus, AgentTeamTask, AgentTeamTaskRequest, AgentTeamTaskResult, AgentTeamTransferTaskRequest, AgentTeamTransferTaskResult, AgentTeamTaskRef, AgentTeamThreadAttentionRequest, AgentTeamThreadAttentionResult, AgentTeamMainAttentionResult, AgentTeamMainAttentionStatus, AgentTeamThreadAttentionStatus, AgentTeamThreadHistory, AgentTeamThreadHistoryRequest, AgentTeamThreadReadFact, AgentTeamThreadReadData, AgentTeamThreadReadRequest, AgentTeamThreadReadResult, AgentTeamThreadReadSnapshot, AgentTeamThreadObservations, AgentTeamThreadObservationsRequest, AgentTeamThreadRef, AgentTeamPromoteThreadRequest, AgentTeamPromoteThreadResult, AgentTeamUpdateProjectRequest, AgentTeamProjectOwnerRequest, AgentTeamProjectOwnerResult, AgentTeamUpdateProjectResult, AgentTeamSubscription, AgentTeamSubscriptionAcceptResult, AgentTeamSubscriptionChangeResult, AgentTeamSubscriptionEventAccepted, AgentTeamSubscriptionPublishResult, AgentTeamSubscriptionRef, AgentTeamSubscriptionRequestIntent, AgentTeamSubscriptionScriptSource, AgentTeamDelegationTarget, AgentTeamUpdateMemberRequest, AgentTeamView, AgentTeamWorkerAnswer, AgentTeamWorkerSteerAdmission, AgentTeamWorkerSteerAdmissionWrite, AgentTeamWorkerSteerRequestState, AgentTeamWorkerSteerStoredOutcome, AgentTeamWorkerExecution, AgentTeamWorkerRef, AgentTeamWorkerSettledRecorded, AgentTeamWorkerSettleWrite, AgentTeamWorkerStartedRecorded, AgentTeamWorkerStartWrite, AgentTeamWorkerState, AgentTeamWorkerStateView, AgentTeamViewRequest } from './types.ts';
import { type SubscriptionCredential, type SubscriptionEvent, type SubscriptionScriptSnapshot, type SubscriptionTriggers } from './subscriptions.ts';
import type { MemberReminderCandidate } from './member-reminders.ts';
/** Stable Human Member identity shared by every replay of one dshHome Team. */
export declare const AGENT_TEAM_HUMAN_MEMBER_ID: AgentTeamMemberId;
/**
 * The handle the Human is addressed by in Message bodies. The body parser and
 * the Member directory both read this one constant, so a configurable display
 * name has a single place to land instead of a hard-coded literal per surface.
 */
export declare const AGENT_TEAM_HUMAN_HANDLE = "human";
/** Idempotency identity of the one Host bootstrap operation. */
export declare const AGENT_TEAM_INITIALIZE_REQUEST_ID: AgentTeamRequestId;
/** Resolve the one Human authority owned by this Team. */
export declare function agentTeamHumanActor(): AgentTeamHumanActor;
/** Finished Tasks the board keeps per Project. */
export declare const TASK_BOARD_FINISHED_PER_PROJECT = 5;
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
export declare const AGENT_TEAM_RULES_VERSION = 7;
export declare function agentTeamHostActor(): AgentTeamHostActor;
/** Caller-owned payload of the idempotent Team initialization request. */
export interface AgentTeamInitializeRequest {
    readonly requestId: AgentTeamRequestId;
    readonly actor: AgentTeamHumanActor;
    readonly humanMemberId: AgentTeamMemberId;
}
export interface AgentTeamAuthorizedCreateProjectRequest extends AgentTeamCreateProjectRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedAddMemberRequest extends AgentTeamAddMemberRequest {
    readonly actor: AgentTeamHumanActor;
    readonly member: AgentTeamAgentMember;
}
export interface AgentTeamAuthorizedSetMemberStateRequest extends AgentTeamSetMemberStateRequest {
    readonly actor: AgentTeamHumanActor;
}
/** Host-authorized recycling of one cold Member generation onto a fresh Session. */
export interface AgentTeamAuthorizedRecycleMemberSessionRequest {
    readonly requestId: AgentTeamRequestId;
    readonly workspaceId: WorkspaceId;
    readonly memberId: AgentTeamMemberId;
    readonly actor: AgentTeamHostActor;
    readonly previousSessionId: SessionId;
    readonly newSessionId: SessionId;
    readonly inputFromSeq?: SessionLogOffset;
}
export interface AgentTeamAuthorizedJoinProjectRequest extends AgentTeamJoinProjectRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedRemoveProjectMemberRequest extends AgentTeamRemoveProjectMemberRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedJoinWorkspaceRequest extends AgentTeamJoinWorkspaceRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedLeaveWorkspaceRequest extends AgentTeamLeaveWorkspaceRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedPostMainMessageRequest extends AgentTeamPostMainMessageRequest {
    readonly actor: AgentTeamHumanActor | AgentTeamMemberActor;
    readonly resolvedAttachments?: readonly AgentTeamMessageAttachment[] | undefined;
}
export interface AgentTeamAuthorizedStartThreadRequest extends AgentTeamStartThreadRequest {
    readonly actor: AgentTeamHumanActor | AgentTeamMemberActor;
    readonly resolvedAttachments?: readonly AgentTeamMessageAttachment[] | undefined;
}
export interface AgentTeamAuthorizedMainStreamReadRequest extends AgentTeamMainStreamReadRequest {
    readonly actor: AgentTeamHumanActor | AgentTeamMemberActor;
}
export interface AgentTeamAuthorizedReplyRequest extends AgentTeamReplyRequest {
    readonly actor: AgentTeamHumanActor | AgentTeamMemberActor;
    /** Metadata the Host resolved from the attachment cache before the append. */
    readonly resolvedAttachments?: readonly AgentTeamMessageAttachment[] | undefined;
}
export interface AgentTeamAuthorizedClaimRequest extends AgentTeamClaimRequest {
    readonly actor: AgentTeamHumanActor | AgentTeamMemberActor;
}
export interface AgentTeamAuthorizedTaskRequest extends AgentTeamTaskRequest {
    readonly actor: AgentTeamHumanActor | AgentTeamMemberActor;
}
export interface AgentTeamAuthorizedTransferTaskRequest extends AgentTeamTransferTaskRequest {
    readonly actor: AgentTeamHumanActor | AgentTeamMemberActor;
}
export interface AgentTeamAuthorizedPromoteThreadRequest extends AgentTeamPromoteThreadRequest {
    /** A Member actor is judged against the rules version: only Project owners may promote from version 2, and nobody but the Human before. */
    readonly actor: AgentTeamHumanActor | AgentTeamMemberActor;
}
export interface AgentTeamAuthorizedThreadAttentionRequest extends AgentTeamThreadAttentionRequest {
    readonly actor: AgentTeamHumanActor | AgentTeamMemberActor;
}
export interface AgentTeamAuthorizedThreadReadRequest extends AgentTeamThreadReadRequest {
    readonly actor: AgentTeamHumanActor | AgentTeamMemberActor;
    /**
     * Host-internal confirmation bound: acknowledge only the default unread
     * batch's prefix through this Thread sequence. `0` acknowledges no fact and
     * consumes no marker or Task reminder. Absent means the default batch, and a
     * stored receipt without the field keeps that same meaning on replay.
     */
    readonly selectedThroughSequence?: number | undefined;
}
export interface AgentTeamAuthorizedRemoveMemberRequest extends AgentTeamRemoveMemberRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedArchiveMemberRequest extends AgentTeamArchiveMemberRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedUpdateProjectRequest extends AgentTeamUpdateProjectRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedProjectOwnerRequest extends AgentTeamProjectOwnerRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedArchiveProjectRequest extends AgentTeamArchiveProjectRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedUpdateMemberRequest extends AgentTeamUpdateMemberRequest {
    readonly actor: AgentTeamHumanActor;
}
export interface AgentTeamAuthorizedDmRequest extends AgentTeamDmRequest {
    readonly actor: AgentTeamMemberActor;
}
/** Construction hooks used to make durable operation creation deterministic in tests. */
/** One subscription definition as a caller supplies it; the ledger mints the ref, revision and instants. */
export interface AgentTeamCreateSubscriptionRequest {
    readonly requestId: AgentTeamRequestId;
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly name: string;
    readonly triggers: SubscriptionTriggers;
    readonly script: SubscriptionScriptSnapshot;
    readonly credentials: readonly SubscriptionCredential[];
    /** Who its events are for; omitted means the Creating Member alone. */
    readonly notify?: readonly AgentTeamMemberId[] | undefined;
    /** Ids the trial run printed that this subscription must never publish; empty means ignore that history. */
    readonly baselineIds: readonly string[];
}
export interface AgentTeamAuthorizedCreateSubscriptionRequest extends AgentTeamCreateSubscriptionRequest {
    readonly actor: AgentTeamActor;
}
/** A full replacement of the four editable parts; the revision moves by one. */
export interface AgentTeamUpdateSubscriptionRequest {
    readonly requestId: AgentTeamRequestId;
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly subscriptionRef: AgentTeamSubscriptionRef;
    readonly expectedRevision: number;
    readonly name: string;
    readonly triggers: SubscriptionTriggers;
    readonly script: SubscriptionScriptSnapshot;
    readonly credentials: readonly SubscriptionCredential[];
    /** Who its events are for; omitted keeps the stored set, and `[]` clears it to the timeline alone. */
    readonly notify?: readonly AgentTeamMemberId[] | undefined;
}
export interface AgentTeamAuthorizedUpdateSubscriptionRequest extends AgentTeamUpdateSubscriptionRequest {
    readonly actor: AgentTeamActor;
}
/** A state transition that does not move the revision. */
export interface AgentTeamSubscriptionStateRequest {
    readonly requestId: AgentTeamRequestId;
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly subscriptionRef: AgentTeamSubscriptionRef;
    readonly expectedRevision: number;
}
export interface AgentTeamAuthorizedSubscriptionStateRequest extends AgentTeamSubscriptionStateRequest {
    readonly actor: AgentTeamActor;
}
/** An automatic pause records its own reason and never moves the revision. */
export interface AgentTeamAuthorizedPauseSubscriptionRequest extends AgentTeamSubscriptionStateRequest {
    readonly actor: AgentTeamActor;
    readonly reason: 'manual' | 'failures';
}
/** Append-only re-baselining: the ids to ignore from now on, never a replacement of what is already recorded. */
export interface AgentTeamAuthorizedBaselineSubscriptionRequest {
    readonly requestId: AgentTeamRequestId;
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly subscriptionRef: AgentTeamSubscriptionRef;
    readonly ids: readonly string[];
    readonly actor: AgentTeamActor;
}
/** Every subscription write whose request id has to mean the same payload twice. */
type AgentTeamAuthorizedSubscriptionWrite = AgentTeamAuthorizedCreateSubscriptionRequest | AgentTeamAuthorizedUpdateSubscriptionRequest | AgentTeamAuthorizedPauseSubscriptionRequest | AgentTeamAuthorizedSubscriptionStateRequest | AgentTeamAuthorizedBaselineSubscriptionRequest | AgentTeamAcceptSubscriptionEventsRequest | AgentTeamPublishSubscriptionEventRequest;
/** A create or update retry before its script source and credentials have been resolved. */
type AgentTeamSubscriptionWriteReplayBase = {
    readonly requestId: AgentTeamRequestId;
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly actor: AgentTeamActor;
    readonly name: string;
    readonly credentials?: readonly SubscriptionCredential[] | undefined;
    readonly intervalMinutes?: number | undefined;
    readonly webhook?: boolean | undefined;
    readonly script: AgentTeamSubscriptionScriptSource;
    readonly notify?: readonly AgentTeamMemberId[] | undefined;
};
export type AgentTeamSubscriptionWriteReplayRequest = AgentTeamSubscriptionWriteReplayBase & {
    readonly kind: 'create';
    readonly baseline?: 'current-output' | 'ignore-history' | undefined;
} | AgentTeamSubscriptionWriteReplayBase & {
    readonly kind: 'update';
    readonly subscriptionRef: AgentTeamSubscriptionRef;
    readonly expectedRevision: number;
};
export interface AgentTeamSubscriptionWriteReplay {
    readonly value: AgentTeamSubscriptionChangeResult;
    readonly addressArmed: boolean;
}
/** One run's validated output, accepted under the version the run pinned. */
export interface AgentTeamAcceptSubscriptionEventsRequest {
    readonly requestId: AgentTeamRequestId;
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly subscriptionRef: AgentTeamSubscriptionRef;
    readonly subscriptionRevision: number;
    readonly scriptHash: string;
    readonly events: readonly SubscriptionEvent[];
    readonly actor: AgentTeamActor;
}
/** One accepted event published to the Main stream. */
export interface AgentTeamPublishSubscriptionEventRequest {
    readonly requestId: AgentTeamRequestId;
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly subscriptionRef: AgentTeamSubscriptionRef;
    readonly acceptedSequence: number;
    readonly eventId: string;
    readonly actor: AgentTeamActor;
}
export interface AgentTeamLedgerOptions {
    readonly operationId?: () => AgentTeamOperationId;
    readonly occurredAt?: () => string;
    readonly ref?: (kind: 'project' | 'message' | 'task' | 'thread' | 'claim' | 'activity' | 'subscription') => string;
    /**
     * Whether one unread fact is already on the named Member's model-visible
     * surface, in full. The Host supplies it: it owns the live Agent sessions,
     * the ledger owns durable state and must never reach into a runtime.
     *
     * Returning false refuses the write. A true answer exempts this one write
     * only: nothing is persisted, no watermark advances, no marker is consumed.
     */
    readonly areFactsVisible?: ((memberId: AgentTeamMemberId, facts: readonly AgentTeamThreadReadFact[], threadRef: AgentTeamThreadRef) => boolean) | undefined;
    readonly areMainEntriesVisible?: ((memberId: AgentTeamMemberId, entries: readonly AgentTeamMainTimelineEntry[], projectRef: AgentTeamProjectRef) => boolean) | undefined;
    /** Highest rules version to adopt and accept; defaults to `AGENT_TEAM_RULES_VERSION`. */
    readonly rulesVersion?: number;
    /**
     * Mints one webhook token when a write arms an address. The ledger consults
     * it instead of the platform's CSPRNG directly, so a test commits a known
     * address and hash rather than a value it could never predict.
     */
    readonly webhookToken?: () => string;
}
/** Internal append result indicating whether this call committed a new record. */
export interface AgentTeamLedgerResult<T> {
    readonly value: T;
    readonly committed: boolean;
}
/**
 * Outcome of one Thread read. A read that committed always carries the receipt
 * of the operation it wrote; a read that committed nothing — an already-read
 * Thread — answers with the current picture instead, and only a retry of a
 * read that did commit still carries that original receipt.
 */
export type AgentTeamThreadReadOutcome = {
    readonly value: AgentTeamThreadReadResult & {
        readonly receipt: AgentTeamOperationReceipt;
    };
    readonly committed: true;
} | {
    readonly value: AgentTeamThreadReadResult;
    readonly committed: false;
};
interface AgentTeamDurableMemberResult {
    readonly receipt: AgentTeamOperationReceipt;
    readonly member: AgentTeamAgentMember;
}
export type { AgentTeamDurableMemberResult };
/**
 * One readable native-record anchor in a continuation chain. A continuation that
 * failed before opening its own session has no anchor, so a later explicit
 * continuation inherits the nearest predecessor's anchor while still linking to
 * the failed tail as its direct predecessor.
 */
export interface WorkerResumeAnchor {
    readonly nativeSessionId: string;
    readonly nativeStorage: string;
    readonly nativeTurnId?: string | undefined;
    readonly nativeTurnIds?: readonly string[] | undefined;
    readonly nativeInputIds?: readonly string[] | undefined;
}
export declare function isThreadReadSnapshot(data: AgentTeamThreadReadData): data is AgentTeamThreadReadSnapshot;
/** The Thread and optional Task one read targeted, whichever form the record holds. */
export declare function threadReadTargetOf(data: AgentTeamThreadReadData): {
    readonly threadRef: AgentTeamThreadRef;
    readonly taskRef?: AgentTeamTaskRef | undefined;
};
/** Replay and append logic behind the Agent Team service interface. */
export declare class AgentTeamLedger {
    private readonly table;
    /** Live projection; record validation replays build independent Projection values instead. */
    private readonly state;
    private readonly createOperationId;
    private readonly createOccurredAt;
    private readonly createRef;
    /** How a write that arms a webhook address obtains its token; the default is the platform CSPRNG. */
    private readonly createWebhookToken;
    /** Host-supplied surface visibility probe; absent means no write is ever exempt. */
    private readonly areFactsVisible?;
    private readonly areMainEntriesVisible;
    private readonly rulesVersion;
    /** A one-call read set lets notificationFacts and mainNotificationFacts reuse material memberInbox already derived. */
    private notificationReadSet;
    private operationTail;
    /**
     * Runtime human display name. Durable identity stays `member:human`; only
     * the handle read by @ matching and handle-uniqueness follows this value.
     * The Host syncs it from the `agent-team-human` settings namespace; the
     * ledger never persists it, so a rename affects only later resolutions.
     */
    private humanHandle;
    /**
     * Head of the durable records the constructor's record-level replay
     * validated, adoptable once by the invariant mount. See `validateAtMount`.
     */
    private bootValidation;
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
    private projectionVersion;
    constructor(table: KvTable<AgentTeamOperationId, AgentTeamOperation>, options?: AgentTeamLedgerOptions);
    /** Current human display name for @ matching and uniqueness checks. */
    humanDisplayHandle(): string;
    /** Read-only inputs for one event-evaluated reminder pass. */
    reminderFacts(): readonly import('./task-reminders.ts').ReminderTaskFacts[];
    heldTaskClaim(taskRef: AgentTeamTaskRef, memberId: AgentTeamMemberId): boolean;
    reminderEpisodeExists(taskRef: AgentTeamTaskRef, kind: import('./task-reminders.ts').ReminderKind, recipient: AgentTeamMemberId, baselineSequence: number): boolean;
    hasUnreadResponsibility(taskRef: AgentTeamTaskRef, recipient: AgentTeamMemberId): boolean;
    planReminders(nowMs: number, idleMs: (memberId: AgentTeamMemberId) => number | undefined, taskRef?: AgentTeamTaskRef): readonly import('./task-reminders.ts').ReminderCandidate[];
    /** Recheck the whole condition after earlier writes in the queue; a stale baseline or recipient is not committable. */
    raiseReminder(candidate: import('./task-reminders.ts').ReminderCandidate, nowMs: number, idleMs: (memberId: AgentTeamMemberId) => number | undefined): Promise<AgentTeamOperationReceipt | undefined>;
    /**
     * Record one delegated Worker run as started, before any native process exists.
     * This write is the run's whole binding: nothing later recomputes which Thread
     * its result belongs to. The record is private; only a bound target has a fact.
     */
    recordWorkerStarted(request: AgentTeamWorkerStartWrite): Promise<AgentTeamLedgerResult<AgentTeamWorkerStartedRecorded>>;
    /**
     * Record the one terminal fact of a delegated Worker run: at most once, with a
     * marker naming the fact it wrote in the same operation. A Project-only run
     * projects nothing public.
     */
    recordWorkerSettled(request: AgentTeamWorkerSettleWrite): Promise<AgentTeamLedgerResult<AgentTeamWorkerSettledRecorded>>;
    /**
     * Admit one steer request before the Host reaches the engine. A canonical
     * admission reserves a receiving execution and instruction (after an explicit
     * refusal, a fresh request id may reserve the same text again); an alias
     * reserves a fresh id for a request that already did. Neither writes a public
     * Worker fact or changes the execution record.
     */
    recordWorkerSteerAdmitted(request: AgentTeamWorkerSteerAdmissionWrite): Promise<AgentTeamLedgerResult<AgentTeamWorkerSteerAdmission>>;
    /**
     * Write the one outcome of an admitted steer. The caller must wait for this
     * record before reporting success; a missing outcome after replay is
     * unconfirmed, never an invitation to send the instruction again.
     */
    recordWorkerSteerRecorded(request: {
        readonly admissionRequestId: AgentTeamRequestId;
        readonly outcome: AgentTeamWorkerSteerStoredOutcome;
    }): Promise<AgentTeamLedgerResult<{
        readonly receipt: AgentTeamOperationReceipt;
        readonly outcome: AgentTeamWorkerSteerStoredOutcome;
    }>>;
    /**
     * What one request id means for steering: an admitted steer, a non-steer
     * operation it collides with, or nothing. A legacy `worker-started` request is
     * left to `workerStartedByRequest`, so a continuation retry from a ledger
     * written before steer receipts still answers as it always did.
     */
    workerSteerRequest(requestId: AgentTeamRequestId): AgentTeamWorkerSteerRequestState | undefined;
    /** The effective outcome of an admission, following an alias to its canonical request. */
    workerSteerOutcome(requestId: AgentTeamRequestId): AgentTeamWorkerSteerStoredOutcome | undefined;
    /**
     * Canonical admissions for one exact text on one receiving execution, oldest
     * first. A continuation admission is matchable through its source before the
     * new execution has opened, when its generated ref is not yet discoverable.
     * Aliases are excluded: they reserve an id, not another native intent.
     */
    workerSteerAdmissionsForText(query: {
        readonly workerRef?: AgentTeamWorkerRef | undefined;
        readonly instruction: string;
        readonly initiatedBy: AgentTeamMemberId;
        readonly continuedFrom?: AgentTeamWorkerRef | undefined;
    }): readonly AgentTeamWorkerSteerAdmission[];
    /** Whether this Host recorded the run and has not recorded its ending. */
    workerRunState(workerRef: AgentTeamWorkerRef): AgentTeamWorkerState | undefined;
    /** One run's whole durable record, for the Host's stop authorization. */
    workerExecution(workerRef: AgentTeamWorkerRef): AgentTeamWorkerExecution | undefined;
    /** The one execution directly continued from this run, if any. */
    workerSuccessor(workerRef: AgentTeamWorkerRef): AgentTeamWorkerExecution | undefined;
    /**
     * The newest execution in one native conversation. A running continuation
     * inherits the session id through its predecessor until its own settlement, so
     * this remains the durable way to join an alias ref to work already underway.
     */
    workerLatestInNativeSession(nativeSessionId: string): AgentTeamWorkerExecution | undefined;
    /** The native conversation one execution belongs to, inherited through its continuation chain. */
    workerNativeSessionOf(workerRef: AgentTeamWorkerRef): string | undefined;
    /**
     * The native-record anchors this execution's chain can resume, nearest first.
     * A cleanly failed continuation may have no anchor of its own; its predecessor
     * still identifies the same native conversation for an explicit later try.
     */
    workerResumeAnchors(workerRef: AgentTeamWorkerRef): readonly WorkerResumeAnchor[];
    /** The execution one request id opened, for a continuation retry that outlives its Host. */
    workerStartedByRequest(requestId: AgentTeamRequestId): AgentTeamWorkerExecution | undefined;
    /** Every run one Member initiated, newest start first: the record keeps runs that no live execution backs any more. */
    workerExecutionsOfMember(memberId: AgentTeamMemberId): readonly AgentTeamWorkerExecution[];
    /**
     * Every Worker run bound to one Thread with the durable state each ended in.
     * It reads the execution records, not the facts: a read answers for a window of
     * a long Thread, and a run whose facts fall outside it still stands as recorded.
     * `running` here means a start with no ending, which is what a restart finds.
     */
    threadWorkerStates(threadRef: AgentTeamThreadRef): readonly Pick<AgentTeamWorkerStateView, 'state' | 'workerRef'>[];
    /**
     * What a delegation target names, for the Host to bind and authorize before it
     * writes or starts anything. Existence only: the start write re-derives the
     * binding, so a target that changed in between is refused, not misrecorded.
     */
    delegationTarget(request: {
        readonly projectRef?: AgentTeamProjectRef | undefined;
        readonly threadRef?: AgentTeamThreadRef | undefined;
        readonly taskRef?: AgentTeamTaskRef | undefined;
    }): AgentTeamDelegationTarget;
    /**
     * What one Worker run handed back, for the Member who delegated it or the Human:
     * the only reader of a record's private half, which never projects into a Thread.
     */
    workerAnswerFor(memberId: AgentTeamMemberId, workerRef: AgentTeamWorkerRef): AgentTeamWorkerAnswer | undefined;
    /** The public fact a run's start contributes to its Thread, or nothing on a Project-only run. */
    private workerStartedActivityFor;
    /** The public fact a run's ending contributes to its Thread; the reason is what a participant needs and the answer never is. */
    private workerSettledActivityFor;
    /** A run's target exists, belongs to the Project it names, and its Thread and Task agree about each other. */
    private assertWorkerBindingFrom;
    /**
     * A continued execution keeps the source execution's attribution while adding
     * one new Team execution. The native session must already be anchored, every
     * fixed binding must match, and no execution in that native conversation may
     * still be running. The ledger is the concurrency authority, not the live map.
     */
    private assertWorkerContinuationFrom;
    /** Resolve a chain's native session from the terminal predecessor that recorded it. */
    private workerNativeSessionFrom;
    /** Every complete native-record anchor in a continuation chain, direct predecessor first. */
    private workerResumeAnchorsFrom;
    /** A resumed execution may settle only against the native conversation its chain started with. */
    private assertWorkerSettlementFrom;
    /**
     * Validate an admission against the receiving execution. A live steer names
     * an execution the ledger already holds; a continuation admission may name a
     * not-yet-recorded execution and therefore proves its ownership through the
     * source it resumes.
     */
    private workerSteerReceivingExecution;
    /** Resolve and validate the canonical request an alias joins. */
    private workerSteerAliasTarget;
    private workerSteerCanonicalAdmissionsFor;
    private workerSteerAdmissionOf;
    private workerSteerOutcomeOfOperation;
    private freezeWorkerSteerOutcome;
    private assertWorkerSteerOutcome;
    private assertSameWorkerSteerAdmission;
    private workerStartedRecorded;
    private workerSettledRecorded;
    private assertSameWorkerStart;
    private assertSameWorkerSettle;
    /** Every subscription, deleted ones included: a ref stays resolvable after the terminal state. */
    subscriptions(): readonly AgentTeamSubscription[];
    /** One Project's subscriptions in creation order. */
    subscriptionsOfProject(projectRef: AgentTeamProjectRef): readonly AgentTeamSubscription[];
    subscription(subscriptionRef: AgentTeamSubscriptionRef): AgentTeamSubscription | undefined;
    subscriptionResumeSequence(subscriptionRef: AgentTeamSubscriptionRef): number;
    /**
     * The subscription a posted token's address names, or `undefined`: a reset, a dropped
     * trigger or a deletion leave the old token naming nothing. The scan is constant-time
     * over every armed subscription and not a hash index, so the search tells nothing.
     */
    subscriptionByWebhookToken(token: string): AgentTeamSubscription | undefined;
    /** The ids one subscription must never publish again: its baseline plus everything it accepted. */
    subscriptionKnownIds(subscriptionRef: AgentTeamSubscriptionRef): ReadonlySet<string>;
    /** Accepted events still waiting for publication, oldest first — the queue a publisher drains. */
    pendingSubscriptionEvents(subscriptionRef: AgentTeamSubscriptionRef): readonly AgentTeamSubscriptionEventAccepted[];
    /** Every accepted event of one subscription in accept order, published ones included. */
    subscriptionEvents(subscriptionRef: AgentTeamSubscriptionRef): readonly AgentTeamSubscriptionEventAccepted[];
    /** Durable creation of one subscription, with the ids its trial run asked to ignore. */
    createSubscription(request: AgentTeamAuthorizedCreateSubscriptionRequest, requestIntent?: AgentTeamCreateSubscriptionRequestIntent): Promise<AgentTeamLedgerResult<AgentTeamSubscriptionChangeResult>>;
    /** Replace the editable parts of one subscription; every edit is a new revision. */
    updateSubscription(request: AgentTeamAuthorizedUpdateSubscriptionRequest, requestIntent?: AgentTeamSubscriptionRequestIntent): Promise<AgentTeamLedgerResult<AgentTeamSubscriptionChangeResult>>;
    pauseSubscription(request: AgentTeamAuthorizedPauseSubscriptionRequest): Promise<AgentTeamLedgerResult<AgentTeamSubscriptionChangeResult>>;
    resumeSubscription(request: AgentTeamAuthorizedSubscriptionStateRequest): Promise<AgentTeamLedgerResult<AgentTeamSubscriptionChangeResult>>;
    deleteSubscription(request: AgentTeamAuthorizedSubscriptionStateRequest): Promise<AgentTeamLedgerResult<AgentTeamSubscriptionChangeResult>>;
    /**
     * Replace one subscription's webhook address. Like pause it is a state transition, so
     * the revision does not move: accepted deliveries keep their version and only the old
     * address stops resolving. The new token is returned once, never stored in the clear.
     */
    resetSubscriptionWebhook(request: AgentTeamAuthorizedSubscriptionStateRequest): Promise<AgentTeamLedgerResult<AgentTeamSubscriptionChangeResult>>;
    /** Append ids to the deduplication waterline; nothing already recorded is removed. */
    baselineSubscription(request: AgentTeamAuthorizedBaselineSubscriptionRequest): Promise<AgentTeamLedgerResult<AgentTeamOperationReceipt>>;
    /**
     * Accept one run's validated output as durable facts. Deduplication and the
     * backlog ceiling are rechecked here, against the projection rather than the
     * caller's view: two runs that finish together must not both cross 500.
     */
    acceptSubscriptionEvents(request: AgentTeamAcceptSubscriptionEventsRequest): Promise<AgentTeamLedgerResult<AgentTeamSubscriptionAcceptResult>>;
    /**
     * Publish one accepted event. The recipients are frozen here, at the publish
     * commit: the subscription's own `notify` set, minus anyone who has left the
     * Project since. Ownership never substitutes for it — an event is addressed
     * intelligence, so a subscription whose recipients are all gone reaches nobody.
     */
    publishSubscriptionEvent(request: AgentTeamPublishSubscriptionEventRequest): Promise<AgentTeamLedgerResult<AgentTeamSubscriptionPublishResult>>;
    /** Commit one non-deleting lifecycle transition with its Main stream line. */
    private commitSubscriptionState;
    private subscriptionActivity;
    private activeProject;
    /**
     * Resolve one subscription its caller may edit: same Project, not deleted,
     * and the caller owns that Project. Only the Host's own automatic pause may
     * act without an owner behind it.
     */
    private ownedSubscription;
    /**
     * The prior subscription as a write may store it again. Every lifecycle
     * record copies the whole subscription forward, and replay requires each
     * stored recipient to belong to the Project at its own commit, so an address
     * that can no longer receive is dropped here — at the write, never tolerated
     * in validation, which would let a real corruption through with it.
     */
    private subscriptionCarriedForward;
    private subscriptionStaleRevision;
    private actorMemberOf;
    /**
     * The webhook arm a write leaves behind. Enabling mints a token the caller receives
     * once; an edit that keeps the trigger keeps the address, so only a reset or dropping
     * the trigger moves it. `generation` counts addresses armed under this trigger, so two
     * resets stay distinguishable without either token.
     */
    private armedWebhook;
    private subscriptionChangeOf;
    private subscriptionAcceptOf;
    private subscriptionPublishOf;
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
    subscriptionWriteReplay(request: AgentTeamAuthorizedSubscriptionWrite | AgentTeamSubscriptionWriteReplayRequest): AgentTeamSubscriptionWriteReplay | undefined;
    private assertSameSubscriptionReplay;
    /**
     * Whether a retry asks for the recipients the committed write stored. An
     * omitted set asks for nothing of its own — on a create that is the
     * Creating Member, on an update the set already stored — so it can never
     * contradict the first answer.
     */
    private sameAskedNotify;
    private createSubscriptionRequestIntent;
    private updateSubscriptionRequestIntent;
    /** Old creates carry no source or baseline intent; compare every fact their operation did retain. */
    private sameLegacyCreateReplay;
    /** Old updates lack the caller's omitted-or-explicit trigger intent, so compare the effects they did record. */
    private sameLegacyUpdateReplay;
    private subscriptionWriteArmedAddress;
    private assertSameSubscriptionWrite;
    /** The per-kind payload comparison behind {@link assertSameSubscriptionWrite}. */
    private sameSubscriptionRequest;
    /** Every reminder one Member owns, newest creation first, with the occurrence facts a surface renders. */
    memberRemindersOf(memberId: AgentTeamMemberId): readonly AgentTeamMemberReminderView[];
    private memberRemindersOfFrom;
    /** Active reminders one Member carries; the create ceiling compares against this. */
    activeMemberReminderCount(memberId: AgentTeamMemberId): number;
    private activeMemberReminderCountFrom;
    /** Unconsumed occurrences of one Member's reminders: the private Inbox unread that wakes them. */
    unreadMemberRemindersFor(memberId: AgentTeamMemberId): readonly AgentTeamUnreadMemberReminder[];
    /** A Member's own reminders, as the tool renders them. */
    memberReminderList(memberId: AgentTeamMemberId): readonly AgentTeamMemberReminderView[];
    /**
     * A Member creates a reminder for itself. The schedule and note are validated
     * here rather than at the caller so one authority decides what is committable,
     * and the per-Member ceiling counts the reminders that are still active.
     */
    createMemberReminder(request: AgentTeamMemberReminderCreateRequest): Promise<AgentTeamLedgerResult<AgentTeamMemberReminderCreateResult>>;
    /**
     * Withdraw one reminder. The Member that owns it withdraws its own; the Human
     * may withdraw any, because the Human sees them in Member detail.
     */
    cancelMemberReminder(request: AgentTeamMemberReminderCancelRequest): Promise<AgentTeamLedgerResult<AgentTeamMemberReminderCancelResult>>;
    /** Every active reminder as the planner sees it: durable facts plus the Member lifecycle that still governs it. */
    private memberReminderPlanEntries;
    /** Occurrences due now, at most one per reminder. */
    planMemberReminders(nowMs: number): readonly MemberReminderCandidate[];
    /** The instant the Host must next wake for, or undefined while nothing is pending. */
    nextMemberReminderWakeAt(nowMs: number): number | undefined;
    /**
     * Raise one occurrence. Replanned first, exactly as a Task reminder is, so a
     * baseline that moved while the write waited is not committed.
     */
    raiseMemberReminder(candidate: MemberReminderCandidate): Promise<AgentTeamOperationReceipt | undefined>;
    /**
     * Record that these occurrences reached their Member's context, consuming
     * their markers. Consumption is by occurrence identity, not by reminder: a
     * notice that named an older occurrence must not consume the newer one that
     * replaced it while the notice waited unread. A Host that restarts before this
     * write leaves the markers unconsumed, so the next wake redelivers the same
     * occurrence: at least once.
     */
    consumeMemberReminders(memberId: AgentTeamMemberId, occurrences: readonly AgentTeamMemberReminderOccurrenceRef[]): Promise<readonly AgentTeamOperationReceipt[]>;
    /**
     * Sync the runtime human display name from Host settings. Never persisted:
     * a rename affects only later @ resolutions and handle checks.
     */
    setHumanDisplayHandle(handle: string): void;
    initialize(request?: AgentTeamInitializeRequest): Promise<AgentTeamLedgerResult<AgentTeamOperationReceipt>>;
    /**
     * Append the marker for a rules version this build implements but the ledger has not adopted.
     * It runs inside initialize's queued task, so it precedes every later write — startup recovery's included.
     */
    private adoptRulesVersion;
    createProject(request: AgentTeamAuthorizedCreateProjectRequest): Promise<AgentTeamLedgerResult<AgentTeamCreateProjectResult>>;
    /** Human rename of one Project's display facts; identity refs are immutable. */
    updateProject(request: AgentTeamAuthorizedUpdateProjectRequest): Promise<AgentTeamLedgerResult<AgentTeamUpdateProjectResult>>;
    addProjectOwner(request: AgentTeamAuthorizedProjectOwnerRequest): Promise<AgentTeamLedgerResult<AgentTeamProjectOwnerResult>>;
    removeProjectOwner(request: AgentTeamAuthorizedProjectOwnerRequest): Promise<AgentTeamLedgerResult<AgentTeamProjectOwnerResult>>;
    private changeProjectOwner;
    /** The one owner-change rule, judged against the live projection on write and the replay projection on load. */
    private projectOwnerChangeProblem;
    addMember(request: AgentTeamAuthorizedAddMemberRequest): Promise<AgentTeamLedgerResult<AgentTeamDurableMemberResult>>;
    /** Human edit of one Member's mutable facts; identity, preset, and lifecycle state are preserved. */
    updateMember(request: AgentTeamAuthorizedUpdateMemberRequest): Promise<AgentTeamLedgerResult<AgentTeamDurableMemberResult>>;
    suspendMember(request: AgentTeamAuthorizedSetMemberStateRequest): Promise<AgentTeamLedgerResult<AgentTeamDurableMemberResult>>;
    resumeMember(request: AgentTeamAuthorizedSetMemberStateRequest): Promise<AgentTeamLedgerResult<AgentTeamDurableMemberResult>>;
    /** Move one enabled Member from a cold generation onto a fresh Session. */
    recycleMemberSession(request: AgentTeamAuthorizedRecycleMemberSessionRequest): Promise<AgentTeamLedgerResult<AgentTeamDurableMemberResult>>;
    getMember(memberId: AgentTeamMemberId): AgentTeamAgentMember | undefined;
    /**
     * The retired Session this Member most recently left through a swap — the
     * lineage parent a crash between the durable binding commit and the new
     * Session's activation recreates the successor from. Read from the audit
     * projection; the Member record itself only names the current Session.
     */
    previousSessionForMember(memberId: AgentTeamMemberId): SessionId | undefined;
    /**
     * The latest session transition this Member committed: the retired Session
     * and the target it moved onto. Crash recovery binds carried-input
     * redelivery to the recorded target — the CURRENT Session being that target
     * proves the old generation's unconsumed input still belongs here.
     */
    lastTransitionForMember(memberId: AgentTeamMemberId): {
        readonly previousSessionId: SessionId;
        readonly targetSessionId: SessionId;
        readonly inputFromSeq?: SessionLogOffset;
    } | undefined;
    listMembers(): readonly AgentTeamAgentMember[];
    /**
     * Join one Agent Member to one additional Workspace. Participation is a
     * pure relation — no Session is created or moved; the Member's Session
     * stays rooted in its default Workspace and collaboration in the joined
     * Workspace is ledger work addressed by the workspaceId.
     */
    joinWorkspace(request: AgentTeamAuthorizedJoinWorkspaceRequest): Promise<AgentTeamLedgerResult<AgentTeamJoinWorkspaceResult>>;
    /**
     * Withdraw one Agent Member from one of its non-default Workspaces. The
     * default Workspace cannot be left — ending it is the archive path. Every
     * active Claim the Member holds on the Workspace's Threads releases with
     * public Activities, its Attention and markers on those Threads clear, and
     * its Project memberships there end; identity, Session, and remaining
     * participations are untouched.
     */
    leaveWorkspace(request: AgentTeamAuthorizedLeaveWorkspaceRequest): Promise<AgentTeamLedgerResult<AgentTeamLeaveWorkspaceResult>>;
    /**
     * Archive one Project: hidden from every surface, facts kept recoverable.
     * Every active Claim on the Project's Threads releases with one public
     * Activity per (owner, Thread), and every Member's Attention and markers
     * for those Threads clear — a hidden Project must not leave Tasks stuck in
     * progress behind it or phantom unread counts.
     */
    archiveProject(request: AgentTeamAuthorizedArchiveProjectRequest): Promise<AgentTeamLedgerResult<AgentTeamArchiveProjectResult>>;
    reply(request: AgentTeamAuthorizedReplyRequest): Promise<AgentTeamLedgerResult<AgentTeamReplyResult>>;
    /**
     * Post one Main stream Message: the Project-level conversation outside every Thread. Any Project member may write; a
     * writer holding Main stream unread (an owner's ordinary unread, or any Member's markers) reads first.
     */
    postMainMessage(request: AgentTeamAuthorizedPostMainMessageRequest): Promise<AgentTeamLedgerResult<AgentTeamPostMainMessageResult>>;
    /**
     * Acknowledge the Main stream through one sequence (default the head): an owner's watermark advances and the reader's
     * markers up to it are consumed. A read that changes neither writes nothing, like a Thread read.
     */
    readMainStream(request: AgentTeamAuthorizedMainStreamReadRequest, select?: (preview: AgentTeamMainStreamReadResult) => number): Promise<AgentTeamLedgerResult<AgentTeamMainStreamReadResult>>;
    /**
     * Answer what a Main stream read would return right now without committing
     * or acknowledging anything: the same page, consumed markers and post-read
     * standing the read would produce.
     */
    previewMainStreamRead(request: AgentTeamAuthorizedMainStreamReadRequest): AgentTeamMainStreamReadResult;
    /**
     * The bound one Main stream read acknowledges, and the delta committing it
     * would write. An explicit bound wins; without one the read acknowledges only
     * the first page of unread, so a backlog is read page by page, never skipped.
     * `hasBacklog` distinguishes a bound already chosen from one still defaulted.
     */
    private planMainRead;
    /** Start a discussion or Task Thread: a Project owner's act. Mentions deliver a direct marker only; the creator alone follows. */
    startThread(request: AgentTeamAuthorizedStartThreadRequest): Promise<AgentTeamLedgerResult<AgentTeamStartThreadResult>>;
    /** One page of a Project's Main stream, oldest first, with the reader's own standing. Never writes. */
    mainStreamHistory(actor: AgentTeamHumanActor | AgentTeamMemberActor, request: AgentTeamMainStreamHistoryRequest): AgentTeamMainStreamHistory;
    /** One Member's unread Main stream entries, per Project, for the Host's wake: an owner's ordinary unread and every reader's markers. */
    mainNotificationFacts(memberId: AgentTeamMemberId): readonly {
        readonly project: AgentTeamProject;
        readonly entries: readonly AgentTeamMainTimelineEntry[];
    }[];
    promoteThread(request: AgentTeamAuthorizedPromoteThreadRequest): Promise<AgentTeamLedgerResult<AgentTeamPromoteThreadResult>>;
    changeClaim(request: AgentTeamAuthorizedClaimRequest): Promise<AgentTeamLedgerResult<AgentTeamClaimResult>>;
    transferTask(request: AgentTeamAuthorizedTransferTaskRequest): Promise<AgentTeamLedgerResult<AgentTeamTransferTaskResult>>;
    changeTask(request: AgentTeamAuthorizedTaskRequest): Promise<AgentTeamLedgerResult<AgentTeamTaskResult>>;
    removeMember(request: AgentTeamAuthorizedRemoveMemberRequest): Promise<AgentTeamLedgerResult<AgentTeamRemoveMemberResult>>;
    /**
     * Archive one Member: hidden from every surface, data kept recoverable.
     * The release shape matches removal — active Claims release with public
     * Activities and the Member's Attention/markers clear — because a hidden
     * Member must not leave Tasks stuck in progress or phantom unread counts.
     */
    archiveMember(request: AgentTeamAuthorizedArchiveMemberRequest): Promise<AgentTeamLedgerResult<AgentTeamArchiveMemberResult>>;
    changeAttention(request: AgentTeamAuthorizedThreadAttentionRequest): Promise<AgentTeamLedgerResult<AgentTeamThreadAttentionResult | AgentTeamMainAttentionResult>>;
    /**
     * Follow or unfollow one Project's Main stream. Same shape as a Thread's
     * Attention: absent means the ordinary updates never reach this Member, present
     * means they do, and direct markers and responsibility Activities are untouched
     * either way. The Human's own row is derived, so the write is a no-op for them.
     */
    private writeMainAttention;
    /**
     * Append one Member-to-Member direct message as an audit-only operation.
     * A DM is pure delivery: no Project, Thread, revision, attention, or
     * markers change, so apply() is a marker and no projection state moves.
     */
    sendDm(request: AgentTeamAuthorizedDmRequest): Promise<AgentTeamLedgerResult<AgentTeamDmResult>>;
    /**
     * Bounded adjacent context for a DM relay: the truncated body of the most
     * recent earlier DM between the two sessions, newest first. Returns
     * undefined when this is their first exchange. `excluding` skips the
     * operation id of the DM being delivered right now, so the context line is
     * the adjacent prior exchange rather than a self-reference. Direction
     * labels are from the reader's perspective: the reader is the recipient of
     * the DM being delivered, so messages the reader sent are `you → them`.
     */
    dmHistoryBetween(senderSessionId: SessionId, recipientMemberId: AgentTeamMemberId, excluding?: AgentTeamOperationId): string | undefined;
    attentionStatus(actor: AgentTeamHumanActor | AgentTeamMemberActor, request: {
        workspaceId: WorkspaceId;
        threadRef?: AgentTeamThreadRef | undefined;
        taskRef?: AgentTeamTaskRef | undefined;
    }): AgentTeamThreadAttentionStatus;
    /** The reader's own Main stream Attention on one Project, answered without writing. */
    mainAttentionStatus(actor: AgentTeamHumanActor | AgentTeamMemberActor, request: {
        workspaceId: WorkspaceId;
        projectRef: AgentTeamProjectRef;
    }): AgentTeamMainAttentionStatus;
    inbox(actor: AgentTeamHumanActor | AgentTeamMemberActor, request: AgentTeamInboxRequest): AgentTeamInbox;
    memberInbox(actor: AgentTeamMemberActor, request: {
        readonly limit?: number;
    }): AgentTeamInbox;
    private inboxForWorkspaces;
    taskBoard(actor: AgentTeamHumanActor | AgentTeamMemberActor, request: AgentTeamTaskBoardRequest): AgentTeamTaskBoard;
    memberTaskBoard(actor: AgentTeamMemberActor, request: Omit<AgentTeamTaskBoardRequest, 'workspaceId'>): AgentTeamTaskBoard;
    private taskBoardFor;
    private mainInboxItems;
    private inboxActorFor;
    /**
     * One Member as a row draws them: the id carries the identity hue, the handle
     * the initial. The Human is the one Member the Agent roster never holds, so
     * their row reads the runtime display name rather than falling back to the
     * durable `member:human` id — the same name every other seat and @ matching
     * already use.
     */
    private memberActor;
    /**
     * The people a Task still has on it, resolved the way a row draws them: owners
     * of its live Claims, in claim order, deduped. A released Claim is not work,
     * and a done or closed Task keeps its Claims as history rather than as
     * presence — deliberately the same rule the Project feed applies to the same
     * Task, so 「谁在这个 Task 上」 never acquires a second definition.
     */
    private liveClaimOwners;
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
    private recentInboxItems;
    /**
     * Threads that can hold unread facts for one reader, from the per-reader
     * derived indexes: Attention follows plus direct and activity markers.
     * Every unread source is covered — ordinary unread requires Attention, and
     * marker unread requires a marker — so no full Thread scan is needed.
     */
    private inboxCandidateThreads;
    /** Model-visible notification material derived from the recipient's current durable unread state. */
    notificationFacts(memberId: AgentTeamMemberId, request?: AgentTeamInboxRequest): readonly {
        readonly item: AgentTeamInboxItem;
        readonly facts: readonly AgentTeamThreadReadFact[];
        readonly reminders: readonly import('./types/requests-results.ts').AgentTeamInboxReminder[];
    }[];
    /**
     * Thread, Main and Member-reminder notification material share one bounded
     * read set for one delivery attempt. A Member reminder is the third unread
     * source: it belongs to no Thread, so it rides the same private notice.
     */
    notificationSnapshot(memberId: AgentTeamMemberId): {
        readonly threads: ReturnType<AgentTeamLedger['notificationFacts']>;
        readonly main: ReturnType<AgentTeamLedger['mainNotificationFacts']>;
        readonly memberReminders: readonly AgentTeamUnreadMemberReminder[];
        readonly workers: readonly AgentTeamWorkerAnswer[];
    };
    private withNotificationReadSet;
    private mainUnreadForNotification;
    /**
     * Answer what a read would return right now without committing or
     * acknowledging anything. The Host uses this to see the bounded batch it can
     * deliver before deciding which prefix it actually did deliver.
     */
    previewThreadRead(request: AgentTeamAuthorizedThreadReadRequest): AgentTeamThreadReadResult;
    readThread(request: AgentTeamAuthorizedThreadReadRequest, select?: (preview: AgentTeamThreadReadResult) => number): Promise<AgentTeamThreadReadOutcome>;
    threadObservations(actor: AgentTeamHumanActor, request: AgentTeamThreadObservationsRequest): AgentTeamThreadObservations;
    /** Every operation carrying an inbox delta drives the Inbox projection; the payload shape decides, not a per-kind list. */
    private attentionDelta;
    /** Attachment ids referenced by any stored Message — the GC's keep-set oracle. */
    referencedAttachmentIds(): Set<AgentTeamAttachmentId>;
    threadHistory(actor: AgentTeamHumanActor | AgentTeamMemberActor, request: AgentTeamThreadHistoryRequest): AgentTeamThreadHistory;
    /**
     * The Tasks this discussion spawned, as the cards the Thread renders at their creation points. Each card is the Main
     * stream's own `mainThreadCard` projection of the Task's Thread, so the two faces cannot drift apart.
     */
    private derivedTaskCards;
    listClaims(actor: AgentTeamHumanActor | AgentTeamMemberActor, request: {
        workspaceId: WorkspaceId;
        taskRef: AgentTeamTaskRef;
    }): AgentTeamClaimList;
    getTask(taskRef: AgentTeamTaskRef): AgentTeamTask | undefined;
    getClaim(claimRef: AgentTeamClaimRef): AgentTeamClaim | undefined;
    /** Navigation facts for message-body Thread refs; unknown refs are omitted. */
    resolveThreadRefs(workspaceId: WorkspaceId, threadRefs: readonly AgentTeamThreadRef[]): AgentTeamResolvedThreadRef[];
    /**
     * Context for Messages cited by `replyToMessageRef`; unknown refs are omitted.
     *
     * A reply stores only its parent's identity, so the author and the excerpt a
     * quote block renders are derived here from the recorded Message. Resolving
     * through the ledger rather than the reader's loaded window is what lets a
     * quote survive history paging — the parent may be far outside the facts the
     * reader currently holds.
     */
    resolveMessageRefs(workspaceId: WorkspaceId, messageRefs: readonly AgentTeamMessageRef[]): AgentTeamResolvedMessageRef[];
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
    readMessage(actor: AgentTeamHumanActor | AgentTeamMemberActor, request: AgentTeamReadMessageRequest): AgentTeamReadMessageResult;
    /** A Main stream Message read back whole; the Main stream itself is the authorization. */
    private readMainMessage;
    /** Navigation facts for message-body Task refs; unknown refs are omitted. */
    resolveTaskRefs(workspaceId: WorkspaceId, taskRefs: readonly AgentTeamTaskRef[]): AgentTeamResolvedTaskRef[];
    view(request: AgentTeamViewRequest, memberId?: AgentTeamMemberId): AgentTeamView;
    status(): AgentTeamStatus;
    getProject(projectRef: AgentTeamProjectRef): AgentTeamProject | undefined;
    /**
     * Whether this actor may change a Project's subscriptions. A trial run makes
     * no durable change, so the Host checks the same authority here that a write
     * would enforce, instead of learning a caller was not an owner only after the
     * script has already run.
     */
    assertSubscriptionAuthority(actor: AgentTeamActor, projectRef: AgentTeamProjectRef, workspaceId: WorkspaceId): void;
    /** Workspace members may discover subscription metadata; scripts, credential references, webhook arms and logs stay Project-gated. */
    assertSubscriptionMetadataAuthority(actor: AgentTeamActor, projectRef: AgentTeamProjectRef, workspaceId: WorkspaceId): void;
    /** Full subscription reads remain Project facts: run logs and the Human Client's script-bearing list. */
    assertSubscriptionReadAuthority(actor: AgentTeamActor, projectRef: AgentTeamProjectRef, workspaceId: WorkspaceId): void;
    /** Whether one Project exists at all; a delegation may not guess one from a directory or a page. */
    hasProject(projectRef: AgentTeamProjectRef): boolean;
    /** Agent owners of one Project, sorted. The Human owns every Project and is not listed. */
    projectOwnerIds(projectRef: AgentTeamProjectRef): readonly AgentTeamMemberId[];
    /**
     * One subscription's event recipients as a create or update states them. The
     * Human is a member of every Project even though ownership is derived rather
     * than listed; anyone else must still belong to it. Deduplicated and sorted,
     * so the stored set has exactly one order to compare.
     */
    private subscriptionNotifyOf;
    /**
     * Why a proposed recipient set cannot be stored, if it cannot. The Host asks
     * before its trial run, so a typo costs a rejected form rather than a script
     * execution.
     */
    subscriptionNotifyProblem(projectRef: AgentTeamProjectRef, notify: readonly AgentTeamMemberId[] | undefined): string | undefined;
    /** Whether one addressed recipient can still receive: the Human always, a Member only while it belongs to the Project. */
    private notifyRecipientIsLive;
    /** The same predicate over a replay projection, so validation judges each segment at its own point in the ledger. */
    private notifyRecipientLiveFrom;
    /**
     * A stored subscription as the projection should hold it. Records written
     * before events were addressed carry no `notify`; they read back as the
     * Creating Member alone, so replay of an old ledger never routes an event to
     * someone the subscription never named.
     */
    private subscriptionWithNotify;
    /** Active Projects the Agent Member owns, in creation order. */
    ownedProjects(memberId: AgentTeamMemberId): readonly AgentTeamProject[];
    validate(): void;
    validateAtMount(): void;
    hasCommitted(requestId: AgentTeamRequestId): boolean;
    /**
     * The operation one request id already committed, if any. It is the durable
     * record of that request: a caller whose own bookkeeping failed after the
     * commit reads the answer back from here instead of repeating the work.
     */
    committedOperation(requestId: AgentTeamRequestId): AgentTeamOperation | undefined;
    /** Return one stored committed operation by id. */
    getOperation(operationId: AgentTeamOperationId): AgentTeamOperation | undefined;
    private withReleasedActivityScopes;
    /** One workspace change scope per Workspace the Member participates in — member-level commits wake every panel that lists it. */
    private memberWorkspaceScopes;
    /**
     * Durable position of the newest shared-projection commit: the version every
     * change waiter outside the presence scope observes. It only moves when a
     * commit has scopes somebody could refetch (`changeScopesOf`), never for
     * private read progress or an audit-only record.
     */
    projectionSequence(): number;
    /** Scopes whose projections one committed operation invalidates; undefined wakes every waiter. */
    changeScopesOf(operation: AgentTeamOperation): readonly AgentTeamChangeScope[] | undefined;
    /** Members whose Inbox projection may have changed; the Host notifies only live ones. */
    affectedMembersOf(operation: AgentTeamOperation): readonly AgentTeamMemberId[];
    private touchedThreadRefs;
    private replay;
    private validateRecords;
    private validateOperation;
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
    private validateInboxDelta;
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
    private validateReleaseCleanup;
    /**
     * Inbox deltas minted by a departure carry the freshly generated activity
     * refs of its transfer Activities, so replay compares business fields and
     * matches each such marker's ref against the transfer recorded beside it.
     */
    private sameInboxDelta;
    private accountabilityReturnsForCleanup;
    /**
     * Every Member that owes a Task inside a scope nothing will be left to hand it to: a Project being archived, or a
     * Member leaving. Version 2 ranged over owner grants, which cannot see a Task handed to a plain member; version 3
     * ranges over the Tasks themselves.
     */
    private accountableMembersInScopeFrom;
    private validateAccountabilityReturns;
    /**
     * Replay validation of one subscription record. Every judgement re-derives
     * what the commit path derived: the Project state, the owner standing, the
     * definition rules, the revision arithmetic, the deduplication waterline, and
     * the frozen recipient markers of a publication.
     */
    private validateSubscriptionOperation;
    private validateMessageInbox;
    private validateMentions;
    private validMentionTarget;
    /**
     * Apply one committed operation to the live projection, then advance the
     * version shared-projection consumers compare against — but only when the
     * operation invalidated a scope somebody could refetch. Private read progress
     * and audit-only records (`changeScopesOf` derives no scope for them) leave it
     * where it was, so one Member's Thread read cannot make a parked Client
     * believe that something it watches changed.
     */
    private applyAndAdvanceProjectionVersion;
    private applyTo;
    /**
     * Replay the departure snapshot a releasing operation carries. The listed
     * order is replay semantics: an Activity references a Claim, and the inbox
     * delta reads the Tasks and Threads. Each caller still applies its own
     * identifying writes (member, membership, project) around this call.
     */
    private applyReleaseSnapshot;
    private applyReleasedClaims;
    private applyReleasedActivities;
    private applyReleasedTargets;
    private applyReleasedInbox;
    /** Facts arrive in ledger sequence order, so global and per-thread lists stay sorted by append only. */
    private appendMessageFact;
    private appendActivityFact;
    /** Display ordinals are a per-Project creation counter; the workspace filter happens at read time. */
    private recordTaskNumber;
    /** One shared bucket for a Task's Claims, created on first write. */
    private claimBucketFor;
    /**
     * Write one Claim into the projection and its Task bucket, keeping the
     * position a Claim already holds: read projections paginate by bucket order,
     * so an update must not move its Claim to the end.
     */
    private upsertClaimKeepingPosition;
    /**
     * Replay-order Attention observations, appended from committed Inbox deltas
     * only (the hypothetical read projection applies its delta directly).
     *
     * Removals are evaluated before sets, exactly like the scan's loop order. A
     * removal records only when Attention existed, and a set records unless it is
     * the Thread-creating Message (initial Attention) or merely advances the same
     * follow's watermark.
     */
    private recordAttentionObservations;
    /** Append one `unfollow` per removal that had Attention to end; returns the keys that ended. */
    private recordUnfollowObservations;
    /** Append one `follow` for each set that starts a new Attention rather than restating an existing one. */
    private recordFollowObservations;
    private appendObservation;
    private applyInboxDelta;
    /** Structured mentions per Message, and the Project-wide set that feeds rules-version-2 membership. */
    private recordMentions;
    private recordNamed;
    private recordTaskSnapshot;
    private appendMainSource;
    private appendMainActivity;
    /** Departure ends every Main stream Attention this Member holds, as it ends its Thread Attention. */
    private dropMainAttention;
    /** Insert into the Member's Thread bucket keeping the sequence order the read path must see. */
    private insertBucketedMarker;
    private removeBucketedMarker;
    private prepareRead;
    /**
     * The Thread's head: the sequence of its last public fact. Every fact an
     * unread batch can carry sits at or below it, which is what makes it the
     * bound a confirmation may reach. It is deliberately not `thread.revision`:
     * that number fences Thread writes and moves only with the operations that
     * revise Thread state, so a fact that revises none — a bound Worker run's
     * start or ending — legitimately sits past it.
     */
    private threadHeadFrom;
    /** Validate one Host-selected confirmation bound against the Thread it targets. */
    private threadReadSelection;
    /**
     * Derive the durable receipt of one Thread read from a prior projection: the
     * Thread it targeted, the watermark it reaches, the Attention row it writes
     * and the Inbox delta it consumes. This is the whole durable content of a
     * receipt-shaped read and the only thing `validateRecords` re-derives for
     * one; the picture derivation below builds on the same result, so the two can
     * never drift.
     */
    private prepareReadReceiptFrom;
    /** Derive the only legal durable result of one Thread read from a prior projection. */
    private prepareReadFrom;
    private readFactFrom;
    private unreadFor;
    private unreadForFrom;
    /**
     * The single authority on "this fact is unread for this reader". The picture
     * derivation and the remaining-count derivation both go through it, so the
     * count a read reports can never disagree with the facts it lists. Marker
     * membership arrives as key sets: the caller may be looking at a state the
     * projection has not applied yet.
     */
    private isUnreadFact;
    /**
     * Unread count once this read's own Inbox delta has been applied, derived
     * without materializing a hypothetical projection. The delta can only touch
     * the reader's own Attention row and its own marker keys in one Thread, and
     * every lookup in `isUnreadFact` is scoped to that same (member, Thread)
     * pair, so the post-delta state is the Attention row the receipt already
     * derived plus those marker keys with the delta's own removals and additions
     * applied.
     */
    private remainingUnreadAfter;
    private visibleToFollower;
    private threadFacts;
    private threadFactsFrom;
    /**
     * Check a receipt against its own independent derivation: the progress it
     * claims and the Inbox delta it consumed, nothing else. The picture and the
     * unread count left behind are projection state a replay re-derives for the
     * surfaces that need them, not content of this record. The Task ref is
     * derived rather than copied back, so a Task Thread read cannot drop the Task
     * it belongs to and shrink its own claim unchecked.
     */
    private validateThreadReadReceipt;
    /**
     * Check a pre-receipt snapshot against the same derivation that wrote it. That
     * shape is frozen: a field added to a read afterwards, like the orientation
     * count, is deliberately not compared, because no stored record carries it and
     * expecting one would reject every ledger written before the field existed.
     */
    private validateLegacyThreadReadSnapshot;
    private occurredAtForFactFrom;
    private messageInboxDelta;
    private closeThreadInbox;
    private closeThreadInboxFrom;
    private withReminderCleanup;
    /**
     * Acceptance notifies every done Claim owner, pre-finished (the normal
     * flow) and atomically completed (early acceptance) alike, through activity
     * markers regardless of whether they still follow the Thread. The actor
     * never notifies itself. Legacy records without the acceptance
     * discriminator keep completed-only wake semantics on replay.
     */
    private acceptThreadInbox;
    private acceptThreadInboxFrom;
    private reopenThreadInbox;
    private reopenThreadInboxFrom;
    private promoteThreadInbox;
    private promoteThreadInboxFrom;
    /** `projectRefs` scopes the Main stream markers a departure clears; undefined means every Project. */
    private removeMemberThreadInbox;
    private removeMemberThreadInboxFrom;
    /** Live Main stream markers a departure clears, in sequence order so write and replay derive the same list. */
    private mainMarkersToClear;
    /** Attention and marker cleanup for EVERY Member on the given Threads. */
    private projectArchivalInbox;
    private projectArchivalInboxFrom;
    private inboxDelta;
    /** A delta that moves only Member reminder markers; every other family stays untouched. */
    private memberReminderInboxDelta;
    /** A Thread Attention period starting at `startSequence`, established by `source`. */
    private startAttention;
    /** A Thread Attention period starting after everything the Thread holds now, so it inherits no backlog. */
    private followAttention;
    private followAttentionFrom;
    private currentTail;
    /**
     * A Main stream Attention period anchored at `sequence`: the reader saw
     * everything before it and nothing after. An explicit follow anchors at the
     * stream's current tail, so a new follower inherits no backlog; an ownership
     * grant anchors at the grant itself.
     */
    private startMainAttention;
    /**
     * The Human's Main stream Attention, derived rather than stored: the Human
     * owns every Project without a stored grant, so its Main stream attention is
     * the one identity-derived fact that survives — it starts at the Project's
     * creation and is advanced only by its own reads. Every other Member's comes
     * from its own durable row.
     */
    private humanMainAttentionFrom;
    private mainAttentionForFrom;
    /**
     * The Main stream Attention row a withdrawn ownership grant created, or nothing.
     * Only `project-owner` rows end with the grant: a Member that followed on its
     * own holds a `self` row, and that following — with its read progress — is not
     * the grant's to end. The Human's derived row is never stored, and the Human is
     * never removed as owner.
     */
    private grantedMainAttentionEnds;
    private isFollowingMainFrom;
    /**
     * Everyone whose Main stream Attention covers one Project: the stored rows
     * plus the Human, whose row is derived from owning the Project. Membership is
     * re-checked, because a row survives the departure that should have ended it
     * and a departed Member must not be woken for a stream it can no longer read.
     */
    private mainStreamRecipientsFrom;
    private attentionFor;
    private attentionForFrom;
    private isFollowing;
    private isFollowingFrom;
    private directMarkersFor;
    /** One Member's live Inbox markers for one Thread, snapshotted so a caller cannot freeze the live bucket's array. */
    private frozenMarkerSnapshot;
    private reminderMarkersForFrom;
    /** Current conditions decide whether a durable reminder still deserves a row or a wake; stale markers stay stored until a Task read or lifecycle cleanup. */
    private liveReminderMarkersFrom;
    private remindersFor;
    private activityMarkersForFrom;
    private assertMentionTargets;
    private requireRulesVersion2;
    private requireProjectMemberActor;
    private requireProjectMemberActorFrom;
    private resolveAccountable;
    /**
     * Who a transfer may hand a Task to. Creating a Task still names an owner, so responsibility reaches a plain
     * Project member only through this move; version 3 therefore asks the narrower question, whether the target
     * still takes part in the Project, and not whether it owns it. Following the Thread is never part of it.
     */
    private resolveTransferTarget;
    private validateTaskSources;
    private heldTaskClaimFrom;
    /**
     * Whether this Task still has somewhere to be accountable: the Human, or a Member who still takes part in the
     * Project. Version 2 asked for an owner grant, which stranded a Task handed to a plain member and a Task kept by
     * a former owner who still takes part.
     */
    private accountableIsValidFrom;
    /**
     * Who may verify this Task as an Agent: a Project owner, or the accountable the Task was handed to, and never
     * anyone who ever held a Claim on it. The Human decides separately, because the Human is not an Agent actor.
     */
    private canVerifyTaskFrom;
    /** The target a committed transfer landed on, judged by the rules the segment that wrote it ran under. */
    private transferTargetIsValidFrom;
    /** The one Member this Task's review belongs to: its accountable when that Member may verify, otherwise the Human. */
    private verifierOfFrom;
    /**
     * Who a Task change's responsibility marker reaches. Version 2 named the accountable, or the Human when that
     * accountable had ever held a Claim — a suspended accountable was still the member the change concerned.
     * Version 3 asks who can verify, which also moves a marker off an accountable that can no longer act. Each
     * version answers for the records it wrote, so a captured version 2 segment still replays onto its own member.
     */
    private responsibilityActivityRecipientsFrom;
    private mergeResponsibilityReturn;
    /**
     * The responsibility a departing Member gives back to the Human, one transfer per open Task.
     * `keepWhenStillMember` is the owner-grant question: losing the grant is not leaving the Project, so a Member
     * that still takes part keeps its Tasks, and only the Member whose participation ends hands them back.
     */
    private accountabilityReturnsFrom;
    private responsibilityInboxDeltaFrom;
    private inboxDeltaForTaskResponsibility;
    private requireProjectOwnerActor;
    /** The Human owns every Project; an Agent owns it from its grant until the grant ends. */
    private isProjectOwnerFrom;
    private mainSourcesFrom;
    private mainHeadFrom;
    private mainProducerFrom;
    /**
     * One reader's unread Main stream, oldest first. Ordinary unread comes from the
     * reader's own Main stream Attention: whatever the stream holds after that
     * period's read watermark, minus what the reader produced. There is no
     * identity-derived ordinary unread, so a reader who does not follow the Main
     * stream has markers alone — exactly as a Thread reader who does not follow it.
     * Task cards and earlier-version Thread anchors are never unread.
     */
    private mainUnreadFrom;
    private mainStandingFrom;
    /**
     * Standing as it will read once a Main stream read through `readThrough`
     * commits, derived without materializing the committed delta. Only this
     * reader's ordinary unread and markers up to the bound can change.
     */
    private mainStandingAfterRead;
    /**
     * The only legal durable result of reading through `readThrough`: the markers it consumes, and whether the
     * reader's own Main stream Attention watermark moves. The watermark itself is replayed from the operation,
     * so the delta carries the Attention row and the markers alone.
     */
    private prepareMainReadFrom;
    /**
     * A receipt dev builds of this train wrote while a published event still
     * counted as Project news: that event alone advanced the reader's watermark.
     * The current model gives a marker-only read no watermark to move, so the
     * stored receipt is the one this build derives plus the standing row the old
     * model moved. Only that exact shape is accepted, and it replays as written —
     * the records after it were written against the watermark it set.
     */
    private isLegacySubscriptionEventReadAdvance;
    /** The newest page through `readThrough` a read answers with, plus any older entry whose marker the read consumes, so no marker is cleared unseen. */
    private mainReadPage;
    private mainReadResult;
    private mainEntries;
    private mainEntry;
    /** A card is the current state of its Thread, rebuilt on every read; it keeps no copy of the Thread's progress. */
    private mainThreadCard;
    private printableSender;
    private mainUnreadRequired;
    /** The Agent whose ownership changed learns of it through a Main stream marker. */
    private ownerActivityInboxDelta;
    private mainMessageInboxDelta;
    /** A Main stream reply answers a Main stream Message of the same Project; a Thread Message is never a target. */
    private requireMainReplyParent;
    private mainPostResult;
    private startThreadResult;
    private assertSameMainMessage;
    private assertSameThreadStart;
    private assertSameMainRead;
    private unreadRequired;
    private staleRevision;
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
    private revisionRelationTo;
    /**
     * The facts committed strictly after `sequence` — the increment a stale
     * writer never saw. `unread_required` already carries its own batch through
     * `unreadFor`; this is the revision gate's equivalent, where the missed
     * facts are simply those past the obsolete token. `unread` is true by
     * construction (the writer's token predates them) and `direct` resolves
     * through the same marker lookup a read uses, so the two surfaces can never
     * disagree about which facts were aimed at this reader.
     */
    private factsAfter;
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
    private buildReleaseSnapshot;
    private releaseSummaries;
    private threadsForActivities;
    private claimsForTask;
    private claimsForTaskFrom;
    private claimsForVisibleTasks;
    private tasksForClaims;
    /** Resolve one Task's Thread for a workspace-authorized actor; Member actors must belong to the Task's Project. */
    private threadForActor;
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
    private deferredThreadWrite;
    /**
     * Whether every unread fact is already on this Member's visible surface.
     * Fail-closed in every direction: an absent probe, an empty answer, or one
     * fact the surface cannot show means the write is not exempt. The probe is
     * the Host's, because the surface is runtime state the ledger never holds.
     */
    private visibleSurfaceExempts;
    /** Commit projections shared by the Message-sent and Thread-replied results. */
    private committedMessageResult;
    private threadAnchor;
    private threadAnchorFrom;
    private threadFactKey;
    /**
     * Display numbers for Tasks: one counter per home Project, in creation
     * order. This is the single numbering authority — Project cards, Thread
     * headings, cross-project ref resolution, and inbox renders all show the
     * ordinal the Task holds inside its own Project. The ordinals are derived
     * at replay time (`taskNumberByTask`); this read only filters them to one
     * Workspace.
     */
    private taskNumbers;
    private hasActiveClaim;
    private hasActiveClaimFrom;
    private deriveResolvedTaskStatus;
    private deriveTaskStatus;
    private setMemberState;
    private assertActorForWorkspace;
    private assertHumanActor;
    private assertMemberActor;
    /** Shortest accepted UUID abbreviation after the branded prefix. */
    private static readonly MIN_REF_UUID_PREFIX;
    private isRefAbbreviationTail;
    /**
     * Full map key for one branded ref, tolerating a unique UUID abbreviation.
     * Exact refs win; an abbreviated ref (prefix plus at least 6 hex chars,
     * hyphens ignored) resolves only when it matches exactly one key. Returns
     * undefined for unknown or ambiguous refs so lenient callers can degrade
     * without throwing.
     */
    private uniqueRefKey;
    /** uniqueRefKey with the established unknown/ambiguous error contract and hints. */
    private requireRefKey;
    /** Agents strip the branded prefix or abbreviate UUIDs when echoing refs; point at the fix instead of a bare lookup failure. */
    private unknownRefHint;
    private requireTask;
    private requireThread;
    private projectRefForThread;
    /**
     * The Project one read resolves against, or undefined when it is not on Team
     * read surfaces at all.
     *
     * Archival removes a Project and everything it owns from every read: its
     * Threads, Tasks, Claims, and Messages stop resolving, and participation ends
     * with it. This is the single definition of that rule for reads; writes use
     * `requireActiveProject`, and Thread-scoped writes `assertThreadProjectActive`.
     */
    private visibleProject;
    private projectRefForThreadFrom;
    private threadContextForActor;
    private threadContextFrom;
    private requireProject;
    /** Guard for every mutating or Project-scoped surface flow: archived Projects reject. */
    private requireActiveProject;
    /** Thread-mutation guard: the Project owning the Thread must still be active. */
    private assertThreadProjectActive;
    private requireMember;
    /**
     * Live-side write gate for a Member acting in a Project: participation in the
     * Workspace that owns the Project. Joining the Project is not a prerequisite —
     * a Member who works in this Workspace can reply, claim, follow and read here.
     */
    private requireMemberProject;
    /**
     * Replay-side write authorization for one Project's operations:
     * participation in the Workspace that owns the Project. Project membership
     * is a Human-side organisation and is not a write gate, but historical
     * operations were checked against it; every actor that passed the
     * membership form also participates, so this form never rejects a record
     * the membership form accepted.
     */
    private participatesInProjectWorkspaceFrom;
    /**
     * Whether a Member takes part in a Project (the visibility question),
     * derived from taking part in any Thread of the Project, or from an
     * explicit membership a historical ledger still carries. The explicit half
     * keeps old ledgers reproducible (a Member added by `project-member-joined`
     * who never wrote a word must still see the Project); nothing new is
     * enrolled. Deriving from Threads is what makes a Member mentioned into a
     * Thread see the Project that Thread belongs to.
     */
    private isProjectMember;
    private isProjectMemberFrom;
    /** Every Thread of the Project, taskful or taskless — the scope both cleanup validators replay against. */
    private projectThreadRefs;
    private projectThreadRefsFrom;
    /** The Workspace authorization question: does this Member participate in this Workspace. */
    participatesIn(memberId: AgentTeamMemberId, workspaceId: WorkspaceId): boolean;
    private participatesInFrom;
    /** Every Workspace the Member participates in: the default first, then the rest sorted. */
    workspacesOf(memberId: AgentTeamMemberId): readonly WorkspaceId[];
    private workspacesOfFrom;
    /** Whether two Members share at least one Workspace participation — the handle-uniqueness scope. */
    private participationOverlapFrom;
    /** Every Thread in the Workspace — the scope a Workspace leave replays its cleanup against. */
    private workspaceThreadRefs;
    private workspaceProjectRefsFrom;
    private workspaceThreadRefsFrom;
    private assertJoinableMember;
    private normalizeUnique;
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
    private mentionCandidatesFor;
    /**
     * The Member set `@all` stands for in one Project: the Members who take part
     * in that Project plus the Human. Deliberately narrower than the names a body
     * may address — a Member can be named by hand from anywhere in the Workspace,
     * while `@all` only reaches the people already in this conversation.
     */
    private allRecipientsFor;
    private withHumanAlias;
    /**
     * Resolve the Message one reply answers, inside the Thread being written.
     *
     * The ref is checked against the ledger's own Message index instead of being
     * trusted: a ref from another Thread would render as a quote of a
     * conversation this reader cannot follow, and an unknown ref would render as
     * a dangling quote. Both are refused at write time, so every stored reply has
     * a parent a reader can actually be taken to.
     */
    private requireReplyParent;
    /**
     * The recipient set one write delivers to. The body is the sole authority on
     * mentions: the `@Handle` scan below is the only thing a caller can name with,
     * and it is the same scan for an Agent and for Human input typed by hand. The
     * one input besides the body is `answered`, the parent Message's author, whom
     * a reply reaches the way a mention does.
     */
    private deliveryRecipientsFor;
    /**
     * Whether one Member has ever held Attention on one Thread. Committed Inbox
     * deltas append a follow/unfollow observation, and the live index covers the
     * Thread-creating Message whose initial Attention is never observed — so the
     * two together answer "was this Member ever part of this Thread" without
     * adding a second durable authority.
     */
    private everParticipated;
    private everParticipatedFrom;
    /**
     * Split the Agent recipients an existing Thread cannot deliver to: those the
     * body named that the Thread has never carried. The send still commits — a
     * text mention must never fail the write — and the author is told through the
     * result, because inviting a Member into an existing Thread stays a Human
     * decision.
     */
    private undeliverableRecipients;
    private normalizeDirection;
    private assertHandleAvailable;
    private assertHandleAvailableFrom;
    private assertModelSelection;
    /**
     * Capability allow-list entries are exact identifiers (skill names,
     * reserved tool names); only whitespace-only values are rejected. Unknown
     * names are intent, not errors — committing must stay replayable across
     * Harness upgrades, so divergence is derived at activation instead.
     */
    private assertCapabilities;
    private initialization;
    private assertInitializationRecord;
    private assertSameInitialization;
    private assertSameProjectCreation;
    private assertSameMemberAdd;
    private assertSameMemberState;
    private assertSameMemberSessionRecycled;
    private assertSameProjectUpdate;
    private assertSameMemberUpdate;
    private assertSameProjectJoin;
    private assertSameProjectMemberRemoval;
    private assertSameWorkspaceJoin;
    private assertSameWorkspaceLeave;
    private assertSameProjectArchival;
    private assertSameDm;
    private dmResult;
    private assertSameReply;
    private assertSamePromotion;
    private assertSameClaim;
    private assertSameTask;
    private assertSameRemoval;
    private assertSameArchival;
    /** A replayed Attention request must address the same scope it first wrote, whichever face it used. */
    private assertSameAttention;
    private assertSameThreadRead;
    private sameTask;
    private sameTaskIdentity;
    private sameClaim;
    private sameClaimIdentity;
    private sameThread;
    private sameMemberIdentity;
    private sameMemberFacts;
    private sameActor;
    private sameList;
    private attentionKey;
    private directMarkerKey;
    private activityMarkerKey;
    private addMembership;
    private addRef;
    private throwRequestCollision;
    private requestCollisionError;
    private projectResult;
    private projectOwnerResult;
    private projectUpdateResult;
    private memberResult;
    private joinResult;
    private projectMemberRemovalResult;
    private workspaceJoinResult;
    private workspaceLeaveResult;
    private projectArchivalResult;
    private replyResult;
    private claimResult;
    private taskResult;
    private transferTaskResult;
    private attentionResult;
    /**
     * A Main stream Attention change answers with the Project it addressed and the
     * row now standing, so the caller can state the scope without a Thread ref.
     */
    private mainAttentionResult;
    private promotionResult;
    /**
     * The Thread picture a read answers with, derived from the projection the
     * read resolved against. Committed reads, no-op reads and retries all share
     * this one derivation, so a read that writes nothing still returns the same
     * Attention, facts, watermark and unread count a committed one would.
     */
    private readPicture;
    private receipt;
    private removalResult;
    private archivalResult;
    private operationBase;
    private nextSequence;
    private ref;
    private committed;
    private resolved;
    private sortedRecords;
    /**
     * Attention rows written before the source field existed carry none, and a
     * replay validator re-derives the row it expects from the projection — which
     * always has one. The missing source is supplied in memory, so an old record
     * validates against the same row the projection holds. `self` is the only
     * source that claims a cause the stored bytes never had, so it is the honest
     * default: a row whose origin the ledger cannot know is treated as the
     * Member's own choice.
     */
    private repairLegacyAttentionSource;
    /** What an operation whose Attention rows carry no source established them by. */
    private legacyAttentionSourceOf;
    /**
     * An owner grant written before Main stream Attention existed carries the
     * era's inbox: a Main marker alone, with no `mainAttention` row. That grant
     * still started its Member's default attention, so the missing row is
     * re-minted from the grant's own sequence and the record is repaired in
     * memory. Any other shape — a row already present, or a delta that differs
     * from the era's in some other way — is left alone, so it still fails
     * validation and a forgery is not silently accepted.
     */
    private repairLegacyMainAttentionGrant;
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
    private repairLegacyMainAttentionGrantOverwrite;
    /**
     * An Agent's Main stream read written before Main stream Attention existed
     * carried only the markers it consumed: its watermark lived in a projection
     * field that no longer exists, so replay alone would lose every byte of read
     * progress and hand the reader its whole history as unread. The row is
     * re-minted from the read's own `readThroughSequence`, so the era's progress
     * survives. Only the era's shape is repaired — a receipt that differs in any
     * other way is a shape this build never wrote and still fails validation.
     */
    private repairLegacyMainStreamRead;
    /**
     * Records written by releases that scoped Project archival and Project
     * member-removal inbox cleanup to taskful Threads only (the collector read
     * the Task projection) carry an incomplete inbox when the Project holds a
     * taskless Thread with Attention or markers. They are repaired in memory
     * the same way pre-envelope Thread reads are; any other inbox still fails
     * validation, so a forgery is not silently accepted.
     */
    private repairLegacyProjectCleanup;
    /** The legacy Project Thread scope: only Threads carrying a Task. */
    private legacyProjectThreadRefs;
    /**
     * Ledgers written before message occurredAt existed store bare messages;
     * snapshot-shaped Thread reads resolve instants from the originating
     * operations. A receipt-shaped read carries no message at all, so it passes
     * through untouched — the load path must never touch a shape it does not
     * have, and it never writes either form back.
     */
    private normalizeOperation;
    private enqueue;
}
//# sourceMappingURL=ledger.d.ts.map