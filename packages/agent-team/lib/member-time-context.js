/**
 * Team Member turn-level clock context. The first model step of every eligible turn appends a durable, source-attributed snapshot: the current instant in the fixed Team zone (UTC+8), the time elapsed since the preceding model-visible event, and the ordering authority note. Later steps stay quiet unless the turn outlasts the refresh interval, then one snapshot lands per elapsed interval. The snapshot is an observation, never ledger authority: sequence and revision order Team facts.
 *
 * The shipped `@deepseek-ai/dsh-time-context` is not mounted: its browser-zone policy asks the model to confirm dates with the user when no unique browser zone exists, which is the normal case for background Member wakes.
 *
 * State is folded from the Member Session's own events, so restart, request reconstruction, and compaction derive identical baselines without a second store.
 * @module @contexera/dsh-agent-team/member-time-context
 */
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { matchesAnyProducerKind } from "./context-source.js";
import { formatTeamDuration, formatTeamTimestamp } from "./time-format.js";
import { advanceOwnedSessionEventCursor } from "./session-event-cursor.js";
export const name = 'contexera-agent-team-member-time-context';
/** The plugin name this producer wrote under before the identity rename; older clock snapshots carry it, so the fold must accept it. */
export const LEGACY_NAME = 'wowyuarm-agent-team-member-time-context';
/** Every producer name whose snapshots this module authored, current first. */
export const PRODUCER_NAMES = [name, LEGACY_NAME];
/** Default minimum spacing between two snapshots within one turn, in ms. */
export const CLOCK_REFRESH_INTERVAL_MS = 1_800_000;
function emptyBaseline() {
    return { lastMessageTime: null, lastInjectionTime: null, lastTurnInjectionTime: null, openTurn: -1 };
}
/** Folds one session event into the clock baseline; uninterested events return the same state reference. @internal exported for tests. */
export function applyClockEvent(state, event) {
    switch (event.type) {
        case 'turn/start':
            return event.data.turn === state.openTurn ? state
                : { ...state, lastTurnInjectionTime: null, openTurn: event.data.turn };
        case 'turn/end':
            return state.openTurn === -1 ? state : { ...state, lastTurnInjectionTime: null, openTurn: -1 };
        case 'user/message': {
            const source = event.data.source;
            const injected = matchesAnyProducerKind(source.kind, PRODUCER_NAMES);
            const withMessage = state.lastMessageTime === event.time ? state : { ...state, lastMessageTime: event.time };
            if (!injected)
                return withMessage;
            return { ...withMessage, lastInjectionTime: event.time, lastTurnInjectionTime: event.time };
        }
        case 'assistant/message':
        case 'tool/result':
            return state.lastMessageTime === event.time ? state : { ...state, lastMessageTime: event.time };
        default:
            return state;
    }
}
/** Fold a whole event log into the clock baseline. @internal exported for tests. */
export function foldClockBaseline(events) {
    let state = emptyBaseline();
    for (const event of events)
        state = applyClockEvent(state, event);
    return state;
}
/** Whether this step appends a snapshot: the first step of a turn always does; later steps only when the turn has outlasted the refresh interval since the last snapshot. Skipped steps never backfill; their span folds into the next elapsed. @internal exported for tests. */
export function shouldSampleClock(step, now, baseline, refreshIntervalMs) {
    if (step === 1)
        return true;
    return baseline.lastTurnInjectionTime === null || now - baseline.lastTurnInjectionTime >= refreshIntervalMs;
}
/** One interval as a duration to render; a non-monotonic clock reads as zero elapsed rather than negative. */
function nonNegativeDuration(elapsedMs) {
    return Math.max(0, elapsedMs);
}
/** Render one durable clock snapshot text. @internal exported for tests. */
export function renderClockSnapshot(input) {
    const elapsed = input.previous === undefined ? 'unavailable' : formatTeamDuration(nonNegativeDuration(input.now - input.previous));
    const baseline = input.step === 1 ? 'model-visible event' : 'step context';
    return `Team clock sampled while preparing turn ${input.turn}, step ${input.step}: ${formatTeamTimestamp(new Date(input.now).toISOString())}\n`
        + `Elapsed since the preceding ${baseline}: ${elapsed}.\n`
        + 'Team collaboration timestamps use UTC+8. Sequence and revision, not wall-clock time, determine ordering and concurrency.';
}
/** The clock baseline folded incrementally over one Session's own events. The cache is keyed by Session id, so a missing prior event renders `unavailable` rather than a baseline guessed across generations. */
const CLOCK_FOLD = {
    start: emptyBaseline(),
    step: (state, event) => applyClockEvent(state, event),
};
export function apply(ctx, config = {}) {
    const refreshIntervalMs = config.refreshIntervalMs ?? CLOCK_REFRESH_INTERVAL_MS;
    // One entry per Member, replaced when its Session changes, so a rollover neither resumes across generations nor retains old ones.
    const cursors = new Map();
    ctx.on('agent/pre-step', async ({ agent, turn, step, signal }, next) => {
        const decision = await next();
        if (decision.kind === 'reject' || signal.aborted)
            return decision;
        // Resolved at step time, never through plugin inject (see member-context).
        const host = ctx.get('agentTeam');
        if (host === undefined)
            return decision;
        const member = host.memberForAgent(agent);
        if (member === undefined)
            return decision;
        const now = Date.now();
        const owned = advanceOwnedSessionEventCursor(cursors.get(member.memberId), agent.session.id, CLOCK_FOLD, agent.session.ownEvents(), agent.session.inheritedEventCount);
        cursors.set(member.memberId, owned);
        const baseline = owned.cursor.value;
        // Turn-first-step always samples; later steps sample only at the refresh
        // interval, so a quick tool-dense turn stays at one line.
        if (!shouldSampleClock(step, now, baseline, refreshIntervalMs))
            return decision;
        const previous = step === 1
            ? baseline.lastMessageTime ?? undefined
            : baseline.lastTurnInjectionTime ?? undefined;
        const text = renderClockSnapshot({ now, turn, step, previous });
        const message = createUserMessage({
            content: [{ type: 'text', text }],
            source: { kind: name, form: 'snapshot', sections: [{ name, text }] },
        });
        return { kind: 'enter', messages: [...decision.messages, message] };
    }, { prepend: true });
}
