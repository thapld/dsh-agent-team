import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { IconAgentPresetOutlineRegular, IconChecklistOutlineRegular, IconChevronLeftOutlineMedium, IconChevronLeftOutlineRegular, IconListPenOutlineRegular, IconQueueOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamWorkspaceSelector } from "./TeamWorkspaceSelector.js";
import { TeamAgentsPanel } from "./TeamAgentsPanel.js";
import { TeamProjectsPanel } from "./TeamProjectsPanel.js";
import css from './sidebar.module.css';
/** A failed read keeps the last good total: it must never fold into zero and read as "no unread". Recovery overwrites the kept value. */
function mergeInboxTotals(results, previous) {
    const totals = new Map();
    for (const { workspaceId, result } of results) {
        totals.set(workspaceId, result.ok ? result.value.totalUnreadCount : previous.get(workspaceId) ?? 0);
    }
    return totals;
}
/**
 * The quantity lives in the control's accessible name. The mark hangs off the icon so the wide card and the 36px rail
 * button put the same dot on the same corner.
 */
function InboxMark({ unread }) {
    return _jsxs("span", { className: css.inboxMark, children: [_jsx(IconQueueOutlineRegular, { size: 16 }), unread > 0 && _jsx("span", { className: css.inboxDot, "data-team-inbox-dot": true, "aria-hidden": "true" })] });
}
export function TeamWorkspaceBrowser({ wide, expandSidebar, navigation, selectWorkspace, selectProject, selectInbox, selectBoard, leaveTeam, t, useWorkspaces, loadMembers, loadInbox, subscribeChanges, subscribeReads, addMember, loadProjects, createProject, updateProject, archiveProject, addProjectOwner, removeProjectOwner, humanIdentity, updateMember, recoverMember, archiveMember, joinWorkspace, leaveWorkspace, loadModels, loadMemberReminders, cancelMemberReminder, loadWorkerRuns, stopWorker, inspectWorker, openMemberSession }) {
    const navigationState = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot, navigation.getSnapshot);
    const workspaces = useWorkspaces(state => state.items);
    const selected = navigationState.workspaceId;
    const selectedExists = selected !== undefined && workspaces.some(workspace => workspace.workspaceId === selected);
    const selectedId = selectedExists ? selected : workspaces[0]?.workspaceId;
    // Exactly one sidebar row carries aria-current='page': the open Project, else the selected Agent card while a Member Session
    // view is open, else the Workspace overview. The Inbox and Task board cards take the marker while their global page stands,
    // but not while an embedded Member Session covers it (the face stays the remembered one underneath).
    const overviewIsCurrent = navigationState.projectRef === undefined && navigationState.memberSessionId === undefined && navigationState.inbox !== true && navigationState.board !== true;
    const inboxIsCurrent = navigationState.inbox === true && navigationState.memberSessionId === undefined;
    const boardIsCurrent = navigationState.board === true && navigationState.memberSessionId === undefined;
    const [creatingAgents, setCreatingAgents] = useState([]);
    // Rail icons request expansion and name the section to reveal once wide.
    const [pendingSection, setPendingSection] = useState();
    const projectsRef = useRef(null);
    const agentsRef = useRef(null);
    // One scope-less subscription re-pulls each Workspace's unread total (limit 1) on every wake; same-burst wakes coalesce behind a short debounce.
    const [inboxTotal, setInboxTotal] = useState(0);
    // Kept across failed refreshes so the badge never folds an unread read into zero.
    const keptTotalsRef = useRef(new Map());
    // The rail repeats it as the hover hint, the only place a reader meets the quantity without opening the page.
    const inboxLabel = inboxTotal > 0 ? t('inboxTitleWithCount', { count: inboxTotal }) : t('inboxTitle');
    useEffect(() => {
        let disposed = false;
        let scheduled;
        const refresh = async () => {
            const results = await Promise.all(workspaces.map(async (workspace) => ({
                workspaceId: workspace.workspaceId,
                result: await loadInbox({ workspaceId: workspace.workspaceId, limit: 1 }),
            })));
            if (disposed)
                return;
            const totals = mergeInboxTotals(results, keptTotalsRef.current);
            keptTotalsRef.current = totals;
            setInboxTotal([...totals.values()].reduce((sum, total) => sum + total, 0));
        };
        const schedule = () => {
            if (scheduled !== undefined)
                return;
            scheduled = setTimeout(() => { scheduled = undefined; void refresh(); }, 200);
        };
        void refresh();
        const unsubscribe = subscribeChanges(undefined, update => {
            if (update.type === 'changed')
                schedule();
        });
        // Reads change no shared projection, so no changes wake fires; refresh the badge from every completed read.
        const unsubscribeReads = subscribeReads(schedule);
        return () => {
            disposed = true;
            if (scheduled !== undefined)
                clearTimeout(scheduled);
            unsubscribe();
            unsubscribeReads();
        };
    }, [loadInbox, subscribeChanges, subscribeReads, workspaces]);
    useEffect(() => {
        // The Inbox and Task board pages are global and need no selected Workspace, so the
        // auto-select must not yank the seat back to a Workspace overview.
        if (navigationState.inbox === true || navigationState.board === true)
            return;
        if (navigationState.mode === 'team' && selectedId !== undefined && selectedId !== selected) {
            selectWorkspace(selectedId);
        }
    }, [navigationState.inbox, navigationState.board, navigationState.mode, selected, selectedId, selectWorkspace]);
    useEffect(() => {
        if (!wide || pendingSection === undefined)
            return;
        const node = pendingSection === 'agents' ? agentsRef.current : projectsRef.current;
        setPendingSection(undefined);
        queueMicrotask(() => { node?.querySelector('button')?.focus(); });
    }, [wide, pendingSection]);
    if (!wide) {
        return _jsxs("nav", { className: css.railWorkspace, "aria-label": t('workspaceSections'), children: [_jsx(Tooltip, { label: t('backToConversations'), side: "right", children: _jsx("button", { type: "button", className: css.railButton, "aria-label": t('backToConversations'), "data-team-action": "leave", onClick: leaveTeam, children: _jsx(IconChevronLeftOutlineRegular, { size: 18 }) }) }), _jsx(Tooltip, { label: inboxLabel, side: "right", children: _jsx("button", { type: "button", className: css.railButton, "aria-label": inboxLabel, "aria-current": inboxIsCurrent ? 'page' : undefined, onClick: () => { selectInbox(); expandSidebar(); }, children: _jsx(InboxMark, { unread: inboxTotal }) }) }), _jsx(Tooltip, { label: t('taskBoard'), side: "right", children: _jsx("button", { type: "button", className: css.railButton, "aria-label": t('taskBoard'), "aria-current": boardIsCurrent ? 'page' : undefined, onClick: () => { selectBoard(); expandSidebar(); }, children: _jsx(IconChecklistOutlineRegular, { size: 16 }) }) }), _jsx(Tooltip, { label: t('projects'), side: "right", children: _jsx("button", { type: "button", className: css.railButton, "aria-label": t('projects'), onClick: () => { setPendingSection('projects'); expandSidebar(); }, children: _jsx(IconListPenOutlineRegular, { size: 16 }) }) }), _jsx(Tooltip, { label: t('agents'), side: "right", children: _jsx("button", { type: "button", className: css.railButton, "aria-label": t('agents'), onClick: () => { setPendingSection('agents'); expandSidebar(); }, children: _jsx(IconAgentPresetOutlineRegular, { size: 16 }) }) })] });
    }
    return _jsxs("section", { className: css.workspaceBrowser, "aria-label": t('workspaces'), children: [_jsx("button", { type: "button", className: css.leaveCard, "aria-label": t('backToConversations'), "data-team-action": "leave", onClick: leaveTeam, children: _jsxs("span", { className: css.leaveCardGroup, children: [_jsx(IconChevronLeftOutlineMedium, { size: 14, className: css.leaveCardGlyph }), _jsx("span", { className: css.leaveCardLabel, children: t('backToConversations') })] }) }), _jsxs("button", { type: "button", className: css.inboxCard, "aria-label": inboxLabel, "aria-current": inboxIsCurrent ? 'page' : undefined, onClick: selectInbox, children: [_jsx(InboxMark, { unread: inboxTotal }), _jsx("span", { className: css.inboxCardLabel, children: t('inboxTitle') })] }), _jsxs("button", { type: "button", className: css.taskBoardCard, "aria-label": t('taskBoard'), "aria-current": boardIsCurrent ? 'page' : undefined, onClick: selectBoard, children: [_jsx("span", { className: css.taskBoardGlyph, children: _jsx(IconChecklistOutlineRegular, { size: 16 }) }), _jsx("span", { className: css.inboxCardLabel, children: t('taskBoard') })] }), _jsx(TeamWorkspaceSelector, { workspaces: workspaces, selectedId: selectedId, current: overviewIsCurrent, onSelect: selectWorkspace, t: t }), selectedId !== undefined && _jsxs("div", { className: css.workspaceSection, children: [_jsx("div", { ref: projectsRef, children: _jsx(TeamProjectsPanel, { workspaceId: selectedId, loadMembers: loadMembers, loadProjects: loadProjects, subscribeChanges: subscribeChanges, createProject: createProject, updateProject: updateProject, archiveProject: archiveProject, addProjectOwner: addProjectOwner, removeProjectOwner: removeProjectOwner, humanIdentity: humanIdentity, creatingAgents: creatingAgents.filter(request => request.workspaceId === selectedId), ...(navigationState.memberSessionId !== undefined || navigationState.projectRef === undefined ? {} : { selectedProjectRef: navigationState.projectRef }), selectProject: selectProject, t: t }, selectedId) }), _jsx("div", { ref: agentsRef, children: _jsx(TeamAgentsPanel, { workspaceId: selectedId, loadMembers: loadMembers, subscribeChanges: subscribeChanges, addMember: addMember, updateMember: updateMember, recoverMember: recoverMember, archiveMember: archiveMember, joinWorkspace: joinWorkspace, leaveWorkspace: leaveWorkspace, loadModels: loadModels, loadMemberReminders: loadMemberReminders, cancelMemberReminder: cancelMemberReminder, loadWorkerRuns: loadWorkerRuns, stopWorker: stopWorker, inspectWorker: inspectWorker, ...(navigationState.memberSessionId === undefined ? {} : { memberSessionId: navigationState.memberSessionId }), openMemberSession: openMemberSession, onCreatingChange: (request, creating) => { setCreatingAgents(current => creating ? [...current.filter(item => item.requestId !== request.requestId), request] : current.filter(item => item.requestId !== request.requestId)); }, t: t }, selectedId) })] })] });
}
