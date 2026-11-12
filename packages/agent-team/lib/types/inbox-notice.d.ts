import type { WorkspaceId } from '@deepseek-ai/dsh-workspace';
import { type ActivityFact } from './activity-facts.ts';
import type { InboxDeliveryPlan, InboxMemberReminder, InboxThreadUnread } from './inbox-delivery.ts';
import { type RenderedTeamMessage, type TeamMessageSurface } from './surface-visibility.ts';
import type { AgentTeamClaimRef, AgentTeamMainTimelineEntry, AgentTeamMemberId, AgentTeamMessage, AgentTeamProject, AgentTeamProjectRef, AgentTeamThreadRef, AgentTeamUnreadMemberReminder, AgentTeamWorkerAnswer } from './types.ts';
export interface InboxNoticeLookup {
    readonly printableSender: (memberId: AgentTeamMemberId) => string;
    readonly isProjectOwner: (readerId: AgentTeamMemberId, projectRef: AgentTeamProjectRef) => boolean;
    readonly repliesToLine: (message: AgentTeamMessage, workspaceId: WorkspaceId) => string | undefined;
    readonly claimOwner: (claimRef: AgentTeamClaimRef) => AgentTeamMemberId | undefined;
}
export interface InboxMainProjectUnread {
    readonly project: AgentTeamProject;
    readonly entries: readonly AgentTeamMainTimelineEntry[];
}
export interface InboxNoticeInput {
    readonly notifications: readonly InboxThreadUnread[];
    readonly main: readonly InboxMainProjectUnread[];
    readonly memberReminders: readonly AgentTeamUnreadMemberReminder[];
    /** The private answers of this reader's finished Worker runs, keyed by `workerRef`. */
    readonly workers?: readonly AgentTeamWorkerAnswer[] | undefined;
    readonly surface: readonly TeamMessageSurface[];
    readonly lookup: InboxNoticeLookup;
    readonly readerId?: AgentTeamMemberId | undefined;
    readonly deliveryPlan?: InboxDeliveryPlan | undefined;
    readonly prefix?: string | undefined;
}
export interface RenderedInboxNotice {
    readonly text: string;
    readonly messages: readonly RenderedTeamMessage[];
    readonly activities: readonly ActivityFact[];
    readonly renderedThreads: ReadonlySet<AgentTeamThreadRef>;
    readonly undelivered: readonly AgentTeamThreadRef[];
    readonly deliveredReminders: readonly InboxMemberReminder[];
}
/** Render one bounded wake without changing its durable facts or delivery semantics. */
export declare function renderInboxNotice(input: InboxNoticeInput): RenderedInboxNotice;
//# sourceMappingURL=inbox-notice.d.ts.map