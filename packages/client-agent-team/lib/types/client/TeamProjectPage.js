import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamMainStream } from "./TeamMainStream.js";
import { TeamSubscriptionsTab } from "./TeamSubscriptionsTab.js";
import { TeamProjectPanel } from "./TeamProjectPanel.js";
import { resolvePanelWidth, readPanelWidthPreference } from "./panel-width.js";
import { TeamCountBadge } from "./TeamCountBadge.js";
import { plainGist, taskStatusDot } from "./team-formatters.js";
import { TeamStateDot } from "./TeamStateDot.js";
import { BoardCardFoot } from "./BoardCardFoot.js";
import { hostTaskRefLookup, jumpToTaskThread } from "./refs.js";
import { hostThreadRefLookup, jumpToThread, resolvedThreadDestination } from "./refs.js";
import { rosterProjectName, rosterMember } from "./refs.js";
import projectCss from './project.module.css';
import css from './conversation.module.css';
/** Fresh window is authoritative for every Message it covers; older loaded Messages are retained. */
function mergeProjectView(current, fresh) {
    // An empty window's cursor is the request default, not a loaded boundary, so it must not cap the fresh one.
    if (current.items.length === 0)
        return fresh;
    const freshRefs = new Set(fresh.items.map(item => item.message.messageRef));
    const items = [...current.items.filter(item => !freshRefs.has(item.message.messageRef)), ...fresh.items]
        .sort((left, right) => left.message.sequence - right.message.sequence);
    return {
        ...fresh,
        items,
        cursor: Math.min(fresh.cursor, current.cursor),
        hasMore: fresh.hasMore || hasOlderBeyondFreshWindow(current, fresh),
    };
}
function hasOlderBeyondFreshWindow(current, fresh) {
    return current.cursor < fresh.cursor;
}
/** Zero unread is the absence of a badge. A failed read keeps the previous counts rather than rendering as "everything was consumed". */
function applyInboxRead(previous, result) {
    if (!result.ok)
        return previous;
    return new Map(result.value.items.filter(item => item.unreadCount > 0).map(item => [item.thread.threadRef, item.unreadCount]));
}
export function TeamProjectPage({ workspaceId, projectRef, humanName, humanAvatarUrl, loadProjects, loadTaskBoard, loadSubscriptions, loadSubscriptionLogs, pauseSubscription, resumeSubscription, deleteSubscription, subscribeChanges, loadMembers, loadInbox, drafts, putAttachment, getAttachment, postMainMessage, startThread, readMainStream, mainStreamHistory, readThread, loadThreadHistory, threadObservations, reply, promoteThread, changeAttention, selectThread, selectDiscussion, closeDiscussion, selectProject, discussionRef, discussionAnchor, resolveTaskRefs, resolveThreadRefs, resolveMessageRefs, openMemberSession, t }) {
    const [view, setView] = useState();
    const [taskBoard, setTaskBoard] = useState();
    const [members, setMembers] = useState([]);
    const [unreadByThread, setUnreadByThread] = useState(new Map());
    const [loadError, setLoadError] = useState();
    const [loading, setLoading] = useState(true);
    // The finished column starts at the Host's default page and grows on demand: the
    // reader asked to see older resolved work, so ask the Host for a deeper slice.
    // The mirror ref is what `refresh` reads, because the change subscription holds
    // the closure from the first render and a state read there would collapse an
    // expanded column back to the default page on the next change event.
    const [finishedLimit, setFinishedLimit] = useState(FINISHED_PAGE);
    const finishedLimitRef = useRef(FINISHED_PAGE);
    const [expandingFinished, setExpandingFinished] = useState(false);
    const [tab, setTab] = useState('main');
    // The subscription tab's projection: read on mount for the tab's count, then
    // re-read while the tab is open and after every write it commits.
    const [subscriptions, setSubscriptions] = useState();
    const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);
    const [subscriptionsError, setSubscriptionsError] = useState();
    // The mirror ref is what the re-read reads: the change listener holds the
    // closure from the first render, where the list was still undefined, so a
    // state read there would blank a loaded list on every Project change.
    const subscriptionsLoadedRef = useRef(false);
    // The surface owns the panel-width variable; a drag writes it there so this page never re-renders.
    const [panelSurface, setPanelSurface] = useState(null);
    const mountedRef = useRef(false);
    // True after the first load; later refreshes keep the rendered timeline.
    const loadedRef = useRef(false);
    const refreshSequenceRef = useRef(0);
    const tabIdPrefix = useId();
    const subscriptionSequenceRef = useRef(0);
    const mainTabRef = useRef(null);
    const boardTabRef = useRef(null);
    const subscriptionsTabRef = useRef(null);
    const boardPanelRef = useRef(null);
    // Enter and Space need no branch: the button's own activation fires click.
    const onTabKeyDown = (event) => {
        const order = [
            { value: 'main', ref: mainTabRef },
            { value: 'board', ref: boardTabRef },
            { value: 'subscriptions', ref: subscriptionsTabRef },
        ];
        const current = order.findIndex(entry => entry.value === tab);
        if (current < 0)
            return;
        let next;
        switch (event.key) {
            case 'ArrowLeft':
                next = (current + order.length - 1) % order.length;
                break;
            case 'ArrowRight':
                next = (current + 1) % order.length;
                break;
            case 'Home':
                next = 0;
                break;
            case 'End':
                next = order.length - 1;
                break;
            default: return;
        }
        event.preventDefault();
        const target = order[next];
        setTab(target.value);
        target.ref.current?.focus();
    };
    // One destination rule for every `thread:` ref: a loaded row names its own Task, and a ref outside the window resolves
    // through the Host. The resolved ref carries the Project it lives in, so a cross-Project discussion opens beside that
    // Project's feed instead of this page's.
    const openThreadRef = resolvedThreadDestination(selectThread, selectDiscussion);
    // Unresolvable refs never become links (see TeamMessage), so only Host-confirmed refs reach here.
    const openRef = (ref) => {
        if (ref.startsWith('project:')) {
            if (ref !== projectRef)
                selectProject(ref);
            return;
        }
        if (ref.startsWith('thread:')) {
            const match = view?.items.find(item => item.thread.threadRef === ref);
            if (match !== undefined) {
                openThreadRef(match.task === undefined
                    // The row came from this Project's feed, so its own Project is the page's.
                    ? { threadRef: match.thread.threadRef, projectRef }
                    : { threadRef: match.thread.threadRef, projectRef, taskRef: match.task.taskRef, ...(match.taskNumber === undefined ? {} : { taskNumber: match.taskNumber }) });
                return;
            }
            jumpToThread(resolveThreadRefs, workspaceId, ref, openThreadRef);
            return;
        }
        if (ref.startsWith('task:')) {
            const match = view?.items.find(item => item.task?.taskRef === ref);
            if (match !== undefined) {
                selectThread(match.thread.threadRef, projectRef, match.task?.taskRef, match.taskNumber);
                return;
            }
            jumpToTaskThread(resolveTaskRefs, workspaceId, ref, selectThread);
        }
    };
    const lookupTaskRefs = hostTaskRefLookup(resolveTaskRefs, workspaceId);
    const lookupThreadRefs = hostThreadRefLookup(resolveThreadRefs, workspaceId);
    // Keyed on roster content, not array identity, so memoized rows survive change bursts that leave the roster untouched.
    const rosterKey = useMemo(() => [
        (view?.projects ?? []).map(project => `${project.projectRef}=${project.name}=${project.state}`).join(','),
        members.map(status => `${status.member.memberId}=${status.member.handle}=${status.member.sessionId}=${status.availability}`).join(','),
        view?.humanMemberId ?? '',
    ].join(';'), [view, members]);
    const projectNameOf = useMemo(() => {
        const projects = view?.projects ?? [];
        return (ref) => rosterProjectName(projects, ref);
    }, [rosterKey]);
    const memberOf = useMemo(() => {
        const humanMemberId = view?.humanMemberId;
        return (ref) => rosterMember(members, humanMemberId, humanName, ref);
    }, [rosterKey, humanName]);
    const taskNumberOf = useMemo(() => {
        const numbers = view?.taskNumbers ?? [];
        return (taskRef) => numbers.find(entry => entry.taskRef === taskRef)?.taskNumber;
    }, [view]);
    const handlePanelRead = useCallback((read) => {
        setUnreadByThread(current => {
            if (!current.has(read))
                return current;
            const next = new Map(current);
            next.delete(read);
            return next;
        });
    }, []);
    // Promotion has no panel to restore: the discussion became the Task, so `selectThread` must drop the panel state
    // explicitly instead of treating this as a same-Project Task cover.
    const handlePanelPromoted = useCallback((taskRef) => {
        if (discussionRef !== undefined)
            selectThread(discussionRef, projectRef, taskRef, taskNumberOf(taskRef), { preserveDiscussion: false });
    }, [discussionRef, projectRef, selectThread, taskNumberOf]);
    // The composer the reader typed in unmounts with the switch to the board, so focus must land somewhere: the Task's own
    // new card (Enter opens it), taking the same `.boardCard:focus-visible` ring every card takes — no second focus language.
    // A start with no ref, or a board that never produces the card, falls back to the tab so focus is never dropped.
    const focusSettledTaskCard = (taskRef) => {
        void refresh().then(() => {
            let attempts = 0;
            const land = () => {
                const card = taskRef === undefined ? null : boardPanelRef.current?.querySelector(`[data-team-task-ref="${taskRef}"]`);
                if (card !== null && card !== undefined) {
                    card.focus();
                    return;
                }
                // The refreshed board is a fresh React value; it is committed within a frame or two of refresh resolving.
                if (attempts++ < 12) {
                    requestAnimationFrame(land);
                    return;
                }
                boardTabRef.current?.focus();
            };
            requestAnimationFrame(land);
        });
    };
    const handleTaskStarted = (taskRef) => {
        setTab('board');
        focusSettledTaskCard(taskRef);
    };
    const handlePanelClose = useCallback(() => { closeDiscussion(); }, [closeDiscussion]);
    // The Host caps the finished column per Project; expanding asks for the whole set once,
    // so the deeper slice is fetched on the click rather than on every board refresh.
    const expandFinished = async () => {
        if (expandingFinished)
            return;
        setExpandingFinished(true);
        try {
            const result = await loadTaskBoard({ workspaceId, projectRef, finishedLimit: EXPANDED_FINISHED_LIMIT });
            if (!mountedRef.current)
                return;
            if (!result.ok) {
                setLoadError(result.error.message);
                return;
            }
            finishedLimitRef.current = EXPANDED_FINISHED_LIMIT;
            setFinishedLimit(EXPANDED_FINISHED_LIMIT);
            setTaskBoard(result.value);
        }
        catch (cause) {
            if (mountedRef.current)
                setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            if (mountedRef.current)
                setExpandingFinished(false);
        }
    };
    const humanMemberId = view?.humanMemberId;
    const humanIdentity = humanMemberId === undefined
        ? undefined
        : { memberId: humanMemberId, name: humanName, ...(humanAvatarUrl === undefined ? {} : { avatarUrl: humanAvatarUrl }) };
    // Every board row comes from the same Host projection the Agent tool reads.
    const boardColumns = useMemo(() => {
        const items = [...taskBoard?.open ?? [], ...taskBoard?.finished ?? []];
        return BOARD_COLUMNS.map(column => ({ ...column, items: items.filter(item => column.match(item.task.status)) }));
    }, [taskBoard]);
    // Only the Host knows whether a full page was a cut or the end of the history,
    // so the expand control reads its truncation signal rather than counting rows.
    // At the deepest page the Host accepts there is nothing left to ask for, and
    // the control retires even while older resolved work still exists.
    const finishedHasMore = taskBoard?.finishedTruncated === true && finishedLimit < EXPANDED_FINISHED_LIMIT;
    // The surface is laid out after this effect first runs, so the seat follows its box; a dragged choice is re-clamped, never re-derived.
    useEffect(() => {
        if (panelSurface === null)
            return;
        const seat = () => {
            if (panelSurface.offsetWidth === 0)
                return;
            const width = resolvePanelWidth(panelSurface.offsetWidth, readPanelWidthPreference());
            panelSurface.style.setProperty('--team-panel-width', `${width}px`);
        };
        seat();
        const observer = new ResizeObserver(seat);
        observer.observe(panelSurface);
        return () => { observer.disconnect(); };
    }, [panelSurface, discussionRef]);
    const project = view?.projects.find(item => item.projectRef === projectRef);
    const projectMemberIds = new Set(view?.members.filter(item => item.projectRef === projectRef).map(item => item.memberId) ?? []);
    const projectOwnerIds = new Set((view?.owners ?? []).filter(item => item.projectRef === projectRef).map(item => item.memberId));
    // A re-read after a write keeps the rows on screen: only a first read has
    // nothing to show, and blanking the list for every pause would make the page
    // flicker on each committed write.
    const refreshSubscriptions = async (clearError = false) => {
        if (!mountedRef.current)
            return;
        const sequence = subscriptionSequenceRef.current + 1;
        subscriptionSequenceRef.current = sequence;
        if (!subscriptionsLoadedRef.current)
            setSubscriptionsLoading(true);
        if (clearError)
            setSubscriptionsError(undefined);
        try {
            const result = await loadSubscriptions({ workspaceId, projectRef });
            if (!mountedRef.current || sequence !== subscriptionSequenceRef.current)
                return;
            if (result.ok) {
                setSubscriptions(result.value.entries);
                setSubscriptionsError(undefined);
                subscriptionsLoadedRef.current = true;
            }
            else {
                setSubscriptionsError(result.error.message);
            }
        }
        catch (cause) {
            if (mountedRef.current && sequence === subscriptionSequenceRef.current) {
                setSubscriptionsError(cause instanceof Error ? cause.message : String(cause));
            }
        }
        finally {
            if (mountedRef.current && sequence === subscriptionSequenceRef.current)
                setSubscriptionsLoading(false);
        }
    };
    const refresh = async (clearError = false) => {
        if (!mountedRef.current)
            return false;
        const sequence = refreshSequenceRef.current + 1;
        refreshSequenceRef.current = sequence;
        if (!loadedRef.current)
            setLoading(true);
        if (clearError)
            setLoadError(undefined);
        try {
            const [loaded, loadedTaskBoard, loadedMembers, loadedInbox] = await Promise.all([
                loadProjects({ workspaceId, projectRef, direction: 'before', topLevelOnly: true, includeActivities: false, limit: 20 }),
                loadTaskBoard({ workspaceId, projectRef, finishedLimit: finishedLimitRef.current }),
                loadMembers({ workspaceId }),
                // The Host Inbox is the authority for unread; never re-derive it from message mentions.
                loadInbox({ workspaceId, limit: 100 }),
            ]);
            if (!mountedRef.current || sequence !== refreshSequenceRef.current)
                return false;
            if (loaded.ok) {
                setView(current => current === undefined ? loaded.value : mergeProjectView(current, loaded.value));
                loadedRef.current = true;
            }
            else
                setLoadError(loaded.error.message);
            if (loadedTaskBoard.ok)
                setTaskBoard(loadedTaskBoard.value);
            else
                setLoadError(loadedTaskBoard.error.message);
            if (loadedMembers.ok)
                setMembers(loadedMembers.value);
            else
                setLoadError(loadedMembers.error.message);
            if (!loadedInbox.ok)
                setLoadError(loadedInbox.error.message);
            setUnreadByThread(current => applyInboxRead(current, loadedInbox));
            if (loaded.ok && loadedTaskBoard.ok && loadedMembers.ok && loadedInbox.ok)
                setLoadError(undefined);
            return loaded.ok && loadedTaskBoard.ok && loadedMembers.ok && loadedInbox.ok;
        }
        catch (cause) {
            if (mountedRef.current && sequence === refreshSequenceRef.current)
                setLoadError(cause instanceof Error ? cause.message : String(cause));
            return false;
        }
        finally {
            if (mountedRef.current && sequence === refreshSequenceRef.current)
                setLoading(false);
        }
    };
    const refreshMembers = async () => {
        if (!mountedRef.current)
            return;
        try {
            const loaded = await loadMembers({ workspaceId });
            if (!mountedRef.current)
                return;
            if (loaded.ok)
                setMembers(loaded.value);
            else
                setLoadError(loaded.error.message);
        }
        catch (cause) {
            if (mountedRef.current)
                setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
    };
    useEffect(() => {
        mountedRef.current = true;
        loadedRef.current = false;
        finishedLimitRef.current = FINISHED_PAGE;
        setFinishedLimit(FINISHED_PAGE);
        setView(undefined);
        setTab('main');
        setLoadError(undefined);
        setLoading(true);
        setSubscriptions(undefined);
        setSubscriptionsError(undefined);
        setSubscriptionsLoading(true);
        subscriptionsLoadedRef.current = false;
        subscriptionSequenceRef.current = 0;
        void refresh();
        void refreshSubscriptions();
        const disposers = [
            subscribeChanges({ kind: 'project', projectRef }, update => {
                if (!mountedRef.current)
                    return;
                if (update.type === 'failed') {
                    setLoadError(update.message);
                    return;
                }
                void refresh();
                // The count is on the tab itself, so the list is re-read even while the
                // feed stands in front: a stale number on a tab is a wrong claim.
                void refreshSubscriptions();
            }),
            subscribeChanges({ kind: 'workspace', workspaceId }, update => {
                if (!mountedRef.current)
                    return;
                if (update.type === 'failed') {
                    setLoadError(update.message);
                    return;
                }
                void refreshMembers();
            }),
            subscribeChanges({ kind: 'presence', workspaceId }, update => {
                if (!mountedRef.current)
                    return;
                if (update.type === 'failed') {
                    setLoadError(update.message);
                    return;
                }
                void refreshMembers();
            }),
        ];
        return () => {
            mountedRef.current = false;
            refreshSequenceRef.current += 1;
            for (const dispose of disposers)
                dispose();
        };
    }, [workspaceId, projectRef]);
    useEffect(() => {
        if (tab === 'subscriptions')
            void refreshSubscriptions();
    }, [tab]);
    return _jsxs("main", { className: css.surface, "data-team-project": projectRef, ref: setPanelSurface, children: [_jsxs("div", { className: `${css.surfaceHeader} ${css.surfaceHeaderWithTabs}`, children: [_jsx("header", { className: css.headerRow, children: _jsx("div", { className: css.headerCopy, children: _jsxs("div", { className: projectCss.headerIdentity, children: [_jsx("h1", { children: project === undefined ? '# …' : `# ${project.name}` }), project !== undefined && project.description !== '' && _jsx("p", { className: projectCss.headerDescription, title: project.description, children: project.description })] }) }) }), _jsxs("nav", { className: projectCss.tabs, role: "tablist", "aria-label": project === undefined ? '# …' : `# ${project.name}`, onKeyDown: onTabKeyDown, children: [_jsx("button", { ref: mainTabRef, id: `${tabIdPrefix}-main`, type: "button", role: "tab", "aria-selected": tab === 'main', "aria-controls": `${tabIdPrefix}-main-panel`, tabIndex: tab === 'main' ? 0 : -1, className: projectCss.tab, onClick: () => { setTab('main'); }, children: t('projectTabMain') }), _jsx("button", { ref: boardTabRef, id: `${tabIdPrefix}-board`, type: "button", role: "tab", "aria-selected": tab === 'board', "aria-controls": `${tabIdPrefix}-board-panel`, tabIndex: tab === 'board' ? 0 : -1, className: projectCss.tab, onClick: () => { setTab('board'); }, children: t('projectTabBoard') }), _jsx("button", { ref: subscriptionsTabRef, id: `${tabIdPrefix}-subscriptions`, type: "button", role: "tab", "aria-selected": tab === 'subscriptions', "aria-controls": `${tabIdPrefix}-subscriptions-panel`, tabIndex: tab === 'subscriptions' ? 0 : -1, className: projectCss.tab, onClick: () => { setTab('subscriptions'); }, children: t('projectTabSubscriptions') })] })] }), tab === 'board' && _jsxs("section", { ref: boardPanelRef, id: `${tabIdPrefix}-board-panel`, role: "tabpanel", "aria-labelledby": `${tabIdPrefix}-board`, className: projectCss.board, children: [loadError !== undefined && _jsx("p", { className: css.error, role: "alert", children: loadError }), loadError === undefined && taskBoard === undefined && _jsx("div", { className: css.emptySurface, children: _jsxs("p", { className: css.loadingState, children: [_jsx("span", { className: css.loadingMark, "aria-hidden": "true" }), t('boardLoading')] }) }), loadError === undefined && taskBoard !== undefined && boardColumns.every(column => column.items.length === 0) && _jsx("div", { className: css.emptySurface, children: _jsx("p", { className: css.emptyState, children: t('boardEmpty') }) }), boardColumns.some(column => column.items.length > 0) && _jsx("div", { className: projectCss.boardColumns, children: boardColumns.map(column => _jsxs("div", { className: projectCss.boardColumn, children: [_jsxs("div", { className: projectCss.boardColumnHead, children: [t(column.labelKey), _jsx("span", { className: projectCss.boardColumnCount, children: column.items.length })] }), column.labelKey === 'taskStatusDone' && finishedHasMore
                                    && _jsx("div", { className: projectCss.boardColumnExpand, children: _jsx(Button, { size: "sm", variant: "outline", disabled: expandingFinished, onClick: () => { void expandFinished(); }, children: t('boardShowAllFinished') }) }), column.items.map(item => _jsx(ProjectionBoardCard, { item: item, unread: unreadByThread.get(item.threadRef) ?? 0, human: humanIdentity, humanMemberId: humanMemberId, t: t, onOpen: () => { selectThread(item.threadRef, projectRef, item.task.taskRef, item.taskNumber); } }, item.task.taskRef))] }, column.labelKey)) })] }), tab === 'subscriptions' && _jsx(TeamSubscriptionsTab, { workspaceId: workspaceId, projectRef: projectRef, host: { loadSubscriptionLogs, pauseSubscription, resumeSubscription, deleteSubscription }, entries: subscriptions, loading: subscriptionsLoading, error: subscriptionsError, onRetry: () => { void refreshSubscriptions(true); }, onChanged: () => { void refreshSubscriptions(); }, canManage: project?.state === 'active', memberOf: memberOf, panelId: `${tabIdPrefix}-subscriptions-panel`, labelledBy: `${tabIdPrefix}-subscriptions`, t: t }), tab === 'main' && _jsx("div", { id: `${tabIdPrefix}-main-panel`, role: "tabpanel", "aria-labelledby": `${tabIdPrefix}-main`, className: projectCss.feedStage, "data-panel": discussionRef === undefined ? 'closed' : 'open', children: project !== undefined && view !== undefined ? _jsx(TeamMainStream, { workspaceId: workspaceId, projectRef: projectRef, humanName: humanName, humanAvatarUrl: humanAvatarUrl, humanMemberId: view.humanMemberId, members: members, projectMemberIds: projectMemberIds, projectOwnerIds: projectOwnerIds, drafts: drafts, mainStreamHistory: mainStreamHistory, readMainStream: readMainStream, postMainMessage: postMainMessage, startThread: startThread, putAttachment: putAttachment, getAttachment: getAttachment, subscribeChanges: subscribeChanges, openRef: openRef, onResolveTaskRefs: lookupTaskRefs, onResolveThreadRefs: lookupThreadRefs, projectNameOf: projectNameOf, memberOf: memberOf, openMemberSession: openMemberSession, onOpenDiscussion: threadRef => { selectDiscussion(threadRef, projectRef); }, onOpenTask: (threadRef, taskRef, taskNumber) => { selectThread(threadRef, projectRef, taskRef, taskNumber); }, onTaskStarted: handleTaskStarted, t: t }) : _jsx("section", { className: css.timeline, "aria-label": t('timelineLabel'), children: _jsxs("div", { className: css.timelineContent, children: [loading && loadError === undefined && _jsx("div", { className: css.emptySurface, children: _jsxs("p", { className: css.loadingState, children: [_jsx("span", { className: css.loadingMark, "aria-hidden": "true" }), t('loadingProjects')] }) }), !loading && loadError === undefined && _jsx("div", { className: css.emptySurface, children: _jsx("p", { className: css.emptyState, children: t('emptyProjects') }) }), !loading && loadError !== undefined && _jsxs("div", { className: css.errorState, role: "alert", children: [_jsx("span", { children: loadError }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => { void refresh(true); }, children: t('retry') })] })] }) }) }), tab === 'main' && discussionRef !== undefined && project !== undefined && _jsx(TeamProjectPanel, { surface: panelSurface, workspaceId: workspaceId, projectRef: projectRef, threadRef: discussionRef, ...(discussionAnchor === undefined ? {} : { anchor: discussionAnchor }), projectName: project.name, humanName: humanName, ...(humanAvatarUrl === undefined ? {} : { humanAvatarUrl }), ...(view?.humanMemberId === undefined ? {} : { humanMemberId: view.humanMemberId }), members: members, projectMemberIds: projectMemberIds, projectOwnerIds: projectOwnerIds, drafts: drafts, getAttachment: getAttachment, putAttachment: putAttachment, readThread: readThread, loadThreadHistory: loadThreadHistory, threadObservations: threadObservations, reply: reply, promoteThread: promoteThread, changeAttention: changeAttention, subscribeChanges: subscribeChanges, selectThread: selectThread, selectDiscussion: selectDiscussion, selectProject: selectProject, resolveTaskRefs: resolveTaskRefs, resolveThreadRefs: resolveThreadRefs, resolveMessageRefs: resolveMessageRefs, openMemberSession: openMemberSession, projectNameOf: projectNameOf, memberOf: memberOf, taskNumberOf: taskNumberOf, onRead: handlePanelRead, onPromoted: handlePanelPromoted, onClose: handlePanelClose, t: t }, discussionAnchor ?? '')] });
}
const BOARD_COLUMNS = [
    { labelKey: 'taskStatusTodo', match: (status) => status === 'todo' },
    { labelKey: 'taskStatusInProgress', match: (status) => status === 'in_progress' },
    { labelKey: 'taskStatusInReview', match: (status) => status === 'in_review' },
    { labelKey: 'taskStatusDone', match: (status) => status === 'done' || status === 'closed' },
];
/** The finished column's first page, matching the Host's per-Project default so the two agree before any expansion. */
const FINISHED_PAGE = 5;
/** The finished column's expanded page: the Host caps a request at 100, which covers a Project's history in practice. */
const EXPANDED_FINISHED_LIMIT = 100;
/** One Task on the board; resolved work dims so moving work stays loudest. */
function ProjectionBoardCard({ item, unread, human, humanMemberId, t, onOpen }) {
    const task = item.task;
    const taskNumber = item.taskNumber ?? 0;
    const resolved = task.status === 'done' || task.status === 'closed';
    return _jsxs("button", { type: "button", className: projectCss.boardCard, "data-team-task-ref": task.taskRef, ...(resolved ? { 'data-resolved': '' } : {}), "aria-label": `${unread > 0 ? t('openTaskUnread', { number: taskNumber, count: unread }) : t('openTask', { number: taskNumber })}${item.needsAcceptance ? ` · ${t('boardNeedsAcceptance')}` : ''}`, onClick: onOpen, children: [_jsxs("span", { className: projectCss.boardCardNum, children: [_jsx(TeamStateDot, { size: 8, state: taskStatusDot(task.status) }), t('taskLabel', { number: taskNumber }), item.needsAcceptance && _jsx("span", { className: projectCss.boardAcceptBadge, children: t('boardNeedsAcceptance') }), _jsx(TeamCountBadge, { count: unread })] }), _jsx("span", { className: projectCss.boardCardTitle, children: plainGist(item.subject) }), _jsx(BoardCardFoot, { item: item, human: human, humanMemberId: humanMemberId, t: t })] });
}
