import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
export declare function useEditDialogSave<Request>({ save, onCommitted, onClose }: {
    readonly save: (request: Request) => Promise<RemoteResult<unknown>>;
    readonly onCommitted: () => Promise<void> | void;
    readonly onClose: () => void;
}): {
    readonly saving: boolean;
    readonly error: string | undefined;
    /** `build` receives the request retained only after an uncertain write, so an unchanged retry preserves its ID. */
    readonly save: (build: (previous: Request | undefined) => Request) => Promise<void>;
    readonly invalidate: () => void;
};
//# sourceMappingURL=team-dialog-save.d.ts.map