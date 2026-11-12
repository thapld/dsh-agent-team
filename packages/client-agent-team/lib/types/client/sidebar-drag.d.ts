import type { ReactNode } from 'react';
import type { SidebarDropMarker } from './sidebar-order.ts';
export interface SidebarRowDragHandlers<K extends string> {
    readonly rowProps: (orderKey: K) => {
        readonly draggable: true;
        readonly className?: string | undefined;
        readonly onDragStart: (event: React.DragEvent<HTMLElement>) => void;
        readonly onDragEnd: () => void;
        readonly onDragOver: (event: React.DragEvent<HTMLElement>) => void;
        readonly onDrop: (event: React.DragEvent<HTMLElement>) => void;
    };
}
/** One drag gesture per panel instance; `onCommit` fires exactly once per completed gesture. */
export declare function useSidebarRowDrag<K extends string>({ refs, onCommit }: {
    readonly refs: readonly K[];
    readonly onCommit: (movedRef: K, targetRef: K, marker: SidebarDropMarker) => void;
}): SidebarRowDragHandlers<K>;
/** Owns the drop-marker styling for one row without adding layout; the styled row stays inside so descendant selectors keep working. */
export declare function SortableRow<K extends string>({ drag, orderKey, children }: {
    readonly drag: SidebarRowDragHandlers<K>;
    readonly orderKey: K;
    readonly children: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=sidebar-drag.d.ts.map