import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconChevronDownOutlineRegular, IconQuestionOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './sidebar.module.css';
export function TeamSidebarSection({ title, help, actions, open, onToggle, children }) {
    return (_jsxs("section", { className: css.section, children: [_jsxs("div", { className: css.sectionHeader, children: [_jsxs("button", { type: "button", className: css.sectionToggle, "aria-expanded": open, onClick: () => { onToggle(!open); }, children: [_jsx(IconChevronDownOutlineRegular, { className: css.sectionChevron }), _jsx("span", { className: css.sectionTitle, children: title })] }), help !== undefined && (_jsx(Tooltip, { label: help.body, side: "right", delayMs: 200, portal: true, maxWidth: 280, children: _jsx("button", { type: "button", className: css.sectionHint, "aria-label": help.label, children: _jsx(IconQuestionOutlineRegular, { size: 12 }) }) })), actions !== undefined && _jsx("span", { className: css.sectionActions, children: actions })] }), open && children] }));
}
