import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { plainGist, taskStatusDot } from "./team-formatters.js";
import { TeamStateDot } from "./TeamStateDot.js";
import { BoardCardFoot } from "./BoardCardFoot.js";
import projectCss from './project.module.css';
import css from './conversation.module.css';
const columns = [
    { key: 'todo', label: 'taskStatusTodo' },
    { key: 'in_progress', label: 'taskStatusInProgress' },
    { key: 'in_review', label: 'taskStatusInReview' },
];
export function TeamTaskBoardPage({ useWorkspaces, loadTaskBoard, subscribeChanges, selectWorkspace, selectThread, t }) {
    const workspaces = useWorkspaces(state => state.items);
    const [items, setItems] = useState();
    // The reader the boards are relative to, so a card can say 「你负责」 the way the Project board does.
    const [humanMemberId, setHumanMemberId] = useState();
    const [error, setError] = useState();
    const refresh = useCallback(async () => {
        const results = await Promise.all(workspaces.map(async (workspace) => loadTaskBoard({ workspaceId: workspace.workspaceId })));
        const failed = results.find(result => !result.ok);
        setError(failed?.ok === false ? failed.error.message : undefined);
        if (failed === undefined) {
            setItems(results.flatMap(result => result.ok ? result.value.open : []).sort((a, b) => b.lastActivitySequence - a.lastActivitySequence));
            const first = results.find(result => result.ok);
            setHumanMemberId(first !== undefined && first.ok ? first.value.humanMemberId : undefined);
        }
    }, [loadTaskBoard, workspaces]);
    useEffect(() => { void refresh(); }, [refresh]);
    useEffect(() => subscribeChanges(undefined, update => { if (update.type === 'changed')
        void refresh(); }), [refresh, subscribeChanges]);
    return _jsxs("main", { className: css.surface, "data-team-task-board": true, children: [_jsx("div", { className: `${css.surfaceHeader} ${css.surfaceHeaderStacked}`, children: _jsx("header", { className: css.headerRow, children: _jsxs("div", { className: css.headerCopy, children: [_jsx("h1", { children: t('taskBoard') }), _jsx("p", { children: t('taskBoardHint') })] }) }) }), _jsxs("section", { className: projectCss.board, children: [error !== undefined && _jsx("p", { className: css.error, role: "alert", children: error }), items === undefined && error === undefined && _jsx("div", { className: css.emptySurface, children: _jsxs("p", { className: css.loadingState, children: [_jsx("span", { className: css.loadingMark, "aria-hidden": "true" }), t('boardLoading')] }) }), items !== undefined && items.length === 0 && _jsx("div", { className: css.emptySurface, children: _jsx("p", { className: css.emptyState, children: t('taskBoardEmpty') }) }), items !== undefined && items.length > 0 && _jsx("div", { className: projectCss.boardColumns, children: columns.map(column => {
                            const columnItems = items.filter(item => item.task.status === column.key);
                            return _jsxs("div", { className: projectCss.boardColumn, children: [_jsxs("div", { className: projectCss.boardColumnHead, children: [t(column.label), _jsx("span", { className: projectCss.boardColumnCount, children: columnItems.length })] }), columnItems.map(item => _jsxs("button", { type: "button", className: projectCss.boardCard, onClick: () => { selectWorkspace(item.workspaceId); selectThread(item.threadRef, item.projectRef, item.task.taskRef, item.taskNumber); }, children: [_jsxs("span", { className: projectCss.boardCardNum, children: [_jsx(TeamStateDot, { size: 8, state: taskStatusDot(item.task.status) }), t('taskLabel', { number: item.taskNumber }), item.needsAcceptance && _jsx("span", { className: projectCss.boardAcceptBadge, children: t('boardNeedsAcceptance') })] }), _jsxs("span", { className: projectCss.boardCardTitle, children: [item.projectName, ": ", plainGist(item.subject)] }), _jsx(BoardCardFoot, { item: item, human: undefined, humanMemberId: humanMemberId, t: t })] }, item.task.taskRef))] }, column.key);
                        }) })] })] });
}
