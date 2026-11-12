import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { IconChevronDownOutlineRegular, IconFolderOpenRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './sidebar.module.css';
/**
 * The single-line Workspace selector scoping the Team sidebar: Projects and Agents belong to one Workspace, so a selector
 * reads as "you are in X". Cross-Workspace unread is summarized by the Inbox entry, which stays outside the selector.
 *
 * The trigger is a field, not a row, so it does not read as the first Projects entry; its accessible name states the shown
 * Workspace. The menu is the only way to switch, so it takes focus on open and returns it to the trigger on Escape.
 */
export function TeamWorkspaceSelector({ workspaces, selectedId, current, onSelect, t }) {
    const [open, setOpen] = useState(false);
    // A portaled Menu list is hidden until the primitive's layout effect places it, so its `autoFocus` runs one render too early
    // and `focus()` on a hidden row is a no-op; arrow keys (indexed from `document.activeElement`) would stay dead.
    // Focus the opened row once the list is on screen; no-op when focus is already inside.
    useEffect(() => {
        if (!open)
            return;
        const frame = requestAnimationFrame(() => {
            // The list this open mounted is the last portaled child.
            const lists = document.querySelectorAll('body > [role="menu"]');
            const list = lists[lists.length - 1];
            if (list === undefined || list.contains(document.activeElement))
                return;
            list.querySelector('button:not(:disabled)')?.focus();
        });
        return () => { cancelAnimationFrame(frame); };
    }, [open]);
    const selected = workspaces.find(workspace => workspace.workspaceId === selectedId);
    // Nothing to select: say so in the selector's own seat instead of a dead field.
    if (selected === undefined)
        return _jsx("p", { className: css.emptyState, children: t('empty') });
    const items = workspaces.map(workspace => ({
        id: workspace.workspaceId,
        label: workspace.title,
    }));
    return (_jsx(Menu, { open: open, portal: true, autoFocus: true, items: items, selectedIds: [selected.workspaceId], onSelect: id => { setOpen(false); onSelect(id); }, onClose: () => { setOpen(false); }, anchor: (_jsxs("button", { type: "button", className: css.workspaceTrigger, "data-team-workspace-trigger": true, "aria-label": t('workspaceSelectorWithValue', { title: selected.title }), "aria-haspopup": "menu", "aria-expanded": open, "aria-current": current ? 'page' : undefined, title: `${selected.title} · ${selected.path}`, onClick: () => { setOpen(value => !value); }, children: [_jsx("span", { className: css.workspaceIcon, "aria-hidden": "true", children: _jsx(IconFolderOpenRegular, { size: 16 }) }), _jsx("span", { className: css.workspaceValue, children: selected.title }), _jsx("span", { className: `${css.workspaceChevron} ${open ? css.workspaceChevronOpen : ''}`, "aria-hidden": "true", children: _jsx(IconChevronDownOutlineRegular, {}) })] })) }));
}
