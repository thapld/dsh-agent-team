/**
 * Team settings' profile-wide extra tool-name editor.
 *
 * The Host settings document is the durable authority. This controller owns
 * only the browser draft, the discovered-name catalog, and the UI's distinction
 * between a stale revision and a rejected write.
 * @module @contexera/dsh-agent-team/client/extra-tool-grants
 */
import type { SettingsDescribeValue, SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { AgentTeamToolCatalogResult } from '@contexera/dsh-agent-team/types';
/** The settings Remote methods this editor uses directly, without ConfigForm's lossy boolean. */
export interface ExtraToolGrantsSettings {
    describe(): Promise<RemoteResult<SettingsDescribeValue>>;
    mutate(namespace: string, ops: readonly SettingsPathOpView[], expectedRevision: number | undefined): Promise<RemoteResult<SettingsNamespaceView>>;
}
/** The public Host discovery read; it is not a per-Member filtered view. */
export interface ExtraToolCatalog {
    load(): Promise<RemoteResult<AgentTeamToolCatalogResult>>;
}
export interface ExtraToolGrantsDeps {
    readonly namespace: string;
    readonly settings: ExtraToolGrantsSettings;
    readonly catalog: ExtraToolCatalog;
}
export type ExtraToolListStatus = 'loading' | 'ready' | 'error';
export type ExtraToolCatalogStatus = 'loading' | 'ready' | 'error';
export type ExtraToolNotice = {
    readonly kind: 'saved';
} | {
    readonly kind: 'rejected';
    readonly message: string;
} | {
    readonly kind: 'failed';
    readonly message: string;
} | {
    readonly kind: 'conflict';
    readonly message: string;
    readonly expected: number;
    readonly actual: number;
    readonly latestCommitted?: readonly string[] | undefined;
    readonly reloadFailure?: string | undefined;
};
export interface ExtraToolGrantsState {
    readonly listStatus: ExtraToolListStatus;
    readonly listError?: string | undefined;
    readonly catalogStatus: ExtraToolCatalogStatus;
    readonly catalogError?: string | undefined;
    readonly catalog: readonly string[];
    readonly committed: readonly string[];
    readonly draft: readonly string[];
    readonly missing: readonly string[];
    readonly writable: boolean;
    readonly revision?: number | undefined;
    readonly search: string;
    readonly dirty: boolean;
    readonly canSave: boolean;
    readonly canDiscard: boolean;
    readonly saving: boolean;
    readonly awaitingReview: boolean;
    readonly notice?: ExtraToolNotice | undefined;
}
export interface ExtraToolGrantsFace {
    getSnapshot(): ExtraToolGrantsState;
    subscribe(listener: () => void): () => void;
    load(): void;
    loadCatalog(): void;
    setSearch(text: string): void;
    toggle(name: string): void;
    clear(): void;
    discard(): void;
    save(): void;
    acknowledgeConflict(): void;
}
/**
 * Stage the draft independently from the accepted list. A failed list read is
 * never materialized as an empty saved value, and a conflict keeps both sides
 * visible until the Human explicitly acknowledges the latest revision.
 */
export declare class ExtraToolGrantsController implements ExtraToolGrantsFace {
    private readonly deps;
    private readonly store;
    private loadGeneration;
    private catalogGeneration;
    constructor(deps: ExtraToolGrantsDeps);
    readonly getSnapshot: () => ExtraToolGrantsState;
    readonly subscribe: (listener: () => void) => (() => void);
    /** Read the accepted list. Called once at mount and explicitly on retry. */
    readonly load: () => void;
    /** Read the discovery names independently of settings and Human identity. */
    readonly loadCatalog: () => void;
    readonly setSearch: (text: string) => void;
    readonly toggle: (name: string) => void;
    readonly clear: () => void;
    readonly discard: () => void;
    readonly acknowledgeConflict: () => void;
    readonly save: () => void;
    private recoverConflict;
    private readAccepted;
    private acceptList;
}
/** Subscribe one settings section to the editor's draft and results. */
export declare function useExtraToolGrants(face: ExtraToolGrantsFace): ExtraToolGrantsState;
//# sourceMappingURL=extra-tool-grants.d.ts.map