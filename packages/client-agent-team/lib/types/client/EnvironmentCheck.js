import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEnvironmentCheck } from "./environment-check.js";
import css from './environment-check.module.css';
const ICONS = {
    ok: _jsx("path", { d: "M3 8.5 6.5 12 13 4.5" }),
    warn: _jsxs(_Fragment, { children: [_jsx("path", { d: "M8 2.5 14.6 13.6H1.4z" }), _jsx("path", { d: "M8 6.6v3.2" }), _jsx("path", { d: "M8 11.9h.01" })] }),
    unknown: _jsxs(_Fragment, { children: [_jsx("circle", { cx: "8", cy: "8", r: "6" }), _jsx("path", { d: "M5.6 8h4.8" })] }),
};
function EnvironmentIcon({ glyph }) {
    return _jsx("svg", { className: css.icon, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: ICONS[glyph] });
}
const RELEASE_NOTES_URL = 'https://github.com/Contexera/dsh-agent-team/releases';
export function EnvironmentCheck({ t, environment }) {
    const { report } = useEnvironmentCheck(environment);
    // Informational: absence before or without a read is not an error.
    if (report === undefined)
        return null;
    const range = report.supportRange;
    const running = report.dshVersion;
    // Withhold the tested line unless both versions were derived (installed manifest version and the range's lower bound).
    const certified = report.certifiedDshVersion;
    const bundleVersion = report.bundleVersion;
    // `'unknown'` is the data layer's word for an unreadable version and never reaches the page.
    const tested = certified !== undefined && bundleVersion !== undefined && bundleVersion !== 'unknown';
    const title = report.verdict === 'ok'
        ? t('environmentOkTitle')
        : report.verdict === 'out-of-range'
            ? t('environmentOutOfRangeTitle')
            : t('environmentUndeterminedTitle');
    const lines = [];
    if (report.verdict === 'ok') {
        if (running !== undefined)
            lines.push(t('environmentOkDetail', { version: running }));
    }
    else if (report.verdict === 'out-of-range') {
        if (running !== undefined)
            lines.push(t('environmentOutOfRangeDetail', { version: running }));
        if (range !== undefined)
            lines.push(t('environmentRange', { lower: range.lower, upper: range.upper }));
        if (tested && certified !== undefined && bundleVersion !== undefined) {
            lines.push(t('environmentTested', { bundle: bundleVersion, dsh: certified }));
        }
    }
    else {
        lines.push(t('environmentUndeterminedDetail'));
    }
    // Marks the verdict for assertions; nothing renders before a read lands, so a journey can wait on this attribute.
    return _jsxs("div", { className: css.block, "data-environment": report.verdict, children: [_jsx(EnvironmentIcon, { glyph: report.verdict === 'ok' ? 'ok' : report.verdict === 'out-of-range' ? 'warn' : 'unknown' }), _jsxs("div", { className: css.body, children: [_jsx("p", { className: css.title, children: title }), lines.map((line, index) => _jsx("p", { className: css.detail, children: line }, index)), report.verdict !== 'ok' && _jsx("p", { className: css.action, children: _jsx("a", { className: css.link, href: RELEASE_NOTES_URL, target: "_blank", rel: "noreferrer", children: t('environmentReleaseNotes') }) })] })] });
}
