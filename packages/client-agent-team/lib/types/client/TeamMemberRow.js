import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamMemberAvatar } from "./TeamMemberAvatar.js";
import css from './member-row.module.css';
/**
 * The one place a Member's identity is drawn, so identity, tone and truncation cannot drift between surfaces. A fragment, not a
 * row: each surface owns its row element and grid and places this in the first two tracks. The handle spelling is the surface's call.
 */
export function TeamMemberIdentity({ status, name, className, t }) {
    return _jsxs(_Fragment, { children: [_jsx(TeamMemberAvatar, { status: status, t: t }), _jsxs("span", { className: className === undefined ? css.copy : `${css.copy} ${className}`, children: [_jsx("strong", { children: name ?? `@${status.member.handle.replace(/^@/, '')}` }), _jsx("small", { children: status.member.description })] })] });
}
/** The action is the row's only chrome; a row without one collapses the trailing track, handing its width to the description. */
export function TeamMemberRow({ status, action, error, className, t }) {
    return _jsxs("div", { className: className === undefined ? css.row : `${css.row} ${className}`, "data-team-member-row": true, children: [_jsx(TeamMemberIdentity, { status: status, t: t }), action !== undefined && _jsx(Button, { size: "sm", variant: "outline", className: css.action, disabled: action.disabled === true, ...(action.ariaLabel === undefined ? {} : { 'aria-label': action.ariaLabel }), onClick: action.onSelect, children: action.label }), error !== undefined && _jsx("p", { className: css.error, role: "alert", children: error })] });
}
