import type { AgentTeamClaim, AgentTeamMemberId, AgentTeamTask, AgentTeamTaskRef } from './types/entities.ts';
export declare const REVIEW_BACKLOG_IDLE_MS: number;
export declare const STALLED_PUBLIC_MS: number;
export declare const STALLED_IDLE_MS: number;
export type ReminderKind = 'review-backlog' | 'stalled';
export interface ReminderClaimFacts {
    readonly claim: AgentTeamClaim;
    readonly createdSequence: number;
}
export interface ReminderTaskFacts {
    readonly task: AgentTeamTask;
    readonly projectActive: boolean;
    readonly statusBaselineSequence: number;
    readonly statusBaselineOccurredAt: string;
    readonly latestPublicSequence: number;
    readonly latestPublicOccurredAt: string;
    readonly claims: readonly ReminderClaimFacts[];
}
export interface ReminderEvaluationInput {
    readonly nowMs: number;
    readonly tasks: readonly ReminderTaskFacts[];
    /** The Member a Task's review belongs to: its accountable when that Member may verify, otherwise the Human. */
    readonly verifierOf: (task: AgentTeamTask) => AgentTeamMemberId;
    readonly isAvailable: (memberId: AgentTeamMemberId) => boolean;
    /** Milliseconds idle, or undefined when this Host has not observed a complete running → idle interval. */
    readonly idleMs: (memberId: AgentTeamMemberId) => number | undefined;
    readonly episodeExists: (taskRef: AgentTeamTaskRef, kind: ReminderKind, recipient: AgentTeamMemberId, baselineSequence: number) => boolean;
    readonly hasUnreadResponsibility: (taskRef: AgentTeamTaskRef, recipient: AgentTeamMemberId) => boolean;
}
export interface ReminderCandidate {
    readonly taskRef: AgentTeamTaskRef;
    readonly kind: ReminderKind;
    readonly recipient: AgentTeamMemberId;
    readonly baselineSequence: number;
}
/** Evaluate every open Task once. Unknown runtime presence never becomes an idle duration. */
export declare function planTaskReminders(input: ReminderEvaluationInput): readonly ReminderCandidate[];
//# sourceMappingURL=task-reminders.d.ts.map