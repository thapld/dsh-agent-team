export type TimelineBlock<T> = {
    readonly kind: 'run';
    readonly items: readonly T[];
} | {
    readonly kind: 'day';
    readonly label: string;
};
/**
 * One entry of a timeline that mixes facts with projections that are not facts — a Task derived from the discussion is
 * the only such projection today. A projected card has no sender and no instant of its own, so it never joins a run and
 * never introduces a day separator.
 */
export type TimelineEntry<T, C> = {
    readonly kind: 'fact';
    readonly fact: T;
} | {
    readonly kind: 'card';
    readonly key: string;
    readonly card: C;
};
/** Where a projected card sits: the sequence of the fact it was derived from, and the identity its React key needs. */
export interface TimelineCardPlacement {
    readonly sequence: number;
    readonly key: string;
}
/** One node of a rendered timeline: a same-sender run, a day divider, a projected card, the unread boundary, or a lone activity. */
export type TimelineNode<T, C> = {
    readonly kind: 'run';
    readonly items: readonly T[];
} | {
    readonly kind: 'day';
    readonly label: string;
} | {
    readonly kind: 'card';
    readonly key: string;
    readonly card: C;
} | {
    readonly kind: 'boundary';
} | {
    readonly kind: 'lone';
    readonly fact: T;
};
/** Same-sender messages at least this many minutes apart count as separate turns. */
export declare const RUN_GAP_MINUTES = 5;
/** Only a real waiting gap earns a time divider; rapid bursts stay one run. */
export declare function isRunGap(previousOccurredAt: string | undefined, occurredAt: string | undefined): boolean;
export declare function localDateKey(occurredAt: string): string;
/** MM-DD within the current year, YYYY-MM-DD across years. */
export declare function daySeparatorLabel(occurredAt: string, now?: Date): string;
/** Breaks a run at every calendar-day change. Items without a wall-clock instant (activities) inherit the preceding message's day and never trigger a boundary. */
export declare function chunkRunsWithDays<T>(items: readonly T[], senderOf: (item: T) => string | undefined, occurredAtOf: (item: T) => string | undefined): readonly TimelineBlock<T>[];
/**
 * Merge facts and projected cards into one sequence-ordered stream. A card sits before the first fact with a greater
 * sequence, so it keeps the place where its Task was created instead of collecting at the end of the timeline.
 */
export declare function placeCards<T, C>(facts: readonly T[], cards: readonly C[], sequenceOf: (fact: T) => number, placementOf: (card: C) => TimelineCardPlacement): readonly TimelineEntry<T, C>[];
/**
 * Group a merged fact/card stream into render nodes. A card breaks the surrounding run and inherits the current day, the
 * boundary sits before the first fact it marks, and a fact with no sender (an activity) never joins a run.
 */
export declare function chunkTimeline<T, C>(entries: readonly TimelineEntry<T, C>[], senderOf: (fact: T) => string | undefined, occurredAtOf: (fact: T) => string | undefined, isBoundaryOf?: (fact: T) => boolean): readonly TimelineNode<T, C>[];
//# sourceMappingURL=team-separators.d.ts.map