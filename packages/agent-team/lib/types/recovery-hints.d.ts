/**
 * Registry of every model-facing recovery line the Team renders: one entry per situation, built from the values the rejection holds so the line names the refused value. It lives in the Host because both tools and the ledger reject, and tools import the Host, never the reverse. `assertRecoveryCoverage` refuses entries no situation reaches; `forbidHandWrittenRecovery` scans model-facing sources for route sentences outside the registry.
 */
/** What a rejection hands the registry: the values the sentence should name. */
export interface RecoveryContext {
    /** The value the model passed that was refused, echoed so the line is concrete. */
    readonly refused?: string | undefined;
    /** The Thread the rejected action was aimed at, when there is one. */
    readonly threadRef?: string | undefined;
    /** The Task the rejected action was aimed at, when there is one. */
    readonly taskRef?: string | undefined;
    /** The Project the rejected action was aimed at, when there is one. */
    readonly projectRef?: string | undefined;
    /** The tool action whose parameter shape was wrong, when the fault is a shape. */
    readonly action?: string | undefined;
    /** The parameter that belongs to another action, when the fault is that one. */
    readonly parameter?: string | undefined;
    /** The action that parameter does belong to, when the fault is that one. */
    readonly owner?: string | undefined;
    readonly completeFacts?: boolean | undefined;
}
/** One registered way out: the situation it answers, and its words. */
export interface RecoveryEntry {
    /** The rejection kind this entry answers, exactly as the rejecting code spells it. */
    readonly kind: string;
    /** The sentence, built from the context so it can name real values. */
    readonly sentence: (context: RecoveryContext) => string;
}
/** One entry per model-facing fault, naming the next action and its value. Lookup is by exact kind so a new kind cannot inherit a neighbour's sentence. */
export declare const RECOVERY_REGISTRY: readonly RecoveryEntry[];
/** Every kind the registry answers, for the coverage check below. */
export declare const RECOVERY_KINDS: readonly string[];
/** Look one entry up by exact kind; an unregistered kind is a bug, never a silent fallback. */
export declare function recoveryFor(kind: string): RecoveryEntry;
/** Refuses a registry entry no produced situation reaches, and a produced situation with no entry. */
export declare function assertRecoveryCoverage(producedKinds: readonly string[]): void;
/** Refuses a hand-written recovery sentence in model-facing source. Comments are stripped before the scan, so only what a model would read is checked. */
export declare function forbidHandWrittenRecovery(source: string, fileName: string): void;
//# sourceMappingURL=recovery-hints.d.ts.map