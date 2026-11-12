/**
 * The Team settings page's configuration groups: the Host row's compaction
 * threshold and its experimental Worker delegation settings.
 *
 * The shared settings form addresses top-level section fields only, while both
 * groups live inside the row as objects. Each scope below flattens one group for
 * the form and maps its edits back onto child paths, so a save never restates a
 * sibling field beside the one it means.
 */
import { useSyncExternalStore } from 'react';
import { SettingsFormModel, } from '@deepseek-ai/dsh-client-ui-primitives';
import { WORKER_ENGINES } from '@contexera/dsh-agent-team/worker-settings';
import { formatCapacity, parseCapacity } from "./capacity.js";
/** Read one plain-object layer, leaving every other shape absent. */
function recordOf(layer) {
    return typeof layer === 'object' && layer !== null && !Array.isArray(layer)
        ? layer
        : undefined;
}
/** Follow one path through plain objects; undefined when any step is not one. */
function leafAt(layer, path) {
    let node = layer;
    for (const step of path) {
        const record = recordOf(node);
        if (record === undefined)
            return undefined;
        node = record[step];
    }
    return node;
}
/** Whether the layer itself carries the path's last key, which is what marks a field overridden. */
function ownAt(layer, path) {
    const key = path.at(-1);
    const parent = recordOf(leafAt(layer, path.slice(0, -1)));
    return parent !== undefined && key !== undefined && Object.hasOwn(parent, key);
}
/** Project one Host snapshot onto the flattened form shape. */
function flatten(snapshot) {
    const base = recordOf(recordOf(snapshot.base)?.memberCompaction);
    const user = recordOf(recordOf(snapshot.user)?.memberCompaction);
    return {
        status: snapshot.status,
        value: snapshot.value === undefined
            ? undefined
            : { tokens: snapshot.value.memberCompaction?.tokens },
        base: { tokens: base?.tokens },
        // Presence, not equality, marks the field overridden: only an own `tokens`
        // key in the user layer counts.
        user: user !== undefined && Object.hasOwn(user, 'tokens') ? { tokens: user.tokens } : {},
        writable: snapshot.writable,
        revision: snapshot.revision,
    };
}
/** Translate one flattened field edit into the Host group's child path. */
function sectionOp(op) {
    const path = ['memberCompaction', ...op.path];
    return op.op === 'set'
        ? { op: 'set', path, value: op.value }
        : { op: 'unset', path };
}
/**
 * Wrap the Host row's shared form as the flattened scope the staged model
 * reads and writes.
 * @param form - the Host row's configuration form.
 * @returns the same document seen as the group's single field.
 */
export function teamConfigScope(form, onSaved) {
    return {
        getSnapshot: () => flatten(form.getSnapshot()),
        subscribe: listener => form.subscribe(listener),
        mutate: async (ops, expectedRevision) => {
            const accepted = await form.mutate(ops.map(sectionOp), expectedRevision);
            if (accepted)
                onSaved?.();
            return accepted;
        },
    };
}
/** The threshold field: the accepted spelling decides, never a silent rewrite. */
const TOKENS_FIELD = {
    field: 'tokens',
    format: value => typeof value === 'number' ? formatCapacity(value) : '',
    parse: (text) => {
        const parsed = parseCapacity(text);
        if (parsed === undefined)
            return { kind: 'clear' };
        return Number.isSafeInteger(parsed) && parsed > 0 && !Object.is(parsed, -0)
            ? { kind: 'set', value: parsed }
            : undefined;
    },
};
/** Stage the threshold over the Host row and publish what the page renders. */
export class TeamConfigController {
    form;
    store;
    actions;
    /** @param scope - the Host row seen through {@link teamConfigScope}. */
    constructor(scope) {
        this.form = new SettingsFormModel(scope, [TOKENS_FIELD]);
        this.actions = this.form.actions();
        this.store = this.form.bind(() => ({ ...this.form.shell(), tokens: this.form.field('tokens') }));
    }
    getSnapshot = () => this.store.getSnapshot();
    subscribe = (listener) => this.store.subscribe(listener);
    edit = (field, text) => { this.actions.edit(field, text); };
    resetField = (field) => { this.actions.resetField(field); };
    save = () => { this.actions.save(); };
    discard = () => { this.actions.discard(); };
    /** Release the form's accepted-value subscription. */
    dispose() { this.form.dispose(); }
}
/** Subscribe one rendered settings page to the staged configuration. */
export function useTeamConfig(face) {
    return useSyncExternalStore(face.subscribe, face.getSnapshot, face.getSnapshot);
}
/** The Host path each staged field writes: a leaf, never a sibling. */
const WORKER_PATHS = {
    enabled: ['worker', 'enabled'],
    defaultEngine: ['worker', 'defaultEngine'],
    codexEnabled: ['worker', 'engines', 'codex', 'enabled'],
    codexExecutable: ['worker', 'engines', 'codex', 'executable'],
    claudeEnabled: ['worker', 'engines', 'claude', 'enabled'],
    claudeExecutable: ['worker', 'engines', 'claude', 'executable'],
};
/** Every staged field, in the order the page reads them. */
const WORKER_FIELDS = Object.keys(WORKER_PATHS);
function booleanOf(value) {
    return typeof value === 'boolean' ? value : undefined;
}
function stringOf(value) {
    return typeof value === 'string' ? value : undefined;
}
/** One field's effective value in a layer, or undefined where the layer stops. */
function workerValuesOf(layer) {
    return {
        enabled: booleanOf(leafAt(layer, WORKER_PATHS.enabled)),
        defaultEngine: stringOf(leafAt(layer, WORKER_PATHS.defaultEngine)),
        codexEnabled: booleanOf(leafAt(layer, WORKER_PATHS.codexEnabled)),
        codexExecutable: stringOf(leafAt(layer, WORKER_PATHS.codexExecutable)),
        claudeEnabled: booleanOf(leafAt(layer, WORKER_PATHS.claudeEnabled)),
        claudeExecutable: stringOf(leafAt(layer, WORKER_PATHS.claudeExecutable)),
    };
}
/** Only the fields the user layer itself carries; presence is what the form reports as overridden. */
function storedWorkerValues(layer) {
    const stored = {};
    for (const field of WORKER_FIELDS)
        if (ownAt(layer, WORKER_PATHS[field]))
            stored[field] = leafAt(layer, WORKER_PATHS[field]);
    return stored;
}
/** Translate one flattened Worker field edit into the Host group's child path. */
function workerOp(op) {
    const field = op.path[0];
    const path = field === undefined ? undefined : WORKER_PATHS[field];
    if (path === undefined)
        throw new TypeError(`the Worker group stages no field ${String(field)}`);
    return op.op === 'set'
        ? { op: 'set', path: [...path], value: op.value }
        : { op: 'unset', path: [...path] };
}
/**
 * Wrap the Host row's shared form as the Worker group's flattened scope. The
 * group nests two levels below the row, so both the value and the presence of
 * every leaf are read along its own path.
 * @param form - the Host row's configuration form.
 * @returns the same document seen as the Worker group's fields.
 */
export function workerConfigScope(form, onSaved) {
    return {
        getSnapshot: () => {
            const snapshot = form.getSnapshot();
            return {
                status: snapshot.status,
                value: snapshot.value === undefined ? undefined : workerValuesOf(snapshot.value),
                base: workerValuesOf(snapshot.base),
                user: storedWorkerValues(snapshot.user),
                writable: snapshot.writable,
                revision: snapshot.revision,
            };
        },
        subscribe: listener => form.subscribe(listener),
        mutate: async (ops, expectedRevision) => {
            const accepted = await form.mutate(ops.map(workerOp), expectedRevision);
            if (accepted)
                onSaved?.();
            return accepted;
        },
    };
}
/** A boolean staged as text, the only shape a form field's draft has. */
function switchField(field) {
    return {
        field,
        format: value => value === true ? 'true' : 'false',
        parse: text => text === 'true'
            ? { kind: 'set', value: true }
            : text === 'false' ? { kind: 'set', value: false } : undefined,
    };
}
/** One of a fixed set of spellings; a stored value outside it renders as the fallback rather than as an empty control. */
function choiceField(field, choices, fallback) {
    return {
        field,
        format: value => typeof value === 'string' && choices.includes(value) ? value : fallback,
        parse: text => choices.includes(text) ? { kind: 'set', value: text } : undefined,
    };
}
/** An executable path staged as typed; a blank draft clears it so the engine falls back to its own discovery. */
function pathField(field) {
    return {
        field,
        format: value => typeof value === 'string' ? value : '',
        parse: (text) => {
            const trimmed = text.trim();
            return trimmed === '' ? { kind: 'clear' } : { kind: 'set', value: trimmed };
        },
    };
}
/** Stage the Worker group over the Host row and publish what the page renders. */
export class WorkerConfigController {
    form;
    store;
    actions;
    /** @param scope - the Host row seen through {@link workerConfigScope}. */
    constructor(scope) {
        this.form = new SettingsFormModel(scope, [
            switchField('enabled'),
            choiceField('defaultEngine', WORKER_ENGINES, WORKER_ENGINES[0]),
            switchField('codexEnabled'),
            pathField('codexExecutable'),
            switchField('claudeEnabled'),
            pathField('claudeExecutable'),
        ]);
        this.actions = this.form.actions();
        this.store = this.form.bind(() => ({
            ...this.form.shell(),
            enabled: this.form.field('enabled'),
            defaultEngine: this.form.field('defaultEngine'),
            codexEnabled: this.form.field('codexEnabled'),
            codexExecutable: this.form.field('codexExecutable'),
            claudeEnabled: this.form.field('claudeEnabled'),
            claudeExecutable: this.form.field('claudeExecutable'),
        }));
    }
    getSnapshot = () => this.store.getSnapshot();
    subscribe = (listener) => this.store.subscribe(listener);
    edit = (field, text) => { this.actions.edit(field, text); };
    resetField = (field) => { this.actions.resetField(field); };
    setSwitch = (field, next) => {
        this.actions.edit(field, next ? 'true' : 'false');
    };
    save = () => { this.actions.save(); };
    discard = () => { this.actions.discard(); };
    /** Release the form's accepted-value subscription. */
    dispose() { this.form.dispose(); }
}
/** Subscribe one rendered settings page to the staged Worker group. */
export function useWorkerConfig(face) {
    return useSyncExternalStore(face.subscribe, face.getSnapshot, face.getSnapshot);
}
