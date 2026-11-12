/**
 * Team settings' profile-wide extra tool-name editor.
 *
 * The Host settings document is the durable authority. This controller owns
 * only the browser draft, the discovered-name catalog, and the UI's distinction
 * between a stale revision and a rejected write.
 * @module @contexera/dsh-agent-team/client/extra-tool-grants
 */
import { useSyncExternalStore } from 'react';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { EXTRA_TOOL_GRANTS_FIELD, extraToolGrantsFrom, sanitizeExtraToolGrants, } from '@contexera/dsh-agent-team/member-tool-grants';
const INITIAL = Object.freeze({
    listStatus: 'loading',
    catalogStatus: 'loading',
    catalog: Object.freeze([]),
    committed: Object.freeze([]),
    draft: Object.freeze([]),
    missing: Object.freeze([]),
    writable: false,
    search: '',
    dirty: false,
    canSave: false,
    canDiscard: false,
    saving: false,
    awaitingReview: false,
});
/** Read one plain record without accepting arrays as a settings section. */
function recordOf(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
function failureCodeOf(error) {
    if (typeof error !== 'object' || error === null)
        return undefined;
    const code = Reflect.get(error, 'code');
    return typeof code === 'string' ? code : undefined;
}
function sameNames(left, right) {
    if (left.length !== right.length)
        return false;
    return left.every((name, index) => name === right[index]);
}
function missingNames(draft, catalog) {
    const known = new Set(catalog);
    return Object.freeze(draft.filter(name => !known.has(name)));
}
function decodedNames(view) {
    return extraToolGrantsFrom(recordOf(view.value)?.[EXTRA_TOOL_GRANTS_FIELD]);
}
function derived(state) {
    const draft = [...state.draft].sort();
    const committed = [...state.committed].sort();
    const dirty = !sameNames(draft, committed);
    return {
        ...state,
        draft: Object.freeze(draft),
        committed: Object.freeze(committed),
        missing: missingNames(draft, state.catalog),
        dirty,
        canSave: state.listStatus === 'ready'
            && state.writable
            && state.revision !== undefined
            && !state.saving
            && !state.awaitingReview
            && dirty,
        canDiscard: state.listStatus === 'ready'
            && !state.saving
            && dirty
            && (!state.awaitingReview || (state.notice?.kind === 'conflict' && state.notice.latestCommitted !== undefined)),
    };
}
/**
 * Stage the draft independently from the accepted list. A failed list read is
 * never materialized as an empty saved value, and a conflict keeps both sides
 * visible until the Human explicitly acknowledges the latest revision.
 */
export class ExtraToolGrantsController {
    deps;
    store;
    loadGeneration = 0;
    catalogGeneration = 0;
    constructor(deps) {
        this.deps = deps;
        this.store = createSnapshotStore(INITIAL, { flush: 'sync' });
    }
    getSnapshot = () => this.store.getSnapshot();
    subscribe = (listener) => this.store.subscribe(listener);
    /** Read the accepted list. Called once at mount and explicitly on retry. */
    load = () => {
        const state = this.getSnapshot();
        if (state.saving)
            return;
        const generation = ++this.loadGeneration;
        this.store.set(derived({
            ...state,
            listStatus: 'loading',
            listError: undefined,
            notice: state.awaitingReview ? state.notice : undefined,
        }));
        void this.readAccepted().then(accepted => {
            if (generation !== this.loadGeneration)
                return;
            this.acceptList(accepted);
        }, (error) => {
            if (generation !== this.loadGeneration)
                return;
            this.store.set(derived({
                ...this.getSnapshot(),
                listStatus: 'error',
                listError: messageOf(error),
                writable: false,
                revision: undefined,
            }));
        });
    };
    /** Read the discovery names independently of settings and Human identity. */
    loadCatalog = () => {
        const generation = ++this.catalogGeneration;
        this.store.update((draft) => {
            draft.catalogStatus = 'loading';
            draft.catalogError = undefined;
        });
        void this.deps.catalog.load().then((response) => {
            if (generation !== this.catalogGeneration)
                return;
            if (!response.ok) {
                this.store.update((draft) => {
                    draft.catalogStatus = 'error';
                    draft.catalogError = response.error.message;
                });
                return;
            }
            const catalog = Object.freeze([...new Set(response.value.names)].sort());
            this.store.set(derived({
                ...this.getSnapshot(),
                catalogStatus: 'ready',
                catalogError: undefined,
                catalog,
            }));
        }, (error) => {
            if (generation !== this.catalogGeneration)
                return;
            this.store.update((draft) => {
                draft.catalogStatus = 'error';
                draft.catalogError = messageOf(error);
            });
        });
    };
    setSearch = (text) => {
        this.store.update((draft) => { draft.search = text; });
    };
    toggle = (name) => {
        const state = this.getSnapshot();
        if (state.listStatus !== 'ready' || !state.writable || state.saving || state.awaitingReview)
            return;
        const selected = new Set(state.draft);
        if (selected.has(name))
            selected.delete(name);
        else
            selected.add(name);
        this.store.set(derived({
            ...state,
            draft: Object.freeze([...selected].sort()),
            notice: undefined,
        }));
    };
    clear = () => {
        const state = this.getSnapshot();
        if (state.listStatus !== 'ready' || !state.writable || state.saving || state.awaitingReview)
            return;
        this.store.set(derived({ ...state, draft: Object.freeze([]), notice: undefined }));
    };
    discard = () => {
        const state = this.getSnapshot();
        if (!state.canDiscard)
            return;
        this.store.set(derived({
            ...state,
            draft: Object.freeze([...state.committed]),
            awaitingReview: false,
            notice: undefined,
        }));
    };
    acknowledgeConflict = () => {
        const state = this.getSnapshot();
        if (!state.awaitingReview || state.revision === undefined || state.listStatus !== 'ready'
            || state.notice?.kind !== 'conflict' || state.notice.latestCommitted === undefined)
            return;
        this.store.set(derived({
            ...state,
            awaitingReview: false,
            notice: undefined,
        }));
    };
    save = () => {
        const state = this.getSnapshot();
        if (!state.canSave || state.revision === undefined)
            return;
        const expectedRevision = state.revision;
        const names = sanitizeExtraToolGrants(state.draft);
        this.store.set(derived({ ...state, saving: true, notice: undefined }));
        void this.deps.settings.mutate(this.deps.namespace, [{ op: 'set', path: [EXTRA_TOOL_GRANTS_FIELD], value: [...names] }], expectedRevision).then((response) => {
            if (!response.ok) {
                if (response.error.code === 'settings/conflict') {
                    void this.recoverConflict(response.error.message, expectedRevision, response.error.details);
                    return;
                }
                this.store.set(derived({
                    ...this.getSnapshot(),
                    saving: false,
                    notice: response.error.code === 'settings/rejected'
                        ? { kind: 'rejected', message: response.error.message }
                        : { kind: 'failed', message: response.error.message },
                }));
                return;
            }
            const accepted = decodedNames(response.value);
            if (accepted === undefined) {
                this.store.set(derived({
                    ...this.getSnapshot(),
                    listStatus: 'error',
                    listError: `the saved profile setting '${EXTRA_TOOL_GRANTS_FIELD}' is not a readable tool-name list`,
                    revision: undefined,
                    saving: false,
                }));
                return;
            }
            this.store.set(derived({
                ...this.getSnapshot(),
                listStatus: 'ready',
                listError: undefined,
                writable: this.getSnapshot().writable,
                revision: response.value.revision,
                committed: accepted,
                draft: accepted,
                saving: false,
                awaitingReview: false,
                notice: { kind: 'saved' },
            }));
        }, (error) => {
            this.store.set(derived({
                ...this.getSnapshot(),
                saving: false,
                notice: {
                    kind: failureCodeOf(error) === 'settings/rejected' ? 'rejected' : 'failed',
                    message: messageOf(error),
                },
            }));
        });
    };
    async recoverConflict(message, expected, details) {
        const generation = ++this.loadGeneration;
        const actual = typeof details === 'object' && details !== null && typeof Reflect.get(details, 'actual') === 'number'
            ? Reflect.get(details, 'actual')
            : expected;
        this.store.set(derived({
            ...this.getSnapshot(),
            saving: false,
            awaitingReview: true,
            notice: { kind: 'conflict', message, expected, actual },
        }));
        try {
            const accepted = await this.readAccepted();
            if (generation !== this.loadGeneration)
                return;
            this.store.set(derived({
                ...this.getSnapshot(),
                listStatus: 'ready',
                listError: undefined,
                writable: accepted.writable,
                revision: accepted.revision,
                committed: accepted.names,
                notice: {
                    kind: 'conflict',
                    message,
                    expected,
                    actual: accepted.revision,
                    latestCommitted: accepted.names,
                },
            }));
        }
        catch (error) {
            if (generation !== this.loadGeneration)
                return;
            this.store.set(derived({
                ...this.getSnapshot(),
                listStatus: 'error',
                listError: messageOf(error),
                revision: undefined,
                notice: {
                    kind: 'conflict',
                    message,
                    expected,
                    actual,
                    reloadFailure: messageOf(error),
                },
            }));
        }
    }
    async readAccepted() {
        const response = await this.deps.settings.describe();
        if (!response.ok)
            throw new Error(response.error.message);
        const view = response.value.namespaces.find(candidate => candidate.ns === this.deps.namespace);
        if (view === undefined)
            throw new Error(`the profile settings namespace '${this.deps.namespace}' is absent`);
        const names = decodedNames(view);
        if (names === undefined) {
            throw new Error(`the profile setting '${EXTRA_TOOL_GRANTS_FIELD}' is not a readable tool-name list`);
        }
        return Object.freeze({
            writable: response.value.writable,
            revision: view.revision,
            names: Object.freeze([...names].sort()),
        });
    }
    acceptList(accepted) {
        const state = this.getSnapshot();
        const conflict = state.awaitingReview && state.notice?.kind === 'conflict' ? state.notice : undefined;
        this.store.set(derived({
            ...state,
            listStatus: 'ready',
            listError: undefined,
            writable: accepted.writable,
            revision: accepted.revision,
            committed: accepted.names,
            // A conflict retry re-reads the committed side only. The Human's draft is
            // still the thing they must compare, so never replace it with the winner.
            draft: conflict === undefined ? accepted.names : state.draft,
            saving: false,
            awaitingReview: conflict !== undefined,
            notice: conflict === undefined ? undefined : {
                kind: 'conflict',
                message: conflict.message,
                expected: conflict.expected,
                actual: accepted.revision,
                latestCommitted: accepted.names,
            },
        }));
    }
}
/** Subscribe one settings section to the editor's draft and results. */
export function useExtraToolGrants(face) {
    return useSyncExternalStore(face.subscribe, face.getSnapshot, face.getSnapshot);
}
