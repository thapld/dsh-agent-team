import type { AgentTeamMainStreamHistory, AgentTeamMainStreamReadResult, AgentTeamMainStreamStanding, AgentTeamMainTimelineEntry, AgentTeamProjectRef } from '@contexera/dsh-agent-team/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { TeamConversationProps } from './slots.ts';
/** How long an arrival keeps its mark: long enough to be noticed, short enough to stay information rather than furniture. */
export declare const ARRIVAL_MARK_MS = 3000;
interface MainStreamSnapshot {
    readonly entries: readonly AgentTeamMainTimelineEntry[];
    readonly cursor: number;
    readonly hasMore: boolean;
    readonly standing: AgentTeamMainStreamStanding;
    /** Keys first shown unread in this visit, with the instant they were shown. See {@link liveArrivals}. */
    readonly arrivals: ReadonlyMap<string, number>;
}
export declare function mainEntryKey(entry: AgentTeamMainTimelineEntry): string;
/**
 * The keys still inside their arriving hold. The hold is what makes the mark information: an entry arrives marked, stays
 * marked long enough to be noticed, and is released on its own clock — never held until the reader leaves the page.
 */
export declare function liveArrivals(arrivals: ReadonlyMap<string, number>, now: number): ReadonlySet<string>;
/** A fresh page is authoritative for the sequences it covers; loaded entries outside it stay. */
export declare function mergeMainStream(current: MainStreamSnapshot | undefined, fresh: AgentTeamMainStreamHistory, now?: number): MainStreamSnapshot;
/**
 * A read's answer is authoritative for the entries it carries, flagged as the reader saw them before the read. Unlike a history page it is not
 * contiguous — it adds any older entry whose marker the read consumes — so entries overlay by key instead of replacing a range.
 */
export declare function mergeMainRead(current: MainStreamSnapshot, read: AgentTeamMainStreamReadResult, now?: number): MainStreamSnapshot;
/**
 * The marked keys of one render, and a timer for the next release: entries can arrive in a burst, so the earliest deadline
 * schedules the re-render and the following one takes over from there.
 */
export declare function useArrivalMarks(arrivals: ReadonlyMap<string, number>): ReadonlySet<string>;
interface UseMainStreamOptions {
    readonly workspaceId: WorkspaceId;
    readonly projectRef: AgentTeamProjectRef;
    readonly mainStreamHistory: TeamConversationProps['mainStreamHistory'];
    readonly readMainStream: TeamConversationProps['readMainStream'];
    readonly subscribeChanges: TeamConversationProps['subscribeChanges'];
}
export interface MainStreamState {
    readonly entries: readonly AgentTeamMainTimelineEntry[];
    /** Entries still inside their arriving hold: the mark a reader sees, on its own clock. */
    readonly marked: ReadonlySet<string>;
    readonly hasMore: boolean;
    readonly loading: boolean;
    readonly loadingOlder: boolean;
    readonly error: string | undefined;
    readonly refresh: () => Promise<boolean>;
    readonly loadOlder: () => Promise<void>;
    /** Acknowledge everything loaded so far; the Host-owned standing decides what is still unread. */
    readonly markRead: () => Promise<void>;
}
/**
 * Newest page first, older pages on demand. The page is mounted only while the Main stream is the visible reading, so a
 * standing with unread entries or markers is acknowledged as soon as it is on screen.
 */
export declare function useMainStream({ workspaceId, projectRef, mainStreamHistory, readMainStream, subscribeChanges }: UseMainStreamOptions): MainStreamState;
export {};
//# sourceMappingURL=main-stream.d.ts.map