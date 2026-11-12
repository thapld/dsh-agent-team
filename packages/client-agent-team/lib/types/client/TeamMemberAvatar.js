import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { identityInitial, memberHue } from "./team-formatters.js";
import { presenceDotState, presenceLabel } from "./TeamPresenceDot.js";
import { TeamStateDot } from "./TeamStateDot.js";
import css from './sidebar.module.css';
export function TeamMemberAvatar({ status, t }) {
    const label = presenceLabel(status, t);
    const state = presenceDotState(status.presence);
    return (_jsx(Tooltip, { label: label, delayMs: 300, children: _jsxs("span", { className: css.agentAvatar, style: { '--team-avatar-hue': memberHue(status.member.memberId) }, role: "img", "aria-label": label, children: [identityInitial(status.member.handle), _jsx("span", { className: css.agentAvatarBadge, "aria-hidden": "true", children: _jsx(TeamStateDot, { state: state }) })] }) }));
}
