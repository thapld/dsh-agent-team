import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { formatAbsoluteTime, formatMessageTime } from "./team-formatters.js";
import { workerEngineName } from "./worker-copy.js";
import { Button, IconChevronDownOutlineRegular, Input, Menu, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import { mintRequestId } from "./requests.js";
import { useEditDialogSave } from "./team-dialog-save.js";
import createCss from './create.module.css';
import css from './sidebar.module.css';
import settingsCss from './team-settings.module.css';
function modelKey(provider, model) {
    return `${provider}\u0000${model}`;
}
const modelCatalogCaches = new WeakMap();
function peekCatalogGroups(loadModels) {
    return modelCatalogCaches.get(loadModels)?.value?.groups;
}
function sharedCatalog(loadModels) {
    const cached = modelCatalogCaches.get(loadModels);
    if (cached?.inflight !== undefined)
        return cached.inflight;
    const next = loadModels();
    const entry = cached ?? {};
    entry.inflight = next;
    modelCatalogCaches.set(loadModels, entry);
    const forget = (result) => {
        if (modelCatalogCaches.get(loadModels) === entry && entry.inflight === next) {
            delete entry.inflight;
            if (result !== undefined && result.ok)
                entry.value = result.value;
        }
    };
    next.then((result) => { forget(result); }, () => { forget(undefined); });
    return next;
}
/** Best-effort warm so pickers open with rows; failures belong to the picker's own error surface. */
export function warmModelCatalog(loadModels) {
    try {
        void sharedCatalog(loadModels).catch(() => {
            // The picker that later reads surfaces the failure with its retry entry.
        });
    }
    catch {
        // Same: a synchronously refused warm leaves no trace; the picker reports it.
    }
}
/**
 * Shared provider/model dropdown for the create and edit forms. Mounts open with the warmed value and revalidate behind it;
 * a refused or failed read with no warmed value renders a retryable error rather than stranding the field on "loading".
 */
export function ModelPickerField({ model, onModelChange, loadModels, disabled, t }) {
    const [groups, setGroups] = useState(() => peekCatalogGroups(loadModels));
    const [modelsError, setModelsError] = useState();
    const [reloadToken, setReloadToken] = useState(0);
    const [open, setModelOpen] = useState(false);
    const [effortOpen, setEffortOpen] = useState(false);
    useEffect(() => {
        let mounted = true;
        let pending;
        try {
            pending = sharedCatalog(loadModels);
        }
        catch (error) {
            // A synchronously refused read (an undeclared remote, a dead scope) surfaces as the same retryable failure; last good rows stay rendered.
            setModelsError(error instanceof Error ? error.message : String(error));
            return;
        }
        void pending.then((result) => {
            if (!mounted)
                return;
            if (result.ok) {
                setGroups(result.value.groups);
                setModelsError(undefined);
            }
            else {
                setModelsError(result.error.message);
            }
        }, (error) => {
            // A rejected read (a transport that died mid-call) retries like any other failure.
            if (!mounted)
                return;
            setModelsError(error instanceof Error ? error.message : String(error));
        });
        return () => { mounted = false; };
    }, [loadModels, reloadToken]);
    // No "follow the Host default" row: a Member always runs a named route, so the picker only lists real routes.
    const items = [];
    const byKey = new Map();
    for (const group of groups ?? []) {
        items.push({ type: 'label', id: `model-group:${group.id}`, text: group.name });
        for (const entry of group.models) {
            const key = modelKey(group.id, entry.id);
            byKey.set(key, { provider: group.id, id: entry.id, name: entry.name, efforts: entry.reasoning?.efforts ?? [] });
            items.push({ id: key, label: entry.name });
        }
    }
    const selectedModelKey = model === undefined ? '' : modelKey(model.provider, model.model);
    const triggerLabel = model === undefined
        ? t('modelChoose')
        : byKey.get(selectedModelKey)?.name ?? `${model.provider} / ${model.model}`;
    // The effort sub-row only makes sense for a chosen model with adapter-exposed efforts.
    const efforts = model === undefined ? [] : byKey.get(selectedModelKey)?.efforts ?? [];
    const effortItems = [{ id: '', label: t('effortFollowDefault') }, ...efforts.map(effort => ({ id: effort.id, label: effort.name }))];
    const selectedEffort = model?.reasoningEffort ?? '';
    const effortTriggerLabel = model === undefined || selectedEffort === ''
        ? t('effortFollowDefault')
        : efforts.find(effort => effort.id === selectedEffort)?.name ?? selectedEffort;
    return _jsxs("div", { className: createCss.field, children: [_jsx("span", { children: t('memberModel') }), groups === undefined && modelsError === undefined && _jsx("small", { className: css.editHint, children: t('modelsLoading') }), modelsError !== undefined && (_jsxs("p", { className: css.editHint, children: [_jsx("span", { role: "alert", children: t('modelsLoadFailed', { message: modelsError }) }), ' ', _jsx(Button, { size: "sm", variant: "outline", disabled: disabled, onClick: () => { setModelsError(undefined); setReloadToken(token => token + 1); }, children: t('retry') })] })), groups !== undefined && (_jsx(Menu, { open: open, portal: true, className: createCss.menuCap, items: items, selectedId: selectedModelKey, onSelect: key => {
                    setModelOpen(false);
                    const choice = byKey.get(key);
                    if (choice !== undefined)
                        onModelChange({ provider: choice.provider, model: choice.id });
                }, onClose: () => { setModelOpen(false); }, anchor: _jsxs("button", { type: "button", className: createCss.selectTrigger, "aria-label": t('memberModel'), "aria-haspopup": "menu", "aria-expanded": open, disabled: disabled, onClick: () => { setModelOpen(value => !value); }, children: [_jsx("span", { className: createCss.selectValue, children: triggerLabel }), _jsx("span", { className: `${createCss.chevron} ${open ? createCss.chevronOpen : ''}`, "aria-hidden": true, children: _jsx(IconChevronDownOutlineRegular, {}) })] }) })), model !== undefined && efforts.length > 0 && (_jsx(Menu, { open: effortOpen, portal: true, className: createCss.menuCap, items: effortItems, selectedId: selectedEffort, onSelect: key => {
                    setEffortOpen(false);
                    onModelChange(key === ''
                        ? { provider: model.provider, model: model.model }
                        : { provider: model.provider, model: model.model, reasoningEffort: key });
                }, onClose: () => { setEffortOpen(false); }, anchor: _jsxs("button", { type: "button", className: createCss.selectTrigger, "aria-label": t('reasoningEffort'), "aria-haspopup": "menu", "aria-expanded": effortOpen, disabled: disabled, onClick: () => { setEffortOpen(value => !value); }, children: [_jsx("span", { className: createCss.selectValue, children: `${t('reasoningEffort')} · ${effortTriggerLabel}` }), _jsx("span", { className: `${createCss.chevron} ${effortOpen ? createCss.chevronOpen : ''}`, "aria-hidden": true, children: _jsx(IconChevronDownOutlineRegular, {}) })] }) }))] });
}
/** What the reminder is waiting on, as one line: the pending read wins, then the next
 *  occurrence, then the last one it already had. */
function reminderTimingText(view, t) {
    if (view.pendingOccurrenceAt !== undefined)
        return t('memberReminderPending', { time: formatAbsoluteTime(view.pendingOccurrenceAt) });
    if (view.nextOccurrenceAt !== undefined)
        return t('memberReminderNext', { time: formatAbsoluteTime(view.nextOccurrenceAt) });
    if (view.lastOccurrenceAt !== undefined)
        return t('memberReminderLast', { time: formatAbsoluteTime(view.lastOccurrenceAt) });
    return undefined;
}
/**
 * One Member's reminders that can still fire, in Member detail. Read-only by construction: the
 * Human sees what the Member asked of itself and may withdraw a reminder, but never invents one —
 * a reminder has exactly one recipient, and only that Member creates its own. Every write re-reads
 * the list, so the rows are never an optimistic guess at what the Host stored.
 */
export function MemberRemindersSection({ workspaceId, memberId, loadMemberReminders, cancelMemberReminder, disabled, t }) {
    const [reminders, setReminders] = useState();
    const [error, setError] = useState();
    const [reloadToken, setReloadToken] = useState(0);
    const [withdrawing, setWithdrawing] = useState();
    useEffect(() => {
        let mounted = true;
        let pending;
        try {
            pending = loadMemberReminders({ requestId: mintRequestId(), workspaceId, memberId });
        }
        catch (cause) {
            // A synchronously refused read (an undeclared remote, a dead scope) is the same retryable failure.
            setError(cause instanceof Error ? cause.message : String(cause));
            return;
        }
        void pending.then((result) => {
            if (!mounted)
                return;
            if (result.ok) {
                setReminders(result.value);
                setError(undefined);
            }
            else {
                setError(result.error.message);
            }
        }, (cause) => {
            if (!mounted)
                return;
            setError(cause instanceof Error ? cause.message : String(cause));
        });
        return () => { mounted = false; };
    }, [loadMemberReminders, workspaceId, memberId, reloadToken]);
    const cancel = async (reminderRef) => {
        if (withdrawing !== undefined)
            return;
        setWithdrawing(reminderRef);
        try {
            const result = await cancelMemberReminder({ requestId: mintRequestId(), workspaceId, reminderRef });
            if (!result.ok)
                throw new Error(result.error.message);
            setReloadToken(token => token + 1);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setWithdrawing(undefined);
        }
    };
    // The ledger keeps a reminder after it fires or is withdrawn, but Member detail is a
    // management surface: a row that can no longer fire has nothing left to manage.
    const manageable = reminders?.filter(view => view.reminder.state === 'active');
    const headingId = useId();
    return (_jsxs("div", { className: createCss.section, role: "group", "aria-labelledby": headingId, "data-team-member-reminders": true, children: [_jsx("h3", { className: settingsCss.groupHeading, id: headingId, children: t('memberReminders') }), manageable === undefined && error === undefined && _jsx("small", { className: css.editHint, children: t('memberRemindersLoading') }), manageable !== undefined && manageable.length === 0 && _jsx("small", { className: css.editHint, children: t('memberRemindersEmpty') }), manageable !== undefined && manageable.length > 0 && (_jsx("ul", { className: createCss.reminderList, children: manageable.map(view => (_jsx(ReminderRow, { view: view, disabled: disabled, withdrawing: withdrawing, onCancel: reminderRef => { void cancel(reminderRef); }, t: t }, view.reminder.reminderRef))) })), error !== undefined && (_jsxs("p", { className: createCss.failure, role: "alert", children: [_jsx("span", { children: t('memberRemindersFailed', { message: error }) }), _jsx(Button, { size: "sm", variant: "outline", disabled: disabled, onClick: () => { setError(undefined); setReloadToken(token => token + 1); }, children: t('retry') })] }))] }));
}
/** A note long enough to dominate the row folds to a fixed preview with an expand toggle,
 *  reusing the Message body's alpha-mask fade so the cutoff reads as "there is more". */
const REMINDER_NOTE_EXPAND_CHARS = 120;
/** One manageable reminder: the note leads, the schedule/state/timing facts and the withdraw
 *  control share a footer line, and an over-long note folds until expanded. */
function ReminderRow({ view, disabled, withdrawing, onCancel, t }) {
    const [expanded, setExpanded] = useState(false);
    const note = view.reminder.note;
    const clampable = note.length > REMINDER_NOTE_EXPAND_CHARS;
    const timing = reminderTimingText(view, t);
    return (_jsx("li", { className: createCss.reminderRow, children: _jsxs("div", { className: createCss.reminderBody, children: [_jsx("span", { "data-reminder-note": "", className: `${createCss.reminderNote} ${clampable && !expanded ? createCss.reminderNoteClamp : ''}`, children: note }), clampable && (_jsx("button", { type: "button", className: createCss.reminderExpand, "aria-expanded": expanded, onClick: () => { setExpanded(value => !value); }, children: expanded ? t('collapseMessage') : t('expandMessage') })), _jsxs("div", { className: createCss.reminderFooter, children: [_jsxs("p", { className: createCss.reminderFacts, children: [_jsx("span", { children: `${reminderScheduleText(view.reminder.schedule, t)} · ${t(REMINDER_STATE_KEYS[view.reminder.state])}` }), timing !== undefined && _jsx("span", { children: timing })] }), view.reminder.state === 'active' && (_jsx(Button, { className: createCss.reminderCancel, size: "sm", variant: "ghost", "aria-label": `${t('memberReminderCancel')} · ${note}`, disabled: disabled || withdrawing !== undefined, onClick: () => { onCancel(view.reminder.reminderRef); }, children: withdrawing === view.reminder.reminderRef ? t('memberReminderCancelling') : t('memberReminderCancel') }))] })] }) }));
}
/** The one label per stored state, so a new state cannot silently render as nothing. */
const REMINDER_STATE_KEYS = {
    active: 'memberReminderActive',
    done: 'memberReminderDone',
    cancelled: 'memberReminderCancelled',
};
/** One schedule as the Human reads it: the stored form, with cron naming the zone it is read in. */
function reminderScheduleText(schedule, t) {
    if (schedule.kind === 'once')
        return `${t('memberReminderOnce')} ${formatAbsoluteTime(schedule.at)}`;
    if (schedule.kind === 'every')
        return t('memberReminderEvery', { minutes: schedule.minutes });
    return t('memberReminderCron', { expression: schedule.expression });
}
const WORKER_RUN_STATE_KEYS = {
    running: 'memberWorkerRunRunning',
    stopping: 'memberWorkerRunStopping',
    stopped: 'memberWorkerRunStopped',
    completed: 'memberWorkerRunCompleted',
    failed: 'memberWorkerRunFailed',
    unconfirmed: 'memberWorkerRunUnconfirmed',
};
/** What the run reports into, in the words the Thread faces already use. */
function workerRunTargetText(run, t) {
    if (run.taskRef !== undefined)
        return t('memberWorkerTargetTask');
    if (run.threadRef !== undefined)
        return t('memberWorkerTargetThread');
    return t('memberWorkerTargetProject');
}
/**
 * One Member's running Worker executions, read from the Host that owns them.
 * Read-only by construction: the Human sees what this Host holds and may ask it
 * to stop one, but a stop is only reported as done when the engine confirmed its
 * cleanup. A failed stop keeps its row and its sentence across refreshes rather
 * than disappearing into a shorter list.
 */
export function MemberWorkerRunsSection({ workspaceId, memberId, loadWorkerRuns, stopWorker, inspectWorker, disabled, t }) {
    const [runs, setRuns] = useState();
    const [error, setError] = useState();
    const [reloadToken, setReloadToken] = useState(0);
    const [stopping, setStopping] = useState();
    const [outcomes, setOutcomes] = useState(() => new Map());
    // One seat for a row's report: opening another row closes the previous one
    // instead of stacking them.
    const [report, setReport] = useState();
    const headingId = useId();
    // A read that answers after the surface moved on is not the answer to show:
    // each open bumps its generation, and only the current one lands.
    const reportGeneration = useRef(0);
    useEffect(() => {
        let mounted = true;
        let pending;
        try {
            pending = loadWorkerRuns({ workspaceId, memberId });
        }
        catch (cause) {
            // A synchronously refused read (an undeclared remote, a dead scope) is the same retryable failure.
            setError(cause instanceof Error ? cause.message : String(cause));
            return;
        }
        void pending.then((result) => {
            if (!mounted)
                return;
            if (result.ok) {
                setRuns(result.value.runs);
                setError(undefined);
            }
            else {
                setError(result.error.message);
            }
        }, (cause) => {
            if (!mounted)
                return;
            setError(cause instanceof Error ? cause.message : String(cause));
        });
        return () => { mounted = false; };
    }, [loadWorkerRuns, workspaceId, memberId, reloadToken]);
    /**
     * Record a request that carried no execution fact: the sentence changes, and
     * whatever the Host last confirmed for this row stays exactly as it was.
     */
    const recordNotice = (run, notice) => {
        setOutcomes(current => {
            const previous = current.get(run.workerRef);
            return new Map(current).set(run.workerRef, { run,
                ...(previous?.hostState === undefined ? {} : { hostState: previous.hostState }), notice });
        });
    };
    const stop = async (run) => {
        if (stopping !== undefined)
            return;
        setStopping(run.workerRef);
        try {
            const result = await stopWorker({ workspaceId, memberId, workerRef: run.workerRef });
            if (!result.ok) {
                // A refused call says the request did not complete. It carries no
                // execution fact, so it may not take back a state the Host confirmed.
                recordNotice(run, result.error.message);
                return;
            }
            const value = result.value;
            // The Host's receipt is structured: an ending it decided, a cleanup still
            // in flight, or a handle it no longer holds. None of them is guessed here.
            setOutcomes(current => new Map(current).set(run.workerRef, value.kind === 'ended'
                ? { run, hostState: value.state, ...(value.diagnostic === undefined ? {} : { notice: value.diagnostic }) }
                : { run, hostState: value.kind === 'pending' ? 'stopping' : 'unconfirmed', notice: value.message }));
        }
        catch (cause) {
            // The row stays, and so does whatever the Host last confirmed: a request
            // that never completed is an explanation, not an execution fact.
            recordNotice(run, cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setStopping(undefined);
        }
    };
    /**
     * Read one ended run's diagnostic from its row. The Host answers the summary,
     * the native identities it recorded, and whatever the engine's own record
     * still holds; this surface only renders what it is given. The same control
     * folds the report away, including while its read is still in flight.
     */
    const inspect = async (workerRef) => {
        if (report?.workerRef === workerRef) {
            reportGeneration.current += 1;
            setReport(undefined);
            return;
        }
        const current = ++reportGeneration.current;
        setReport({ workerRef });
        try {
            const result = await inspectWorker({ workspaceId, memberId, workerRef });
            if (current !== reportGeneration.current)
                return;
            setReport(result.ok ? { workerRef, value: result.value } : { workerRef, error: result.error.message });
        }
        catch (cause) {
            if (current !== reportGeneration.current)
                return;
            setReport({ workerRef, error: cause instanceof Error ? cause.message : String(cause) });
        }
    };
    const rows = (runs ?? []).map(run => ({ run, outcome: outcomes.get(run.workerRef) }));
    for (const outcome of outcomes.values()) {
        if (!(runs ?? []).some(run => run.workerRef === outcome.run.workerRef))
            rows.push({ run: outcome.run, outcome });
    }
    return (_jsxs("div", { className: createCss.section, role: "group", "aria-labelledby": headingId, "data-team-member-workers": true, children: [_jsxs("div", { className: createCss.sectionHead, children: [_jsx("h3", { className: settingsCss.groupHeading, id: headingId, children: t('memberWorkerRuns') }), rows.length > 0 && _jsx("small", { className: createCss.sectionHeadMeta, children: t('memberWorkerRunsWindow') })] }), runs === undefined && error === undefined && _jsx("small", { className: css.editHint, children: t('memberWorkerRunsLoading') }), runs !== undefined && rows.length === 0 && _jsx("small", { className: css.editHint, children: t('memberWorkerRunsEmpty') }), rows.length > 0 && (_jsx("ul", { className: createCss.reminderList, children: rows.map(({ run, outcome }) => {
                    // The Host's live word wins over a snapshot; a receipt's ending wins
                    // over both, because a run that ended is no longer listed.
                    const listed = (runs ?? []).find(candidate => candidate.workerRef === run.workerRef);
                    const state = outcome?.hostState ?? listed?.state ?? run.state;
                    // One flag drives the visible word, the accessible name, the expanded
                    // state, and the click: a control whose name says "view" while it folds
                    // the report away tells a screen reader a different story than the page.
                    const open = report?.workerRef === run.workerRef;
                    // Only an ended run has a native record to read. The Host answers a live
                    // one with "still going" and an unconfirmed one with the sentence its own
                    // hint already carries, so a door there would open onto nothing.
                    const ended = state === 'stopped' || state === 'completed' || state === 'failed';
                    return (_jsx("li", { className: createCss.reminderRow, "data-worker-run": run.workerRef, "data-worker-state": state, children: _jsxs("div", { className: createCss.reminderBody, children: [_jsx("span", { className: createCss.workerRunTask, "data-worker-task": "", title: run.task, children: `${workerEngineName(t, run.engine)} · ${run.task}` }), _jsxs("div", { className: createCss.reminderFooter, children: [_jsx("p", { className: createCss.workerRunFacts, children: `${t(WORKER_RUN_STATE_KEYS[state])} · ${workerRunTargetText(run, t)} · `
                                                + t('memberWorkerStarted', { time: formatMessageTime(run.startedAt) }) }), (state === 'running' || state === 'stopping' || ended) && (_jsxs("div", { className: createCss.reminderActions, children: [(state === 'running' || state === 'stopping') && (_jsx(Button, { size: "sm", variant: "ghost", "aria-label": t('memberWorkerStopAction', { task: run.task }), disabled: disabled || stopping !== undefined, onClick: () => { void stop(run); }, children: stopping === run.workerRef || state === 'stopping' ? t('memberWorkerRunStopping') : t('memberWorkerStop') })), ended && (_jsx(Button, { size: "sm", variant: "ghost", "aria-label": open
                                                        ? t('memberWorkerInspectHideAction', { task: run.task })
                                                        : t('memberWorkerInspectAction', { task: run.task }), "aria-expanded": open, disabled: disabled, onClick: () => { void inspect(run.workerRef); }, children: open ? t('memberWorkerInspectHide') : t('memberWorkerInspect') }))] }))] }), outcome?.notice !== undefined && _jsx("p", { className: createCss.error, role: "alert", children: outcome.notice }), state === 'unconfirmed' && _jsx("small", { className: css.editHint, children: t('memberWorkerStopUnconfirmedHint') }), report?.workerRef === run.workerRef && _jsx(WorkerReport, { report: report, t: t })] }) }, run.workerRef));
                }) })), error !== undefined && (_jsxs("p", { className: createCss.failure, role: "alert", children: [_jsx("span", { children: t('memberWorkerRunsFailed', { message: error }) }), _jsx(Button, { size: "sm", variant: "outline", disabled: disabled, onClick: () => { setError(undefined); setReloadToken(token => token + 1); }, children: t('retry') })] }))] }));
}
/**
 * The Host's report as it came: the summary the Thread already carries, the
 * native identities the settlement recorded, and the bounded fragments the
 * engine's own record still answers — or the reason it cannot. Nothing here is
 * derived from a refusal.
 */
function WorkerReport({ report, t }) {
    if (report.value === undefined) {
        // A read in flight is a status; a read that failed is the same failure every
        // other read on this page reports, so it is an alert.
        return report.error === undefined
            ? _jsx("p", { className: createCss.error, role: "status", children: t('memberWorkerInspectLoading') })
            : _jsx("p", { className: createCss.error, role: "alert", children: t('memberWorkerInspectFailed', { message: report.error }) });
    }
    const value = report.value;
    const native = [
        value.native.threadId === undefined ? undefined : t('memberWorkerInspectNativeThread', { id: value.native.threadId }),
        value.native.turnId === undefined ? undefined : t('memberWorkerInspectNativeTurn', { id: value.native.turnId }),
        value.native.storage === undefined ? undefined : t('memberWorkerInspectNativeRecord', { path: value.native.storage }),
    ].filter((line) => line !== undefined);
    return (_jsxs("div", { className: `${createCss.reminderFacts} ${createCss.workerReport}`, "data-worker-report": value.workerRef, children: [_jsx("p", { className: createCss.reportLine, children: `${t('memberWorkerInspectSummary')}: ${value.summary}` }), value.stage !== undefined && _jsx("p", { className: createCss.reportLine, children: t('memberWorkerInspectStage', { stage: value.stage }) }), native.length === 0
                ? _jsx("p", { className: createCss.reportLine, children: t('memberWorkerInspectNoNative') })
                : native.map(line => _jsx("p", { className: createCss.reportLine, children: line }, line)), value.history.kind === 'read' ? (_jsxs(_Fragment, { children: [_jsx("p", { className: createCss.reportLine, children: t('memberWorkerInspectFragments') }), value.history.fragments.length === 0
                        ? _jsx("p", { className: createCss.reportLine, children: t('memberWorkerInspectNoFragments') })
                        : _jsx("ul", { className: createCss.reportList, children: value.history.fragments.map((fragment, index) => (
                            // Two fragments of one kind are ordinary (an interrupted turn and a
                            // failed one), so the position is part of the identity.
                            _jsx("li", { children: `${fragment.kind}: ${fragment.text}` }, `${fragment.kind}-${index}`))) }), value.history.withheld > 0
                        && _jsx("p", { className: createCss.reportLine, children: t('memberWorkerInspectWithheld', { count: value.history.withheld }) }), value.history.truncated && _jsx("p", { className: createCss.reportLine, children: t('memberWorkerInspectTruncated') })] })) : _jsx("p", { className: createCss.reportLine, children: value.history.reason })] }));
}
export function AgentEditorDialog({ status, updateMember, loadModels, loadMemberReminders, cancelMemberReminder, loadWorkerRuns, stopWorker, inspectWorker, onCommitted, onClose, t }) {
    const memberId = status.member.memberId;
    const [handle, setHandle] = useState(status.member.handle);
    const [description, setDescription] = useState(status.member.description);
    const [model, setModel] = useState(status.member.model);
    const { saving, error, save, invalidate } = useEditDialogSave({
        save: updateMember,
        onCommitted,
        onClose,
    });
    const dirty = handle.trim() !== status.member.handle || description.trim() !== status.member.description
        || !sameModel(model, status.member.model);
    const submit = async (event) => {
        event.preventDefault();
        const normalizedHandle = handle.trim();
        const normalizedDescription = description.trim();
        if (saving || !dirty || normalizedHandle.length === 0)
            return;
        const payload = {
            memberId,
            handle: normalizedHandle,
            description: normalizedDescription,
            // A Member always runs an explicit route and the Host refuses to clear one, so a record that has none yet simply
            // leaves the field out. Capabilities stay out of the payload so a Remote-written override is left alone.
            ...(model === undefined ? {} : { model }),
        };
        await save(previous => previous !== undefined && previous.memberId === payload.memberId
            && previous.handle === payload.handle && previous.description === payload.description
            && sameModel(previous.model, model) ? previous : {
            requestId: mintRequestId(),
            ...payload,
        });
    };
    return (_jsxs(Modal, { open: true, onClose: onClose, title: t('editAgent'), description: `@${status.member.handle}`, closeLabel: t('close'), contentClassName: createCss.dialogContent, footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: saving, onClick: onClose, children: t('cancel') }), _jsx(Button, { type: "submit", form: "team-agent-edit-form", variant: "primary", disabled: saving || !dirty || handle.trim().length === 0, children: saving ? t('editSaving') : t('editSave') })] }), children: [_jsxs("form", { id: "team-agent-edit-form", className: createCss.form, onSubmit: event => { void submit(event); }, children: [_jsxs("label", { className: createCss.field, children: [_jsx("span", { children: t('agentName') }), _jsx(Input, { className: createCss.input, value: handle, onChange: event => { setHandle(event.target.value); invalidate(); }, disabled: saving, "data-modal-autofocus": true })] }), _jsxs("label", { className: createCss.field, children: [_jsxs("span", { children: [t('agentDescription'), t('optionalSuffix')] }), _jsx(Input, { className: createCss.input, value: description, placeholder: t('agentDescriptionPlaceholder'), onChange: event => { setDescription(event.target.value); invalidate(); }, disabled: saving })] }), _jsx(ModelPickerField, { model: model, onModelChange: choice => { invalidate(); setModel(choice); }, loadModels: loadModels, disabled: saving, t: t }), error !== undefined && _jsx("p", { className: createCss.error, role: "alert", children: error })] }), _jsx(MemberRemindersSection, { workspaceId: status.member.workspaceId, memberId: memberId, loadMemberReminders: loadMemberReminders, cancelMemberReminder: cancelMemberReminder, disabled: saving, t: t }), _jsx(MemberWorkerRunsSection, { workspaceId: status.member.workspaceId, memberId: memberId, loadWorkerRuns: loadWorkerRuns, stopWorker: stopWorker, inspectWorker: inspectWorker, disabled: saving, t: t })] }));
}
export function sameModel(left, right) {
    // `null` and an absent field both mean "no override", so they are the same
    // state even though the update request distinguishes them.
    if (left === undefined || left === null)
        return right === undefined || right === null;
    if (right === undefined || right === null)
        return false;
    return left.provider === right.provider && left.model === right.model && left.reasoningEffort === right.reasoningEffort;
}
