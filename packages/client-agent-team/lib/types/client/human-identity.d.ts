import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { AgentTeamHumanProfileResult, AgentTeamPutHumanAvatarResult, AgentTeamRemoveHumanAvatarResult, AgentTeamSetHumanProfileResult } from '@contexera/dsh-agent-team/types';
/**
 * The Client's one projection of the Human identity, so every seat that names or draws the Human shows one rename and one face.
 * Durable facts live in the Host (name and avatar reference in the Team Host row's Config, bytes in the avatar store);
 * writes go through the Host's profile and avatar Remotes.
 *
 * `name` stays undefined until the first read settles, and callers fall back to their own localized name. Reads are
 * demand-driven: the first subscriber starts the read.
 */
export interface TeamHumanIdentitySnapshot {
    /** `unavailable` only when no value was ever accepted; it is the one state that offers a retry. */
    readonly status: 'loading' | 'ready' | 'unavailable';
    readonly name?: string | undefined;
    /** Configured avatar reference; undefined means the identity fallback is the avatar. */
    readonly avatarRef?: string | undefined;
    readonly avatarUrl?: string | undefined;
    /** Opaque Host-instance plus settings-revision fence; returned verbatim on the next write. */
    readonly settingsFence?: string | undefined;
    readonly version?: string | undefined;
    readonly repoUrl?: string | undefined;
    /** A newer published release, when one is known; the footnote stays version + link until then. */
    readonly latestVersion?: string | undefined;
    /** Last failure, kept beside the last accepted value so a page can report it. */
    readonly error?: string | undefined;
}
export interface TeamHumanIdentitySource {
    getSnapshot(): TeamHumanIdentitySnapshot;
    subscribe(listener: () => void): () => void;
}
/** The settings page's extra face: re-read after a failed or superseded read. */
export interface TeamHumanIdentityFace extends TeamHumanIdentitySource {
    refresh(): Promise<void>;
    /** Invalidate any in-flight read and start a fresh one after a durable profile write. */
    refreshAfterWrite(): Promise<void>;
}
export interface TeamHumanIdentityLoader {
    loadProfile: () => Promise<RemoteResult<AgentTeamHumanProfileResult>>;
    /** Resolve one avatar reference to a displayable URL; null falls back to the initial. */
    loadAvatarUrl: (avatarRef: string) => Promise<string | null>;
}
export interface TeamHumanProfileWriterLoader {
    readonly setHumanName: (name: string, expectedFence: string) => Promise<RemoteResult<AgentTeamSetHumanProfileResult>>;
    readonly replaceAvatar: (request: {
        readonly name: string;
        readonly mediaType?: string | undefined;
        readonly bytesBase64: string;
    }, expectedFence: string) => Promise<RemoteResult<AgentTeamPutHumanAvatarResult>>;
    readonly removeAvatar: (expectedFence: string) => Promise<RemoteResult<AgentTeamRemoveHumanAvatarResult>>;
}
/** One settings-page write result. A saved write may still need a profile re-read before its new value is visible. */
export type TeamHumanProfileActionOutcome = {
    readonly kind: 'rejected';
    readonly message: string;
} | {
    readonly kind: 'conflict';
    readonly message: string;
} | {
    readonly kind: 'uncertain';
    readonly message: string;
} | {
    readonly kind: 'saved';
    readonly warning: string;
} | undefined;
export declare class TeamHumanIdentity implements TeamHumanIdentityFace {
    private snapshot;
    private readonly listeners;
    private reading;
    private generation;
    private readonly loader;
    constructor(loader: TeamHumanIdentityLoader);
    readonly getSnapshot: () => TeamHumanIdentitySnapshot;
    readonly subscribe: (listener: () => void) => (() => void);
    /** Concurrent callers share one round trip; a failed refresh keeps the last accepted value beside the error. */
    refresh(): Promise<void>;
    refreshAfterWrite(): Promise<void>;
    private startRead;
    dispose(): void;
    private read;
    /** Bytes are immutable per reference, so one fetch serves every later refresh with the same avatar. */
    private avatarUrlFor;
    /** A previously accepted value stays on screen; only an identity that never loaded becomes `unavailable`. */
    private recordReadFailure;
    private commit;
}
/** Settings-page writes share one rule: a successful durable write is never reported as a save failure. */
export declare class TeamHumanProfileWriter {
    private readonly identity;
    private readonly loader;
    constructor(identity: TeamHumanIdentityFace, loader: TeamHumanProfileWriterLoader);
    setName(name: string, expectedFence: string): Promise<TeamHumanProfileActionOutcome>;
    replaceAvatar(request: {
        readonly name: string;
        readonly mediaType?: string | undefined;
        readonly bytesBase64: string;
    }, expectedFence: string): Promise<TeamHumanProfileActionOutcome>;
    removeAvatar(expectedFence: string): Promise<TeamHumanProfileActionOutcome>;
    private finish;
}
export declare function useHumanIdentity(identity: TeamHumanIdentitySource): TeamHumanIdentitySnapshot;
//# sourceMappingURL=human-identity.d.ts.map