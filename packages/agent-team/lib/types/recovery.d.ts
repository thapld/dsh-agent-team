import type { AgentTeamMemberId } from './types.ts';
/** Error families automatic recovery may act on. Classification uses the Harness's structured data first (stable code, then HTTP status); only an error with no usable code falls back to conservative string signatures. Any other structured code without a 429/503 status (provider, credential, quota, context, or request state) stays manual, as does unstructured wording matching neither signature. */
export type RecoverableErrorKind = 'transient network' | 'rate limiting';
/** One thrown value as a single-line diagnostic: error name, stable code if any, and message. Stacks and cause chains stay with the Harness exporter. */
export declare function failureDetail(error: unknown): string;
/** Classify one `agent/error` occurrence into the family automatic recovery may act on, or `undefined` when a wake cannot help. */
export declare function classifyRecoverableError(error: unknown): RecoverableErrorKind | undefined;
/** Why one Member's automatic recovery episode ended. */
export type RecoveryClearReason = 'clean-turn' | 'non-recoverable' | 'wake-failed' | 'session-disposed' | 'manual' | 'host-disposed';
/** One observable step of a Member's automatic recovery. Every decision is reported because none is reconstructible from `agent/error` events alone: terminal errors cancel pending wakeups, stood-down episodes suppress later ones, and a wake with a missing target ends tracking silently. */
export type RecoveryFact = {
    readonly kind: 'scheduled';
    readonly memberId: AgentTeamMemberId;
    readonly errorKind: RecoverableErrorKind;
    readonly consecutiveFailures: number;
    readonly maxConsecutiveErrors: number;
    readonly delayMs: number;
} | {
    readonly kind: 'woke';
    readonly memberId: AgentTeamMemberId;
    readonly consecutiveFailures: number;
} | {
    readonly kind: 'stood-down';
    readonly memberId: AgentTeamMemberId;
    readonly errorKind: RecoverableErrorKind;
    readonly consecutiveFailures: number;
    readonly maxConsecutiveErrors: number;
} | {
    readonly kind: 'cleared';
    readonly memberId: AgentTeamMemberId;
    readonly reason: RecoveryClearReason;
    readonly consecutiveFailures: number;
    /** Wakeups the clear cancelled; with `stoodDown` this is what a silent stop would have hidden. */
    readonly pendingWakes: number;
    readonly stoodDown: boolean;
    /** The wake failure that ended tracking, for `wake-failed`; never a stack. */
    readonly detail?: string;
};
export interface RecoveryCoordinatorOptions {
    /** Performs a delayed recovery wakeup; throwing means the Member is gone and tracking stops. */
    readonly wake: (memberId: AgentTeamMemberId) => void;
    /** Every recovery state change, once per change: the only way a decision here leaves the coordinator. */
    readonly report?: (fact: RecoveryFact) => void;
    /** Delay between a recoverable error and its automatic recovery wakeup. */
    readonly delayMs?: number;
    /** Consecutive recoverable errors allowed before automatic recovery stands down. */
    readonly maxConsecutiveErrors?: number;
}
export declare const RECOVERY_DELAY_MS = 120000;
export declare const RECOVERY_MAX_CONSECUTIVE_ERRORS = 3;
/** Per-member automatic recovery episodes. An episode is every recoverable `agent/error` until a clean turn end, regardless of text or family; each of the first two occurrences schedules its own wakeup. */
export declare class RecoveryCoordinator {
    private readonly episodes;
    private readonly wake;
    private readonly report;
    private readonly delayMs;
    private readonly maxConsecutiveErrors;
    constructor(options: RecoveryCoordinatorOptions);
    /** Observe one `agent/error` occurrence for a Member; `error` is the raw event payload. */
    onError(memberId: AgentTeamMemberId, error: unknown): void;
    /** A turn ended cleanly (running→idle without an error): the episode is over. */
    onCleanTurnEnd(memberId: AgentTeamMemberId): void;
    /** End one Member's episode; `reason` says who ended it, and only a live episode reports. */
    stopTracking(memberId: AgentTeamMemberId, reason: RecoveryClearReason, detail?: string): void;
    dispose(): void;
    private emit;
    private cancelTimers;
}
//# sourceMappingURL=recovery.d.ts.map