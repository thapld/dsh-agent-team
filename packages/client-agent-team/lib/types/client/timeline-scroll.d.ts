export interface TimelineScroll {
    readonly ref: React.RefObject<HTMLElement>;
    onScroll: () => void;
    isPinned: () => boolean;
    scrollToBottom: () => void;
}
/** Shared by Project and Thread: follow new facts only while pinned to the bottom, and hold one visible Message at the same viewport offset when content changes. The content key must change whenever rendered facts change. */
export declare function useTimelineScroll(contentKey: string): TimelineScroll;
//# sourceMappingURL=timeline-scroll.d.ts.map