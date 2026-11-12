import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { TEAM_MARK_DOT, TEAM_MARK_RING, TEAM_MARK_VIEW_BOX } from "./team-mark.js";
export function TeamPanelIcon({ size }) {
    return (_jsxs("svg", { width: size, height: size, viewBox: TEAM_MARK_VIEW_BOX, fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", strokeWidth: 1, children: [_jsx("path", { d: TEAM_MARK_RING, stroke: "currentColor" }), _jsx("circle", { cx: TEAM_MARK_DOT.cx, cy: TEAM_MARK_DOT.cy, r: TEAM_MARK_DOT.r, fill: "currentColor" })] }));
}
