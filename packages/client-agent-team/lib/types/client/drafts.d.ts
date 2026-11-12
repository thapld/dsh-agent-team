import type { AgentTeamProjectRef, AgentTeamThreadRef } from '@contexera/dsh-agent-team/types';
/** Drafts are local UI convenience state, never Host-authoritative, so localStorage is their home. */
export type TeamDraftKey = `project:${AgentTeamProjectRef}` | `thread:${AgentTeamThreadRef}`;
export type TeamDraftKind = 'project' | 'thread';
/** The key format is this module's contract, so parsing it belongs here. */
export declare function draftKindOf(key: TeamDraftKey): TeamDraftKind;
/** One cached composer state. */
export interface TeamDraftState {
    readonly draft: string;
}
declare const STORAGE_KEY = "dsh.agent-team.drafts.v1";
/** One instance per Client context (created in `applyUi`), never a module singleton. */
export declare class TeamDraftStore {
    private entries;
    private readonly snapshots;
    private readonly listeners;
    readonly subscribe: (listener: () => void) => (() => void);
    dispose(): void;
    /** Stable per-key snapshot identity for useSyncExternalStore. */
    readonly getSnapshot: (key: TeamDraftKey) => TeamDraftState;
    writeDraft(key: TeamDraftKey, draft: string): void;
    clear(key: TeamDraftKey): void;
    /** Test seam: forget everything, including what localStorage still holds. */
    reset(): void;
    reload(): void;
    private write;
    private evict;
}
export { STORAGE_KEY as TEAM_DRAFTS_STORAGE_KEY };
//# sourceMappingURL=drafts.d.ts.map