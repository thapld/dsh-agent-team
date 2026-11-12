/**
 * The Team settings page's configuration groups: the Host row's compaction
 * threshold and its experimental Worker delegation settings.
 *
 * The shared settings form addresses top-level section fields only, while both
 * groups live inside the row as objects. Each scope below flattens one group for
 * the form and maps its edits back onto child paths, so a save never restates a
 * sibling field beside the one it means.
 */
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import { type SettingsFieldState, type SettingsFormActions, type SettingsFormScope, type SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives';
/** One engine's Worker settings as the row stores them; the Host schema owns what each field means. */
export interface WorkerEngineSection {
    enabled?: boolean | undefined;
    executable?: string | undefined;
    sandbox?: string | undefined;
}
/** The row's Worker group: the experimental switch, the default engine, and each engine's own settings. */
export interface WorkerSection {
    enabled?: boolean | undefined;
    defaultEngine?: string | undefined;
    engines?: {
        codex?: WorkerEngineSection | undefined;
        claude?: WorkerEngineSection | undefined;
    } | undefined;
}
/** The Host row fields this form reads. */
export interface TeamConfigSection {
    memberCompaction?: {
        tokens?: number | undefined;
    } | undefined;
    worker?: WorkerSection | undefined;
}
/** The group flattened to the one field the form edits. */
export interface TeamConfigValues {
    tokens?: number | undefined;
}
/** Staged state and actions the settings page renders. */
export interface TeamConfigState extends SettingsFormShell {
    tokens: SettingsFieldState;
}
/** The configuration group's whole outward face. */
export interface TeamConfigFace extends SettingsFormActions {
    getSnapshot(): TeamConfigState;
    subscribe(listener: () => void): () => void;
}
/**
 * Wrap the Host row's shared form as the flattened scope the staged model
 * reads and writes.
 * @param form - the Host row's configuration form.
 * @returns the same document seen as the group's single field.
 */
export declare function teamConfigScope(form: ConfigForm<TeamConfigSection>, onSaved?: () => void): SettingsFormScope<TeamConfigValues>;
/** Stage the threshold over the Host row and publish what the page renders. */
export declare class TeamConfigController implements TeamConfigFace {
    private readonly form;
    private readonly store;
    private readonly actions;
    /** @param scope - the Host row seen through {@link teamConfigScope}. */
    constructor(scope: SettingsFormScope<TeamConfigValues>);
    readonly getSnapshot: () => TeamConfigState;
    readonly subscribe: (listener: () => void) => (() => void);
    readonly edit: (field: string, text: string) => void;
    readonly resetField: (field: string) => void;
    readonly save: () => void;
    readonly discard: () => void;
    /** Release the form's accepted-value subscription. */
    dispose(): void;
}
/** Subscribe one rendered settings page to the staged configuration. */
export declare function useTeamConfig(face: TeamConfigFace): TeamConfigState;
/** The Worker group flattened to the fields the form stages. */
export interface WorkerConfigValues {
    enabled?: boolean | undefined;
    defaultEngine?: string | undefined;
    codexEnabled?: boolean | undefined;
    codexExecutable?: string | undefined;
    claudeEnabled?: boolean | undefined;
    claudeExecutable?: string | undefined;
}
/**
 * Wrap the Host row's shared form as the Worker group's flattened scope. The
 * group nests two levels below the row, so both the value and the presence of
 * every leaf are read along its own path.
 * @param form - the Host row's configuration form.
 * @returns the same document seen as the Worker group's fields.
 */
export declare function workerConfigScope(form: ConfigForm<TeamConfigSection>, onSaved?: () => void): SettingsFormScope<WorkerConfigValues>;
/** The Worker group's staged state as the page renders it. */
export interface WorkerConfigState extends SettingsFormShell {
    enabled: SettingsFieldState;
    defaultEngine: SettingsFieldState;
    codexEnabled: SettingsFieldState;
    codexExecutable: SettingsFieldState;
    claudeEnabled: SettingsFieldState;
    claudeExecutable: SettingsFieldState;
}
/** The Worker group's whole outward face. */
export interface WorkerConfigFace extends SettingsFormActions {
    getSnapshot(): WorkerConfigState;
    subscribe(listener: () => void): () => void;
    /** Stage one switch from the control's boolean, so the page never spells the field's text. */
    setSwitch(field: WorkerSwitchField, next: boolean): void;
}
/** The switches the page renders; the pickers and paths stage their own text. */
export type WorkerSwitchField = 'enabled' | 'codexEnabled' | 'claudeEnabled';
/** Stage the Worker group over the Host row and publish what the page renders. */
export declare class WorkerConfigController implements WorkerConfigFace {
    private readonly form;
    private readonly store;
    private readonly actions;
    /** @param scope - the Host row seen through {@link workerConfigScope}. */
    constructor(scope: SettingsFormScope<WorkerConfigValues>);
    readonly getSnapshot: () => WorkerConfigState;
    readonly subscribe: (listener: () => void) => (() => void);
    readonly edit: (field: string, text: string) => void;
    readonly resetField: (field: string) => void;
    readonly setSwitch: (field: WorkerSwitchField, next: boolean) => void;
    readonly save: () => void;
    readonly discard: () => void;
    /** Release the form's accepted-value subscription. */
    dispose(): void;
}
/** Subscribe one rendered settings page to the staged Worker group. */
export declare function useWorkerConfig(face: WorkerConfigFace): WorkerConfigState;
//# sourceMappingURL=team-config.d.ts.map