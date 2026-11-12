import { type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives';
/** Overflow menu shared by sidebar Project and Agent rows; the owning row stays pinned to its hover fill while open. */
export declare function TeamRowMenu({ label, items, onSelect, onOpenChange }: {
    readonly label: string;
    readonly items: readonly MenuEntry[];
    readonly onSelect: (id: string) => void;
    /** Lets the row pin its hover styling while the portal list is up. */
    readonly onOpenChange?: (open: boolean) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=TeamRowMenu.d.ts.map