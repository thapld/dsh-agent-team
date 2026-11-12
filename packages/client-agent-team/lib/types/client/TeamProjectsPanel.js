import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, IconArchiveOutlineRegular, IconEditOutlineRegular, IconPlusOutlineRegular, Input, Modal, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamPresenceDot } from "./TeamPresenceDot.js";
import { MultiMenuField } from "./multi-menu-field.js";
import { SortableRow, useSidebarRowDrag } from "./sidebar-drag.js";
import { moveSidebarItem, useSidebarOrder } from "./sidebar-order.js";
import { useSidebarSectionOpen, setSidebarSectionOpen } from "./sidebar-sections.js";
import { mintRequestId } from "./requests.js";
import { TeamProjectOwners } from "./TeamProjectOwners.js";
import { TeamRowMenu } from "./TeamRowMenu.js";
import { TeamSidebarSection } from "./TeamSidebarSection.js";
import { useEditDialogSave } from "./team-dialog-save.js";
import createCss from './create.module.css';
import css from './sidebar.module.css';
export function TeamProjectsPanel(props) {
    const { workspaceId, loadMembers, loadProjects, subscribeChanges, createProject, updateProject, creatingAgents, selectedProjectRef, selectProject, t } = props;
    const [view, setView] = useState();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState();
    const [savedRefreshFailed, setSavedRefreshFailed] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selected, setSelected] = useState(new Set());
    const [mutating, setMutating] = useState(false);
    const [pendingCreate, setPendingCreate] = useState();
    const previousCreatingKey = useRef(creatingAgents.map(request => request.requestId).join(','));
    const triggerRef = useRef(null);
    const projectRefs = useMemo(() => view?.projects.map(project => project.projectRef) ?? [], [view]);
    const orderedProjectRefs = useSidebarOrder(workspaceId, 'projects', projectRefs);
    const orderedProjects = useMemo(() => {
        const byRef = new Map((view?.projects ?? []).map(project => [project.projectRef, project]));
        return orderedProjectRefs.map(projectRef => byRef.get(projectRef)).filter(project => project !== undefined);
    }, [orderedProjectRefs, view]);
    const applyMove = (movedRef, targetRef, marker) => {
        void moveSidebarItem(workspaceId, 'projects', orderedProjectRefs, movedRef, targetRef, marker);
    };
    const drag = useSidebarRowDrag({ refs: orderedProjectRefs, onCommit: applyMove });
    const sectionOpen = useSidebarSectionOpen(workspaceId, 'projects');
    const loadedRef = useRef(false);
    const mountedRef = useRef(false);
    const editAwaitingRefresh = useRef(false);
    // Three wake sources can overlap; only the newest issuance applies.
    const refreshSequenceRef = useRef(0);
    const refresh = useCallback(async () => {
        const sequence = refreshSequenceRef.current + 1;
        refreshSequenceRef.current = sequence;
        if (!loadedRef.current)
            setLoading(true);
        // Start each read inside allSettled so a synchronous Remote failure cannot hide the other leg's result.
        const [projectRead, memberRead] = await Promise.allSettled([
            Promise.resolve().then(() => loadProjects({ workspaceId, limit: 1 })),
            Promise.resolve().then(() => loadMembers({ workspaceId })),
        ]);
        // A panel the user already left changes nothing; the key-remounted successor owns the state.
        if (!mountedRef.current || sequence !== refreshSequenceRef.current)
            return;
        const projectResult = projectRead.status === 'fulfilled' ? projectRead.value : undefined;
        const memberResult = memberRead.status === 'fulfilled' ? memberRead.value : undefined;
        // The roster and catalog legs have independent freshness; one leg's failure must not freeze the other's landed value.
        if (projectResult?.ok === true) {
            setView(projectResult.value);
            loadedRef.current = true;
        }
        if (memberResult?.ok === true) {
            const visibleMembers = memberResult.value.filter(status => status.member.state !== 'inactive' && status.member.state !== 'archived');
            setMembers(visibleMembers);
            const selectable = new Set(visibleMembers.filter(status => status.presence !== 'unavailable')
                .map(status => status.member.memberId));
            setSelected(current => new Set([...current].filter(memberId => selectable.has(memberId))));
        }
        const failure = (read, result) => {
            if (read.status === 'rejected')
                return read.reason instanceof Error ? read.reason.message : String(read.reason);
            return result?.ok === false ? result.error?.message : undefined;
        };
        const projectError = failure(projectRead, projectResult);
        const memberError = failure(memberRead, memberResult);
        if (projectError !== undefined)
            setError(projectError);
        else if (memberError !== undefined)
            setError(memberError);
        else
            setError(undefined);
        const failed = projectError !== undefined || memberError !== undefined;
        if (!failed)
            editAwaitingRefresh.current = false;
        setSavedRefreshFailed(failed && editAwaitingRefresh.current);
        setLoading(false);
    }, [loadProjects, loadMembers, workspaceId]);
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
    useEffect(() => subscribeChanges({ kind: 'workspace', workspaceId }, update => {
        if (update.type === 'failed') {
            setError(update.message);
            setSavedRefreshFailed(editAwaitingRefresh.current);
            return;
        }
        void refresh();
    }), [subscribeChanges, refresh, workspaceId]);
    const creatingKey = creatingAgents.map(request => request.requestId).join(',');
    useEffect(() => {
        if (previousCreatingKey.current === creatingKey)
            return;
        previousCreatingKey.current = creatingKey;
        void refresh();
    }, [creatingKey, refresh]);
    const membership = useMemo(() => {
        const byProject = new Map();
        for (const item of view?.members ?? []) {
            const ids = byProject.get(item.projectRef) ?? new Set();
            ids.add(item.memberId);
            byProject.set(item.projectRef, ids);
        }
        return byProject;
    }, [view]);
    const ownership = useMemo(() => {
        const byProject = new Map();
        for (const item of view?.owners ?? []) {
            const ids = byProject.get(item.projectRef) ?? new Set();
            ids.add(item.memberId);
            byProject.set(item.projectRef, ids);
        }
        return byProject;
    }, [view]);
    const closeForm = () => {
        if (mutating)
            return;
        setFormOpen(false);
        queueMicrotask(() => { triggerRef.current?.focus(); });
    };
    const submit = async (event) => {
        event.preventDefault();
        if (mutating || name.trim() === '')
            return;
        const payload = { workspaceId, name: name.trim(), description: description.trim(), memberIds: [...selected] };
        const samePending = pendingCreate !== undefined && pendingCreate.workspaceId === payload.workspaceId
            && pendingCreate.name === payload.name && pendingCreate.description === payload.description
            && JSON.stringify(pendingCreate.memberIds) === JSON.stringify(payload.memberIds);
        const request = samePending ? pendingCreate : {
            requestId: mintRequestId(), ...payload,
        };
        setPendingCreate(request);
        setMutating(true);
        setError(undefined);
        setSavedRefreshFailed(false);
        try {
            const result = await createProject(request);
            if (result.ok) {
                setPendingCreate(undefined);
                setName('');
                setDescription('');
                setSelected(new Set());
                setFormOpen(false);
                await refresh();
                queueMicrotask(() => { triggerRef.current?.focus(); });
            }
            else {
                setError(result.error.message);
            }
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setMutating(false);
        }
    };
    return (_jsxs("div", { className: css.panel, children: [_jsx(Modal, { open: formOpen, onClose: closeForm, title: t('addProject'), closeLabel: t('close'), contentClassName: createCss.dialogContent, footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: mutating, onClick: closeForm, children: t('cancel') }), _jsx(Button, { type: "submit", form: "team-project-create-form", variant: "primary", disabled: mutating || name.trim() === '', children: mutating ? t('creatingProject') : t('createProject') })] }), children: _jsxs("form", { id: "team-project-create-form", className: createCss.form, onSubmit: event => { void submit(event); }, children: [_jsxs("label", { className: createCss.field, children: [_jsx("span", { children: t('projectName') }), _jsx(Input, { className: createCss.input, value: name, disabled: mutating, autoFocus: true, onChange: event => { setName(event.target.value); setPendingCreate(undefined); } })] }), _jsxs("label", { className: createCss.field, children: [_jsxs("span", { children: [t('projectDescription'), t('optionalSuffix')] }), _jsx(Input, { className: createCss.input, value: description, placeholder: t('agentDescriptionPlaceholder'), disabled: mutating, onChange: event => { setDescription(event.target.value); setPendingCreate(undefined); } })] }), _jsx(MultiMenuField, { label: t('initialMembers'), disabled: mutating, options: [
                                ...creatingAgents.map(request => ({ id: request.requestId, label: request.handle, disabled: true, hint: t('memberCreatingReason') })),
                                ...members.map(status => ({
                                    id: status.member.memberId,
                                    label: status.member.handle,
                                    ...(status.presence === 'unavailable' ? { disabled: true, hint: t('memberUnavailableReason') } : {}),
                                    icon: _jsx(TeamPresenceDot, { status: status, t: t }),
                                })),
                            ], selected: [...selected], onToggle: id => {
                                setSelected(current => {
                                    const next = new Set(current);
                                    if (next.has(id))
                                        next.delete(id);
                                    else
                                        next.add(id);
                                    return next;
                                });
                                setPendingCreate(undefined);
                            }, triggerEmptyLabel: t('membersPickerEmpty'), formatCount: count => t('membersPickerCount', { count }) }), error !== undefined && _jsx("p", { className: createCss.error, role: "alert", children: error })] }) }), _jsxs(TeamSidebarSection, { title: t('projects'), help: { label: t('projectHelpLabel'), body: t('projectHelp') }, open: sectionOpen, onToggle: open => { setSidebarSectionOpen(workspaceId, 'projects', open); }, actions: (_jsx(Tooltip, { label: t('addProject'), delayMs: 500, children: _jsx("button", { ref: triggerRef, type: "button", className: css.iconButton, "aria-label": t('addProject'), onClick: () => { setError(undefined); setSavedRefreshFailed(false); setFormOpen(true); }, children: _jsx(IconPlusOutlineRegular, { size: 14 }) }) })), children: [loading && view === undefined && _jsx("p", { className: css.emptyState, children: t('loadingProjects') }), !loading && error === undefined && view !== undefined && view.projects.length === 0 && _jsx("p", { className: css.emptyState, children: t('emptyProjects') }), _jsx("div", { className: css.projectList, children: orderedProjects.map(project => {
                            const joined = membership.get(project.projectRef) ?? new Set();
                            return (_jsx(SortableRow, { drag: drag, orderKey: project.projectRef, children: _jsx(ProjectRow, { project: project, members: members, joinedIds: joined, ownerIds: ownership.get(project.projectRef) ?? new Set(), addProjectOwner: props.addProjectOwner, removeProjectOwner: props.removeProjectOwner, humanIdentity: props.humanIdentity, selected: selectedProjectRef === project.projectRef, updateProject: updateProject, archiveProject: props.archiveProject, onCommitted: refresh, onEditCommitted: refreshAfterCommit, selectProject: selectProject, t: t }) }, project.projectRef));
                        }) })] }), !formOpen && error !== undefined && (_jsxs("div", { className: css.retryError, role: "alert", children: [_jsx("span", { children: savedRefreshFailed ? t('editSavedRefreshFailed', { message: error }) : error }), _jsx("button", { type: "button", className: css.textButton, disabled: mutating, onClick: () => { void refresh(); }, children: savedRefreshFailed ? t('editRefreshRetry') : t('retry') })] }))] }));
}
function ProjectRow({ project, members, joinedIds, ownerIds, addProjectOwner, removeProjectOwner, humanIdentity, selected, updateProject, archiveProject, onCommitted, onEditCommitted, selectProject, t }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [rowAlert, setRowAlert] = useState();
    const selectRef = useRef(null);
    const archive = async () => {
        try {
            const result = await archiveProject({
                requestId: mintRequestId(),
                workspaceId: project.workspaceId,
                projectRef: project.projectRef,
            });
            await onCommitted();
            if (!result.ok) {
                setRowAlert(t('archiveProjectFailed', { message: result.error.message }));
            }
        }
        catch (cause) {
            setRowAlert(t('archiveProjectFailed', { message: cause instanceof Error ? cause.message : String(cause) }));
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("article", { className: css.projectRow, "data-team-project-row": project.projectRef, "data-menu-open": menuOpen || undefined, "aria-current": selected ? 'page' : undefined, children: [_jsx("button", { ref: selectRef, type: "button", className: css.projectSelect, "aria-label": `# ${project.name}`, onClick: () => { selectProject(project.projectRef); }, children: _jsxs("strong", { className: css.projectName, children: ["# ", project.name] }) }), _jsx("span", { className: css.rowMenu, children: _jsx(TeamRowMenu, { label: t('actionsProject', { name: project.name }), items: [
                                { id: 'edit', label: t('editProject'), icon: _jsx(IconEditOutlineRegular, {}) },
                                { id: 'archive', label: t('archiveProject'), icon: _jsx(IconArchiveOutlineRegular, { size: 16 }), danger: true },
                            ], onSelect: (id) => {
                                if (id === 'edit') {
                                    selectRef.current?.focus({ preventScroll: true });
                                    setEditing(true);
                                }
                                else
                                    setArchiving(true);
                            }, onOpenChange: setMenuOpen }) })] }), rowAlert !== undefined && _jsx("div", { className: css.rowAlert, role: "alert", children: rowAlert }), archiving && (_jsx(Modal, { open: true, onClose: () => { setArchiving(false); }, title: t('archiveProjectTitle', { name: project.name }), closeLabel: t('close'), contentClassName: createCss.dialogContent, footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", onClick: () => { setArchiving(false); }, children: t('cancel') }), _jsx(Button, { variant: "primary", onClick: () => { setArchiving(false); void archive(); }, children: t('archiveProjectConfirm') })] }), children: _jsx("p", { className: createCss.error, children: t('archiveProjectNotice', { name: project.name }) }) })), editing && (_jsx(ProjectEditorDialog, { project: project, members: members, joinedIds: joinedIds, ownerIds: ownerIds, addProjectOwner: addProjectOwner, removeProjectOwner: removeProjectOwner, humanIdentity: humanIdentity, updateProject: updateProject, onCommitted: onEditCommitted, onClose: () => { setEditing(false); }, t: t }))] }));
}
/** Name and description commit through one durable update; membership keeps its own immediate add/remove flow. */
function ProjectEditorDialog({ project, members, ownerIds, addProjectOwner, removeProjectOwner, humanIdentity, updateProject, onCommitted, onClose, t }) {
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description);
    const { saving, error, save, invalidate } = useEditDialogSave({
        save: updateProject,
        onCommitted,
        onClose,
    });
    const dirty = name.trim() !== project.name || description.trim() !== project.description;
    const submit = async (event) => {
        event.preventDefault();
        const normalizedName = name.trim();
        const normalizedDescription = description.trim();
        if (saving || !dirty || normalizedName === '')
            return;
        await save(previous => previous !== undefined && previous.projectRef === project.projectRef
            && previous.name === normalizedName && previous.description === normalizedDescription ? previous : {
            requestId: mintRequestId(),
            workspaceId: project.workspaceId,
            projectRef: project.projectRef,
            name: normalizedName,
            description: normalizedDescription,
        });
    };
    return (_jsxs(Modal, { open: true, onClose: onClose, title: t('editProject'), description: `# ${project.name}`, closeLabel: t('close'), contentClassName: createCss.dialogContent, footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: saving, onClick: onClose, children: t('cancel') }), _jsx(Button, { type: "submit", form: "team-project-edit-form", variant: "primary", disabled: saving || !dirty || name.trim() === '', children: saving ? t('editSaving') : t('editSave') })] }), children: [_jsxs("form", { id: "team-project-edit-form", className: createCss.form, onSubmit: event => { void submit(event); }, children: [_jsxs("label", { className: createCss.field, children: [_jsx("span", { children: t('projectName') }), _jsx(Input, { className: createCss.input, value: name, onChange: event => { setName(event.target.value); invalidate(); }, disabled: saving, "data-modal-autofocus": true })] }), _jsxs("label", { className: createCss.field, children: [_jsxs("span", { children: [t('projectDescription'), t('optionalSuffix')] }), _jsx(Input, { className: createCss.input, value: description, placeholder: t('agentDescriptionPlaceholder'), onChange: event => { setDescription(event.target.value); invalidate(); }, disabled: saving })] }), error !== undefined && _jsx("p", { className: createCss.error, role: "alert", children: error })] }), _jsx(TeamProjectOwners, { project: project, members: members, ownerIds: ownerIds, addProjectOwner: addProjectOwner, removeProjectOwner: removeProjectOwner, humanIdentity: humanIdentity, onCommitted: onCommitted, t: t })] }));
}
