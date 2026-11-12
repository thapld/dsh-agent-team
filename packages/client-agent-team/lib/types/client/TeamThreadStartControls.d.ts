import type { TeamConversationProps } from './slots.ts';
/** Rules version 2 composer controls: the owner turns the send into a new Thread, as a discussion or, checked, a Task. */
export declare function TeamThreadStartControls({ open, asTask, pending, onOpenChange, onAsTaskChange, t }: {
    readonly open: boolean;
    readonly asTask: boolean;
    readonly pending: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly onAsTaskChange: (asTask: boolean) => void;
    readonly t: TeamConversationProps['t'];
}): import("react").JSX.Element;
//# sourceMappingURL=TeamThreadStartControls.d.ts.map