import { jsx as _jsx } from "react/jsx-runtime";
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamStateDot } from "./TeamStateDot.js";
import css from './presence.module.css';
export function presenceLabel(status, t) {
    const label = status.presence === 'available' ? t('statusAvailable')
        : status.presence === 'working' ? t('statusWorking')
            : status.presence === 'error' ? t('statusError') : t('statusUnavailable');
    return status.diagnostic === undefined ? label : `${label}: ${diagnosticText(status)}`;
}
export function diagnosticText(status) {
    const diagnostic = status.diagnostic;
    if (diagnostic === undefined)
        return '';
    return diagnostic.location === undefined ? diagnostic.detail : `${diagnostic.detail} (${diagnostic.location.path})`;
}
export function restartOffered(status) {
    return status.diagnostic?.class !== 'rollover';
}
export function presenceDotState(presence) {
    return presence === 'available' ? 'done' : presence === 'working' ? 'ongoing' : presence === 'error' ? 'error' : 'quiet';
}
export function TeamPresenceDot({ status, t }) {
    const label = presenceLabel(status, t);
    return (_jsx(Tooltip, { label: label, delayMs: 300, children: _jsx("span", { className: css.target, role: "img", "aria-label": label, children: _jsx(TeamStateDot, { state: presenceDotState(status.presence) }) }) }));
}
