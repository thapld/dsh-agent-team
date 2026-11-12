/**
 * Human presentation preference: whether each Team sidebar section is expanded. It lives in this browser only and is
 * never a shared Team fact. Same storage discipline as `sidebar-order.ts`: a read-through cache so other tabs' writes are
 * picked up, and an in-memory fallback when storage is unavailable.
 */
import { useCallback, useSyncExternalStore } from 'react';
const STORAGE_KEY = 'dsh.agent-team.sidebar-sections';
function sectionKey(workspaceId, kind) {
    // The Workspace selector is a field, not a collapsible section, so it keeps no preference.
    return workspaceId === undefined ? undefined : `${workspaceId}|${kind}`;
}
const MEMORY_ONLY = Symbol('sidebar-sections.memory');
/** Read-through parse cache over the raw persisted payload; see `sidebar-order.ts`. */
let cachedRaw;
let cachedCollapsed = new Set();
function storedCollapsed() {
    let raw = null;
    try {
        raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    }
    catch {
        raw = null;
    }
    if (cachedRaw !== undefined && raw !== null && raw === cachedRaw)
        return cachedCollapsed;
    if (raw === null) {
        if (cachedRaw === MEMORY_ONLY)
            return cachedCollapsed;
        cachedRaw = raw;
        cachedCollapsed = new Set();
        return cachedCollapsed;
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('not an object');
        const keys = parsed.collapsed;
        if (!Array.isArray(keys) || !keys.every(key => typeof key === 'string'))
            throw new Error('bad shape');
        cachedRaw = raw;
        // Projects were called Channels; a section collapsed before the rename stays collapsed.
        cachedCollapsed = new Set(keys.map(key => key.replace(/\|channels$/, '|projects')));
        return cachedCollapsed;
    }
    catch {
        return new Set();
    }
}
function writeCollapsed(collapsed) {
    cachedCollapsed = collapsed;
    try {
        if (typeof localStorage === 'undefined')
            throw new Error('no localStorage');
        const raw = JSON.stringify({ collapsed: [...collapsed] });
        localStorage.setItem(STORAGE_KEY, raw);
        cachedRaw = raw;
        return;
    }
    catch {
        // Private mode and quota failures do not block folding; the in-memory state keeps serving.
        cachedRaw = MEMORY_ONLY;
    }
}
const listeners = new Set();
/** `false` only when this browser explicitly collapsed it. */
export function useSidebarSectionOpen(workspaceId, kind) {
    const key = sectionKey(workspaceId, kind);
    const subscribe = useCallback((listener) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }, []);
    return useSyncExternalStore(subscribe, () => key === undefined ? true : !storedCollapsed().has(key), () => key === undefined ? true : !storedCollapsed().has(key));
}
/** The only mutation path. Unknown keys (missing workspace) no-op so an unloaded workspace never persists a phantom preference. */
export function setSidebarSectionOpen(workspaceId, kind, open) {
    const key = sectionKey(workspaceId, kind);
    if (key === undefined)
        return;
    const next = new Set(storedCollapsed());
    if (open)
        next.delete(key);
    else
        next.add(key);
    writeCollapsed(next);
    for (const listener of listeners)
        listener();
}
