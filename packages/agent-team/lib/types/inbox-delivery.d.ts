import type { AgentTeamProjectRef, AgentTeamReminderRef, AgentTeamThreadReadFact, AgentTeamThreadRef } from './types/entities.ts';
import type { AgentTeamInboxItem, AgentTeamInboxReminder, AgentTeamMainTimelineEntry } from './types/requests-results.ts';
/**
 * Every unread fact interrupts: there is one delivery class. An ordinary Thread
 * update reaches a reader only because it follows that Thread, a mention or a
 * reply carries a direct marker, and a responsibility Activity or live Task
 * reminder arrives through its own marker — so what decides whether ordinary
 * work exists at all is Attention, never how fast it travels. No identity
 * chooses a slower class here. `covered` is what keeps an unchanged
 * rederivation from spending a second attempt on the same durable facts.
 */
/** The reader's role in one notice scope, as the notice states it. */
export type InboxScopeRole = 'follower' | 'member';
export interface InboxThreadUnread {
    readonly item: AgentTeamInboxItem;
    readonly facts: readonly AgentTeamThreadReadFact[];
    readonly reminders?: readonly AgentTeamInboxReminder[];
}
export interface InboxMainUnread {
    readonly projectRef: AgentTeamProjectRef;
    readonly entries: readonly AgentTeamMainTimelineEntry[];
}
/** One unconsumed Member reminder occurrence, by the marker identity that carries it. */
export interface InboxMemberReminder {
    readonly reminderRef: AgentTeamReminderRef;
    readonly sequence: number;
}
export interface InboxDeliveryInput {
    readonly threads: readonly InboxThreadUnread[];
    readonly main: readonly InboxMainUnread[];
    /**
     * Unconsumed Member reminders. Like a Task reminder, one is always delivered:
     * it is the whole reason the notice exists when nothing else is unread, and
     * its identity in the signature is what makes a replacement, not a stack.
     */
    readonly reminders?: readonly InboxMemberReminder[] | undefined;
    /**
     * The reminders the notice actually rendered, when the detail cap or the
     * character budget dropped some of them. An occurrence that never reached the
     * text was never delivered, so it stays out of `covered` and stays unread
     * until a notice can render it.
     */
    readonly deliveredReminders?: readonly InboxMemberReminder[] | undefined;
    /** Signature of the immediate facts the last delivery attempt answered. */
    readonly covered: string | undefined;
    /**
     * Threads the last notice could not render, so its facts were never delivered.
     * Their facts still enter this signature — otherwise an unchanged
     * rederivation would look identical to the delivered one — but the facts the
     * last attempt actually answered are the ones `covered` may match.
     */
    readonly undelivered?: readonly AgentTeamThreadRef[] | undefined;
}
export interface InboxThreadPlan {
    readonly threadRef: AgentTeamThreadRef;
    readonly role: InboxScopeRole;
}
export interface InboxDeliveryPlan {
    /** Why a notice goes out now, or `undefined` when nothing may interrupt the reader. */
    readonly trigger: 'immediate' | undefined;
    readonly signature: string;
    /** The signature the next rederivation compares `covered` against: everything the notice can actually render. */
    readonly delivered: string;
    readonly threads: readonly InboxThreadPlan[];
}
export declare function planInboxDelivery(input: InboxDeliveryInput): InboxDeliveryPlan;
//# sourceMappingURL=inbox-delivery.d.ts.map