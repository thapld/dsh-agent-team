/**
 * Durable Agent Team Host capability.
 *
 * The Host owns the append-only collaboration ledger and all Member lifecycle
 * effects. Session history and browser state are projections, never Team facts.
 * @module @contexera/dsh-agent-team
 */
import { Context, Service } from '@deepseek-ai/cordis';
import { type Agent } from '@deepseek-ai/dsh-agent';
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace';
import { type Config } from './host-row-settings.ts';
export { teamMessageSurface, visibleTeamSurface, missingMessageRange } from './surface-visibility.ts';
export { activityFact, activityText, type ActivityFact } from './activity-facts.ts';
import { type AgentTeamWorkerRun, type WorkerDelegationRequest } from './worker-service.ts';
import { type SubscriptionDeliveryInput } from './subscription-runs.ts';
import type { AgentTeamAddMemberRequest, AgentTeamAddMemberResult, AgentTeamAgentMember, AgentTeamAgentMemberStatus, AgentTeamArchiveProjectRequest, AgentTeamArchiveProjectResult, AgentTeamArchiveMemberRequest, AgentTeamArchiveMemberResult, AgentTeamWorkerInspectRequest, AgentTeamWorkerInspection, AgentTeamWorkerSteerRequest, AgentTeamWorkerSteerResult, AgentTeamWorkerRef, AgentTeamWorkerRunListRequest, AgentTeamWorkerRunListResult, AgentTeamWorkerStopRequest, AgentTeamWorkerStopResult, AgentTeamChangesRequest, AgentTeamChangesResult, AgentTeamActivityRef, AgentTeamClaimList, AgentTeamClaimRequest, AgentTeamClaimResult, AgentTeamClientMemberStatus, AgentTeamBaselineSubscriptionRequest, AgentTeamCreateSubscriptionRequest, AgentTeamCreateProjectRequest, AgentTeamCreateProjectResult, AgentTeamEnvironmentRequest, AgentTeamEnvironmentResult, AgentTeamToolCatalogRequest, AgentTeamToolCatalogResult, AgentTeamGetAttachmentRequest, AgentTeamGetAttachmentResult, AgentTeamGetHumanAvatarRequest, AgentTeamGetHumanAvatarResult, AgentTeamHumanProfileRequest, AgentTeamSidebarOrderRequest, AgentTeamSidebarOrderResult, AgentTeamSidebarOrderWriteRequest, AgentTeamHumanProfileResult, AgentTeamPutHumanAvatarRequest, AgentTeamPutHumanAvatarResult, AgentTeamRemoveHumanAvatarRequest, AgentTeamRemoveHumanAvatarResult, AgentTeamInbox, AgentTeamInboxRequest, AgentTeamJoinWorkspaceRequest, AgentTeamJoinWorkspaceResult, AgentTeamLeaveWorkspaceRequest, AgentTeamLeaveWorkspaceResult, AgentTeamMemberId, AgentTeamMemberResult, AgentTeamMembersRequest, AgentTeamMessageRef, AgentTeamResolveMessageRefsRequest, AgentTeamResolveMessageRefsResult, AgentTeamResolveTaskRefsRequest, AgentTeamResolveTaskRefsResult, AgentTeamResolveThreadRefsRequest, AgentTeamResolveThreadRefsResult, AgentTeamOperationReceipt, AgentTeamPromoteThreadRequest, AgentTeamPromoteThreadResult, AgentTeamPutAttachmentRequest, AgentTeamPutAttachmentResult, AgentTeamRecoverMemberRequest, AgentTeamRecoverMemberResult, AgentTeamDmRequest, AgentTeamDmResult, AgentTeamRequestId, AgentTeamRemoveMemberRequest, AgentTeamRemoveMemberResult, AgentTeamReplyRequest, AgentTeamReadMessageRequest, AgentTeamReadMessageResult, AgentTeamReplyResult, AgentTeamMainStreamHistory, AgentTeamMainStreamHistoryRequest, AgentTeamMainStreamReadRequest, AgentTeamMainStreamReadResult, AgentTeamPostMainMessageRequest, AgentTeamPostMainMessageResult, AgentTeamStartThreadRequest, AgentTeamStartThreadResult, AgentTeamSetHumanProfileRequest, AgentTeamSetHumanProfileResult, AgentTeamSetMemberStateRequest, AgentTeamStatus, AgentTeamSubscription, AgentTeamSubscriptionBaselineResult, AgentTeamSubscriptionDeliveriesRequest, AgentTeamSubscriptionDeliveriesResult, AgentTeamSubscriptionDraftTrialRequest, AgentTeamSubscriptionDraftTrialResult, AgentTeamSubscriptionListRequest, AgentTeamSubscriptionListResult, AgentTeamSubscriptionMetadata, AgentTeamSubscriptionLogsRequest, AgentTeamSubscriptionLogsResult, AgentTeamSubscriptionReplayRequest, AgentTeamSubscriptionReplayResult, AgentTeamSubscriptionStateRequest, AgentTeamSubscriptionTrialResult, AgentTeamSubscriptionWriteResult, AgentTeamTask, AgentTeamTaskBoard, AgentTeamTaskBoardRequest, AgentTeamTaskRequest, AgentTeamTaskResult, AgentTeamTransferTaskRequest, AgentTeamTransferTaskResult, AgentTeamThreadAttentionRequest, AgentTeamThreadAttentionResult, AgentTeamMainAttentionResult, AgentTeamThreadAttentionStatus, AgentTeamMainAttentionStatus, AgentTeamProjectRef, AgentTeamThreadHistory, AgentTeamThreadHistoryRequest, AgentTeamThreadReadRequest, AgentTeamThreadReadResult, AgentTeamThreadObservations, AgentTeamThreadObservationsRequest, AgentTeamTestSubscriptionRequest, AgentTeamUpdateProjectRequest, AgentTeamUpdateSubscriptionRequest, AgentTeamProject, AgentTeamProjectOwnerRequest, AgentTeamProjectOwnerResult, AgentTeamUpdateProjectResult, AgentTeamUpdateMemberRequest, AgentTeamUpdateMemberResult, AgentTeamView, AgentTeamViewRequest, AgentTeamMemberReminderView, AgentTeamMemberReminderListRequest, AgentTeamMemberReminderCreateRequest, AgentTeamMemberReminderCreateResult, AgentTeamMemberReminderCancelRequest, AgentTeamMemberReminderCancelResult, AgentTeamWebhookIntakeRequest, AgentTeamWebhookIntakeResult } from './types.ts';
export { agentTeamDomainSpec, agentTeamOperationSchema } from './spec.ts';
export { subscriptionDomainSpec } from './subscription-store.ts';
export { SubscriptionScheduler, type SubscriptionAdmissionPolicy, type SubscriptionCheckpoint, type SubscriptionRunOutcome } from './subscription-runtime.ts';
export { baselineIdsOf, detectShellFamily, failureTail, missingCredentials, probeShellFamily, runSubscriptionScript, type ShellFamilyProbe, type SubscriptionCredentials, type SubscriptionRunReport } from './subscription-runner.ts';
export { parseSubscriptionOutput, scriptHash, snapshotScript, subscriptionDefinitionProblem, SUBSCRIPTION_ENV_PREFIX, SUBSCRIPTION_FAILURES_BEFORE_PAUSE, SUBSCRIPTION_MAX_PER_PROJECT, SUBSCRIPTION_MIN_INTERVAL_MINUTES, SUBSCRIPTION_PENDING_MAX, SUBSCRIPTION_PUBLISH_PER_MINUTE, SUBSCRIPTION_RUN_TIMEOUT_MS, SUBSCRIPTION_SCRIPT_MAX_BYTES, SUBSCRIPTION_STDOUT_MAX_BYTES, type SubscriptionCredential, type SubscriptionEvent, type SubscriptionScriptSnapshot, type SubscriptionShell, type SubscriptionTriggers, } from './subscriptions.ts';
export type * from './types.ts';
export { AGENT_TEAM_HUMAN_HANDLE, AGENT_TEAM_HUMAN_MEMBER_ID, AGENT_TEAM_INITIALIZE_REQUEST_ID } from './ledger.ts';
export { HUMAN_PROFILE_DEFAULT_NAME, HUMAN_PROFILE_REPO_URL, HUMAN_PROFILE_SETTINGS_SCHEMA, HUMAN_PROFILE_VERSION, assertValidHumanName, normalizeHumanName } from './human-profile.ts';
export { DEFAULT_WEBHOOK_CONFIG, EXTRA_TOOL_GRANTS_SETTINGS_SCHEMA, HOST_ROW_FIELDS, MEMBER_COMPACTION_SETTINGS_SCHEMA, TEAM_HOST_ROW_SETTINGS_SCHEMA, WAKE_RECYCLE_SETTINGS_SCHEMA, WEBHOOK_SETTINGS_SCHEMA, planHostRowWrite, type Config, type HostRowField, type HostRowWrite, type WebhookConfig } from './host-row-settings.ts';
export { EXTRA_TOOL_GRANTS_FIELD, extraToolGrantsFrom, sanitizeExtraToolGrants } from './member-tool-grants.ts';
export { HUMAN_PROFILE_SETTINGS_NAMESPACE, LEGACY_HUMAN_PROFILE_SETTINGS_NAMESPACE } from './human-settings.ts';
export { humanAvatarsRoot } from './human-avatar.ts';
export { AGENT_TEAM_TOOL_NAMES } from './member-runtime.ts';
export { MEMBER_REMINDER_REF_PATTERN, reminderRefForCallId, reminderRefIsStorable } from './member-reminders.ts';
/** Process-stable marker carried by the final Team message tool definition. */
export declare const AGENT_TEAM_PRESET_MARKER: unique symbol;
export declare function markAgentTeamPreset<T extends object>(definition: T): T;
/**
 * Whether the running dsh loads workspace packages from source via tsx.
 * tsx honors the Harness tsconfig path map onto `src/`, while a profile-installed bundle resolves compiled `lib/`: two module instances with independent scope keys.
 */
export declare function isTsxDevMode(): boolean;
/**
 * Activation diagnostic for a dsh-scope module-instance mismatch: the harness sees a scope key this bundle does not,
 * so the two sides loaded different physical copies of `@deepseek-ai/dsh-scope`.
 */
export declare function teamPresetScopeMismatchMessage(tsxDevMode: boolean): string;
/**
 * One adoption's ledger request id. The event sequence restarts with every Session, so a Member that changes generation
 * would reuse the previous generation's id at the same sequence: the ledger's collision guard refuses that write and the
 * adoption is dropped silently. The Session is part of the identity, and the route comparison keeps a replay idempotent.
 */
export declare function adoptionRequestId(memberId: AgentTeamMemberId, sessionId: SessionId, seq: number): AgentTeamRequestId;
export interface AgentTeamCommitted {
    readonly receipt: AgentTeamOperationReceipt;
}
/**
 * A DM was durably recorded but its session injection could not run (no live
 * handle, or the wake itself failed). The recorded DM stays durable; the
 * sender should not blindly retry — the recipient recovers it through its DM
 * history once its session is live again.
 */
export declare class AgentTeamDmDeliveryError extends Error {
    readonly recipientMemberId: AgentTeamMemberId;
    readonly recipientHandle: string;
    constructor(recipientMemberId: AgentTeamMemberId, recipientHandle: string, message: string);
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        agentTeam: AgentTeam;
    }
    interface Events {
        'agent-team/committed'(event: AgentTeamCommitted): void;
    }
}
export default class AgentTeam extends TypertRemoteService {
    config: Config;
    static Config: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
        wakeRecycle: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            idleMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
            minContextTokens: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            idleMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
            minContextTokens: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, "volatile-defined">;
        memberCompaction: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            tokens: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            tokens: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, "volatile-defined">;
        worker: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            defaultEngine: import("@deepseek-ai/schemastery").default<"codex" | "claude", "codex" | "claude", "defined">;
            engines: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                codex: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
                claude: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                codex: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
                claude: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
            }>>, "defined">;
            timeoutMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            defaultEngine: import("@deepseek-ai/schemastery").default<"codex" | "claude", "codex" | "claude", "defined">;
            engines: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                codex: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
                claude: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                codex: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
                claude: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
            }>>, "defined">;
            timeoutMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, "volatile-defined">;
        webhook: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            publicOrigin: import("@deepseek-ai/schemastery").default<string, string, "defined">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            publicOrigin: import("@deepseek-ai/schemastery").default<string, string, "defined">;
        }>>>, "volatile-defined">;
        sidebarOrder: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            version: import("@deepseek-ai/schemastery").default<number, number, "defined">;
            lists: import("@deepseek-ai/schemastery").default<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            version: import("@deepseek-ai/schemastery").default<number, number, "defined">;
            lists: import("@deepseek-ai/schemastery").default<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
        }>>>, "volatile-defined">;
        extraToolGrants: import("@deepseek-ai/schemastery").default<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        wakeRecycle: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            idleMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
            minContextTokens: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            idleMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
            minContextTokens: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, "volatile-defined">;
        memberCompaction: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            tokens: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            tokens: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, "volatile-defined">;
        worker: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            defaultEngine: import("@deepseek-ai/schemastery").default<"codex" | "claude", "codex" | "claude", "defined">;
            engines: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                codex: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
                claude: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                codex: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
                claude: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
            }>>, "defined">;
            timeoutMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
            defaultEngine: import("@deepseek-ai/schemastery").default<"codex" | "claude", "codex" | "claude", "defined">;
            engines: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                codex: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
                claude: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
            }>>, Schemastery.ObjectT<NoInfer<{
                codex: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
                claude: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, Schemastery.ObjectT<NoInfer<{
                    enabled: import("@deepseek-ai/schemastery").default<boolean, boolean, "defined">;
                    executable: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                    sandbox: import("@deepseek-ai/schemastery").default<string, string, "defined">;
                }>>, "defined">;
            }>>, "defined">;
            timeoutMs: import("@deepseek-ai/schemastery").default<number, number, "defined">;
        }>>>, "volatile-defined">;
        webhook: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            publicOrigin: import("@deepseek-ai/schemastery").default<string, string, "defined">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            publicOrigin: import("@deepseek-ai/schemastery").default<string, string, "defined">;
        }>>>, "volatile-defined">;
        sidebarOrder: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            version: import("@deepseek-ai/schemastery").default<number, number, "defined">;
            lists: import("@deepseek-ai/schemastery").default<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            version: import("@deepseek-ai/schemastery").default<number, number, "defined">;
            lists: import("@deepseek-ai/schemastery").default<import("@deepseek-ai/cosmokit").Dict<string[], string>, import("@deepseek-ai/cosmokit").Dict<string[], string>, "defined">;
        }>>>, "volatile-defined">;
        extraToolGrants: import("@deepseek-ai/schemastery").default<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    }>>, "plain">;
    static inject: string[];
    private backend?;
    private domain?;
    private ledger?;
    /** The scheduler's private state: deleting it changes no domain fact, so it is not part of the ledger. */
    private subscriptionDomain?;
    private subscriptionTable?;
    /** The last fifty runs of every subscription, keyed by subscription then start instant. */
    private subscriptionRunsTable?;
    /** The deliveries whose automatic retries were spent, waiting for an owner. */
    private subscriptionDeliveriesTable?;
    /** The answer each replay request already got, keyed by subscription then request id. */
    private subscriptionReplaysTable?;
    /** The deliveries still owing work: one row per admission. */
    private subscriptionAdmissionsTable?;
    /** The pass that runs due webhook deliveries; it stops with the Host. */
    private admissionPumpTimer?;
    /** One pass at a time: a second one would read the same rows and start them twice. */
    private admissionPumpRunning;
    private subscriptionScheduler?;
    private readonly subscriptionCheckpoints;
    /**
     * One subscription's private read-modify-write steps, serialized. Two webhook
     * deliveries that arrive together must not both add one to the same old
     * failure count, or three spent retries would pause later than the third.
     */
    private readonly subscriptionWriteTails;
    /** The probe once it answers with a family, cached for the composition's lifetime; a refusal is retried. */
    private subscriptionShellProbe;
    private readonly handles;
    /** Reader of the awaited context-projection registration; unloading Team releases it. */
    private contextProjection;
    /** Agent ids with a turn in flight; restarts must wait for the boundary. */
    private readonly runningAgents;
    private readonly memberRuntime;
    /**
     * The single seam for every per-Session stored read: handle lifecycle and failure normalization live here,
     * and consumers choose policy by failure category instead of matching error text.
     */
    private readonly sessionReader;
    /**
     * Why one Member shows error presence, per failure source. Reads prefer activation, then runtime, then compaction;
     * slots clear independently, so a recovered runtime error re-reveals an outstanding compaction failure.
     * Keyed by Member rather than Session so a restarted Session cannot leak stale keys.
     */
    private readonly memberFailures;
    /**
     * The Workers this Host started. Team owns the execution record and the refusal
     * rules; the Harness subagent service owns admission and the parent notice.
     */
    private readonly workerRegistry;
    /** Team notice ids waiting for a turn boundary, keyed by the live Agent message id. */
    private readonly pendingTeamWakes;
    /** Agents that already spent their one acceptance boundary; cleared when the Agent settles. */
    private readonly acceptanceBoundaries;
    /** Notice removals initiated by Team itself, which are normal replacement/disposal operations. */
    private readonly expectedInboxDiscards;
    /**
     * Per-Member Inbox notice delivery: the unread facts the last attempt covered and the attempts they have spent.
     * A retry after a failed wake spends the next attempt over the same durable facts, never a second operation.
     */
    private readonly inboxNoticeDeliveries;
    /**
     * Queued Team notices that carry Member reminders, keyed by message id. The
     * claim of a message is the only evidence that its reminders reached a turn,
     * and each entry names the occurrences that message actually rendered, so a
     * claim consumes exactly those and nothing newer.
     */
    private readonly memberReminderWakes;
    /**
     * Consecutive Member-reminder consumption writes that failed for one Member.
     * Process-local like the notice coverage it bounds: a restart starts over, and
     * a successful write clears it.
     */
    private readonly memberReminderConsumeFailures;
    /** The timer armed for the next Member-reminder occurrence, rearmed after every raise. */
    private memberReminderTimer?;
    private attachmentGcTimer?;
    /**
     * New-release check behind the settings footnote. Memory-only and background-refreshed,
     * so the profile read path never waits on the network and every failure settles as "no update known".
     */
    private readonly humanUpdateCheck;
    /** Opaque process fence kept out of the Client's interpretation and combined with the Harness revision on every profile write. */
    private readonly humanProfileHostFence;
    private readonly memberIdle;
    private reminderEvaluationTail;
    private reminderEvaluationRequested;
    private readonly recovery;
    private readonly contextManagement;
    /**
     * Per-Member lifecycle chains: one Member's long waits (turn boundary, idle) hold only that Member's later operations.
     * Order within a chain is submission order; cross-Member commits stay ordered by the ledger's single writer queue.
     */
    private readonly memberLifecycleTails;
    private readonly retiringAgents;
    private readonly enteredMemberChains;
    private readonly enteredAdditionChains;
    /**
     * addMember chains by request id: the Member id does not exist until the
     * commit answers, and concurrent duplicates of one request must serialize
     * so exactly one of them activates the replayed id.
     */
    private readonly additionLifecycleTails;
    /** Deferred notification effects leave durable writes and Client invalidation on the caller's path; each Member keeps its own effect chain. */
    private readonly notificationEffectTails;
    /** Resolves when Host teardown starts: in-chain idle waits release on it instead of outliving the Host. */
    private readonly shutdown;
    /** Aborts every Host-owned background operation that would otherwise outlive teardown. */
    private readonly shutdownController;
    private accepting;
    /** One adoption attempt per boot: the two readiness edges fire once each, and this keeps their attempt single. */
    private legacyAdoptionStarted;
    /**
     * Presence wake epoch: Agent running/idle/failure has no durable fact behind it, so the presence scope counts those edge wakes in process.
     * It never takes part in a projection waiter's comparison.
     */
    private presenceEpoch;
    private readonly changeWaiters;
    /**
     * The Worker switch the live Member surfaces currently reflect. The Host row
     * is the only switch: it decides whether `team_worker` is declared, and the
     * registry still refuses a start while it is off, so a stale surface can never
     * become an execution path.
     */
    private workerExposure;
    constructor(ctx: Context, config: Config);
    private openTeamStorage;
    private printableSender;
    /** What every reply in this window answers, resolved in one pass: a read is a bounded batch and the resolution is a pure ledger lookup. */
    private replyContextsFor;
    /**
     * The same fact with its reply target attached, as a new object: writing a read-time projection into a durable read's payload
     * would freeze-throw or leave a stored record carrying a field its schema does not know.
     */
    private withReplyTo;
    /**
     * The `Replies to:` line for one notice, or nothing when it answers nothing.
     * An unresolvable target (e.g. an archived Project) falls back to the bare ref.
     */
    private repliesToLine;
    /** The live agent context of one Member, resolved at call time; throws when the Member has no live handle. */
    private liveContextFor;
    private wakeRecycleConfig;
    private memberCompactionConfig;
    /**
     * Whether this generation should be replaced before the next message reaches it. Cheap gates decide from the log's newest event time;
     * only a generation that passed them is priced, because pricing rebuilds a cold Session (a whole-log replay).
     */
    private planWakeForMember;
    private cheapWakePlan;
    private measureLiveContext;
    private measureStoredContext;
    /**
     * Record the configured route on a resumed Agent. A route the ledger names without an effort keeps the effort its own log recorded for that same route, so a Session-level model edit that never entered the ledger survives the next activation.
     */
    private applyConfiguredRoute;
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
    private adoptMemberRouteFromRequest;
    private recycleColdGeneration;
    private wakeGateFor;
    /** Current human display name; the single source for team_view and @ matching. */
    humanHandle(): string;
    /** Current human profile reference from this Host row's Config. `avatarRef` is present only when configured, never explicit `undefined` (exactOptionalPropertyTypes). */
    humanProfile(): {
        readonly name: string;
        readonly avatarRef?: string;
    };
    /** The Host row's Worker switch, read at each use so a live edit is never cached into a stale decision. */
    private workerEnabled;
    /** The profile's exact extra tool-name grants, read at a turn start before tool resolution. */
    private extraToolGrants;
    /**
     * Follow the Worker switch on the live surfaces. The loader event fires for any
     * volatile row update, so the switch is compared before anything is applied;
     * an unchanged value costs nothing. Members are reached at their next turn
     * boundary, and a running Worker is never touched: the switch gates new
     * delegations, not work already in flight.
     */
    private syncWorkerExposure;
    /** Re-apply the Worker switch to every live Member at its own turn boundary, one failure never stopping the others. */
    private applyWorkerExposure;
    /** Push the current Config name into the ledger's runtime @ handle; the ledger may not be open yet, and the post-open sync covers that. */
    private syncHumanHandle;
    /**
     * The judgements the Config schema cannot make about a Human name: the same non-empty floor as Member handles,
     * plus global uniqueness against live Members. Runs before the write so a colliding rename rejects instead of persisting.
     */
    private validateHumanProfile;
    /**
     * One-time migration of Host row values that predate the current stored
     * shape. Two sources, in upgrade order: the pre-rename settings namespace
     * (see {@link migrateRenamedHostRowNow}), then the retired
     * `agent-team-human` settings section (see `LEGACY_HUMAN_PROFILE_SECTION`).
     * Whichever readiness edge fires second (settings service, ledger open)
     * starts the attempt; both write only fields the current namespace stores
     * nothing for, once per boot.
     */
    private migrateLegacyHostRow;
    private migrateLegacyHostRowNow;
    /**
     * The Host row's own USER layer in the current namespace: exactly the fields
     * the Human wrote there. The resolved config is the wrong signal — it carries
     * schema defaults, so a Human who explicitly stored a value equal to the
     * default would read as "nothing stored" and be overwritten.
     */
    private storedHostRowFields;
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
    private writeHostRowValues;
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
    private migrateRenamedHostRowNow;
    private adoptRetiredHumanSectionNow;
    protected [Service.init](): Promise<void>;
    /**
     * Lazy Workspace-deletion handling: deletion is detectable only through the registry (no event).
     * A dead non-default participation is withdrawn through the normal leave path; a dead default Workspace is left alone and the Member surfaces as unavailable.
     */
    private sweepWorkspaceParticipations;
    /**
     * Whether one Member Session has durable persisted content, decided through {@link SessionPersistence.stat}:
     * it reports a still-draining session via its pending header, so a resume racing a suspend's final flush cannot fork a fresh generation over it.
     */
    private sessionPersisted;
    /** Resolve one exact live Agent to its durable Team Member; forks do not inherit identity. */
    memberForAgent(agent: Agent): AgentTeamAgentMember | undefined;
    members(): readonly AgentTeamAgentMemberStatus[];
    /** Read-only navigation lookup for branded Task refs found in message bodies. */
    resolveTaskRefs(request: AgentTeamResolveTaskRefsRequest): AgentTeamResolveTaskRefsResult;
    /** Read-only navigation lookup for branded Thread refs found in message bodies. */
    resolveThreadRefs(request: AgentTeamResolveThreadRefsRequest): AgentTeamResolveThreadRefsResult;
    /** Read-only lookup resolving each reply's parent into its author and excerpt. */
    resolveMessageRefs(request: AgentTeamResolveMessageRefsRequest): AgentTeamResolveMessageRefsResult;
    membersForClient(request: AgentTeamMembersRequest): readonly AgentTeamClientMemberStatus[];
    /** Emit a current baseline, then coalesced invalidations until canceled. */
    changes(request: AgentTeamChangesRequest, signal?: AbortSignal): AsyncIterable<AgentTeamChangesResult>;
    /** Return durable Team status without issuing a model request or a storage write. */
    status(): AgentTeamStatus;
    createProject(request: AgentTeamCreateProjectRequest): Promise<AgentTeamCreateProjectResult>;
    /** Human rename of one Project's display facts; identity refs are immutable. */
    updateProject(request: AgentTeamUpdateProjectRequest): Promise<AgentTeamUpdateProjectResult>;
    /**
     * Archive one Project: hidden from every surface with all facts kept. Member sessions stay live,
     * active Claims on its Threads release, and affected Members' Attention clears.
     */
    archiveProject(request: AgentTeamArchiveProjectRequest): Promise<AgentTeamArchiveProjectResult>;
    /** Drop the private state of every subscription a Project owns: none of it can run or publish again. */
    private forgetProjectSubscriptions;
    /** Human grant of Project ownership to one Agent Member of the Project's Workspace. */
    addProjectOwner(request: AgentTeamProjectOwnerRequest): Promise<AgentTeamProjectOwnerResult>;
    /** Human withdrawal of one Agent Member's Project ownership; the Human owner cannot be removed. */
    removeProjectOwner(request: AgentTeamProjectOwnerRequest): Promise<AgentTeamProjectOwnerResult>;
    /** Create a durable Member and atomically grant its declared initial Projects. */
    addMember(request: AgentTeamAddMemberRequest): Promise<AgentTeamAddMemberResult>;
    /** Commit suspended intent, then dispose the owned AgentHandle; the Session stays. */
    suspendMember(request: AgentTeamSetMemberStateRequest): Promise<AgentTeamMemberResult>;
    resumeMember(request: AgentTeamSetMemberStateRequest): Promise<AgentTeamMemberResult>;
    /**
     * Operator nudge for a Member that stopped making progress: steer a continuation prompt into its live session,
     * rebuild it after an orphaned preset composition, or re-run activation when none is live.
     * Runtime-only (no ledger operation); also cancels any pending automatic recovery episode.
     * A non-enabled Member still holding a live handle is an interrupted suspend/archive/remove; recovery finishes that cleanup.
     */
    recoverMember(request: AgentTeamRecoverMemberRequest): Promise<AgentTeamRecoverMemberResult>;
    /**
     * Finish one Member's committed Session transition, whichever half a failure interrupted. Each external effect is derived fresh:
     * retire a generation still live on the old Session, archive the retired Session unless the registry already reports it archived,
     * and activate the target when no live generation runs it. A live handle alone never decides completion; the registry's archive set is the evidence for the archive step.
     *
     * `forkedFrom` marks a planned in-process activation (the caller just retired that Session): its absence tells `activateMember` the Session may never have materialized, so it runs the carried-input replay.
     * Callers must hold the lifecycle queue (or run before other lifecycle work); this method does not re-enter it.
     */
    private finishMemberTransition;
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
    private convergeMemberEffects;
    /**
     * Retire one Member's previous generation after its durable binding moved
     * onto a new Session id: drop the old handle's transient state, dispose the
     * Agent, and archive the old Session log.
     */
    private retireMemberGeneration;
    private isOrdinaryInput;
    private queuedInputOf;
    private archiveRetiredSession;
    /**
     * Execute one prepared generation swap at a true idle boundary: commit the idempotent Host-actor operation, retire the previous generation, activate the fresh Session.
     * The Team Inbox is rederived, never copied; there is no handoff envelope, because a successor told it received one performs the handoff instead of reading its memory.
     */
    private executeMemberTransition;
    private memberLabel;
    /**
     * Run one lifecycle wait and log its class, subject, and duration, so an operator can tell a Member parked on its own turn (`wait-turn`)
     * from one parked on an external service (`wait-external`).
     */
    private waitLogged;
    /**
     * Cache GC: uploads referenced by a Message survive 72h from upload; orphans (never sent) go after 24h.
     * Runs at startup and then daily, in-process only because the cache is transient.
     */
    private startAttachmentGc;
    private automaticResumeText;
    private manualResumeText;
    /**
     * Steer one continuation message into a Member's live session and log the delivery. Throws when no handle exists so the coordinator stops tracking.
     * Appends the inbox snapshot when there is anything new; a steered continuation is queued for the next step, not read.
     */
    private steerResume;
    /** Automatic-recovery wakeup; throwing tells the coordinator the target is gone. */
    private injectRecovery;
    /**
     * Human edit of one Member's mutable facts. A live model edit records the new route in the Session log through the public model-selection seam, so no Agent is disposed: disposing an Agent emits session/disposed,
     * which makes the Web Client permanently mark the same Session id unavailable even if Team recreates it.
     */
    updateMember(request: AgentTeamUpdateMemberRequest): Promise<AgentTeamUpdateMemberResult>;
    /**
     * Live-apply a capability edit at a turn boundary: the current turn keeps its schemas and catalog; once idle, the next step recomputes them
     * from the new restriction and selection, with the same Session and history. Suspend/remove during the wait cancels the swap.
     */
    private applyCapabilityEdit;
    /**
     * Whether this Member's live handle was replaced while `applyCapabilityEdit` waited for the turn boundary (suspend, removal, restart),
     * so the queued edit must not apply to the generation it originally targeted.
     */
    private generationSwappedDuringWait;
    /** Irreversibly remove one Member, archive its Session, and delete its private namespace. */
    removeMember(request: AgentTeamRemoveMemberRequest): Promise<AgentTeamRemoveMemberResult>;
    /**
     * Archive one Member: commit the archival, dispose its live session (private memory and the Session log stay on disk),
     * and archive the Session from every grouping surface. All active Claims release and the Member's Attention clears.
     */
    archiveMember(request: AgentTeamArchiveMemberRequest): Promise<AgentTeamArchiveMemberResult>;
    /** Human-only Task resolution. Business fences are returned as typed outcomes. */
    changeTask(request: AgentTeamTaskRequest): Promise<AgentTeamTaskResult>;
    /** Human-only promotion of a taskless Thread into a real Task plus public Message. */
    promoteThread(request: AgentTeamPromoteThreadRequest): Promise<AgentTeamPromoteThreadResult>;
    /**
     * Human-only Task responsibility transfer. It shares the ledger path, the request/result contract, and the
     * authority rules with `transferTaskForAgent`: the Host decides whether the actor may move this Task and whether
     * the target is a legal accountable, so the Client offers targets without re-implementing either judgement. From
     * rules version 3 a target need only take part in the Project, so following the Thread is offered by the dialog
     * rather than required by the Host.
     */
    transferTask(request: AgentTeamTransferTaskRequest): Promise<AgentTeamTransferTaskResult>;
    /** Human-only Workspace participation grant; a pure relation — no Session moves. */
    joinWorkspace(request: AgentTeamJoinWorkspaceRequest): Promise<AgentTeamJoinWorkspaceResult>;
    /** Human-only Workspace participation withdrawal and Workspace-scoped cleanup. */
    leaveWorkspace(request: AgentTeamLeaveWorkspaceRequest): Promise<AgentTeamLeaveWorkspaceResult>;
    /** Human top-level start of a discussion or Task Thread. */
    startThread(request: AgentTeamStartThreadRequest): Promise<AgentTeamStartThreadResult>;
    /** Human Main stream Message. Unread Main stream entries come back as a typed outcome. */
    postMainMessage(request: AgentTeamPostMainMessageRequest): Promise<AgentTeamPostMainMessageResult>;
    /** Human's durable, atomically acknowledged Main stream read. */
    readMainStream(request: AgentTeamMainStreamReadRequest): Promise<AgentTeamMainStreamReadResult>;
    /** Human's non-mutating Main stream page with the Human's own unread standing. */
    mainStreamHistory(request: AgentTeamMainStreamHistoryRequest): AgentTeamMainStreamHistory;
    /**
     * Resolve uploaded ids and agent-supplied absolute paths into one attachment metadata list. All paths are validated before anything is copied,
     * so one rejection leaves the cache untouched; each copy takes a request-derived id, so a retry converges instead of writing an orphan.
     */
    private resolveMessageAttachments;
    private prepareAttachments;
    /**
     * Derive the stored body: one machine-facing `[attachment] <absolute path>`
     * line per attachment appended to the member-facing text.
     */
    private appendAttachmentLines;
    /**
     * Upload one composer attachment into the cache; bytes are immutable once
     * written. The requestId is the idempotency key: a retried upload derives
     * the same cache id and replays the original result, while reusing that key
     * for a different payload is refused as a request collision.
     */
    putAttachment(request: AgentTeamPutAttachmentRequest): Promise<AgentTeamPutAttachmentResult>;
    /**
     * Read one cached attachment back for client display. A gone entry is the
     * one expected failure on this path, so it carries the stable
     * `team/attachment-not-found` code the Client branches on; anything else
     * (unreadable metadata, filesystem trouble) stays an unknown Host error.
     */
    getAttachment(request: AgentTeamGetAttachmentRequest): Promise<AgentTeamGetAttachmentResult>;
    /**
     * Local environment check for the settings page: which DSH line this Host runs against and whether it is inside this bundle's declared range.
     * Human-scoped and read-only; the verdict comes from the Harness's own compatibility evaluator.
     *
     * The wire type and `EnvironmentReport` keep separate field lists on purpose: the contract states every fact as optional because a Transport may withhold any,
     * while the report is stricter. This assignment is where the compiler holds them together.
     */
    environmentForClient(_request: AgentTeamEnvironmentRequest): AgentTeamEnvironmentResult;
    /**
     * Foreign global and Agent-scoped tool names a Human could grant. Activated
     * preset baselines and Team-owned names are absent; discovery is not a
     * per-Member admission snapshot and cannot reopen protected controls.
     */
    toolCatalogForClient(_request: AgentTeamToolCatalogRequest): AgentTeamToolCatalogResult;
    /**
     * Human profile read for the settings page and footnote: name and avatar reference from the live Config plus version facts.
     * `latestVersion` is absent until a background refresh observes a newer published release.
     */
    humanProfileForClient(_request: AgentTeamHumanProfileRequest): AgentTeamHumanProfileResult;
    /**
     * Prepare one avatar and commit its reference as one settings intent. A
     * confirmed settings refusal removes only this request's uncommitted bytes;
     * an uncertain write retains them for recovery.
     */
    putHumanAvatar(request: AgentTeamPutHumanAvatarRequest): Promise<AgentTeamPutHumanAvatarResult>;
    /** Read one human avatar back; removed entries throw and the UI falls back to hue/initial. */
    getHumanAvatar(request: AgentTeamGetHumanAvatarRequest): Promise<AgentTeamGetHumanAvatarResult>;
    /** Commit the explicit no-avatar sentinel; old immutable files stay for other profiles or inherited layers. */
    removeHumanAvatar(request: AgentTeamRemoveHumanAvatarRequest): Promise<AgentTeamRemoveHumanAvatarResult>;
    /**
     * Rename the Human against the settings revision the page read. Avatar refs
     * have their own all-or-nothing operations above, so this method cannot turn
     * a Client string into an arbitrary file reference.
     */
    setHumanProfile(request: AgentTeamSetHumanProfileRequest): Promise<AgentTeamSetHumanProfileResult>;
    /** Current settings revision, or absent when this Host has no settings form to write against. */
    private humanProfileRevision;
    /** The opaque value a page returns on its next write; it changes with the Host process and every settings revision. */
    private humanProfileSettingsFence;
    /** Validate the Host instance before a write can touch avatar bytes, then return the Harness revision to fence. */
    private humanProfileWriteRevision;
    /** The profile fields a write answers with, including the fence now in force. */
    private humanProfileWriteResult;
    /** Apply one Human-profile intent and preserve the settings service's conflict semantics on the wire. */
    private mutateHumanProfile;
    /**
     * The Human's own sidebar row order. Presentation only: it rides the Host row
     * beside the profile because it must survive a browser, and it never becomes a
     * ledger fact or an Agent-readable preference.
     */
    sidebarOrderForClient(_request: AgentTeamSidebarOrderRequest): AgentTeamSidebarOrderResult;
    /**
     * Replace one sidebar list's saved order. Last write wins, like the profile
     * beside it: two windows dragging the same list resolve to whichever drop
     * landed last, and the next drag corrects it.
     */
    setSidebarOrder(request: AgentTeamSidebarOrderWriteRequest): Promise<AgentTeamSidebarOrderResult>;
    /** Human existing-Thread reply; unread and revision conflicts are business outcomes. */
    reply(request: AgentTeamReplyRequest): Promise<AgentTeamReplyResult>;
    readMessage(request: AgentTeamReadMessageRequest): AgentTeamReadMessageResult;
    /** Human's personal Attention operation. */
    changeAttention(request: AgentTeamThreadAttentionRequest): Promise<AgentTeamThreadAttentionResult | AgentTeamMainAttentionResult>;
    /** Human Inbox projection; the Web Client consumes the direct-only slice as its mention queue. */
    inbox(request: AgentTeamInboxRequest): AgentTeamInbox;
    taskBoard(request: AgentTeamTaskBoardRequest): AgentTeamTaskBoard;
    /** Human's durable, atomically acknowledged Thread read. */
    readThread(request: AgentTeamThreadReadRequest): Promise<AgentTeamThreadReadResult>;
    /** Human-only durable Attention observations for one Thread. */
    threadObservations(request: AgentTeamThreadObservationsRequest): AgentTeamThreadObservations;
    /** Human's non-mutating bounded Thread history. */
    threadHistory(request: AgentTeamThreadHistoryRequest): AgentTeamThreadHistory;
    /** Return the existing bounded public Workspace discovery projection. */
    view(request: AgentTeamViewRequest): AgentTeamView;
    /** Agent-only start of a discussion or Task Thread; Project owners only. */
    startThreadForAgent(agent: Agent, request: AgentTeamStartThreadRequest): Promise<AgentTeamStartThreadResult>;
    /** Agent-only Main stream Message. */
    postMainMessageForAgent(agent: Agent, request: AgentTeamPostMainMessageRequest): Promise<AgentTeamPostMainMessageResult>;
    /** Agent-only Main stream read; a read with nothing to acknowledge commits nothing. */
    readMainStreamForAgent(agent: Agent, request: AgentTeamMainStreamReadRequest, select?: (read: AgentTeamMainStreamReadResult & {
        readonly visibleMessageRefs: readonly AgentTeamMessageRef[];
        readonly visibleActivityRefs: readonly AgentTeamActivityRef[];
    }) => number): Promise<AgentTeamMainStreamReadResult & {
        readonly visibleMessageRefs: readonly AgentTeamMessageRef[];
        readonly visibleActivityRefs: readonly AgentTeamActivityRef[];
    }>;
    private mainReadContext;
    mainStreamHistoryForAgent(agent: Agent, request: AgentTeamMainStreamHistoryRequest): AgentTeamMainStreamHistory;
    /** Agent-only existing-Thread reply. */
    replyForAgent(agent: Agent, request: AgentTeamReplyRequest): Promise<AgentTeamReplyResult>;
    /** Read one Message back verbatim, for the reader that has to answer it. */
    readMessageForAgent(agent: Agent, request: AgentTeamReadMessageRequest): AgentTeamReadMessageResult;
    /** Agent-only personal Attention change. */
    changeAttentionForAgent(agent: Agent, request: AgentTeamThreadAttentionRequest): Promise<AgentTeamThreadAttentionResult | AgentTeamMainAttentionResult>;
    attentionStatusForAgent(agent: Agent, request: {
        workspaceId: AgentTeamViewRequest['workspaceId'];
        threadRef?: AgentTeamThreadAttentionRequest['threadRef'] | undefined;
        taskRef?: AgentTeamTask['taskRef'] | undefined;
    }): AgentTeamThreadAttentionStatus;
    /** The Agent's own Main stream Attention on one Project, answered without writing. */
    mainAttentionStatusForAgent(agent: Agent, request: {
        workspaceId: AgentTeamViewRequest['workspaceId'];
        projectRef: AgentTeamProjectRef;
    }): AgentTeamMainAttentionStatus;
    /** Agent-only Claim mutation. */
    changeClaimForAgent(agent: Agent, request: AgentTeamClaimRequest): Promise<AgentTeamClaimResult>;
    listClaimsForAgent(agent: Agent, request: {
        workspaceId: AgentTeamViewRequest['workspaceId'];
        taskRef: AgentTeamTask['taskRef'];
    }): AgentTeamClaimList;
    promoteThreadForAgent(agent: Agent, request: AgentTeamPromoteThreadRequest): Promise<AgentTeamPromoteThreadResult>;
    /** Agent-only Task resolution: accept (in_review, never self-executed), close, reopen. */
    changeTaskForAgent(agent: Agent, request: AgentTeamTaskRequest): Promise<AgentTeamTaskResult>;
    /** Agent-only accountability transfer to another enabled Project member or the Human. */
    transferTaskForAgent(agent: Agent, request: AgentTeamTransferTaskRequest): Promise<AgentTeamTransferTaskResult>;
    taskBoardForAgent(agent: Agent, request: Omit<AgentTeamTaskBoardRequest, 'workspaceId'> & {
        readonly workspaceId?: WorkspaceId;
    }): AgentTeamTaskBoard;
    /**
     * Agent-only read of the caller's own Member reminders. Reading also re-derives
     * what is due, so a Member that just learned it has reminders sees them raised.
     */
    memberRemindersForAgent(agent: Agent, request: {
        readonly workspaceId?: WorkspaceId;
    }): readonly AgentTeamMemberReminderView[];
    /** Agent-only creation of a reminder for the caller itself: a reminder has exactly one recipient. */
    createMemberReminderForAgent(agent: Agent, request: Omit<AgentTeamMemberReminderCreateRequest, 'actor'>): Promise<AgentTeamMemberReminderCreateResult>;
    /** Agent-only withdrawal of one of the caller's own reminders. */
    cancelMemberReminderForAgent(agent: Agent, request: Omit<AgentTeamMemberReminderCancelRequest, 'actor'>): Promise<AgentTeamMemberReminderCancelResult>;
    /** Human read of one Member's reminders, for Member detail. */
    memberRemindersForClient(request: AgentTeamMemberReminderListRequest): readonly AgentTeamMemberReminderView[];
    /** Human withdrawal of one Member's reminder, for Member detail; the Human may withdraw any. */
    cancelMemberReminderForClient(request: Omit<AgentTeamMemberReminderCancelRequest, 'actor'>): Promise<AgentTeamMemberReminderCancelResult>;
    inboxForAgent(agent: Agent, request: {
        readonly workspaceId?: WorkspaceId;
        readonly limit?: number;
    }): AgentTeamInbox;
    readThreadForAgent(agent: Agent, request: AgentTeamThreadReadRequest, select?: (read: AgentTeamThreadReadResult & {
        readonly visibleMessageRefs: readonly AgentTeamMessageRef[];
        readonly visibleActivityRefs: readonly AgentTeamActivityRef[];
    }) => number): Promise<AgentTeamThreadReadResult & {
        readonly visibleMessageRefs: readonly AgentTeamMessageRef[];
        readonly visibleActivityRefs: readonly AgentTeamActivityRef[];
    }>;
    /**
     * Attach the durable state of every Worker run bound to this Thread. The states
     * come from the execution records, never from the facts this window returned: a
     * run outside a long Thread's page still stands where its record says.
     */
    private withWorkerStates;
    private threadReadContext;
    /**
     * A read that acknowledged the acceptance of work this Member owned hands the reader one reminder to write down what is durable,
     * and, above the acceptance budget, one compaction once the Agent settles. Priced from the committed read, never persisted, never reverses it.
     */
    private afterAcceptanceRead;
    /**
     * Which standing the reader had in the acceptance this read acknowledged: its
     * own Claim, or the Task it was accountable for. An observer following the
     * Thread sees the same accept as unread and gets no boundary.
     */
    private acceptancePerspective;
    /**
     * One boundary per running episode: several accepted reads or accepts in one turn must
     * not queue several identical reminders or race two compactions.
     */
    private deliverAcceptanceBoundary;
    /**
     * Whether this read acknowledged an acceptance that concluded the reader's own
     * work. An observer following the Thread sees the same accept as unread, and a
     * boundary that told it to close its books would be describing someone else's
     * finished Task.
     */
    private acceptedOwnWork;
    /** Measured context, or undefined when the meter cannot price this Session. */
    private measureContext;
    /** The compaction engine in one Member Agent's preset scope, or undefined when it mounts none. */
    private compactionEngineFor;
    /**
     * Compact once the Agent settles. Acceptance usually lands mid-turn, so the
     * work is deferred to the boundary the engine requires: `compactNow` opens its
     * own maintenance phase, which the loop refuses while a turn is running, and
     * it is the only public entry that compacts without an open turn.
     */
    private scheduleAcceptanceCompaction;
    private runAcceptanceCompaction;
    /**
     * Agent-only direct message: append the audit-only dm-sent operation, then inject the body into the recipient's live session.
     * The commit is the durable fact; a missing handle or failed wake returns a structured delivery error while the DM stays durable for recovery.
     */
    dmForAgent(agent: Agent, request: AgentTeamDmRequest): Promise<AgentTeamDmResult>;
    /** Relay body: the DM itself plus one bounded line of adjacent context. */
    private dmRelayText;
    threadHistoryForAgent(agent: Agent, request: AgentTeamThreadHistoryRequest): AgentTeamThreadHistory;
    private withReplyContexts;
    /** Live participation addresses; paths remain owned by the Harness registry. */
    /** Active Projects the Agent's Member owns, for the per-step Member context; undefined while the ledger predates Project owners. */
    ownedProjectsForAgent(agent: Agent): readonly AgentTeamProject[] | undefined;
    workspacesForAgent(agent: Agent): readonly {
        readonly workspaceId: WorkspaceId;
        readonly path: string | undefined;
        readonly default: boolean;
    }[];
    /** Agent-only bounded discovery projection; participation list carries registry titles when known. */
    viewForAgent(agent: Agent, request: AgentTeamViewRequest): AgentTeamView;
    validateLedger(): void;
    /**
     * Validate the durable ledger for the invariant's mount check. The
     * constructor already re-derived every durable record against its own
     * scratch projection, so this adopts that conclusion once while nothing has
     * committed since; every other call, and every commit-driven validation,
     * replays the whole table again.
     */
    validateLedgerAtMount(): void;
    /**
     * Why a carried-input replay did not run. Each reason is a state the Host
     * accepts and continues from, never an error: a blocked replay would turn a
     * problem in a Session the Member no longer runs in into permanent
     * unavailability.
     */
    private skipCarriedInput;
    private replayCarriedInput;
    /**
     * Jobs this Agent owns that cannot survive a generation swap: any
     * running/stopping job, and any settled job whose terminal output was
     * never reported (disposal would silently discard it). In-place hard
     * compaction is exempt — it never cancels the owner.
     */
    private ownedJobsBlockingRecycle;
    private emitCommittedOutcome;
    private assertProjectMembersAvailable;
    /**
     * Shared append envelope for both message commits: resolve uploads, append through the chosen ledger method, emit the committed receipt,
     * and on failure drop the cache entries this attempt prepared. Keeping the order here once stops send and reply from drifting.
     */
    private commitMessageAs;
    private startThreadAs;
    private postMainMessageAs;
    private readMainStreamAs;
    /** Read one Message back verbatim, whoever is asking. */
    private readMessageAs;
    private replyAs;
    /**
     * After a failed message or reply attempt, remove the request-stable cache copies it could have prepared unless a committed Message references them.
     * The ledger's reference set is the guard; uploads are untouched (the GC owns unreferenced ones). Cleanup failures are logged and never mask the original error.
     */
    private dropUnreferencedPrepared;
    /** Fence one Human Remote call: accepting Host, known Workspace, Human actor. */
    private humanCall;
    /** Fence one Member call: accepting Host, live Member binding, matching Workspace participation. */
    private memberCall;
    private memberActor;
    private requireAgentWorkspace;
    /**
     * Reject a model route the Host cannot serve: an unregistered provider has no
     * adapter at all, so the Member would be created and fail its first turn with
     * an unrelated message. Checked here so the caller sees the real reason.
     */
    private assertModelRoute;
    /**
     * Session headers currently durable in the persistence backend. A disposed Session's log is retired without awaiting,
     * so the JSONL backend's transient win32 staging directories (.dsh-mkdir-*) can surface as ENOENT; the idempotent read backs off briefly.
     */
    private persistedSessionHeaders;
    /**
     * Register the owner guidance in one Member generation's scope. The provider
     * reads ownership and the Worker switch at every assembly, so a grant, a
     * withdrawal, or a switch flip changes the prompt without re-registering it,
     * and the section is resident: compaction rewrites messages, never sections.
     */
    private installProjectOwnerGuidance;
    /** Own-scope foreign tools cannot be masked by the current restriction API; make their denied status explicit instead. */
    private installToolAvailabilityGuidance;
    private activateMember;
    /**
     * Rebuild one enabled Member in place from its persisted Session. A bundle-row reload prunes the preset roster mount while live agents keep dead scope bindings,
     * so the Member loses its composed tools. Re-running composition needs a fresh Agent; disposal marks the recreated Session unavailable in the Web Client until reopened, as suspend/resume does.
     */
    private reactivateMember;
    /**
     * Default an untitled Member Session to its handle so the ordinary Session
     * list names it. An explicit rename or any earlier title always wins; the
     * cosmetic default never fails Member activation.
     */
    private nameMemberSession;
    private validateMemberPreset;
    /**
     * The states with no live surface at all. Each reports a literal `pending`
     * capability: no apply can be in force there, and a literal cannot inherit a
     * stale applied-record left behind by a torn-down surface.
     */
    private memberStatus;
    private setMemberFailure;
    private setActivationDiagnostic;
    /** Store the post-commit configuration apply failure; cleared when the effect lands or a later activation succeeds. */
    private setCapabilityApplyDiagnostic;
    /**
     * Route one activation failure to its diagnostic class: preset composition failures by error class, session failures by the seam's typed classification,
     * everything else as an unclassified activation failure.
     */
    private activationDiagnosticOf;
    private clearMemberFailure;
    private requireWorkspace;
    /** Coalesce event-driven checks; reminders themselves never recursively schedule another pass. */
    private scheduleTaskReminderEvaluation;
    private evaluateTaskReminders;
    /**
     * Open the scheduler's private store and give every timer subscription its
     * first due instant. Boot never resets a persisted due instant or a
     * publication window: a Host that was away catches up once instead of
     * restarting the window.
     */
    private startSubscriptionRuntime;
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
    private updateCheckpoint;
    /** {@link updateCheckpoint} for a caller that already holds the subscription's lock. */
    private updateCheckpointLocked;
    /**
     * The success linearization: end the streak, in the segment that accepted the
     * output. Its caller holds the subscription's write lock, so no delivery the
     * ingress counts can land between the accept and this write — the streak it
     * clears is exactly the defeats counted before the accept, and one that
     * arrives afterwards starts a new streak.
     */
    private clearSubscriptionFailuresLocked;
    private checkpointFor;
    private webhookFailureStreak;
    private resumeNeedsCheckpoint;
    private repairWebhookCheckpointLocked;
    private forgetCountedAdmissionLocked;
    /**
     * The stored record when its private state may still be written: it exists, it
     * is not deleted, and its Project still runs. Every private write reads the
     * ledger through this first — a terminal barrier that only the caller checks
     * is a barrier the next caller forgets.
     */
    private writableSubscription;
    /**
     * Every private row naming one subscription. A checkpoint is keyed by the ref
     * itself; the other tables put the ref before a `|`, and a ref never contains
     * one, so the key prefix is the ref either way.
     */
    private privateKeysOf;
    /** The private tables a subscription owns, each with the word a failed delete logs it as. */
    private subscriptionPrivateTables;
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
    private forgetSubscriptionPrivateState;
    /**
     * Drop every private row of one subscription: its checkpoint, its runs, its
     * failed deliveries, and the answers already given to replay requests. Awaited,
     * so a caller that reported the deletion has actually cleaned up; a row that
     * will not delete is logged and left to the boot sweep, never retried here.
     */
    private dropSubscriptionPrivateState;
    /**
     * Convergence at boot: a deletion that never finished its cleanup — a crash
     * between the ledger commit and the row drops, or a storage fault — must not
     * leave rows that nobody can read or ever remove. A dead subscription is one
     * the ledger no longer serves, which covers both a deletion and an archived
     * Project.
     */
    private convergeSubscriptionPrivateState;
    /** The Project's Workspace root as the Host's own registry holds it — never the process cwd. */
    private subscriptionWorkspaceRoot;
    private shellExecutor;
    private credentialProvider;
    /**
     * The mounted executor's family answer, decided by behavior once and cached;
     * a refusal is retried because the executor may be mounted later.
     */
    private mountedShellProbe;
    private executeSubscriptionRun;
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
    private recordSubscriptionRun;
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
    private runSubscriptionOnce;
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
    private commitRunOutput;
    /**
     * Accept one run's new events, or say why they wait. The caller holds the write
     * lock and has read the terminal barrier in it. No room is not a failure: `hold`
     * keeps a batch its request can never fetch again.
     */
    private acceptFreshEvents;
    /**
     * One timer run for the scheduler. The outcome tells it whether to count a
     * failure, so a run that printed nothing new never pauses a subscription. A
     * batch past the unpublished ceiling is a failure — the script printed more
     * than the Project can still take — while a subscription already at the
     * ceiling never reaches this method: admission skips it before it starts.
     */
    private runTimerSubscription;
    private commitSubscriptionPublication;
    /** Three failed runs in a row pause a subscription: the ledger records it and the Main stream tells every owner. */
    private commitFailurePause;
    private subscriptionListEntries;
    private listSubscriptions;
    /** Agent discovery returns no script, credential reference or webhook arm, even to a Project member. */
    subscriptionsForAgent(agent: Agent, request: AgentTeamSubscriptionListRequest): AgentTeamSubscriptionListResult<AgentTeamSubscriptionMetadata>;
    subscriptionsForClient(request: AgentTeamSubscriptionListRequest): AgentTeamSubscriptionListResult;
    /**
     * One subscription's recorded runs, newest first. Two runs can start in the
     * same millisecond, so the answer is ordered by start instant and falls back
     * to the ref: the key order alone is only start order while instants differ.
     */
    private runRecordsOf;
    /**
     * Start one Worker for the calling Member. The target is resolved and ownership
     * of its Project checked before anything is written or started, and that binding
     * is what the run's result follows from then on: a bound run reports in its
     * Thread and wakes this Member through the Inbox, an unbound one keeps the
     * direct parent result. It reads only the handle's identity, `ctx.get(
     * 'workingDirectory')` and the `session` passed to it, which is the stub surface
     * a lane without a real Session needs; `worker-host-thread.spec.ts` pins it.
     */
    workerStartForAgent(agent: Agent, request: WorkerDelegationRequest): Promise<AgentTeamWorkerRun>;
    /** The Project a delegation belongs to, taken from its target; every refusal precedes any write. */
    private workerDelegationTarget;
    /** Every Worker this Host started, for the caller's own inspection. */
    workerRunsForAgent(agent: Agent): readonly AgentTeamWorkerRun[];
    /**
     * Stop one Worker this Host holds. Only the Member who delegated the run may
     * stop it through the tool; the start conditions — the settings switch, current
     * ownership, an enabled engine — are deliberately not re-applied, so a run
     * stays stoppable after any of them changes.
     */
    workerStopForAgent(agent: Agent, request: {
        readonly workerRef: AgentTeamWorkerRef;
    }): Promise<AgentTeamWorkerRun>;
    /**
     * One Member's instruction to an execution it delegated. A live execution
     * takes it now; an ended execution is resumed as a new linked execution in
     * the same native conversation. The immutable chain and ledger decide which
     * execution owns the next turn, never a process-local native id.
     */
    workerSteerForAgent(agent: Agent, request: AgentTeamWorkerSteerRequest): Promise<AgentTeamWorkerSteerResult>;
    /** Follow the immutable `continuedFrom` chain from a caller's ref to its newest execution. */
    private workerChain;
    /** Whether one execution belongs to the chain rooted at a caller's requested ref. */
    private workerChainContains;
    /** One run's shape for the Human's list, whichever record of it is being read. */
    private workerRunViewOf;
    /**
     * One Member's Worker runs for the Human's edit surface: what this Host still
     * holds (running or stopping), the records a previous Host left running, which
     * are listed as unconfirmed and offer no stop control, and the newest ended
     * runs, each with the state it really ended in. It is one window of five rows:
     * the live and unconfirmed runs hold their seats first, and the newest endings
     * fill the rest. A failed run has to stay reachable after its process exited,
     * or the diagnostic behind it has no door.
     */
    workerRunsForClient(request: AgentTeamWorkerRunListRequest): AgentTeamWorkerRunListResult;
    /**
     * The Human's stop of one execution from a Member's edit surface. It runs the
     * same Host stop transaction as the Member's tool, but answers with structured
     * facts instead of a refusal the Client would have to read a sentence out of:
     * an ending the engine decided, a cleanup still in flight, or a handle this
     * Host no longer holds. Authorization and an unknown run stay refusals.
     */
    stopWorkerForClient(request: AgentTeamWorkerStopRequest): Promise<AgentTeamWorkerStopResult>;
    /**
     * One run's diagnostic for the Member who delegated it, read by its Team-owned
     * ref. The summary is the sentence the Thread already carries; the rest is what
     * the engine's own record still answers, read on demand and never stored. Only
     * the initiating Member and the Human may ask — everyone else is refused, so a
     * Project's other Members keep seeing exactly what the Thread published.
     */
    workerInspectForAgent(agent: Agent, request: {
        readonly workerRef: AgentTeamWorkerRef;
    }): Promise<AgentTeamWorkerInspection>;
    /**
     * The Human's read of one execution's diagnostic from a Member's edit surface.
     * It runs the same look-up as the Member's tool, but the surface names the
     * Member it is showing, so a run that Member did not initiate is refused here
     * rather than answered from a list the Human never asked about.
     */
    inspectWorkerForClient(request: AgentTeamWorkerInspectRequest): Promise<AgentTeamWorkerInspection>;
    /**
     * Build one run's report. A run that has not ended has no anchors yet — they are
     * written with its ending — so the report says that instead of asking the engine
     * for a record the Team has not been told how to find.
     */
    private workerInspectionOf;
    /** One run as the caller may read it: the summary always, the output only an owner. */
    private logEntryOf;
    /**
     * What a subscription's recent runs did. Every Project member may read the
     * summary; the halves only an owner reads are the script's own output and the
     * sentence a failure explains itself with, because the script runs with the
     * Project's credentials and its output may carry what they unlocked.
     */
    private subscriptionLogs;
    /** An Agent Member reads one subscription's runs; the authority split decides what it sees. */
    subscriptionLogsForAgent(agent: Agent, request: AgentTeamSubscriptionLogsRequest): AgentTeamSubscriptionLogsResult;
    /** The Human page reads the same records, and always carries the output. */
    subscriptionLogsForClient(request: AgentTeamSubscriptionLogsRequest): AgentTeamSubscriptionLogsResult;
    /**
     * The delivery records of one subscription, still failing. They outlive the
     * run records on purpose: the run that failed may be evicted long before an
     * owner gets to replay the request that produced it.
     */
    private deliveryRecordsOf;
    private subscriptionDeliveries;
    /** An Agent owner lists the deliveries whose automatic retries are spent. */
    subscriptionDeliveriesForAgent(agent: Agent, request: AgentTeamSubscriptionDeliveriesRequest): AgentTeamSubscriptionDeliveriesResult;
    /** The same list for the Human's page: the failed deliveries an owner reads and replays. */
    subscriptionDeliveriesForClient(request: AgentTeamSubscriptionDeliveriesRequest): AgentTeamSubscriptionDeliveriesResult;
    /**
     * One subscription's private read-modify-write steps, run one at a time: the ingress
     * is the only writer the scheduler does not admit, and two deliveries arriving
     * together would otherwise read the same failure count and lose one increment.
     */
    private serializeSubscriptionWrite;
    /** Every admission one subscription still owes work for, in no particular order. */
    private admissionRecordsOf;
    /**
     * The public entry's whole decision: whether this request becomes durable work. A
     * `queued` answer means the row is already written, so a restart before the 202
     * loses nothing; a storage failure throws and the entry answers 5xx. The token
     * resolves against the ledger's armed addresses, so a reset, a dropped trigger, a
     * deletion and an archive all answer "no such address" — while a delivery already
     * queued keeps its row, because a reset moves an address, not a queue.
     */
    intakeWebhookDelivery(request: AgentTeamWebhookIntakeRequest): Promise<AgentTeamWebhookIntakeResult>;
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
    private pumpWebhookAdmissions;
    /** One due delivery: run it, then settle its row from what the run reported. */
    private runWebhookAdmission;
    /** Keep one run's batch on its delivery row: called inside the accept step's lock and barrier read. */
    private holdAdmissionEvents;
    /**
     * Retry only the accept for a held batch: the payload's one run already happened.
     * A batch whose ids another run published meanwhile owes nothing and leaves too.
     */
    private enqueueHeldAdmission;
    /**
     * Count one attempt and decide what the delivery owes next: another try on the
     * 1/5/30 ladder, or the failed-delivery record an owner replays. One delivery is one
     * failure however many attempts it took. `retryable` is false for a failure no retry
     * can change, which sends it straight to that record.
     */
    private retryOrFailWebhookAdmission;
    /**
     * A stored failure still owns its delivery while it is live, or while it belongs
     * to the same unfinished admission. An expired record from a different
     * admission is a fresh provider delivery and must not suppress its count.
     */
    private deliveryRecordForSettlement;
    private finishExhaustedWebhookAdmissionLocked;
    /** Take a delivery out of the queue: its output was accepted, so no work is owed. */
    private dropWebhookAdmission;
    /**
     * The ingress seam: a delivery whose automatic retries are spent becomes a
     * record an owner can read and replay. `deliveryRef` is the ingress's own
     * stable id, so a repeated admission of the same delivery replaces its attempt
     * count and error instead of adding a second row — and counts nothing, because
     * the delivery already counted once when its retries ran out.
     */
    recordFailedDelivery(subscription: AgentTeamSubscription, input: SubscriptionDeliveryInput): Promise<void>;
    private recordFailedDeliveryLocked;
    /**
     * Count the failure a spent delivery stands for, and pause the subscription at
     * the threshold. Its caller holds the subscription's write lock, so the count
     * it reads is the one the previous delivery committed.
     */
    private countDeliveryFailure;
    /** Drop what expired, then what no longer fits: the newest ten deliveries are the ones kept. */
    private pruneDeliveries;
    /** One delivery of one subscription, or `undefined` once its retention ran out. */
    private deliveryRecordOf;
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
    private replayedDeliveryRefs;
    /**
     * The events one request id already accepted into the ledger, if it did. Every
     * accept commits under a request id the caller can name again — a replay's own
     * calls, and a webhook attempt's own id — so this is where a caller recovers the
     * answer when its private copy could not be written: the output is already
     * durable, and running the script a second time would publish what the ledger
     * already holds.
     */
    private acceptedRequestEvents;
    /** The answer one request already got, or `undefined` when it has asked for nothing yet. */
    private replayRecordOf;
    /**
     * The definition a replay or a queued delivery runs. `current` is the definition
     * as it stands now, because replaying is how an owner confirms a fix; `received`
     * is the version the payload arrived under, because an automatic retry must run
     * the bytes it was queued against, not a script that changed under it.
     */
    private replaySource;
    /**
     * The record a real run may start from, or the error that says why it may not.
     * Deleted and archived are terminal barriers, and a paused subscription runs
     * nothing — a replay is a run, so it needs a resume first.
     */
    private runTarget;
    /** The answer a request already got, rebuilt from the private record so a retried call reads the same. */
    private replayResultOf;
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
    private replaySubscriptionDelivery;
    private replayLocked;
    /**
     * Record that this request is about to run — before it runs.
     *
     * It is the one write that makes a request id an intent rather than a hope:
     * once it lands, a retry cannot silently take a different delivery, cannot
     * read a competing version, and cannot mistake an unfinished attempt for a
     * fresh one. A call that cannot record it must not run the script, so this
     * rejects instead of logging, and the caller's retry starts from nothing.
     */
    private recordReplayIntent;
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
    private settleReplayIntent;
    /** An Agent owner replays one failed delivery; the request id makes a retried call a no-op. */
    replaySubscriptionDeliveryForAgent(agent: Agent, request: AgentTeamSubscriptionReplayRequest): Promise<AgentTeamSubscriptionReplayResult>;
    replaySubscriptionDeliveryForClient(request: AgentTeamSubscriptionReplayRequest): Promise<AgentTeamSubscriptionReplayResult>;
    /**
     * Read the script a create or update names. A path is resolved against the
     * calling Agent's own working directory, the one its bash tool uses; a Human
     * page has no such directory and must paste the content.
     */
    private snapshotSubscriptionScript;
    private readAgentScript;
    private missingCredentialMessage;
    private trialFailureOf;
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
    private trialSubscriptionRun;
    /** The subscription-shaped draft a create trial runs as: it is never stored. */
    private draftSubscription;
    /**
     * The triggers a create or edit asks for. A timer is named by its interval; an
     * address is not, so only an explicit `false` drops one a provider already posts to.
     */
    private subscriptionTriggersOf;
    /**
     * The origin hook addresses hang from, or a refusal naming the setting to
     * write. Arming an address nobody can reach would answer the caller with a
     * URL that cannot work, so the write stops here instead.
     */
    private webhookOrigin;
    /** The one answer an arming write gives: the complete address, once, or nothing when it armed none. */
    private armedAddress;
    /** A retry's answer for a write that already committed: the subscription stands, and an address it armed once is not handed out again. */
    private replayedSubscriptionWrite;
    private createSubscriptionAs;
    createSubscriptionForAgent(agent: Agent, request: AgentTeamCreateSubscriptionRequest): Promise<AgentTeamSubscriptionWriteResult>;
    /** Human creation from a page: the content is pasted, because a Human has no Session working directory. */
    createSubscription(request: AgentTeamCreateSubscriptionRequest): Promise<AgentTeamSubscriptionWriteResult>;
    private updateSubscriptionAs;
    updateSubscriptionForAgent(agent: Agent, request: AgentTeamUpdateSubscriptionRequest): Promise<AgentTeamSubscriptionWriteResult>;
    updateSubscription(request: AgentTeamUpdateSubscriptionRequest): Promise<AgentTeamSubscriptionWriteResult>;
    private testSubscription;
    testSubscriptionForAgent(agent: Agent, request: AgentTeamTestSubscriptionRequest): Promise<AgentTeamSubscriptionTrialResult>;
    /** A trial run never changes durable state, so the Human path can offer it before any edit. */
    testSubscriptionForClient(request: AgentTeamTestSubscriptionRequest): Promise<AgentTeamSubscriptionTrialResult>;
    /**
     * A page's trial of the definition its form holds. No Team fact is written:
     * the script runs through the same validation and executor as a save, and the
     * answer names the snapshot and revision the Client may bind Save to. An edit
     * draft does leave one private test run, like any other trial of a stored
     * subscription; a create draft leaves nothing, because its throwaway ref would
     * belong to no stored definition. Save still re-runs the trial in create/
     * update, so a cached pass is never trusted.
     */
    testSubscriptionDraft(request: AgentTeamSubscriptionDraftTrialRequest): Promise<AgentTeamSubscriptionDraftTrialResult>;
    pauseSubscriptionForAgent(agent: Agent, request: AgentTeamSubscriptionStateRequest): Promise<AgentTeamSubscriptionWriteResult>;
    pauseSubscription(request: AgentTeamSubscriptionStateRequest): Promise<AgentTeamSubscriptionWriteResult>;
    resumeSubscriptionForAgent(agent: Agent, request: AgentTeamSubscriptionStateRequest): Promise<AgentTeamSubscriptionWriteResult>;
    resumeSubscription(request: AgentTeamSubscriptionStateRequest): Promise<AgentTeamSubscriptionWriteResult>;
    resetSubscriptionWebhookForAgent(agent: Agent, request: AgentTeamSubscriptionStateRequest): Promise<AgentTeamSubscriptionWriteResult>;
    resetSubscriptionWebhook(request: AgentTeamSubscriptionStateRequest): Promise<AgentTeamSubscriptionWriteResult>;
    /**
     * Replace the address an outside service posts to. The revision does not
     * move: deliveries already accepted keep the version they arrived under, and
     * only the old address stops resolving.
     *
     * It takes the write lock the entry re-reads the token under, so a request carrying
     * the old address is queued before the reset or answered 404, never after it.
     */
    private resetSubscriptionWebhookAs;
    deleteSubscriptionForAgent(agent: Agent, request: AgentTeamSubscriptionStateRequest): Promise<AgentTeamSubscriptionWriteResult>;
    deleteSubscription(request: AgentTeamSubscriptionStateRequest): Promise<AgentTeamSubscriptionWriteResult>;
    private changeSubscriptionStateAs;
    /** Resume is a trial run first: a subscription that cannot run must not come back to life. */
    private resumeSubscriptionAs;
    baselineSubscriptionForAgent(agent: Agent, request: AgentTeamBaselineSubscriptionRequest): Promise<AgentTeamSubscriptionBaselineResult>;
    baselineSubscription(request: AgentTeamBaselineSubscriptionRequest): Promise<AgentTeamSubscriptionBaselineResult>;
    private baselineSubscriptionAs;
    /**
     * Record that these Member reminders reached a turn, one operation per
     * reminder. The write is the Host's own, so a failure degrades to a retry
     * rather than a log line: the occurrence is still owed, and a coverage that
     * still names it would keep the same durable facts from ever being delivered
     * again.
     */
    private consumeMemberReminders;
    /**
     * A consumption write that failed leaves the occurrence unread, so the coverage
     * the notice earned for it falls with it — otherwise the next redelivery sees
     * the same durable facts as already answered and stays silent. The retry is
     * active: the live Session is rederived now instead of waiting for an unrelated
     * Team fact or a restart. It is bounded, because every retry spends one of the
     * Member's turns and a persistent outage must not spend them forever; standing
     * down still leaves the occurrence owed and the coverage dropped.
     */
    private retryMemberReminderConsumption;
    /**
     * Member reminders are time promises in the ledger, so the Host only decides
     * when to look: on any commit that could have changed them, on boot, and on a
     * timer armed to the next occurrence. Evaluation never waits for a turn.
     */
    private scheduleMemberReminderEvaluation;
    private evaluateMemberReminders;
    /** Arm one timer for the soonest pending occurrence; nothing pending disarms it. */
    private armMemberReminderTimer;
    private requireLedger;
    private requireAccepting;
    private emitCommitted;
    private finishRecordedTransitionThenNotify;
    /**
     * Run one effect that follows the ledger append. The operation is durable by now, so a delivery or listener failure degrades to a log line;
     * a failed Inbox wake clears its own signature so the next commit retries the same durable facts without a second operation.
     * Synchronous invariant divergence is re-raised on the caller's frame; deferred notification effects report it at error level because the commit has already returned.
     */
    private afterCommit;
    /**
     * Presence-only invalidation: Agent running/idle/activation/failure changes
     * alter no durable projection, so only members/presence subscribers wake —
     * the workspace catalog and the scope-less Inbox subscriptions stay parked.
     */
    private emitPresenceChanged;
    /** Presence invalidation in every Workspace the Member participates in — each panel listing it must refresh. */
    private emitMemberPresenceChanged;
    /**
     * The correlation group every Member-scoped diagnostic line carries: ledger Member id and owning Session, with the renameable handle as context.
     * The Session resolves from the live generation first, then the ledger binding.
     */
    private memberScope;
    private notificationCauseText;
    /**
     * The delivery plan for one redelivery. `deliveredReminders` narrows the
     * coverage to the occurrences a notice actually rendered: the plan decides
     * that an attempt is owed, the notice earns what it covers.
     */
    private inboxDeliveryPlan;
    private notificationIdentity;
    /**
     * Wake from durable unread state with bounded facts. One correlated line states what the wake did: its cause, the attempt it spent,
     * and whether the notice was queued, already carried by a recovery instruction, skipped, or failed. A queued notice is delivery intent, not evidence the model read it.
     * A delivery failure is contained here: the operation is already durable. A synchronous invariant divergence leaves on the caller's frame; a deferred one is logged by afterCommit.
     */
    private notifyMember;
    private notifyMemberAtWake;
    private deliverInboxNotice;
    /**
     * One line per automatic-recovery state change (classified family, counted occurrence, armed wait, fired wakeup, stand-down, end of tracking),
     * so no stop is silent and the automatic path is explainable without debug output.
     */
    private reportRecovery;
    private isInboxNotice;
    /** Every Team-authored notice, including the acceptance reminder: a queued one is Host context, not the Member's own unfinished input, so it must not pin the current generation. */
    private isTeamWake;
    private trackTeamWake;
    /** Remove a Team notice that Host code is replacing or disposing on purpose. */
    private removeExpectedTeamWake;
    private expectPendingTeamWakes;
    /**
     * Dispose a Member handle after pre-declaring its queued Team wakes: tearing
     * a Session down discards whatever it had queued, which must not be read as a
     * pre-turn cancellation of work the Member never refused.
     */
    private disposeWithWakeGuard;
    private setPreTurnCancellation;
    private isRecoveryNotice;
    private notificationText;
    private disposeMemberSession;
    private clearMemberRecoveryState;
    /** Forget a Member's notice delivery entirely: a new generation starts over. */
    private clearMemberNotificationState;
    /** Record that the queued notice now answers these facts, keeping the attempt count. */
    private coverInboxFacts;
    /** Spend one delivery attempt and mark the facts it covers; the count rises first so a failed wake still reports the attempt it spent. */
    private beginInboxDelivery;
    /**
     * Drop the fact coverage but keep the attempt count, so the next commit retries the same facts as the next attempt.
     */
    private dropInboxCoverage;
    /**
     * Wake waiters for one committed or lifecycle change. Undefined broadcasts to everyone; an empty scope list invalidates nobody;
     * otherwise global and matching scoped waiters wake. Presence-only scopes wake only matching presence waiters.
     * Each waiter receives the version of its own scope's domain; nothing here advances the projection version.
     */
    private emitChanged;
    /**
     * The cursor domain of one scope: presence scopes count process-local edge wakes, every other scope compares against the ledger position of the newest shared-projection commit.
     * Keeping them separate stops a presence edge from invalidating a projection subscriber.
     */
    private changeVersionOf;
    private validateChangeScope;
    /** Serialize one Member's lifecycle operations in submission order; a long wait inside one holds only this chain. */
    private enqueueLifecycle;
    /** Serialize lifecycle operations against a Member id that does not exist until the commit answers: concurrent duplicates of one add request. */
    private enqueueAddition;
    private chainLifecycle;
}
export declare function lastActivityTime(events: readonly SessionEvent[]): number | null;
export declare function logEventsOf(agent: Agent): readonly SessionEvent[] | undefined;
//# sourceMappingURL=index.d.ts.map