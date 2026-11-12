import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { IconChevronDownOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives';
import createCss from './create.module.css';
import css from './sidebar.module.css';
/** `label` doubles as the trigger's accessible name; `disabled` disables the trigger while a mutation is in flight. */
export function MultiMenuField({ label, options, selected, onToggle, disabled = false, emptyText, triggerEmptyLabel, formatCount }) {
    const [open, setOpen] = useState(false);
    const items = options.map(option => ({
        id: option.id,
        label: option.hint === undefined ? option.label : _jsxs(_Fragment, { children: [option.label, _jsx("small", { className: css.menuHint, children: ` ${option.hint}` })] }),
        ...(option.disabled === true ? { disabled: true } : {}),
        ...(option.icon === undefined ? {} : { icon: option.icon }),
    }));
    return (_jsxs("div", { className: createCss.field, children: [_jsx("span", { children: label }), options.length === 0 && emptyText !== undefined ? _jsx("small", { className: css.editHint, children: emptyText }) : (_jsx(Menu, { open: open, portal: true, className: createCss.menuCap, items: items, selectedIds: selected, onSelect: id => { onToggle(id); }, onClose: () => { setOpen(false); }, anchor: _jsxs("button", { type: "button", className: createCss.selectTrigger, "aria-label": label, "aria-haspopup": "menu", "aria-expanded": open, disabled: disabled, onClick: () => { setOpen(value => !value); }, children: [_jsx("span", { className: createCss.selectValue, children: selected.length === 0 ? triggerEmptyLabel : formatCount(selected.length) }), _jsx("span", { className: `${createCss.chevron} ${open ? createCss.chevronOpen : ''}`, "aria-hidden": true, children: _jsx(IconChevronDownOutlineRegular, {}) })] }) }))] }));
}
