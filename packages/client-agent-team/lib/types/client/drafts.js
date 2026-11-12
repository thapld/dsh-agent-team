/** The key format is this module's contract, so parsing it belongs here. */
export function draftKindOf(key) {
    return key.startsWith('project:') ? 'project' : 'thread';
}
/** Rewriting identical content must not bump `savedAt` or notify: convergence effects re-run freely and would loop through persistence. */
function sameDraftEntry(previous, next) {
    return previous !== undefined && previous.draft === next.draft;
}
const STORAGE_KEY = 'dsh.agent-team.drafts.v1';
/** Retention ceiling; the oldest savedAt entries fall out first. */
const LIMIT = 50;
const EMPTY = Object.freeze({ draft: '' });
function isTeamDraftKey(value) {
    return value.startsWith('project:') || value.startsWith('thread:');
}
function readStored() {
    if (typeof localStorage === 'undefined')
        return new Map();
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '');
        const restored = new Map();
        for (const [storedKey, value] of Object.entries(parsed)) {
            // Projects were called Channels; their drafts were keyed `channel:channel:<id>`.
            const key = storedKey.replace(/^channel:channel:/, 'project:project:');
            if (!isTeamDraftKey(key) || typeof value !== 'object' || value === null)
                continue;
            const candidate = value;
            if (typeof candidate.draft !== 'string' || typeof candidate.savedAt !== 'number')
                continue;
            // Legacy drafts carried `recipientIds`; ignore it — body mentions are now the sole authority.
            restored.set(key, { draft: candidate.draft, savedAt: candidate.savedAt });
        }
        return restored;
    }
    catch {
        // Local persistence is a convenience; malformed content just starts empty.
        return new Map();
    }
}
function persistStored(entries) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        const payload = Object.fromEntries([...entries].map(([key, entry]) => [key, entry]));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    catch {
        // Private mode and quota failures do not block composing.
    }
}
/** One instance per Client context (created in `applyUi`), never a module singleton. */
export class TeamDraftStore {
    entries = readStored();
    snapshots = new Map();
    listeners = new Set();
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    dispose() {
        this.listeners.clear();
    }
    /** Stable per-key snapshot identity for useSyncExternalStore. */
    getSnapshot = (key) => {
        const cached = this.snapshots.get(key);
        if (cached !== undefined)
            return cached;
        const entry = this.entries.get(key);
        if (entry === undefined)
            return EMPTY;
        const snapshot = Object.freeze({ draft: entry.draft });
        this.snapshots.set(key, snapshot);
        return snapshot;
    };
    writeDraft(key, draft) {
        this.write(key, { draft });
    }
    clear(key) {
        if (!this.entries.delete(key))
            return;
        this.snapshots.delete(key);
        persistStored(this.entries);
        for (const listener of this.listeners)
            listener();
    }
    /** Test seam: forget everything, including what localStorage still holds. */
    reset() {
        this.entries = new Map();
        this.snapshots.clear();
        if (typeof localStorage !== 'undefined')
            localStorage.removeItem(STORAGE_KEY);
        for (const listener of this.listeners)
            listener();
    }
    reload() {
        this.entries = readStored();
        this.snapshots.clear();
        for (const listener of this.listeners)
            listener();
    }
    write(key, patch) {
        const previous = this.entries.get(key);
        const next = {
            draft: patch.draft ?? previous?.draft ?? '',
            savedAt: Date.now(),
        };
        if (sameDraftEntry(previous, next))
            return;
        if (next.draft === '') {
            this.clear(key);
            return;
        }
        this.entries.set(key, next);
        this.evict();
        this.snapshots.delete(key);
        persistStored(this.entries);
        for (const listener of this.listeners)
            listener();
    }
    evict() {
        while (this.entries.size > LIMIT) {
            let oldestKey;
            let oldestSavedAt = Number.POSITIVE_INFINITY;
            for (const [key, entry] of this.entries) {
                if (entry.savedAt < oldestSavedAt) {
                    oldestSavedAt = entry.savedAt;
                    oldestKey = key;
                }
            }
            if (oldestKey === undefined)
                return;
            this.entries.delete(oldestKey);
            this.snapshots.delete(oldestKey);
        }
    }
}
export { STORAGE_KEY as TEAM_DRAFTS_STORAGE_KEY };
