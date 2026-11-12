/**
 * Whether an idle Member generation is swapped before anything is delivered into it. Past the provider's prompt-cache TTL a resumed context is rewritten at cache-write prices, so a large generation is cheaper to replace than resume. Every uncertain fact resolves to `resume`: a wrongful swap costs the Member its working trail, a wrongful resume only tokens.
 * @module @contexera/dsh-agent-team/wake-recycle
 */
import { createHash } from 'node:crypto';
import { SessionId as SessionIdBrand } from '@deepseek-ai/dsh-session';
/** Schema defaults: the fleet-measured TTL and the cost-insensitive waterline. */
export const DEFAULT_WAKE_RECYCLE = Object.freeze({
    enabled: true,
    idleMs: 60 * 60_000,
    minContextTokens: 128_000,
});
/** Pure gate ladder; the first failing gate is the reason. */
export function decideWakeRecycle(input) {
    const { config, facts } = input;
    if (!config.enabled)
        return { action: 'resume', reason: 'disabled' };
    if (!facts.hasPriorGeneration)
        return { action: 'resume', reason: 'no_prior_generation' };
    if (facts.lastActivityAtMs === null)
        return { action: 'resume', reason: 'facts_unavailable' };
    const idleMs = input.nowMs - facts.lastActivityAtMs;
    if (idleMs <= config.idleMs)
        return { action: 'resume', reason: 'cache_possibly_warm' };
    if (facts.contextTokens === null)
        return { action: 'measure-context' };
    if (facts.contextTokens <= config.minContextTokens)
        return { action: 'resume', reason: 'context_below_threshold' };
    return {
        action: 'recycle',
        reason: 'cold_gap_large_context',
        idleMs,
        contextTokens: facts.contextTokens,
        thresholds: config,
    };
}
/** Durable identity of one wake swap, derived from the retired Session alone so recovery after a crash between commit and activation converges on the same successor. */
export function wakeRecycleIdentity(previousSessionId) {
    const digest = createHash('sha256').update(JSON.stringify(['wake-recycle', previousSessionId])).digest('hex');
    return { newSessionId: SessionIdBrand(`agent-team-recycle-${digest}`), requestId: `agent-team:recycle:${digest}` };
}
