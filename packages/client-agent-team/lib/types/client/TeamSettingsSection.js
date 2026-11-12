import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { Button, IconChevronDownOutlineRegular, Input, SettingsForm, SettingsValueField, Switch } from '@deepseek-ai/dsh-client-ui-primitives';
import { HUMAN_AVATAR_MAX_BYTES } from '@contexera/dsh-agent-team/human-settings';
import { useHumanIdentity, } from "./human-identity.js";
import { useExtraToolGrants, } from "./extra-tool-grants.js";
import { EnvironmentCheck } from "./EnvironmentCheck.js";
import { formLabels } from "./locales.js";
import { WORKER_ENGINES } from '@contexera/dsh-agent-team/worker-settings';
import { useTeamConfig, useWorkerConfig } from "./team-config.js";
import { useAvatarImage } from "./avatar-image.js";
import { identityInitial } from "./team-formatters.js";
import { WORKER_ENGINE_COPY, workerEngineName } from "./worker-copy.js";
import css from './team-settings.module.css';
/** A local file-read failure is a refusal; Remote uncertainty is classified by the shared writer. */
async function outcomeOf(action) {
    try {
        return await action();
    }
    catch (error) {
        return { kind: 'rejected', message: error instanceof Error ? error.message : String(error) };
    }
}
function avatarInitial(name) {
    return identityInitial((name ?? '').trim()) || 'H';
}
/**
 * The Host row's compaction group, staged by the shared settings form.
 *
 * It is a group of its own rather than a row in the identity list: its save is
 * a settings-document write with its own revision fence, while the rows above
 * write through the Team Remote. Two saves in one form would make one button
 * two different transactions.
 * @param props - the page's locale reader and the configuration group's face.
 * @returns the group's heading, its one field, and its save.
 */
function ContextSettings(props) {
    const { t, face } = props;
    const state = useTeamConfig(face);
    const headingId = useId();
    return _jsxs("section", { className: css.context, "aria-labelledby": headingId, children: [_jsx("h3", { className: css.groupHeading, id: headingId, children: t('memberCompactionTitle') }), _jsx(SettingsForm, { labels: formLabels(t), state: state, onSave: face.save, onDiscard: face.discard, children: _jsx("div", { className: css.fieldStack, children: _jsx(SettingsValueField, { id: "plugin-config-team-member-compaction-tokens", label: t('memberCompactionTokens'), hint: t('memberCompactionTokenHint'), placeholder: "256K", overriddenLabel: t('overridden'), resetLabel: t('reset'), invalidLabel: t('memberCompactionTokenInvalid'), numeric: true, disabled: !state.writable || state.saving, ...state.tokens, onEdit: (text) => { face.edit('tokens', text); }, onReset: () => { face.resetField('tokens'); } }) }) })] });
}
/**
 * One labelled control in a settings group, in the shipped field's rhythm, for
 * what that field does not cover: a native select and a typed path. The hint is
 * the control's description, so the guidance is read with the field.
 * @param props - the field's copy, the control's id, and the control itself.
 * @returns the labelled field.
 */
function Field(props) {
    const hintId = `${props.id}-hint`;
    return _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.fieldLabel, htmlFor: props.id, children: props.label }), props.render(hintId), _jsx("p", { className: css.fieldHint, id: hintId, children: props.hint })] });
}
/**
 * The Host row's Worker group. It is a disclosure rather than an open block: the
 * group is opt-in, so a closed row states what it is set to in one phrase and
 * costs one line of the page. Open, the hierarchy is the panel inside it — the
 * switch, then the engines as one nested surface — so no rule is needed to
 * separate a level from the level it contains.
 * @param props - the page's locale reader and the Worker group's face.
 * @returns the group's summary row and, open, its switches and fields.
 */
function WorkerSettings(props) {
    const { t, face } = props;
    const state = useWorkerConfig(face);
    const headingId = useId();
    const bodyId = useId();
    const prefix = useId();
    const [open, setOpen] = useState(false);
    const on = state.enabled.text === 'true';
    const locked = !state.writable || state.saving;
    const engineLocked = locked || !on;
    const defaultEngine = state.defaultEngine.text;
    // A row whose default engine is off refuses every delegation that names none.
    const defaultEngineOff = (defaultEngine === 'codex' ? state.codexEnabled : state.claudeEnabled).text !== 'true';
    const enabled = WORKER_ENGINES.filter(engine => (engine === 'codex' ? state.codexEnabled : state.claudeEnabled).text === 'true');
    const summary = !on
        ? t('workerCollapsedOff')
        : enabled.length === 0
            ? t('workerCollapsedOnNoEngine')
            : t('workerCollapsedOnEngines', { engines: enabled.map(engine => workerEngineName(t, engine)).join(' · ') });
    return _jsxs("section", { className: css.worker, "aria-labelledby": headingId, "data-worker-settings": true, children: [_jsxs("button", { type: "button", className: css.workerToggle, "aria-expanded": open, "aria-controls": bodyId, onClick: () => { setOpen(value => !value); }, children: [_jsx("span", { className: css.groupHeading, id: headingId, children: t('workerTitle') }), _jsx("span", { className: css.workerToggleSummary, children: summary }), _jsx("span", { className: `${css.chevron} ${open ? css.chevronOpen : ''}`, "aria-hidden": true, children: _jsx(IconChevronDownOutlineRegular, {}) })] }), _jsxs("div", { id: bodyId, hidden: !open, className: css.workerBody, children: [_jsx("p", { className: css.groupIntro, children: t('workerIntro') }), _jsx(SettingsForm, { labels: formLabels(t), state: state, onSave: face.save, onDiscard: face.discard, children: _jsxs("div", { className: css.workerFields, children: [_jsxs("div", { className: css.row, children: [_jsxs("div", { className: css.rowText, children: [_jsx("div", { className: css.title, children: t('workerEnabled') }), _jsx("div", { className: css.desc, children: t('workerEnabledHint') })] }), _jsx("div", { className: css.controls, children: _jsx(Switch, { checked: on, label: t('workerEnabled'), disabled: locked, onChange: (next) => { face.setSwitch('enabled', next); } }) })] }), _jsxs("div", { className: css.enginePanel, children: [_jsxs("div", { className: css.defaultEngine, children: [_jsx("label", { className: css.fieldLabel, htmlFor: `${prefix}-default-engine`, children: t('workerDefaultEngine') }), _jsx("select", { id: `${prefix}-default-engine`, className: `${css.control} ${css.select}`, value: defaultEngine, "aria-describedby": defaultEngineOff ? `${prefix}-default-engine-note` : undefined, disabled: engineLocked, onChange: (event) => { face.edit('defaultEngine', event.target.value); }, children: WORKER_ENGINES.map(engine => _jsx("option", { value: engine, children: workerEngineName(t, engine) }, engine)) }), !defaultEngineOff ? null : _jsx("p", { className: css.defaultEngineNote, id: `${prefix}-default-engine-note`, children: t('workerDefaultEngineUnavailable') })] }), WORKER_ENGINES.map((engine) => {
                                            const name = workerEngineName(t, engine);
                                            const pathId = `${prefix}-${engine}-path`;
                                            const isCodex = engine === 'codex';
                                            return _jsxs("div", { className: css.engine, "data-worker-engine": engine, children: [_jsxs("div", { className: css.engineHead, children: [_jsx("span", { className: css.engineName, children: name }), _jsx(Switch, { checked: (isCodex ? state.codexEnabled : state.claudeEnabled).text === 'true', label: t('workerEngineSwitch', { engine: name }), disabled: engineLocked, onChange: (next) => { face.setSwitch(isCodex ? 'codexEnabled' : 'claudeEnabled', next); } })] }), _jsx(Field, { id: pathId, label: t('workerExecutable'), hint: t('workerExecutableHint', { command: WORKER_ENGINE_COPY[engine].command }), render: describedBy => _jsx("input", { id: pathId, className: css.control, value: (isCodex ? state.codexExecutable : state.claudeExecutable).text, "aria-label": t('workerExecutableFor', { engine: name }), "aria-describedby": describedBy, placeholder: t('workerExecutablePlaceholder', { command: WORKER_ENGINE_COPY[engine].command }), spellCheck: false, autoComplete: "off", disabled: engineLocked, onChange: (event) => { face.edit(isCodex ? 'codexExecutable' : 'claudeExecutable', event.target.value); } }) })] }, engine);
                                        })] })] }) })] })] });
}
/**
 * The profile-wide exact tool-name grant editor. Its list and catalog have
 * independent failure states, and neither depends on the Human identity read.
 * @param props - the page dictionary and the controller shared by every render.
 * @returns the searchable multi-select, its draft actions, and save outcome.
 */
function ExtraToolGrantsSettings(props) {
    const { t, face } = props;
    const state = useExtraToolGrants(face);
    const headingId = useId();
    const searchId = useId();
    const conflictRef = useRef(null);
    const reviewRef = useRef(null);
    const saveRef = useRef(null);
    useEffect(() => {
        face.load();
        face.loadCatalog();
    }, [face]);
    const search = state.search.trim().toLocaleLowerCase();
    const visible = state.catalog.filter(name => name.toLocaleLowerCase().includes(search));
    const locked = state.listStatus !== 'ready'
        || !state.writable
        || state.saving
        || state.awaitingReview;
    const notice = state.notice;
    const conflict = notice?.kind === 'conflict' ? notice : undefined;
    const latest = conflict?.latestCommitted;
    const conflictShown = conflict !== undefined;
    const reviewReady = conflict !== undefined && latest !== undefined;
    // The Save control that opened a conflict is disabled, so focus would fall to
    // the document. Land it on the conflict itself, then on the review control
    // once the reload makes that control usable; a reader who moved on keeps
    // their place.
    useEffect(() => {
        if (!conflictShown)
            return;
        const active = document.activeElement;
        if (active === document.body || active === saveRef.current)
            conflictRef.current?.focus();
    }, [conflictShown]);
    useEffect(() => {
        if (!reviewReady)
            return;
        const active = document.activeElement;
        if (active === document.body || active === conflictRef.current)
            reviewRef.current?.focus();
    }, [reviewReady]);
    return _jsxs("section", { className: css.extraTools, "aria-labelledby": headingId, "data-extra-tool-grants": true, children: [_jsxs("div", { className: css.extraToolHeading, children: [_jsx("h3", { className: css.groupHeading, id: headingId, children: t('extraToolsTitle') }), state.listStatus === 'ready'
                        ? _jsx("span", { className: css.extraToolCount, children: t('extraToolsSelected', { count: state.draft.length }) })
                        : null] }), _jsx("p", { className: css.groupIntro, children: t('extraToolsIntro') }), _jsx("p", { className: css.fieldHint, children: t('extraToolsRegistrationHint') }), state.listStatus === 'loading'
                ? _jsx("p", { className: css.state, role: "status", children: t('extraToolsListLoading') })
                : state.listStatus === 'error'
                    ? _jsxs("div", { className: css.noticeBlock, role: "alert", children: [_jsx("p", { className: css.notice, children: t('extraToolsListFailed', { message: state.listError ?? '' }) }), _jsx("div", { className: css.stateAction, children: _jsx(Button, { variant: "outline", onClick: () => { face.load(); }, children: t('retry') }) })] })
                    : null, state.listStatus === 'ready' && !state.writable
                ? _jsx("p", { className: css.state, children: t('readOnly') })
                : null, _jsxs("div", { className: css.extraSearch, children: [_jsx("label", { className: css.fieldLabel, htmlFor: searchId, children: t('extraToolsSearch') }), _jsx(Input, { id: searchId, type: "search", value: state.search, placeholder: t('extraToolsSearchPlaceholder'), autoComplete: "off", spellCheck: false, onChange: (event) => { face.setSearch(event.target.value); } }), _jsx("p", { className: css.fieldHint, children: t('extraToolsSearchHint') })] }), state.catalogStatus === 'loading'
                ? _jsx("p", { className: css.state, role: "status", children: t('extraToolsCatalogLoading') })
                : state.catalogStatus === 'error'
                    ? _jsxs("div", { className: css.noticeBlock, role: "alert", children: [_jsx("p", { className: css.notice, children: t('extraToolsCatalogFailed', { message: state.catalogError ?? '' }) }), _jsx("div", { className: css.stateAction, children: _jsx(Button, { variant: "outline", onClick: () => { face.loadCatalog(); }, children: t('retry') }) })] })
                    : null, state.catalogStatus === 'ready' && state.catalog.length === 0
                ? _jsx("p", { className: css.state, children: t('extraToolsCatalogEmpty') })
                : null, state.catalogStatus === 'ready' && state.catalog.length > 0 && visible.length === 0
                ? _jsx("p", { className: css.state, children: t('extraToolsNoMatches') })
                : null, visible.length === 0 ? null : _jsx("ul", { className: css.toolList, "aria-label": t('extraToolsCatalogLabel'), children: visible.map(name => _jsx("li", { children: _jsxs("label", { className: css.toolChoice, children: [_jsx("input", { type: "checkbox", checked: state.draft.includes(name), disabled: locked, onChange: () => { face.toggle(name); } }), _jsx("code", { className: css.toolName, children: name })] }) }, name)) }), state.catalogStatus === 'ready' || state.draft.length === 0 ? null
                : _jsxs("div", { className: css.selectionBlock, "data-extra-tool-selected": true, children: [_jsx("div", { className: css.missingHeading, children: t('extraToolsSelectedTitle') }), _jsx("p", { className: css.fieldHint, children: t('extraToolsSelectedHint') }), _jsx("ul", { className: css.toolList, children: state.draft.map(name => _jsx("li", { children: _jsxs("label", { className: css.toolChoice, children: [_jsx("input", { type: "checkbox", checked: true, disabled: locked, onChange: () => { face.toggle(name); } }), _jsx("code", { className: css.toolName, children: name })] }) }, name)) })] }), state.catalogStatus !== 'ready' || state.missing.length === 0 ? null
                : _jsxs("div", { className: `${css.selectionBlock} ${css.missingTools}`, "data-extra-tool-missing": true, children: [_jsx("div", { className: css.missingHeading, children: t('extraToolsMissingTitle') }), _jsx("p", { className: css.fieldHint, children: t('extraToolsMissingHint') }), _jsx("ul", { className: css.toolList, children: state.missing.map(name => _jsx("li", { children: _jsxs("label", { className: css.toolChoice, children: [_jsx("input", { type: "checkbox", checked: true, disabled: locked, onChange: () => { face.toggle(name); } }), _jsx("code", { className: css.toolName, children: name }), _jsx("span", { className: css.missingBadge, children: t('extraToolsMissingBadge') })] }) }, name)) })] }), conflict === undefined ? null : _jsxs("div", { className: css.conflict, ref: conflictRef, role: "alert", tabIndex: -1, "data-extra-tool-conflict": true, children: [_jsx("div", { className: css.conflictTitle, children: t('extraToolsConflictTitle') }), _jsx("p", { className: css.conflictText, children: t('extraToolsConflict', { message: conflict.message }) }), _jsx("p", { className: css.conflictText, children: t('extraToolsConflictDraftKept') }), conflict.reloadFailure === undefined ? null
                        : _jsx("p", { className: css.notice, children: t('extraToolsConflictReloadFailed', { message: conflict.reloadFailure }) }), _jsxs("div", { className: css.conflictCommitted, children: [_jsx("span", { children: t('extraToolsCommitted') }), latest === undefined
                                ? _jsx("span", { className: css.emptyValue, children: conflict.reloadFailure === undefined
                                        ? t('extraToolsCommittedLoading')
                                        : t('extraToolsCommittedUnavailable') })
                                : latest.length === 0
                                    ? _jsx("span", { className: css.emptyValue, children: t('extraToolsEmpty') })
                                    : latest.map(name => _jsx("code", { className: css.committedName, children: name }, name))] }), _jsx("div", { className: css.stateAction, children: _jsx(Button, { ref: reviewRef, variant: "outline", disabled: latest === undefined || state.listStatus !== 'ready', onClick: () => { face.acknowledgeConflict(); }, children: t('extraToolsConflictReviewed') }) })] }), _jsxs("div", { className: css.extraActions, children: [_jsx(Button, { disabled: locked || state.draft.length === 0, onClick: () => { face.clear(); }, children: t('extraToolsClear') }), _jsx("span", { className: css.actionSpacer }), _jsx(Button, { disabled: !state.canDiscard, onClick: () => { face.discard(); }, children: t('cancel') }), _jsx(Button, { ref: saveRef, variant: "primary", disabled: !state.canSave, onClick: () => { face.save(); }, children: state.saving ? t('saving') : t('save') })] }), notice?.kind === 'saved'
                ? _jsx("p", { className: css.success, role: "status", children: t('extraToolsSaved') })
                : null, notice?.kind === 'rejected'
                ? _jsx("p", { className: css.notice, role: "alert", children: t('extraToolsRejected', { message: notice.message }) })
                : null, notice?.kind === 'failed'
                ? _jsx("p", { className: css.notice, role: "alert", children: t('extraToolsWriteFailed', { message: notice.message }) })
                : null] });
}
export function TeamSettingsSection(props) {
    const { t, identity } = props;
    const profile = useHumanIdentity(identity);
    const [draft, setDraft] = useState({ kind: 'follow' });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [rereading, setRereading] = useState(false);
    const [notice, setNotice] = useState(null);
    const filePicker = useRef(null);
    const name = draft.kind === 'editing' ? draft.text : profile.name ?? '';
    const dirty = draft.kind === 'editing' && draft.text.trim() !== (profile.name ?? '');
    const emptyName = draft.kind === 'editing' && draft.text.trim() === '';
    const hasAvatar = profile.avatarRef !== undefined;
    const avatar = useAvatarImage(profile.avatarUrl);
    const writesAvailable = profile.settingsFence !== undefined;
    const writesBlocked = notice?.reread === true;
    const report = (outcome, rejected) => {
        if (outcome === undefined) {
            setNotice(null);
            return;
        }
        if (outcome.kind === 'saved') {
            setNotice({ message: t('humanSettingsSavedRefreshFailed', { message: outcome.warning }), tone: 'saved', reread: true });
            return;
        }
        if (outcome.kind === 'conflict') {
            setNotice({ message: t('humanSettingsProfileConflict'), tone: 'error', reread: true });
            return;
        }
        if (outcome.kind === 'uncertain') {
            setNotice({ message: t('humanSettingsResultUnconfirmed', { message: outcome.message }), tone: 'error', reread: true });
            return;
        }
        setNotice({ message: rejected(outcome.message), tone: 'error', reread: false });
    };
    const rereadProfile = async () => {
        setRereading(true);
        await identity.refreshAfterWrite();
        setRereading(false);
        const error = identity.getSnapshot().error;
        setNotice(error === undefined ? null : {
            message: t('humanSettingsRereadFailed', { message: error }), tone: 'error', reread: true,
        });
    };
    const submitName = async () => {
        if (!dirty || emptyName || saving || writesBlocked || !writesAvailable)
            return;
        setSaving(true);
        setNotice(null);
        const outcome = await outcomeOf(() => props.saveName(name.trim()));
        setSaving(false);
        report(outcome, message => t('humanSettingsNameFailed', { message }));
        if (outcome === undefined)
            setDraft({ kind: 'follow' });
    };
    const pickAvatar = async (file) => {
        if (file === undefined || writesBlocked || !writesAvailable)
            return;
        setNotice(null);
        if (!file.type.startsWith('image/')) {
            setNotice({ message: t('humanSettingsAvatarNotImage'), tone: 'error', reread: false });
            return;
        }
        if (file.size > HUMAN_AVATAR_MAX_BYTES) {
            setNotice({ message: t('humanSettingsAvatarTooLarge'), tone: 'error', reread: false });
            return;
        }
        setUploading(true);
        const outcome = await outcomeOf(() => props.uploadAvatar(file));
        setUploading(false);
        report(outcome, message => t('humanSettingsAvatarFailed', { message }));
    };
    const removeAvatar = async () => {
        if (removing || writesBlocked || !writesAvailable)
            return;
        setNotice(null);
        setRemoving(true);
        const outcome = await outcomeOf(() => props.removeAvatar());
        setRemoving(false);
        report(outcome, message => t('humanSettingsAvatarFailed', { message }));
    };
    // Every state, including a failed read, must say whose Team this is and where a change applies.
    const pageHeader = _jsxs(_Fragment, { children: [_jsx("h2", { className: css.heading, children: t('teamSettingsTitle') }), _jsx("p", { className: css.intro, children: t('teamSettingsIntro') })] });
    const identityContent = profile.status === 'loading' && profile.name === undefined
        ? _jsx("p", { className: css.state, role: "status", children: t('humanSettingsLoading') })
        : profile.name === undefined
            ? _jsxs("div", { className: css.noticeBlock, children: [_jsx("p", { className: css.state, role: "alert", children: t('humanSettingsUnavailable', { message: profile.error ?? '' }) }), _jsx("div", { className: css.stateAction, children: _jsx(Button, { variant: "outline", onClick: () => { void identity.refresh(); }, children: t('retry') }) })] })
            : _jsxs("div", { className: css.rows, children: [_jsxs("div", { className: css.row, children: [_jsxs("div", { className: css.rowText, children: [_jsx("div", { className: css.title, children: t('humanSettingsName') }), _jsx("div", { className: css.desc, children: t('humanSettingsNameHint') })] }), _jsxs("form", { className: css.controls, onSubmit: (event) => {
                                    event.preventDefault();
                                    void submitName();
                                }, children: [_jsx(Input, { className: css.nameInput, "aria-label": t('humanSettingsName'), "aria-invalid": emptyName || undefined, value: name, disabled: saving || rereading || writesBlocked, onChange: (event) => { setDraft({ kind: 'editing', text: event.target.value }); } }), _jsx(Button, { type: "submit", variant: "primary", disabled: saving || rereading || writesBlocked || !writesAvailable || !dirty || emptyName, children: saving ? t('humanSettingsSaving') : t('humanSettingsSave') })] })] }), _jsxs("div", { className: css.row, children: [_jsxs("div", { className: css.rowText, children: [_jsx("div", { className: css.title, children: t('humanSettingsAvatar') }), _jsx("div", { className: css.desc, children: t('humanSettingsAvatarHint') })] }), _jsxs("div", { className: css.controls, children: [avatar.image.kind === 'initial'
                                        ? _jsx("span", { className: `${css.identity} ${css.identityFallback}`, "data-avatar": "initial", "aria-hidden": "true", children: avatarInitial(profile.name) })
                                        : _jsx("img", { className: `${css.identity} ${css.identityImage}`, "data-avatar": "image", src: avatar.image.src, alt: "", onError: avatar.failed }), _jsx("input", { ref: filePicker, type: "file", accept: "image/*", tabIndex: -1, "aria-hidden": "true", hidden: true, onChange: (event) => {
                                            void pickAvatar(event.target.files?.[0]);
                                            event.target.value = '';
                                        } }), _jsx(Button, { variant: "outline", disabled: uploading || removing || rereading || writesBlocked || !writesAvailable, onClick: () => { filePicker.current?.click(); }, children: uploading ? t('humanSettingsUploading') : hasAvatar ? t('humanSettingsReplace') : t('humanSettingsUpload') }), hasAvatar && _jsx(Button, { disabled: uploading || removing || rereading || writesBlocked || !writesAvailable, onClick: () => { void removeAvatar(); }, children: removing ? t('humanSettingsRemovingAvatar') : t('humanSettingsRemoveAvatar') })] })] })] });
    return _jsxs("div", { className: css.section, children: [pageHeader, identityContent, emptyName && _jsx("p", { className: css.notice, children: t('humanSettingsNameEmpty') }), notice === null ? null : _jsxs("div", { className: `${css.notice} ${notice.tone === 'saved' ? css.noticeSaved : ''}`, role: notice.tone === 'saved' ? 'status' : 'alert', children: [_jsx("span", { children: notice.message }), notice.reread && _jsx(Button, { variant: "outline", disabled: rereading, onClick: () => { void rereadProfile(); }, children: rereading ? t('humanSettingsRereading') : t('humanSettingsReread') })] }), props.extraToolGrants === undefined ? null : _jsx(ExtraToolGrantsSettings, { t: t, face: props.extraToolGrants }), props.teamConfig === undefined ? null : _jsx(ContextSettings, { t: t, face: props.teamConfig }), props.workerConfig === undefined ? null : _jsx(WorkerSettings, { t: t, face: props.workerConfig }), _jsx("div", { className: css.environment, children: _jsx(EnvironmentCheck, { t: t, environment: props.environment }) }), profile.version === undefined && profile.repoUrl === undefined ? null : _jsxs("div", { className: css.footnote, children: [profile.version === undefined ? null : _jsx("span", { children: t('humanSettingsVersion', { version: profile.version }) }), profile.version === undefined || profile.repoUrl === undefined ? null : _jsx("span", { "aria-hidden": "true", children: "\u00B7" }), profile.repoUrl === undefined
                        ? null
                        : _jsx("a", { className: css.link, href: profile.repoUrl, target: "_blank", rel: "noreferrer", children: "GitHub" }), profile.latestVersion === undefined
                        ? null
                        : _jsx("a", { className: css.link, href: `${profile.repoUrl ?? ''}/releases`, target: "_blank", rel: "noreferrer", children: t('humanSettingsUpdateAvailable', { version: profile.latestVersion }) })] })] });
}
