import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { IconCheckOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives';
import composerCss from './composer.module.css';
import css from './main-stream.module.css';
/** Rules version 2 composer controls: the owner turns the send into a new Thread, as a discussion or, checked, a Task. */
export function TeamThreadStartControls({ open, asTask, pending, onOpenChange, onAsTaskChange, t }) {
    return _jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: open ? `${composerCss.asTaskPill} ${composerCss.asTaskPillOn}` : composerCss.asTaskPill, "aria-pressed": open, disabled: pending, onClick: () => { onOpenChange(!open); }, children: [open && _jsx(IconCheckOutlineMedium, { size: 14 }), _jsx("span", { className: composerCss.asTaskLabel, children: t('startThread') })] }), open && _jsxs("label", { className: css.startCheck, children: [_jsx("input", { type: "checkbox", checked: asTask, disabled: pending, onChange: event => { onAsTaskChange(event.currentTarget.checked); } }), _jsx("span", { children: t('asTask') })] })] });
}
