import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
export type TeamSidebarListKind = 'projects' | 'agents';
export type SidebarDropMarker = 'before' | 'after';
/** The Host Remote pair this module persists through, injected once by the Client wiring. */
export interface SidebarOrderHost {
    readonly load: () => Promise<RemoteResult<{
        readonly lists: Readonly<Record<string, readonly string[]>>;
    }>>;
    readonly save: (request: {
        readonly key: string;
        readonly refs: readonly string[];
    }) => Promise<RemoteResult<{
        readonly lists: Readonly<Record<string, readonly string[]>>;
    }>>;
}
/** Removed refs disappear; new refs join in their Remote default positions after the known ones. */
export declare function reconcileSidebarOrder<R extends string>(saved: readonly string[], current: readonly R[]): readonly R[];
/** Point this module at the Host Remote pair (once per Client wiring); passing `undefined` detaches it. */
export declare function attachSidebarOrderHost(next: SidebarOrderHost | undefined): void;
/** Read the Host's saved order once per attached Host; the first list to render starts it. */
export declare function ensureSidebarOrderHydrated(): Promise<void>;
/** Identity-stable across renders while neither the data nor this browser's preference changes. */
export declare function useSidebarOrder<R extends string>(workspaceId: WorkspaceId | undefined, kind: TeamSidebarListKind, refs: readonly R[]): readonly R[];
/**
 * The only mutation path. Returns the new order, or `undefined` when nothing would change (unknown refs, dropping a row
 * onto itself, or an adjacent marker). The cache, a Host write, and subscriber notification happen here.
 */
export declare function moveSidebarItem<R extends string>(workspaceId: WorkspaceId | undefined, kind: TeamSidebarListKind, refs: readonly R[], movedRef: R, targetRef: R, marker: SidebarDropMarker): readonly R[] | undefined;
//# sourceMappingURL=sidebar-order.d.ts.map