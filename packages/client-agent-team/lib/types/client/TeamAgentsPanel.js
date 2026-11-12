import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, IconArchiveOutlineRegular, IconEditOutlineRegular, IconPlayOutlineRegular, IconPlusOutlineRegular, IconRefreshOutlineRegular, Input, Modal, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamMemberIdentity } from "./TeamMemberRow.js";
import { SortableRow, useSidebarRowDrag } from "./sidebar-drag.js";
import { moveSidebarItem, useSidebarOrder } from "./sidebar-order.js";
import { useSidebarSectionOpen, setSidebarSectionOpen } from "./sidebar-sections.js";
import { mintRequestId } from "./requests.js";
import { diagnosticText, restartOffered } from "./TeamPresenceDot.js";
import { TeamRowMenu } from "./TeamRowMenu.js";
import { TeamSidebarSection } from "./TeamSidebarSection.js";
import { AgentEditorDialog, ModelPickerField, sameModel, warmModelCatalog } from "./TeamMemberEditor.js";
import { TeamAgentImport } from "./TeamAgentImport.js";
import createCss from './create.module.css';
import css from './sidebar.module.css';
/**
 * Follow a Host-initiated Session swap exactly once. The panel follows only once the refreshed status is active, so the
 * commit window never redirects to a Session that does not exist. The seat must still show the previous Session at
 * completion; navigating away first cancels the follow.
 */
function useMemberSessionFollow(seatSessionId, openMemberSession) {
    const observed = useRef(new Map());
    const follows = useRef(new Map());
    // Refs, so the follow decision reads the live value even through a refresh closure captured before the seat rebinds.
    const seatRef = useRef(seatSessionId);
    seatRef.current = seatSessionId;
    const openRef = useRef(openMemberSession);
    openRef.current = openMemberSession;
    return useCallback((statuses) => {
        for (const status of statuses) {
            const memberId = status.member.memberId;
            const current = status.member.sessionId;
            const previous = observed.current.get(memberId);
            if (previous === undefined) {
                observed.current.set(memberId, current);
                continue;
            }
            if (previous !== current) {
                observed.current.set(memberId, current);
                // Only the exact previous live page arms a follow. A binding change seen before any page is embedded is still recorded as the baseline.
                const seat = seatRef.current;
                follows.current.set(memberId, seat !== undefined && previous === seat
                    ? { kind: 'pending', previousSessionId: previous, nextSessionId: current }
                    : { kind: 'idle' });
            }
            const follow = follows.current.get(memberId);
            if (follow?.kind === 'pending' && follow.nextSessionId === current && status.availability === 'active') {
                const seat = seatRef.current;
                follows.current.set(memberId, { kind: 'followed', nextSessionId: current });
                if (seat !== undefined && seat === follow.previousSessionId)
                    openRef.current(follow.nextSessionId);
            }
        }
    }, []);
}
export function TeamAgentsPanel({ workspaceId, loadMembers, subscribeChanges, addMember, updateMember, recoverMember, archiveMember, joinWorkspace, leaveWorkspace, loadModels, loadMemberReminders, cancelMemberReminder, loadWorkerRuns, stopWorker, inspectWorker, memberSessionId, openMemberSession, onCreatingChange, t }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState();
    const [savedRefreshFailed, setSavedRefreshFailed] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [handle, setHandle] = useState('');
    const [description, setDescription] = useState('');
    const [model, setModel] = useState(undefined);
    const [creating, setCreating] = useState(false);
    const [retryRequest, setRetryRequest] = useState();
    const triggerRef = useRef(null);
    const agentRefs = useMemo(() => members.map(status => status.member.memberId), [members]);
    const orderedAgentRefs = useSidebarOrder(workspaceId, 'agents', agentRefs);
    const orderedMembers = useMemo(() => {
        const byId = new Map(members.map(status => [status.member.memberId, status]));
        return orderedAgentRefs.map(memberId => byId.get(memberId)).filter(status => status !== undefined);
    }, [orderedAgentRefs, members]);
    const applyMove = (movedRef, targetRef, marker) => {
        void moveSidebarItem(workspaceId, 'agents', orderedAgentRefs, movedRef, targetRef, marker);
    };
    const drag = useSidebarRowDrag({ refs: orderedAgentRefs, onCommit: applyMove });
    const sectionOpen = useSidebarSectionOpen(workspaceId, 'agents');
    const followRollover = useMemberSessionFollow(memberSessionId, openMemberSession);
    const loadedRef = useRef(false);
    const mountedRef = useRef(false);
    const editAwaitingRefresh = useRef(false);
    // Workspace and presence wakes can overlap; only the newest issuance may update the roster or its error.
    const refreshSequenceRef = useRef(0);
    const refresh = useCallback(async () => {
        const sequence = refreshSequenceRef.current + 1;
        refreshSequenceRef.current = sequence;
        if (!loadedRef.current)
            setLoading(true);
        try {
            const result = await loadMembers({ workspaceId });
            // A panel the user already left changes nothing; the key-remounted successor owns the roster state now.
            if (!mountedRef.current || sequence !== refreshSequenceRef.current)
                return;
            if (result.ok) {
                const next = result.value.filter(status => status.member.state !== 'inactive' && status.member.state !== 'archived');
                setMembers(next);
                followRollover(next);
                setError(undefined);
                setSavedRefreshFailed(false);
                editAwaitingRefresh.current = false;
                loadedRef.current = true;
            }
            else {
                setError(result.error.message);
                setSavedRefreshFailed(editAwaitingRefresh.current);
            }
        }
        catch (cause) {
            if (mountedRef.current && sequence === refreshSequenceRef.current) {
                setError(cause instanceof Error ? cause.message : String(cause));
                setSavedRefreshFailed(editAwaitingRefresh.current);
            }
        }
        finally {
            if (mountedRef.current && sequence === refreshSequenceRef.current)
                setLoading(false);
        }
    }, [loadMembers, workspaceId, followRollover]);
    const refreshAfterCommit = useCallback(() => {
        editAwaitingRefresh.current = true;
        return refresh();
    }, [refresh]);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            refreshSequenceRef.current += 1;
        };
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);
    // Mount-scoped, not per refresh: presence wakes must not refetch the catalog.
    useEffect(() => { warmModelCatalog(loadModels); }, [loadModels]);
    useEffect(() => subscribeChanges({ kind: 'workspace', workspaceId }, update => {
        if (update.type === 'failed') {
            setError(update.message);
            setSavedRefreshFailed(editAwaitingRefresh.current);
            return;
        }
        void refresh();
    }), [subscribeChanges, refresh, workspaceId]);
    // Presence commits nothing and wakes only this scope, so dots stay live without a catalog refetch.
    useEffect(() => subscribeChanges({ kind: 'presence', workspaceId }, update => {
        if (update.type === 'failed') {
            setError(update.message);
            setSavedRefreshFailed(editAwaitingRefresh.current);
            return;
        }
        void refresh();
    }), [subscribeChanges, refresh, workspaceId]);
    const closeForm = () => {
        if (creating)
            return;
        setFormOpen(false);
        queueMicrotask(() => { triggerRef.current?.focus(); });
    };
    const provision = async (request) => {
        setCreating(true);
        onCreatingChange(request, true);
        setError(undefined);
        setSavedRefreshFailed(false);
        setRetryRequest(request);
        try {
            const result = await addMember(request);
            if (result.ok) {
                const committed = { ...result.value.status, workspaceIds: result.value.workspaceIds };
                setMembers(current => {
                    const retained = current.filter(status => status.member.memberId !== committed.member.memberId);
                    return committed.member.state === 'inactive' || committed.member.state === 'archived' ? retained : [...retained, committed];
                });
                setHandle('');
                setDescription('');
                setModel(undefined);
                setFormOpen(false);
                if (result.value.status.presence === 'unavailable') {
                    setError(diagnosticText(result.value.status) || t('statusUnavailable'));
                }
                else {
                    setRetryRequest(undefined);
                }
                queueMicrotask(() => { triggerRef.current?.focus(); });
            }
            else {
                await refresh();
                setError(result.error.message);
            }
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setCreating(false);
            onCreatingChange(request, false);
        }
    };
    const submit = (event) => {
        event.preventDefault();
        const normalizedHandle = handle.trim();
        const normalizedDescription = description.trim();
        // The Host requires an explicit route at creation, so the form refuses to submit without one.
        if (normalizedHandle.length === 0 || model === undefined || creating)
            return;
        const sameRequest = retryRequest !== undefined && retryRequest.workspaceId === workspaceId
            && retryRequest.handle === normalizedHandle && retryRequest.description === normalizedDescription
            && sameModel(retryRequest.model, model)
            && retryRequest.projectRefs.length === 0;
        void provision(sameRequest ? retryRequest : {
            requestId: mintRequestId(),
            workspaceId,
            handle: normalizedHandle,
            description: normalizedDescription,
            presetId: 'team-member',
            // No initial Projects: the Member joins later from the Project side, reachable through its DM view meanwhile.
            projectRefs: [],
            model,
        });
    };
    // `members` is empty both before the first successful load and after a failed
    // one, so claiming the roster is empty additionally requires a clear error.
    const showEmptyRoster = !loading && error === undefined && members.length === 0;
    return (_jsxs("div", { className: css.panel, children: [_jsxs(Modal, { open: formOpen, onClose: closeForm, title: t('addAgent'), closeLabel: t('close'), contentClassName: createCss.dialogContent, footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: creating, onClick: closeForm, children: t('cancel') }), !importing && _jsx(Button, { type: "submit", form: "team-agent-create-form", variant: "primary", disabled: creating || handle.trim().length === 0 || model === undefined, children: creating ? t('creatingAgent') : t('createAgent') })] }), children: [_jsx(Button, { className: createCss.modeSwitch, variant: "outline", disabled: creating, "aria-expanded": importing, onClick: () => { setImporting(value => !value); setError(undefined); }, children: importing ? t('createAgent') : t('importAgentTitle') }), formOpen && importing ? _jsx(TeamAgentImport, { workspaceId: workspaceId, loadMembers: loadMembers, joinWorkspace: joinWorkspace, onPending: setCreating, onJoined: async () => { await refresh(); setFormOpen(false); queueMicrotask(() => { triggerRef.current?.focus(); }); }, t: t }) : _jsxs("form", { id: "team-agent-create-form", className: createCss.form, onSubmit: submit, children: [_jsxs("label", { className: createCss.field, children: [_jsx("span", { children: t('agentName') }), _jsx(Input, { className: createCss.input, value: handle, onChange: event => { setHandle(event.target.value); setRetryRequest(undefined); }, disabled: creating, autoFocus: true })] }), _jsxs("label", { className: createCss.field, children: [_jsxs("span", { children: [t('agentDescription'), t('optionalSuffix')] }), _jsx(Input, { className: createCss.input, value: description, placeholder: t('agentDescriptionPlaceholder'), onChange: event => { setDescription(event.target.value); setRetryRequest(undefined); }, disabled: creating })] }), _jsx(ModelPickerField, { model: model, onModelChange: choice => { setModel(choice); setRetryRequest(undefined); }, loadModels: loadModels, disabled: creating, t: t }), formOpen && error !== undefined && _jsx("p", { className: createCss.error, role: "alert", children: error })] })] }), _jsxs(TeamSidebarSection, { title: t('agents'), open: sectionOpen, onToggle: open => { setSidebarSectionOpen(workspaceId, 'agents', open); }, actions: (_jsx(Tooltip, { label: t('addAgent'), delayMs: 500, children: _jsx("button", { ref: triggerRef, type: "button", className: css.iconButton, "aria-label": t('addAgent'), onClick: () => { setError(undefined); setSavedRefreshFailed(false); setImporting(false); setFormOpen(true); }, children: _jsx(IconPlusOutlineRegular, { size: 14 }) }) })), children: [loading && members.length === 0 && _jsx("p", { className: css.emptyState, children: t('loadingAgents') }), showEmptyRoster && _jsx("p", { className: css.emptyState, children: t('emptyAgents') }), _jsx("div", { className: css.agentList, children: orderedMembers.map(status => (_jsx(SortableRow, { drag: drag, orderKey: status.member.memberId, children: _jsx(AgentRow, { workspaceId: workspaceId, leaveWorkspace: leaveWorkspace, status: status, ...(memberSessionId === undefined ? {} : { current: status.member.sessionId === memberSessionId }), updateMember: updateMember, recoverMember: recoverMember, archiveMember: archiveMember, loadModels: loadModels, loadMemberReminders: loadMemberReminders, cancelMemberReminder: cancelMemberReminder, loadWorkerRuns: loadWorkerRuns, stopWorker: stopWorker, inspectWorker: inspectWorker, openMemberSession: openMemberSession, onUpdated: refresh, onEditCommitted: refreshAfterCommit, t: t }) }, status.member.memberId))) })] }), !formOpen && error !== undefined && (_jsxs("div", { className: css.retryError, role: "alert", children: [_jsx("span", { children: savedRefreshFailed ? t('editSavedRefreshFailed', { message: error }) : error }), _jsx("button", { type: "button", className: css.textButton, disabled: creating, onClick: () => {
                            if (savedRefreshFailed || retryRequest === undefined)
                                void refresh();
                            else
                                setFormOpen(true);
                        }, children: savedRefreshFailed ? t('editRefreshRetry') : t('retry') })] }))] }));
}
function AgentRow({ workspaceId, leaveWorkspace, status, current, updateMember, recoverMember, archiveMember, loadModels, loadMemberReminders, cancelMemberReminder, loadWorkerRuns, stopWorker, inspectWorker, openMemberSession, onUpdated, onEditCommitted, t }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [rowAlert, setRowAlert] = useState();
    const [archivePending, setArchivePending] = useState(false);
    const rowRef = useRef(null);
    const selectRef = useRef(null);
    const archiveRequest = useRef();
    const withdrawing = workspaceId !== status.member.workspaceId;
    // The Host steers a live session, rebuilds an orphaned composition, or re-runs a failed activation.
    const recover = async () => {
        try {
            const result = await recoverMember({
                requestId: mintRequestId(),
                workspaceId: status.member.workspaceId,
                memberId: status.member.memberId,
            });
            await onUpdated();
            if (!result.ok) {
                setRowAlert(t('restartFailed', { message: result.error.message }));
                return;
            }
            if (result.value.status.availability === 'unavailable') {
                setRowAlert(t('restartStillUnavailable', { diagnostic: diagnosticText(result.value.status) || t('statusUnavailable') }));
                return;
            }
            setRowAlert(undefined);
            // A page opened while the Member was down predates the live Session;
            // re-selecting is a no-op when already bound and rebinds when stale.
            if (current === true)
                openMemberSession(status.member.sessionId);
        }
        catch (cause) {
            setRowAlert(t('restartFailed', { message: cause instanceof Error ? cause.message : String(cause) }));
        }
    };
    const archive = async () => {
        if (archivePending)
            return;
        setArchivePending(true);
        setRowAlert(undefined);
        archiveRequest.current ??= mintRequestId();
        const request = { requestId: archiveRequest.current, memberId: status.member.memberId };
        try {
            const result = withdrawing ? await leaveWorkspace({ ...request, workspaceId }) : await archiveMember(request);
            if (!result.ok)
                throw new Error(result.error.message);
            setArchiving(false);
            archiveRequest.current = undefined;
            await onUpdated();
        }
        catch (cause) {
            setRowAlert(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setArchivePending(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { ref: rowRef, tabIndex: -1, className: css.agentRow, "data-agent-row": true, "data-menu-open": menuOpen || undefined, children: [_jsx("button", { ref: selectRef, type: "button", className: css.agentSelect, "aria-label": t('openAgentSession', { name: status.member.handle }), "aria-current": current ? 'page' : undefined, disabled: status.availability !== 'active', onClick: () => {
                            // The message below belongs to the attempt that produced it: a later click that opens must not leave it behind.
                            setRowAlert(undefined);
                            openMemberSession(status.member.sessionId, message => {
                                setRowAlert(t('openAgentSessionFailed', { name: status.member.handle.replace(/^@/, ''), message }));
                            });
                        }, children: _jsx(TeamMemberIdentity, { status: status, name: status.member.handle.replace(/^@/, ''), className: css.agentCopy, t: t }) }), _jsx("span", { className: css.rowMenu, children: _jsx(TeamRowMenu, { label: t('actionsAgent', { name: status.member.handle }), items: [
                                { id: 'edit', label: t('editAgent'), icon: _jsx(IconEditOutlineRegular, {}) },
                                ...(status.presence === 'error' ? [{ id: 'resume', label: t('resumeAgent'), icon: _jsx(IconPlayOutlineRegular, {}) }] : []),
                                ...(status.availability === 'unavailable' && restartOffered(status) ? [{ id: 'restart', label: t('restartAgent'), icon: _jsx(IconRefreshOutlineRegular, {}) }] : []),
                                { id: 'archive', label: t(withdrawing ? 'withdrawAgent' : 'archiveAgent'), icon: _jsx(IconArchiveOutlineRegular, { size: 16 }), danger: true },
                            ], onSelect: (id) => {
                                if (id === 'edit') {
                                    // The menu item disappears; the modal needs a persistent return target.
                                    const target = selectRef.current?.disabled === true ? rowRef.current : selectRef.current;
                                    target?.focus({ preventScroll: true });
                                    setEditing(true);
                                }
                                else if (id === 'archive')
                                    setArchiving(true);
                                else
                                    void recover();
                            }, onOpenChange: setMenuOpen }) })] }), !archiving && rowAlert !== undefined && _jsx("div", { className: css.rowAlert, role: "alert", children: rowAlert }), archiving && (_jsxs(Modal, { open: true, onClose: () => { if (!archivePending)
                    setArchiving(false); }, title: t(withdrawing ? 'withdrawAgentTitle' : 'archiveAgentTitle', { name: status.member.handle }), closeLabel: t('close'), contentClassName: createCss.dialogContent, footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: archivePending, onClick: () => { setArchiving(false); }, children: t('cancel') }), _jsx(Button, { variant: "primary", disabled: archivePending, onClick: () => { void archive(); }, children: t(withdrawing ? 'withdrawAgent' : 'archiveAgentConfirm') })] }), children: [_jsx("p", { className: createCss.error, children: t(withdrawing ? 'withdrawAgentNotice' : 'archiveAgentNotice', { name: status.member.handle }) }), !withdrawing && status.workspaceIds.length > 1 && _jsx("p", { children: t('archiveOtherWorkspaces', { count: status.workspaceIds.length - 1 }) }), rowAlert !== undefined && _jsx("p", { className: createCss.error, role: "alert", children: rowAlert })] })), editing && (_jsx(AgentEditorDialog, { status: status, updateMember: updateMember, loadModels: loadModels, loadMemberReminders: loadMemberReminders, cancelMemberReminder: cancelMemberReminder, loadWorkerRuns: loadWorkerRuns, stopWorker: stopWorker, inspectWorker: inspectWorker, onCommitted: onEditCommitted, onClose: () => { setEditing(false); }, t: t }))] }));
}
