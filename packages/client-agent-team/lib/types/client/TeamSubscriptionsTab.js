import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useState } from 'react';
import { Button, IconChevronDownOutlineRegular, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import { mintRequestId } from "./requests.js";
import { formatAbsoluteTime, formatInboxTime } from "./team-formatters.js";
import css from './subscriptions.module.css';
import conversationCss from './conversation.module.css';
/**
 * The Project's subscription tab. A Project owner arms and maintains a
 * subscription through `team_subscription`, so the Human's surface reads what is
 * armed and may only stop or remove what an owner started.
 */
export function TeamSubscriptionsTab({ workspaceId, projectRef, host, entries, loading, error, onRetry, onChanged, canManage, memberOf, panelId, labelledBy, t, }) {
    const [scriptOf, setScriptOf] = useState();
    const [logsOf, setLogsOf] = useState();
    const [deleting, setDeleting] = useState();
    const [pending, setPending] = useState();
    const [failure, setFailure] = useState();
    const live = (entries ?? []).filter(entry => entry.subscription.state !== 'deleted');
    const runStateAction = async (entry, kind) => {
        if (pending !== undefined)
            return;
        const ref = entry.subscription.subscriptionRef;
        setPending({ ref, kind });
        setFailure(undefined);
        try {
            const request = { requestId: mintRequestId(), workspaceId, projectRef, subscriptionRef: ref, expectedRevision: entry.subscription.revision };
            const result = kind === 'pause' ? await host.pauseSubscription(request) : await host.resumeSubscription(request);
            if (!result.ok) {
                setFailure({ ref, message: t('subscriptionActionFailed', { message: result.error.message }) });
                return;
            }
            onChanged();
        }
        catch (cause) {
            setFailure({ ref, message: t('subscriptionActionFailed', { message: cause instanceof Error ? cause.message : String(cause) }) });
        }
        finally {
            setPending(undefined);
        }
    };
    return _jsxs("section", { id: panelId, role: "tabpanel", "aria-labelledby": labelledBy, className: css.panel, "data-team-subscriptions": true, children: [_jsxs("div", { className: css.column, children: [loading && _jsx(SurfaceLoading, { text: t('subscriptionsLoading') }), !loading && error !== undefined && _jsx(SurfaceError, { message: t('subscriptionsFailed', { message: error }), retry: t('retry'), onRetry: onRetry }), !loading && error === undefined && live.length === 0 && _jsxs("div", { className: conversationCss.emptySurface, children: [_jsx("p", { className: conversationCss.emptyState, children: t('subscriptionsEmpty') }), _jsx("p", { className: css.emptyHint, children: t('subscriptionsEmptyHint') })] }), !loading && error === undefined && live.map(entry => _jsx(SubscriptionCard, { entry: entry, canManage: canManage, owner: memberOf(entry.subscription.createdBy)?.handle ?? t('memberUnknown'), recipients: entry.subscription.notify.map(memberId => memberOf(memberId)?.handle ?? t('memberUnknown')), ownerNamed: entry.subscription.notify.includes(entry.subscription.createdBy), pending: pending !== undefined && pending.ref === entry.subscription.subscriptionRef ? pending.kind : undefined, failure: failure?.ref === entry.subscription.subscriptionRef ? failure : undefined, t: t, onScript: () => { setScriptOf(entry); }, onLogs: () => { setLogsOf(entry); }, onPause: () => { void runStateAction(entry, 'pause'); }, onResume: () => { void runStateAction(entry, 'resume'); }, onDelete: () => { setDeleting(entry); } }, entry.subscription.subscriptionRef)), !loading && error === undefined && live.length > 0 && _jsx("p", { className: css.ownerNote, children: t('subscriptionsOwnerNote') })] }), scriptOf !== undefined && _jsx(SubscriptionScriptDialog, { entry: scriptOf, onClose: () => { setScriptOf(undefined); }, t: t }), logsOf !== undefined && _jsx(SubscriptionLogsDialog, { entry: logsOf, workspaceId: workspaceId, projectRef: projectRef, loadSubscriptionLogs: host.loadSubscriptionLogs, onClose: () => { setLogsOf(undefined); }, t: t }), deleting !== undefined && _jsx(SubscriptionDeleteDialog, { entry: deleting, workspaceId: workspaceId, projectRef: projectRef, deleteSubscription: host.deleteSubscription, onClose: () => { setDeleting(undefined); }, onDeleted: () => { setDeleting(undefined); onChanged(); }, t: t })] });
}
function SurfaceLoading({ text }) {
    return _jsx("div", { className: conversationCss.emptySurface, children: _jsxs("p", { className: conversationCss.loadingState, children: [_jsx("span", { className: conversationCss.loadingMark, "aria-hidden": "true" }), text] }) });
}
function SurfaceError({ message, retry, onRetry }) {
    return _jsxs("div", { className: conversationCss.errorState, role: "alert", children: [_jsx("span", { children: message }), _jsx(Button, { size: "sm", variant: "outline", onClick: onRetry, children: retry })] });
}
function SubscriptionCard({ entry, canManage, owner, recipients, ownerNamed, pending, failure, t, onScript, onLogs, onPause, onResume, onDelete }) {
    const { subscription } = entry;
    const name = subscription.name;
    const paused = subscription.state === 'paused';
    const named = (label) => `${label} · ${name}`;
    const lastRun = entry.lastRun;
    // Two declared lines rather than a wrapped run of facts: a separator that wraps
    // to the head of a line reads as a stray mark. Times use the short reader clock,
    // the same one the run history names.
    const runFacts = [
        lastRun === undefined ? t('subscriptionLastRunNever') : t('subscriptionLastRun', { time: formatInboxTime(lastRun.startedAt, t) }),
        ...(entry.nextRunAt === undefined ? [] : [t('subscriptionNextRunAt', { time: formatInboxTime(entry.nextRunAt, t) })]),
    ].join(' · ');
    const notifyFacts = (recipients.length === 0
        ? t('subscriptionNotifyNobody')
        : t('subscriptionNotify', { names: recipients.join(t('nameListSeparator')) }))
        + (ownerNamed ? '' : ` · ${t('subscriptionOwner', { name: owner })}`);
    const eventFacts = [
        ...(entry.eventCount > 0 ? [t('subscriptionEventCount', { count: entry.eventCount })] : []),
        ...(entry.unpublished > 0 ? [t('subscriptionUnpublished', { count: entry.unpublished })] : []),
    ].join(' · ');
    return _jsxs("article", { className: css.card, "data-team-subscription-ref": subscription.subscriptionRef, "data-subscription-state": subscription.state, children: [_jsxs("div", { className: css.cardHead, children: [_jsx("h3", { className: css.cardName, children: name }), _jsx("span", { className: css.trigger, children: triggerText(subscription.triggers, t) })] }), _jsxs("p", { className: css.facts, children: [_jsx("span", { children: notifyFacts }), _jsx("span", { children: runFacts }), eventFacts !== '' && _jsx("span", { children: eventFacts })] }), paused && _jsx("p", { className: css.paused, "data-paused-reason": subscription.pausedReason, children: pausedText(entry, t) }), failure !== undefined && _jsx("div", { className: css.inlineFailure, role: "alert", children: _jsx("span", { children: failure.message }) }), _jsxs("div", { className: css.actions, children: [_jsx(Button, { size: "sm", variant: "ghost", "aria-label": named(t('subscriptionLogs')), onClick: onLogs, children: t('subscriptionLogs') }), _jsx(Button, { size: "sm", variant: "ghost", "aria-label": named(t('subscriptionScript')), onClick: onScript, children: t('subscriptionScript') }), canManage && (paused
                        ? _jsx(Button, { size: "sm", variant: "outline", disabled: pending !== undefined, "aria-label": named(pending === 'resume' ? t('subscriptionResuming') : t('subscriptionResume')), onClick: onResume, children: pending === 'resume' ? t('subscriptionResuming') : t('subscriptionResume') })
                        : _jsx(Button, { size: "sm", variant: "outline", disabled: pending !== undefined, "aria-label": named(pending === 'pause' ? t('subscriptionPausing') : t('subscriptionPause')), onClick: onPause, children: pending === 'pause' ? t('subscriptionPausing') : t('subscriptionPause') })), canManage && _jsx(Button, { size: "sm", variant: "outline", "aria-label": named(t('subscriptionDelete')), onClick: onDelete, children: t('subscriptionDelete') })] })] });
}
function SubscriptionScriptDialog({ entry, onClose, t }) {
    const { subscription } = entry;
    return _jsxs(Modal, { open: true, onClose: onClose, title: t('subscriptionScriptTitle', { name: subscription.name }), description: t('subscriptionScriptDescription', {
            revision: subscription.revision, shell: subscription.script.shell, hash: subscription.script.sha256.slice(0, 12),
        }), closeLabel: t('close'), className: css.dialogWide, footer: _jsx(Button, { variant: "outline", onClick: onClose, children: t('close') }), children: [_jsx("pre", { className: css.scriptBlock, "data-team-subscription-script": true, children: subscription.script.content }), subscription.credentials.length > 0 && _jsxs("div", { className: css.credentialList, children: [_jsx("h3", { className: css.sectionTitle, children: t('subscriptionCredentials') }), _jsx("ul", { children: subscription.credentials.map(credential => _jsxs("li", { children: [_jsx("code", { children: credential.ref }), ' → ', _jsx("code", { children: credential.env })] }, `${credential.ref}\u0000${credential.env}`)) })] })] });
}
function SubscriptionLogsDialog({ entry, workspaceId, projectRef, loadSubscriptionLogs, onClose, t }) {
    const subscriptionRef = entry.subscription.subscriptionRef;
    const [runs, setRuns] = useState();
    const [error, setError] = useState();
    const [reloadToken, setReloadToken] = useState(0);
    useEffect(() => {
        let mounted = true;
        setError(undefined);
        void loadSubscriptionLogs({ workspaceId, projectRef, subscriptionRef }).then(result => {
            if (!mounted)
                return;
            if (result.ok) {
                setRuns(result.value.runs);
                setError(undefined);
            }
            else
                setError(result.error.message);
        }, (cause) => { if (mounted)
            setError(cause instanceof Error ? cause.message : String(cause)); });
        return () => { mounted = false; };
    }, [workspaceId, projectRef, subscriptionRef, loadSubscriptionLogs, reloadToken]);
    return _jsxs(Modal, { open: true, onClose: onClose, title: t('subscriptionLogsTitle', { name: entry.subscription.name }), description: t('subscriptionLogsDescription'), closeLabel: t('close'), className: css.dialogWide, footer: _jsx(Button, { variant: "outline", onClick: onClose, children: t('close') }), children: [runs === undefined && error === undefined && _jsx("p", { className: css.hint, children: t('subscriptionsLoading') }), error !== undefined && _jsx(SurfaceError, { message: t('subscriptionLogsFailed', { message: error }), retry: t('retry'), onRetry: () => { setReloadToken(token => token + 1); } }), runs !== undefined && error === undefined && runs.length === 0 && _jsx("p", { className: css.hint, children: t('subscriptionLogsEmpty') }), runs !== undefined && error === undefined && runs.length > 0 && _jsx("div", { className: css.listViewport, children: _jsx("ol", { className: css.runList, children: runs.map(run => _jsx(RunRow, { run: run, t: t }, run.runRef)) }) })] });
}
function SubscriptionDeleteDialog({ entry, workspaceId, projectRef, deleteSubscription, onClose, onDeleted, t }) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState();
    const confirm = async () => {
        if (deleting)
            return;
        setDeleting(true);
        setError(undefined);
        try {
            const result = await deleteSubscription({
                requestId: mintRequestId(), workspaceId, projectRef,
                subscriptionRef: entry.subscription.subscriptionRef, expectedRevision: entry.subscription.revision,
            });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            onDeleted();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setDeleting(false);
        }
    };
    return _jsxs(Modal, { open: true, onClose: onClose, title: t('subscriptionDeleteTitle', { name: entry.subscription.name }), closeLabel: t('close'), footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: deleting, onClick: onClose, children: t('cancel') }), _jsx(Button, { variant: "primary", disabled: deleting, onClick: () => { void confirm(); }, children: deleting ? t('subscriptionDeleting') : t('subscriptionDeleteConfirm') })] }), children: [_jsx("p", { className: css.notice, children: t('subscriptionDeleteNotice') }), error !== undefined && _jsx("p", { className: css.error, role: "alert", children: t('subscriptionDeleteFailed', { message: error }) })] });
}
function RunRow({ run, t }) {
    const [expanded, setExpanded] = useState(false);
    const id = useId();
    // A tail the Host withheld is not an empty stream, so the expander and the
    // per-stream captions both key off `undefined` rather than off empty text.
    const hasOutput = run.reason !== undefined || run.stdoutTail !== undefined || run.stderrTail !== undefined;
    const facts = _jsxs(_Fragment, { children: [_jsx("time", { className: css.runTime, dateTime: run.startedAt, title: formatAbsoluteTime(run.startedAt), children: formatInboxTime(run.startedAt, t) }), run.trigger !== 'test' && _jsx("span", { className: css.runTrigger, children: triggerLabel(run.trigger, t) }), _jsx("span", { className: css.runOutcome, "data-succeeded": run.succeeded, children: runCategoryText(run.category, t) }), _jsx("span", { className: css.runMeta, children: t('subscriptionRunDuration', { seconds: (run.durationMs / 1000).toFixed(1) }) }), run.eventCount > 0 && _jsx("span", { className: css.runMeta, children: t('subscriptionRunEvents', { count: run.eventCount }) })] });
    return _jsxs("li", { className: css.runRow, "data-team-subscription-run": run.runRef, "data-run-succeeded": run.succeeded, children: [hasOutput
                ? _jsxs("button", { type: "button", className: css.runHead, "data-expandable": true, "aria-expanded": expanded, "aria-controls": id, onClick: () => { setExpanded(value => !value); }, children: [_jsx("span", { className: css.runChevron, "data-open": expanded || undefined, "aria-hidden": "true", children: _jsx(IconChevronDownOutlineRegular, {}) }), facts] })
                : _jsxs("div", { className: css.runHead, children: [_jsx("span", { className: css.runChevron, "aria-hidden": "true" }), facts] }), expanded && _jsxs("div", { id: id, className: css.runBody, "data-team-subscription-run-output": true, children: [run.reason !== undefined && _jsxs("p", { className: css.runReason, children: [t('subscriptionRunReason'), ": ", run.reason] }), _jsx(OutputTails, { stdout: run.stdoutTail, stderr: run.stderrTail, t: t })] })] });
}
function OutputTails({ stdout, stderr, t }) {
    // A stream that printed nothing states that in one line; a code block around
    // `(empty)` spends a surface on saying nothing ran.
    const streams = [
        { key: 'stdout', caption: t('subscriptionRunStdout'), value: stdout },
        { key: 'stderr', caption: t('subscriptionRunStderr'), value: stderr },
    ];
    return _jsx("div", { className: css.tails, children: streams.map(stream => stream.value === undefined
            ? null
            : stream.value === ''
                ? _jsx("p", { className: css.runStreamEmpty, children: t('subscriptionRunStreamEmpty', { stream: stream.caption }) }, stream.key)
                : _jsxs("section", { children: [_jsx("h4", { children: stream.caption }), _jsx("pre", { children: stream.value })] }, stream.key)) });
}
function triggerText(triggers, t) {
    // Two triggers are one subscription: naming only the timer would hide the
    // address that is also armed.
    const parts = [
        ...(triggers.interval === undefined ? [] : [t('subscriptionEvery', { minutes: triggers.interval.minutes })]),
        ...(triggers.webhook === true ? [t('subscriptionWebhook')] : []),
    ];
    return parts.length === 0 ? t('subscriptionNoTrigger') : parts.join(' · ');
}
function triggerLabel(trigger, t) {
    return t(trigger === 'interval' ? 'subscriptionTriggerInterval'
        : trigger === 'webhook' ? 'subscriptionTriggerWebhook' : 'subscriptionTriggerTest');
}
const RUN_CATEGORY_KEYS = {
    accepted: 'subscriptionCategoryAccepted',
    empty: 'subscriptionCategoryEmpty',
    verified: 'subscriptionCategoryVerified',
    timeout: 'subscriptionCategoryTimeout',
    'exit-code': 'subscriptionCategoryExitCode',
    'stdout-truncated': 'subscriptionCategoryStdoutTruncated',
    'invalid-utf8': 'subscriptionCategoryInvalidUtf8',
    'invalid-output': 'subscriptionCategoryInvalidOutput',
    'executor-missing': 'subscriptionCategoryExecutorMissing',
    'shell-mismatch': 'subscriptionCategoryShellMismatch',
    'workspace-missing': 'subscriptionCategoryWorkspaceMissing',
    'credentials-missing': 'subscriptionCategoryCredentialsMissing',
    'spawn-failed': 'subscriptionCategorySpawnFailed',
    'backlog-full': 'subscriptionCategoryBacklogFull',
};
function runCategoryText(category, t) {
    return t(RUN_CATEGORY_KEYS[category]);
}
function pausedText(entry, t) {
    if (entry.subscription.pausedReason !== 'failures')
        return t('subscriptionPausedManual');
    const failure = entry.lastRun === undefined || entry.lastRun.trigger === 'test' ? undefined : entry.lastRun;
    return failure === undefined ? t('subscriptionPausedFailures')
        : t('subscriptionPausedFailuresWithCategory', { category: runCategoryText(failure.category, t) });
}
