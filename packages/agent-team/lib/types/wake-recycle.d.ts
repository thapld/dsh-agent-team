/**
 * Whether an idle Member generation is swapped before anything is delivered into it. Past the provider's prompt-cache TTL a resumed context is rewritten at cache-write prices, so a large generation is cheaper to replace than resume. Every uncertain fact resolves to `resume`: a wrongful swap costs the Member its working trail, a wrongful resume only tokens.
 * @module @contexera/dsh-agent-team/wake-recycle
 */
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { AgentTeamRequestId } from './types.ts';
export interface WakeRecycleConfig {
    readonly enabled: boolean;
    /** Measured prompt-cache TTL; past it a resume pays the full context again. */
    readonly idleMs: number;
    /** Below this the context is cheap to resume, so continuity wins. */
    readonly minContextTokens: number;
}
/** Schema defaults: the fleet-measured TTL and the cost-insensitive waterline. */
export declare const DEFAULT_WAKE_RECYCLE: WakeRecycleConfig;
export interface WakeRecycleFacts {
    /** Whether a generation exists to swap away from. */
    readonly hasPriorGeneration: boolean;
    /** Epoch ms of the generation's last durable activity; null when unreadable. */
    readonly lastActivityAtMs: number | null;
    /** Measured context of that generation; null when it has not been priced yet. */
    readonly contextTokens: number | null;
}
export type WakeRecycleResumeReason = 'disabled' | 'no_prior_generation' | 'facts_unavailable' | 'cache_possibly_warm' | 'context_below_threshold';
export type WakeRecyclePlan = {
    readonly action: 'resume';
    readonly reason: WakeRecycleResumeReason;
}
/**
 * Every cheap gate passed and only the context size is unknown: pricing it
 * needs a full replay, so the caller may only now spend that read.
 */
 | {
    readonly action: 'measure-context';
} | {
    readonly action: 'recycle';
    readonly reason: 'cold_gap_large_context';
    readonly idleMs: number;
    readonly contextTokens: number;
    readonly thresholds: WakeRecycleConfig;
};
export interface WakeRecycleInput {
    readonly config: WakeRecycleConfig;
    readonly facts: WakeRecycleFacts;
    readonly nowMs: number;
}
/** Pure gate ladder; the first failing gate is the reason. */
export declare function decideWakeRecycle(input: WakeRecycleInput): WakeRecyclePlan;
export interface TransitionIdentity {
    readonly newSessionId: SessionId;
    readonly requestId: AgentTeamRequestId;
}
/** Durable identity of one wake swap, derived from the retired Session alone so recovery after a crash between commit and activation converges on the same successor. */
export declare function wakeRecycleIdentity(previousSessionId: SessionId): TransitionIdentity;
//# sourceMappingURL=wake-recycle.d.ts.map