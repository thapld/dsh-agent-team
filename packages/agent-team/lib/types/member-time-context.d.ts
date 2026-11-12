/**
 * Team Member turn-level clock context. The first model step of every eligible turn appends a durable, source-attributed snapshot: the current instant in the fixed Team zone (UTC+8), the time elapsed since the preceding model-visible event, and the ordering authority note. Later steps stay quiet unless the turn outlasts the refresh interval, then one snapshot lands per elapsed interval. The snapshot is an observation, never ledger authority: sequence and revision order Team facts.
 *
 * The shipped `@deepseek-ai/dsh-time-context` is not mounted: its browser-zone policy asks the model to confirm dates with the user when no unique browser zone exists, which is the normal case for background Member wakes.
 *
 * State is folded from the Member Session's own events, so restart, request reconstruction, and compaction derive identical baselines without a second store.
 * @module @contexera/dsh-agent-team/member-time-context
 */
import type { Context } from '@deepseek-ai/cordis';
import { type ContextFormed } from '@deepseek-ai/dsh-llm';
export declare const name = "contexera-agent-team-member-time-context";
/** The plugin name this producer wrote under before the identity rename; older clock snapshots carry it, so the fold must accept it. */
export declare const LEGACY_NAME = "wowyuarm-agent-team-member-time-context";
/** Every producer name whose snapshots this module authored, current first. */
export declare const PRODUCER_NAMES: readonly ["contexera-agent-team-member-time-context", "wowyuarm-agent-team-member-time-context"];
/** This producer's attribution; `kind` must be producer-owned (Session format V4). The `plugin:` member of each pair is the read-side rename of that producer's released V3 history. */
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'contexera-agent-team-member-time-context': {
            kind: 'contexera-agent-team-member-time-context';
        } & ContextFormed;
        'plugin:contexera-agent-team-member-time-context': {
            kind: 'plugin:contexera-agent-team-member-time-context';
        } & ContextFormed;
        /** Pre-rename producer name; read-side only, and only ever in history. */
        'wowyuarm-agent-team-member-time-context': {
            kind: 'wowyuarm-agent-team-member-time-context';
        } & ContextFormed;
        'plugin:wowyuarm-agent-team-member-time-context': {
            kind: 'plugin:wowyuarm-agent-team-member-time-context';
        } & ContextFormed;
    }
}
/** Default minimum spacing between two snapshots within one turn, in ms. */
export declare const CLOCK_REFRESH_INTERVAL_MS = 1800000;
/** Plugin configuration: the snapshot refresh interval, overridable per preset. */
export interface Config {
    /** Minimum spacing between two snapshots within one turn, in ms. Default 1_800_000 (30 minutes). */
    refreshIntervalMs?: number;
}
/** Folded clock baselines for one Member Session. */
interface ClockBaseline {
    /** Event time of the latest model-visible event (user/assistant message or tool result), or null. */
    readonly lastMessageTime: number | null;
    /** Event time of this plugin's latest durable snapshot, or null. */
    readonly lastInjectionTime: number | null;
    /** Latest snapshot time within the currently open turn, or null before one lands. */
    readonly lastTurnInjectionTime: number | null;
    /** The open turn, or -1 between turns; a new turn clears the turn-local baseline. */
    readonly openTurn: number;
}
/** Folds one session event into the clock baseline; uninterested events return the same state reference. @internal exported for tests. */
export declare function applyClockEvent(state: ClockBaseline, event: {
    readonly type: string;
    readonly time: number;
    readonly data?: unknown;
}): ClockBaseline;
/** Fold a whole event log into the clock baseline. @internal exported for tests. */
export declare function foldClockBaseline(events: readonly {
    readonly type: string;
    readonly time: number;
    readonly data?: unknown;
}[]): ClockBaseline;
/** Whether this step appends a snapshot: the first step of a turn always does; later steps only when the turn has outlasted the refresh interval since the last snapshot. Skipped steps never backfill; their span folds into the next elapsed. @internal exported for tests. */
export declare function shouldSampleClock(step: number, now: number, baseline: ClockBaseline, refreshIntervalMs: number): boolean;
/** Render one durable clock snapshot text. @internal exported for tests. */
export declare function renderClockSnapshot(input: {
    readonly now: number;
    readonly turn: number;
    readonly step: number;
    readonly previous: number | undefined;
}): string;
export declare function apply(ctx: Context, config?: Config): void;
export {};
//# sourceMappingURL=member-time-context.d.ts.map