/** The one count capsule shared by the Inbox entry, the Thread entry and the queue row. Zero renders nothing. */
export declare function TeamCountBadge({ count, tone, label, className }: {
    readonly count: number;
    /** `hairline` is unread that merely arrived; the solid fill is unread that names this reader. */
    readonly tone?: 'solid' | 'hairline' | undefined;
    /** The accessible name while the count is the only thing saying it; omit it when the surrounding control already carries the number. */
    readonly label?: string | undefined;
    readonly className?: string | undefined;
}): import("react").JSX.Element | null;
//# sourceMappingURL=TeamCountBadge.d.ts.map