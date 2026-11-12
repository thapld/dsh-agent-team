import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import { claimersLabel, formatAbsoluteTime, formatInboxTime, formatTaskStatus, plainGist, taskStatusDot } from "./team-formatters.js";
import { namedAvatarOwners, TeamAvatarStack } from "./TeamAvatarStack.js";
import { TeamCountBadge } from "./TeamCountBadge.js";
import { TeamStateDot } from "./TeamStateDot.js";
import css from './conversation.module.css';
import inboxCss from './inbox.module.css';
/** One bound across every Workspace so the 「最近活跃」 tail stays a way back into work, shorter than the queue. */
const RECENT_ROWS_LIMIT = 5;
const rowKey = (row) => row.kind === 'thread' ? row.item.thread.threadRef : row.item.projectRef;
/**
 * Queue order across Workspaces is the Host's own keys (mentions, ledger sequence, then a stable ref). The Host truncates by
 * this order, so re-apply it on merge: a row that survived the cut on mentions must not sink below a merely newer row.
 * Main stream rows rank by the same keys so they interleave with Thread rows instead of forming a block.
 */
function compareByHostInboxOrder(left, right) {
    return right.item.directCount - left.item.directCount
        || right.item.newestSequence - left.item.newestSequence
        || rowKey(left).localeCompare(rowKey(right));
}
/**
 * The Human Inbox: one Inbox call per visible Workspace, merged in the Host's order into the Host's two slices: the unread
 * queue (「需要我」, Thread rows and one Main stream row per Project) and the 「最近活跃」 tail. Opening the page acknowledges
 * nothing; only a durable read advances the watermark. A Thread with unread is only in the queue (the Host excludes it from
 * the tail); this page never re-derives that.
 */
export function TeamInboxPage({ useWorkspaces, loadInbox, subscribeChanges, selectWorkspace, selectThread, selectDiscussion, selectProject, humanName, humanAvatarUrl, t }) {
    const workspaces = useWorkspaces(state => state.items);
    const [rows, setRows] = useState();
    const [recentRows, setRecentRows] = useState([]);
    // The Host names the Human's Member id on every row, so a row can draw that actor from the Client's Human identity.
    const [humanMemberId, setHumanMemberId] = useState();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState();
    // Keeping the Host's cap verdict stops a full page from reading as the whole queue; a failed read keeps the last verdict.
    const [truncated, setTruncated] = useState(false);
    const loadedRef = useRef(false);
    // Last successful slice per Workspace: a failed read must not empty this action queue for it (the sidebar badge keeps last-good too).
    const keptSlicesRef = useRef(new Map());
    const refresh = useCallback(async () => {
        if (!loadedRef.current)
            setLoading(true);
        const results = await Promise.all(workspaces.map(async (workspace) => {
            const result = await loadInbox({ workspaceId: workspace.workspaceId, limit: 100 });
            if (result.ok) {
                const { items, main, recent } = result.value;
                keptSlicesRef.current.set(workspace.workspaceId, { items, main, recent });
                return { ok: true, workspaceId: workspace.workspaceId, workspaceTitle: workspace.title, items, main, recent, hasMore: result.value.hasMore, humanMemberId: result.value.humanMemberId };
            }
            const kept = keptSlicesRef.current.get(workspace.workspaceId);
            return { ok: false, workspaceId: workspace.workspaceId, workspaceTitle: workspace.title, items: kept?.items ?? [], main: kept?.main ?? [], recent: kept?.recent ?? [], message: result.error.message };
        }));
        const failure = results.find(result => !result.ok);
        setHumanMemberId(results.find(result => result.ok)?.humanMemberId);
        const asThreadRows = (items, workspaceId, workspaceTitle) => items.map(item => ({ kind: 'thread', workspaceId, workspaceTitle, item }));
        const asMainRows = (items, workspaceId, workspaceTitle) => items.map(item => ({ kind: 'main', workspaceId, workspaceTitle, item }));
        setRows(results.flatMap((result) => [
            ...asThreadRows(result.items, result.workspaceId, result.workspaceTitle),
            ...asMainRows(result.main, result.workspaceId, result.workspaceTitle),
        ]).sort(compareByHostInboxOrder));
        // Every Workspace's slice is already capped; trim the merged tail to the one global bound.
        setRecentRows(results.flatMap(result => asThreadRows(result.recent, result.workspaceId, result.workspaceTitle))
            .sort(compareByHostInboxOrder).slice(0, RECENT_ROWS_LIMIT));
        setError(failure?.ok === false ? failure.message : undefined);
        // Only a successful read carries a verdict: a kept slice must not clear the
        // footnote it was rendered with.
        if (results.some(result => result.ok))
            setTruncated(results.some(result => result.ok && result.hasMore));
        loadedRef.current = true;
        setLoading(false);
    }, [loadInbox, workspaces]);
    useEffect(() => { void refresh(); }, [refresh]);
    useEffect(() => subscribeChanges(undefined, update => {
        if (update.type === 'failed') {
            setError(update.message);
            return;
        }
        void refresh();
    }), [subscribeChanges, refresh]);
    // A Task keeps the full Thread page; a taskless discussion opens beside its Project's Main stream, landing where an
    // unread row should: the first unread Message naming the reader. The Inbox names a Thread, never a Message, so the
    // panel re-derives that position from its own read.
    const open = (row) => {
        if (row.kind === 'main') {
            selectWorkspace(row.workspaceId);
            selectProject(row.item.projectRef);
            return;
        }
        const { threadRef } = row.item.thread;
        if (row.item.task !== undefined) {
            selectWorkspace(row.workspaceId);
            selectThread(threadRef, row.item.projectRef, row.item.task.taskRef, row.item.taskNumber);
            return;
        }
        selectDiscussion(threadRef, row.item.projectRef, { workspaceId: row.workspaceId, anchor: 'unread' });
    };
    // Shares the conversation seat's header band and reading column with Project and Thread, so switching surfaces does not shift content.
    const totalUnread = rows?.reduce((sum, row) => sum + row.item.unreadCount, 0) ?? 0;
    const totalMentions = rows?.reduce((sum, row) => sum + row.item.directCount, 0) ?? 0;
    const threadRowCount = rows?.filter(row => row.kind === 'thread').length ?? 0;
    const mainRowCount = (rows?.length ?? 0) - threadRowCount;
    // A row names its Workspace only while the rows on screen span more than one; a constant segment wastes the row's most readable position.
    const shownWorkspaces = new Set();
    for (const row of rows ?? [])
        shownWorkspaces.add(row.workspaceTitle);
    for (const row of recentRows)
        shownWorkspaces.add(row.workspaceTitle);
    const showWorkspace = shownWorkspaces.size > 1;
    // Either half missing leaves the stack on its initials fallback.
    const human = humanMemberId === undefined
        ? undefined
        : { memberId: humanMemberId, name: humanName, ...(humanAvatarUrl === undefined ? {} : { avatarUrl: humanAvatarUrl }) };
    const renderRow = (row) => row.kind === 'main'
        ? _jsx(InboxMainRow, { row: row, t: t, showWorkspace: showWorkspace, human: human, onOpen: () => { open(row); } }, `${row.workspaceId} ${rowKey(row)}`)
        : _jsx(InboxQueueRow, { row: row, t: t, showWorkspace: showWorkspace, human: human, onOpen: () => { open(row); } }, `${row.workspaceId} ${rowKey(row)}`);
    return _jsxs("main", { className: css.surface, "data-team-inbox": true, children: [_jsx("div", { className: `${css.surfaceHeader} ${css.surfaceHeaderStacked}`, children: _jsx("header", { className: css.headerRow, children: _jsxs("div", { className: css.headerCopy, children: [_jsx("h1", { children: t('inboxTitle') }), rows !== undefined && rows.length > 0
                                ? _jsxs("p", { className: inboxCss.headerMeta, children: [threadRowCount > 0 && _jsx("span", { children: t('inboxHeaderThreads', { count: threadRowCount }) }), mainRowCount > 0 && _jsx("span", { children: t('inboxHeaderMain', { count: mainRowCount }) }), _jsx("span", { className: inboxCss.headerUnread, children: t('inboxHeaderUnread', { count: totalUnread }) }), totalMentions > 0 && _jsx("span", { children: t('inboxHeaderMentions', { count: totalMentions }) })] })
                                : _jsx("p", { children: t('inboxHeaderHint') })] }) }) }), _jsx("div", { className: css.timeline, children: _jsxs("div", { className: css.timelineContent, children: [loading && rows === undefined && error === undefined && _jsx("div", { className: css.emptySurface, children: _jsxs("p", { className: css.loadingState, children: [_jsx("span", { className: css.loadingMark, "aria-hidden": "true" }), t('loadingInbox')] }) }), !loading && rows === undefined && error !== undefined && _jsxs("div", { className: css.errorState, role: "alert", children: [_jsx("span", { children: error }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => { void refresh(); }, children: t('retry') })] }), rows !== undefined && (rows.length === 0 && recentRows.length === 0
                            ? _jsx("div", { className: css.emptySurface, children: _jsxs("div", { className: css.emptyState, children: [_jsx("strong", { children: t('inboxEmptyTitle') }), _jsx("span", { children: t('inboxEmptyHint') })] }) })
                            : _jsxs(_Fragment, { children: [rows.length > 0 && _jsxs("section", { className: inboxCss.section, children: [_jsxs("h2", { className: inboxCss.sectionTitle, children: [t('inboxSectionNeedsMe'), _jsx("span", { className: inboxCss.sectionCount, children: rows.length })] }), _jsx("div", { className: inboxCss.list, children: rows.map(renderRow) }), truncated && _jsx("p", { className: inboxCss.queueMore, role: "status", children: t('inboxQueueMore') })] }), recentRows.length > 0 && _jsxs("section", { className: inboxCss.section, children: [_jsxs("h2", { className: inboxCss.sectionTitle, children: [t('inboxSectionRecent'), _jsx("span", { className: inboxCss.sectionCount, children: recentRows.length })] }), _jsx("div", { className: inboxCss.list, children: recentRows.map(renderRow) })] })] })), rows !== undefined && error !== undefined && _jsx("p", { className: css.error, role: "alert", children: error })] }) })] });
}
/**
 * The shared two-line queue row shape: a leading actor cluster, then identity, count and instant, then the gist. The count
 * closes the identity line and only its ink changes: a solid capsule when the row names the reader (a mention, or a reply to
 * them), a hairline otherwise. Unread and mention counts reach assistive tech through the capsule's own name, so no second
 * visible count competes.
 */
function InboxRowShell({ actor, crumb, unreadCount, directCount, newestOccurredAt, preview, t, onOpen }) {
    const named = directCount > 0;
    const countLabel = named
        ? t('inboxRowUnreadMentions', { count: unreadCount, mentions: directCount })
        : t('inboxRowUnread', { count: unreadCount });
    return _jsxs("button", { type: "button", className: inboxCss.row, "data-team-inbox-row": true, "data-named": named || undefined, onClick: onOpen, children: [_jsx("span", { className: inboxCss.rowActor, children: actor }), _jsxs("span", { className: inboxCss.rowLine, children: [_jsx("span", { className: inboxCss.rowCrumb, children: crumb }), _jsx(TeamCountBadge, { count: unreadCount, tone: named ? 'solid' : 'hairline', label: countLabel }), _jsx("time", { className: inboxCss.rowTime, dateTime: newestOccurredAt, title: formatAbsoluteTime(newestOccurredAt), children: formatInboxTime(newestOccurredAt, t) })] }), _jsx("span", { className: inboxCss.rowPreview, children: preview })] });
}
/** A Workspace prefix leads the crumb only while the page spans more than one Workspace. */
function WorkspacePrefix({ title, show }) {
    return show ? _jsxs(_Fragment, { children: [_jsx("span", { className: inboxCss.rowWorkspace, children: title }), ' / '] }) : null;
}
/**
 * One Thread row. The gutter leads with who is on the work (or who moved an unclaimed Thread), the Thread entry grammar.
 */
function InboxQueueRow({ row, t, showWorkspace, human, onOpen }) {
    const { item } = row;
    const owners = item.liveClaimOwners;
    // Names come from the Human identity so the chip's letter and the label move together on a rename.
    const namedOwners = namedAvatarOwners(owners, human);
    const reminderIsNewest = item.reminders.at(-1)?.sequence === item.newestSequence;
    const namedActor = namedAvatarOwners([item.newestActor], reminderIsNewest ? undefined : human)[0];
    return _jsx(InboxRowShell
    // A Task's live owners show when there are any, else the person the newest fact came from; this is the Thread's own fact,
    // so it keeps its shape between the queue and the 「最近活跃」 tail. The avatars are presentational: the stack's label joins
    // the control's accessible name.
    , { 
        // A Task's live owners show when there are any, else the person the newest fact came from; this is the Thread's own fact,
        // so it keeps its shape between the queue and the 「最近活跃」 tail. The avatars are presentational: the stack's label joins
        // the control's accessible name.
        actor: owners.length > 0
            ? _jsx(TeamAvatarStack, { owners: namedOwners, label: claimersLabel(namedOwners, t), human: human })
            : _jsx(TeamAvatarStack, { owners: [namedActor], label: reminderIsNewest ? t('inboxReminderActor') : t('inboxRowActor', { name: `@${namedActor.name}` }), human: reminderIsNewest ? undefined : human }), crumb: _jsxs(_Fragment, { children: [_jsx(WorkspacePrefix, { title: row.workspaceTitle, show: showWorkspace }), _jsxs("span", { className: inboxCss.rowProject, children: ["#", item.projectName] }), ' ', item.taskNumber !== undefined && _jsx("span", { className: inboxCss.rowTask, children: t('taskLabel', { number: item.taskNumber }) }), item.task !== undefined && _jsxs(_Fragment, { children: [' ', _jsxs("span", { className: inboxCss.rowTaskState, "data-team-task-state": item.task.status, children: [_jsx(TeamStateDot, { size: 8, state: taskStatusDot(item.task.status) }), formatTaskStatus(item.task.status, t)] })] })] }), unreadCount: item.unreadCount, directCount: item.directCount, newestOccurredAt: item.newestOccurredAt, preview: reminderIsNewest
            ? t(item.reminders.at(-1).kind === 'review-backlog' ? 'inboxReviewReminder' : 'inboxStalledReminder')
            : item.previewText === undefined ? undefined : plainGist(item.previewText), t: t, onOpen: onOpen });
}
/** One Project's Main stream: the Project name then 「主对话」, led by the person who wrote the newest message. */
function InboxMainRow({ row, t, showWorkspace, human, onOpen }) {
    const { item } = row;
    const namedActor = namedAvatarOwners([item.newestActor], human)[0];
    return _jsx(InboxRowShell, { actor: _jsx(TeamAvatarStack, { owners: [namedActor], label: t('inboxRowActor', { name: `@${namedActor.name}` }), human: human }), crumb: _jsxs(_Fragment, { children: [_jsx(WorkspacePrefix, { title: row.workspaceTitle, show: showWorkspace }), _jsxs("span", { className: inboxCss.rowProject, children: ["#", item.projectName] }), ' · ', _jsx("span", { children: t('inboxMainLabel') })] }), unreadCount: item.unreadCount, directCount: item.directCount, newestOccurredAt: item.newestOccurredAt, preview: item.previewText === undefined ? undefined : plainGist(item.previewText), t: t, onOpen: onOpen });
}
