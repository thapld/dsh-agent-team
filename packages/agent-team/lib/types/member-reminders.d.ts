import type { AgentTeamMemberReminderState, AgentTeamReminderRef, AgentTeamReminderSchedule } from './types/entities.ts';
/**
 * Member reminders are time promises bound to a Member, not to a Session: the
 * Team ledger keeps them, so a Session being recycled, rolled over or restarted
 * never costs the Member its reminder. Everything here is pure — the schedule
 * is parsed once at creation and replayed from the ledger afterwards, and the
 * plan answers "what is due now" without touching durable state.
 */
/** Active reminders one Member may carry. */
export declare const MAX_ACTIVE_REMINDERS_PER_MEMBER = 50;
/**
 * The ref shape the durable schema admits: the `reminder:` prefix and one value
 * with no further colon. Every ref the Host or a tool derives is checked against
 * it, because a record that fails it cannot be parsed back on replay.
 */
export declare const MEMBER_REMINDER_REF_PATTERN: RegExp;
/** The note is handed to the creating Member when the occurrence fires. */
export declare const MAX_REMINDER_NOTE_CHARACTERS = 2000;
/** Floor on the gap between two consecutive fires of a recurring reminder. */
export declare const MIN_RECURRING_MINUTES = 10;
export type ReminderScheduleParse = {
    readonly ok: true;
    readonly schedule: AgentTeamReminderSchedule;
} | {
    readonly ok: false;
    readonly reason: string;
};
export type ReminderNoteParse = {
    readonly ok: true;
    readonly note: string;
} | {
    readonly ok: false;
    readonly reason: string;
};
/** The instant a schedule next fires after `fromMs`, or undefined when it never will. */
export declare function nextOccurrenceAt(schedule: AgentTeamReminderSchedule, fromMs: number): number | undefined;
export declare function parseReminderSchedule(input: unknown): ReminderScheduleParse;
export declare function parseReminderNote(input: unknown): ReminderNoteParse;
/** Whether a ref can be stored at all: anything else is refused at the create boundary, not on replay. */
export declare function reminderRefIsStorable(reminderRef: string): boolean;
/**
 * The identity one tool call's reminder carries. A call id is opaque and a
 * parallel sub-call's public form is `<parent>:ptc:<n>`, so the two characters
 * the ref shape reserves are percent-escaped. The escape is injective, so two
 * different calls never collapse onto one reminder, and the same call derives
 * the same ref forever, which is what makes a replayed create idempotent.
 */
export declare function reminderRefForCallId(callId: string): AgentTeamReminderRef;
/**
 * Whether a replay carries the intent the stored create recorded. Both sides are
 * already normalized — the schedule by the parser, the note trimmed — so a
 * respelling of the same promise is the same request, while a moved time or a
 * rewritten note is a different one wearing a reused request id.
 */
export declare function sameReminderIntent(reminder: {
    readonly schedule: AgentTeamReminderSchedule;
    readonly note: string;
}, schedule: AgentTeamReminderSchedule, note: string): boolean;
/** One reminder as the planner sees it: durable facts plus the Member lifecycle that still governs it. */
export interface MemberReminderPlanEntry {
    readonly reminderRef: string;
    readonly memberId: string;
    readonly schedule: AgentTeamReminderSchedule;
    readonly state: AgentTeamMemberReminderState;
    /** `archived` and `inactive` cancel every reminder the Member owns; `suspended` keeps timing. */
    readonly memberState: 'enabled' | 'suspended' | 'inactive' | 'archived';
    readonly createdAtMs: number;
    /** Instant of the last occurrence, or undefined when this reminder has never fired. */
    readonly lastOccurrenceAtMs: number | undefined;
}
export interface MemberReminderPlanInput {
    readonly nowMs: number;
    readonly reminders: readonly MemberReminderPlanEntry[];
}
/** One occurrence to raise. The instant is when it is raised, not when it was scheduled: a missed cadence collapses into a single make-up. */
export interface MemberReminderCandidate {
    readonly reminderRef: string;
    readonly memberId: string;
    readonly scheduledAt: string;
}
/**
 * What is due now, at most one occurrence per reminder. A recurring reminder
 * whose previous occurrence is still unconsumed is still due: replacement is
 * the delivery's business, so the plan never suppresses an occurrence because
 * the last one was never read.
 */
export declare function planMemberReminders(input: MemberReminderPlanInput): readonly MemberReminderCandidate[];
/**
 * Structural validity of one schedule, with no clock in it: replay must reach the
 * same verdict for the same record forever, so the time-dependent policy (a cron
 * that never fires, a gap under the floor) is enforced at creation instead.
 */
export declare function reminderScheduleIsSound(schedule: unknown): boolean;
/** Next instant any active reminder of this Member fires, for arming the Host timer. */
export declare function nextReminderWakeAt(reminders: readonly MemberReminderPlanEntry[], nowMs: number): number | undefined;
//# sourceMappingURL=member-reminders.d.ts.map