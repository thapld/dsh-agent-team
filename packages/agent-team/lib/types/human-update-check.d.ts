/**
 * Best-effort check for a newer published bundle release. The profile read path never waits on the network: it serves a cached in-memory snapshot and refreshes in the background. Every failure settles as "no update known". Nothing is persisted across Host restarts.
 */
/** Public npm metadata document for the bundle's `latest` dist-tag. */
export declare const HUMAN_UPDATE_CHECK_REGISTRY_URL = "https://registry.npmjs.org/@contexera%2fdsh-agent-team/latest";
/** How long one settled check stays authoritative before a re-check. */
export declare const HUMAN_UPDATE_CHECK_TTL_MS: number;
/** Upper bound for one registry round trip; the read path never waits on it. */
export declare const HUMAN_UPDATE_CHECK_TIMEOUT_MS = 5000;
/** Setting this env var to `0`/`false`/`off` disables the outbound check. */
export declare const HUMAN_UPDATE_CHECK_ENV = "DSH_AGENT_TEAM_UPDATE_CHECK";
/** Minimal fetch surface the check needs; the global fetch satisfies it. */
export interface UpdateCheckFetcher {
    (url: string, init: {
        readonly signal: AbortSignal;
    }): Promise<{
        readonly ok: boolean;
        json(): Promise<unknown>;
    }>;
}
/** Operator kill-switch; anything but an explicit off value keeps the default on. */
export declare function isUpdateCheckEnabled(env?: {
    readonly [key: string]: string | undefined;
}): boolean;
/** Numeric core of a `major.minor.patch…` version; suffixes are ignored and unparsable values resolve absent. */
export declare function parseVersionCore(value: string): readonly number[] | undefined;
/** True when `latest` orders strictly after `current` on the numeric core. */
export declare function isNewerVersion(current: string, latest: string): boolean;
/** One registry round trip for the published `latest` version; never throws. */
export declare function fetchLatestVersion(fetchImpl: UpdateCheckFetcher, url?: string, timeoutMs?: number): Promise<string | undefined>;
export interface HumanUpdateCheckerOptions {
    readonly currentVersion: string;
    readonly fetchImpl?: UpdateCheckFetcher | undefined;
    readonly now?: (() => number) | undefined;
    readonly ttlMs?: number | undefined;
    readonly timeoutMs?: number | undefined;
    readonly env?: {
        readonly [key: string]: string | undefined;
    } | undefined;
}
/** A newer published release is known; `latestVersion` is absent until one is. */
export interface HumanUpdateSnapshot {
    readonly latestVersion?: string | undefined;
}
/** Synchronous snapshot over a background-refreshed cache. `snapshot()` never blocks: a stale or empty cache serves the last known value and starts at most one shared refresh; failures leave the previous value standing. */
export declare function createHumanUpdateChecker(options: HumanUpdateCheckerOptions): {
    readonly snapshot: () => HumanUpdateSnapshot;
};
//# sourceMappingURL=human-update-check.d.ts.map