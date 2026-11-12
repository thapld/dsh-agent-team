/**
 * Reminder a Member receives at an acceptance boundary: a read that acknowledges an acceptance of work it owned, or the accept it committed itself.
 * @module @contexera/dsh-agent-team/acceptance-context
 */
import { type UserMessage } from '@deepseek-ai/dsh-llm';
/** Context size at or above which an acceptance also triggers compaction. */
export declare const ACCEPTANCE_COMPACT_TOKENS = 128000;
export type AcceptanceContextAction = 'remind' | 'compact';
export interface AcceptanceContextPlan {
    readonly action: AcceptanceContextAction;
    /** Measured context; absent when the meter could not price the Session. */
    readonly usageTokens?: number;
}
export interface AcceptanceContextFacts {
    readonly usageTokens: number | undefined;
    /** Whether the Member's preset resolves a compaction engine at all. */
    readonly canCompact: boolean;
}
/** Plans `compact` only when usage is measurable, at or above the budget, and an engine exists; otherwise `remind`. */
export declare function planAcceptanceContext(facts: AcceptanceContextFacts): AcceptanceContextPlan;
/** Which standing the reader had in the accepted Task; it names the boundary in the reminder. */
export type AcceptancePerspective = 'contributor' | 'verifier' | 'accountable';
/** Reminder text; the compaction clause appears only when compaction will happen. */
export declare function acceptanceReminderText(action: AcceptanceContextAction, perspective?: AcceptancePerspective): string;
export declare function createAcceptanceReminder(action: AcceptanceContextAction, perspective?: AcceptancePerspective): UserMessage;
//# sourceMappingURL=acceptance-context.d.ts.map