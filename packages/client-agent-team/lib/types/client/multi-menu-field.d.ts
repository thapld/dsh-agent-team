import type { ReactNode } from 'react';
export interface MultiMenuOption {
    readonly id: string;
    readonly label: string;
    readonly disabled?: boolean;
    readonly icon?: ReactNode;
    readonly hint?: string;
}
/** `label` doubles as the trigger's accessible name; `disabled` disables the trigger while a mutation is in flight. */
export declare function MultiMenuField<I extends string>({ label, options, selected, onToggle, disabled, emptyText, triggerEmptyLabel, formatCount }: {
    readonly label: string;
    readonly options: readonly MultiMenuOption[];
    readonly selected: readonly I[];
    readonly onToggle: (id: I) => void;
    readonly disabled?: boolean;
    readonly emptyText?: string;
    readonly triggerEmptyLabel: string;
    readonly formatCount: (count: number) => string;
}): import("react").JSX.Element;
//# sourceMappingURL=multi-menu-field.d.ts.map