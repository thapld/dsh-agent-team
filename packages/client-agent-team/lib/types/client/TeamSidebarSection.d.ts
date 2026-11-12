import type { ReactNode } from 'react';
export declare function TeamSidebarSection({ title, help, actions, open, onToggle, children }: {
    readonly title: string;
    /** A model explanation on hover, to the right. Covering the row beside it is accepted; folding the section is not. */
    readonly help?: {
        readonly label: string;
        readonly body: string;
    };
    /** Trailing header controls (the add button); never part of the toggle. */
    readonly actions?: ReactNode;
    /** Controlled disclosure state; the caller owns persistence. */
    readonly open: boolean;
    readonly onToggle: (open: boolean) => void;
    readonly children: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=TeamSidebarSection.d.ts.map