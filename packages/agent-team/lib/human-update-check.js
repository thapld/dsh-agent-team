/**
 * Best-effort check for a newer published bundle release. The profile read path never waits on the network: it serves a cached in-memory snapshot and refreshes in the background. Every failure settles as "no update known". Nothing is persisted across Host restarts.
 */
/** Public npm metadata document for the bundle's `latest` dist-tag. */
export const HUMAN_UPDATE_CHECK_REGISTRY_URL = 'https://registry.npmjs.org/@contexera%2fdsh-agent-team/latest';
/** How long one settled check stays authoritative before a re-check. */
export const HUMAN_UPDATE_CHECK_TTL_MS = 12 * 60 * 60 * 1000;
/** Upper bound for one registry round trip; the read path never waits on it. */
export const HUMAN_UPDATE_CHECK_TIMEOUT_MS = 5000;
/** Setting this env var to `0`/`false`/`off` disables the outbound check. */
export const HUMAN_UPDATE_CHECK_ENV = 'DSH_AGENT_TEAM_UPDATE_CHECK';
/** Operator kill-switch; anything but an explicit off value keeps the default on. */
export function isUpdateCheckEnabled(env = process.env) {
    const raw = env[HUMAN_UPDATE_CHECK_ENV]?.trim().toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'off';
}
/** Numeric core of a `major.minor.patch…` version; suffixes are ignored and unparsable values resolve absent. */
export function parseVersionCore(value) {
    const core = value.split('+', 1)[0]?.split('-', 1)[0];
    if (core === undefined || core === '')
        return undefined;
    const parts = core.split('.');
    const numbers = [];
    for (const part of parts) {
        if (part === '' || !/^[0-9]+$/.test(part))
            return undefined;
        numbers.push(Number(part));
    }
    return numbers.length === 0 ? undefined : numbers;
}
/** True when `latest` orders strictly after `current` on the numeric core. */
export function isNewerVersion(current, latest) {
    const from = parseVersionCore(current);
    const to = parseVersionCore(latest);
    if (from === undefined || to === undefined)
        return false;
    const width = Math.max(from.length, to.length);
    for (let index = 0; index < width; index += 1) {
        const left = from[index] ?? 0;
        const right = to[index] ?? 0;
        if (right !== left)
            return right > left;
    }
    return false;
}
/** One registry round trip for the published `latest` version; never throws. */
export async function fetchLatestVersion(fetchImpl, url = HUMAN_UPDATE_CHECK_REGISTRY_URL, timeoutMs = HUMAN_UPDATE_CHECK_TIMEOUT_MS) {
    try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok)
            return undefined;
        const payload = (await response.json());
        return typeof payload?.version === 'string' ? payload.version : undefined;
    }
    catch {
        return undefined;
    }
}
/** Synchronous snapshot over a background-refreshed cache. `snapshot()` never blocks: a stale or empty cache serves the last known value and starts at most one shared refresh; failures leave the previous value standing. */
export function createHumanUpdateChecker(options) {
    const { currentVersion, ttlMs = HUMAN_UPDATE_CHECK_TTL_MS, timeoutMs = HUMAN_UPDATE_CHECK_TIMEOUT_MS, now = Date.now, env = process.env, } = options;
    const fetchImpl = options.fetchImpl ?? ((url, init) => globalThis.fetch(url, init));
    let latestVersion;
    let checkedAt = Number.NEGATIVE_INFINITY;
    let inFlight;
    const refresh = () => {
        if (inFlight !== undefined)
            return;
        if (!isUpdateCheckEnabled(env))
            return;
        const settled = fetchLatestVersion(fetchImpl, HUMAN_UPDATE_CHECK_REGISTRY_URL, timeoutMs).then(version => {
            checkedAt = now();
            if (version !== undefined && isNewerVersion(currentVersion, version))
                latestVersion = version;
        });
        const tracked = settled.finally(() => {
            if (inFlight === tracked)
                inFlight = undefined;
        });
        inFlight = tracked;
        // Rejections are already absorbed inside fetchLatestVersion, but the
        // finally chain still needs a settlement handler so a Host without an
        // unhandled-rejection policy never sees one from this floating refresh.
        void tracked.catch(() => { });
    };
    return {
        snapshot: () => {
            if (checkedAt + ttlMs <= now())
                refresh();
            if (latestVersion === undefined)
                return {};
            return { latestVersion };
        },
    };
}
