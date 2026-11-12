import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import { isUncertainRemoteFailure, mergeSettledComposerUploads, mintRequestId, reconcileComposerUploads, sameComposerFiles, uploadComposerFiles } from "./requests.js";
import { mainEntryKey, useMainStream } from "./main-stream.js";
import { TeamComposer } from "./TeamComposer.js";
import { TeamThreadStartControls } from "./TeamThreadStartControls.js";
import { TeamMessage } from "./TeamMessage.js";
import { TeamRunDivider } from "./TeamRunDivider.js";
import { TeamThreadCard } from "./TeamThreadCard.js";
import { rosterAccountableOwner } from "./refs.js";
import { formatAbsoluteTime, formatInboxTime, mentionNamesOf, plainGist } from "./team-formatters.js";
import { chunkRunsWithDays, isRunGap } from "./team-separators.js";
import { useTimelineScroll } from "./timeline-scroll.js";
import css from './conversation.module.css';
import threadCss from './thread.module.css';
import streamCss from './main-stream.module.css';
const matchesMainSend = (intent, body, mode, replyToMessageRef, files) => intent.body === body && intent.mode === mode
    && intent.replyToMessageRef === replyToMessageRef && sameComposerFiles(intent.uploads, files);
/** Generated Remote failures always carry a code; Main keeps its established explicit-failure handling for unclassified test doubles. */
const isUncertainMainFailure = (error) => error.code !== undefined && isUncertainRemoteFailure(error);
/** Rules version 2 Project reading: the Main stream timeline and its composer. Message, activity and card entries arrive from the Host already ordered. */
export function TeamMainStream({ workspaceId, projectRef, humanName, humanAvatarUrl, humanMemberId, members, projectMemberIds, projectOwnerIds, drafts, mainStreamHistory, readMainStream, postMainMessage, startThread, putAttachment, getAttachment, subscribeChanges, openRef, onResolveTaskRefs, onResolveThreadRefs, projectNameOf, memberOf, openMemberSession, onOpenDiscussion, onOpenTask, onTaskStarted, t, }) {
    const stream = useMainStream({ workspaceId, projectRef, mainStreamHistory, readMainStream, subscribeChanges });
    const { entries } = stream;
    const [pending, setPending] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [actionError, setActionError] = useState();
    const [notice, setNotice] = useState();
    const [startingThread, setStartingThread] = useState(false);
    const [asTask, setAsTask] = useState(false);
    const [replyTarget, setReplyTarget] = useState();
    const [openCard, setOpenCard] = useState();
    const [flashedMessage, setFlashedMessage] = useState();
    const draftKey = `project:${projectRef}`;
    const sending = useRef(false);
    const sendIntent = useRef();
    const uploads = useRef([]);
    const lastEntry = entries.at(-1);
    const timeline = useTimelineScroll(`${entries.length}:${lastEntry === undefined ? '' : mainEntryKey(lastEntry)}`);
    const error = actionError ?? stream.error;
    const handleByMember = useMemo(() => new Map(members.map(status => [status.member.memberId, status.member.handle.replace(/^@/, '')])), [members]);
    const human = humanMemberId === undefined
        ? undefined
        : { memberId: humanMemberId, name: humanName, ...(humanAvatarUrl === undefined ? {} : { avatarUrl: humanAvatarUrl }) };
    const nameOf = (memberId) => {
        if (memberId === humanMemberId)
            return humanName;
        const handle = handleByMember.get(memberId);
        return handle === undefined ? memberId : `@${handle}`;
    };
    const clearSendState = useCallback(() => {
        sendIntent.current = undefined;
        setNotice(current => current === undefined ? current : undefined);
        setActionError(current => current === undefined ? current : undefined);
    }, []);
    const changePendingFiles = useCallback((files) => {
        uploads.current = reconcileComposerUploads(files, uploads.current);
        sendIntent.current = undefined;
        setPendingFiles(files);
    }, []);
    const handleReply = useCallback((messageRef) => {
        sendIntent.current = undefined;
        setReplyTarget(messageRef);
        setStartingThread(false);
        setAsTask(false);
    }, []);
    const handleToggleCard = useCallback((messageRef) => {
        setOpenCard(current => current === messageRef ? undefined : messageRef);
    }, []);
    // A quoted line names a Message already in this timeline, so the jump is a scroll and a pulse rather than a route:
    // the Thread page's own gesture, wired here because the row's quote falls back to inert text without it.
    const timelineOnScroll = timeline.onScroll;
    const jumpToMessage = useCallback((messageRef) => {
        const node = document.querySelector(`[data-message-ref="${messageRef}"]`);
        if (node === null)
            return;
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // Tell the shared scroll policy the reader is off the tail, or the next arriving Message counts them as pinned and
        // undoes the jump.
        timelineOnScroll();
        setFlashedMessage(messageRef);
    }, [timelineOnScroll]);
    useEffect(() => {
        if (flashedMessage === undefined)
            return;
        // The pulse is the jump's lifetime: releasing it releases the mark, so a settling jump never outlives its highlight.
        const timer = setTimeout(() => { setFlashedMessage(undefined); }, 1200);
        return () => { clearTimeout(timer); };
    }, [flashedMessage]);
    const handleOpenReplyTo = useCallback((messageRef) => { jumpToMessage(messageRef); }, [jumpToMessage]);
    const toggleThreadStart = (open) => {
        sendIntent.current = undefined;
        setStartingThread(open);
        if (!open)
            setAsTask(false);
        else
            setReplyTarget(undefined);
    };
    const changeAsTask = (next) => {
        sendIntent.current = undefined;
        setAsTask(next);
    };
    const replyEntry = replyTarget === undefined
        ? undefined
        : entries.find((entry) => entry.kind === 'message' && entry.message.messageRef === replyTarget);
    const send = async () => {
        // Read at send time: this page does not subscribe to the draft.
        const { draft } = drafts.getSnapshot(draftKey);
        if (sending.current || pending || draft.trim() === '')
            return;
        sending.current = true;
        const body = draft.trim();
        const mode = startingThread ? (asTask ? 'task' : 'discussion') : 'main';
        const replyToMessageRef = mode === 'main' ? replyTarget : undefined;
        const currentUploads = reconcileComposerUploads(pendingFiles, uploads.current);
        uploads.current = currentUploads;
        let intent = sendIntent.current;
        if (intent === undefined || !matchesMainSend(intent, body, mode, replyToMessageRef, pendingFiles)) {
            intent = { requestId: mintRequestId(), body, mode, ...(replyToMessageRef === undefined ? {} : { replyToMessageRef }), uploads: currentUploads };
            sendIntent.current = intent;
        }
        setPending(true);
        setActionError(undefined);
        setNotice(undefined);
        try {
            const upload = await uploadComposerFiles(putAttachment, workspaceId, intent.uploads);
            const stillCurrent = sendIntent.current?.requestId === intent.requestId;
            uploads.current = stillCurrent ? upload.uploads : mergeSettledComposerUploads(uploads.current, upload.uploads);
            if (!stillCurrent)
                return;
            intent = { ...intent, uploads: upload.uploads };
            sendIntent.current = intent;
            if (!upload.ok) {
                setActionError(upload.error);
                return;
            }
            let submission = intent.request;
            if (submission === undefined) {
                const content = {
                    requestId: intent.requestId, workspaceId, projectRef, body: intent.body,
                    ...(intent.replyToMessageRef === undefined ? {} : { replyToMessageRef: intent.replyToMessageRef }),
                    ...(upload.attachmentIds.length === 0 ? {} : { attachments: upload.attachmentIds }),
                };
                submission = intent.mode === 'main'
                    ? { kind: 'post', request: content }
                    : { kind: 'thread', request: { ...content, kind: intent.mode } };
                intent = { ...intent, request: submission };
                sendIntent.current = intent;
            }
            const result = submission.kind === 'thread'
                ? await startThread(submission.request)
                : await postMainMessage(submission.request);
            const ownsIntent = sendIntent.current?.requestId === intent.requestId;
            if (!result.ok) {
                if (ownsIntent) {
                    if (!isUncertainMainFailure(result.error))
                        sendIntent.current = undefined;
                    setActionError(result.error.message);
                }
            }
            else if (result.value.kind === 'committed') {
                if (ownsIntent) {
                    sendIntent.current = undefined;
                    uploads.current = [];
                    setStartingThread(false);
                    setAsTask(false);
                    setReplyTarget(undefined);
                    drafts.clear(draftKey);
                    setPendingFiles([]);
                    timeline.scrollToBottom();
                    if (intent.mode === 'task')
                        onTaskStarted('task' in result.value ? result.value.task?.taskRef : undefined);
                }
                await stream.refresh();
            }
            else {
                // The draft stays; a resend after reading is a new operation.
                if (ownsIntent) {
                    sendIntent.current = undefined;
                    setNotice(t('mainUnreadRequired'));
                }
                await stream.refresh();
                await stream.markRead();
            }
        }
        catch (cause) {
            if (sendIntent.current?.requestId === intent.requestId)
                setActionError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            sending.current = false;
            setPending(false);
        }
    };
    const renderEntry = (entry, index, run) => {
        // The accent states an arrival, not a standing: it holds for a few seconds after the entry is first shown and then
        // releases on its own clock, so a reader who stays on the page is not left with a mark that never goes away.
        const unread = stream.marked.has(mainEntryKey(entry)) ? '' : undefined;
        if (entry.kind === 'activity') {
            const activity = entry.activity;
            // A subscription lifecycle line names a script, not a Task. The Host
            // writes the automatic pause after repeated failures without an actor of
            // its own, so that line says who acted instead of guessing a Member.
            if ('subscriptionRef' in activity) {
                const text = activity.kind === 'subscription-paused' && activity.reason === 'failures'
                    ? t('mainSubscriptionPausedByHost', { name: activity.subscriptionName })
                    : t(activity.kind === 'subscription-created' ? 'mainSubscriptionCreated'
                        : activity.kind === 'subscription-updated' ? 'mainSubscriptionUpdated'
                            : activity.kind === 'subscription-paused' ? 'mainSubscriptionPaused'
                                : activity.kind === 'subscription-resumed' ? 'mainSubscriptionResumed'
                                    : activity.kind === 'subscription-webhook-reset' ? 'mainSubscriptionWebhookReset' : 'mainSubscriptionDeleted', { actor: activity.actor === undefined ? t('mainSubscriptionHostActor') : nameOf(activity.actor), name: activity.subscriptionName });
                return _jsx("div", { className: streamCss.entry, "data-main-entry": "subscription", "data-unread": unread, children: _jsxs("p", { className: threadCss.activityRow, children: [_jsx("span", { className: threadCss.activityMark, "aria-hidden": "true" }), _jsx("span", { className: threadCss.activityText, children: text })] }) }, mainEntryKey(entry));
            }
            const text = t(activity.kind === 'owner-added' ? 'mainOwnerAdded' : 'mainOwnerRemoved', {
                actor: nameOf(activity.actor), member: nameOf(activity.memberId),
            });
            return _jsx("div", { className: streamCss.entry, "data-main-entry": "activity", "data-unread": unread, children: _jsxs("p", { className: threadCss.activityRow, children: [_jsx("span", { className: threadCss.activityMark, "aria-hidden": "true" }), _jsx("span", { className: threadCss.activityText, children: text })] }) }, mainEntryKey(entry));
        }
        if (entry.kind === 'subscription-event') {
            // What a script printed is data. It is rendered as text, never parsed for
            // mentions or Markdown, and the marker states that boundary on screen.
            // The block is content, not a system notice: its mark seats where a Message's identity seats and the head,
            // title and detail share the feed's text column. The head states the three facts that never change — which
            // subscription, when, and how much to trust it — so the warning is a clause there instead of a sentence
            // repeated under every event, and the title is the one place a reader aims at, so a link is the title.
            const { event } = entry.event;
            return _jsx("div", { className: streamCss.entry, "data-main-entry": "subscription-event", "data-unread": unread, children: _jsxs("div", { className: streamCss.subscriptionEvent, children: [_jsxs("p", { className: streamCss.subscriptionEventHead, children: [_jsx("span", { className: streamCss.subscriptionEventLabel, children: entry.event.subscriptionName }), _jsx("time", { className: streamCss.subscriptionEventTime, dateTime: entry.occurredAt, title: formatAbsoluteTime(entry.occurredAt), children: formatInboxTime(entry.occurredAt, t) }), _jsx("span", { className: streamCss.subscriptionEventWarning, children: t('mainSubscriptionEventUntrusted') })] }), _jsxs("div", { className: streamCss.subscriptionEventBody, children: [_jsx("p", { className: streamCss.subscriptionEventTitle, children: event.url === undefined ? event.title : _jsx("a", { href: event.url, target: "_blank", rel: "noreferrer noopener", children: event.title }) }), event.detail === undefined ? null : _jsx("p", { className: streamCss.subscriptionEventDetail, children: event.detail })] })] }) }, mainEntryKey(entry));
        }
        if (entry.kind === 'thread-card') {
            // The accent states the arrival; the card's accessible name states the durable standing a read clears. A name that
            // expired with the accent would be unstable to a screen reader.
            return _jsx("div", { className: streamCss.entry, "data-main-entry": "thread-card", "data-unread": unread, children: _jsx(TeamThreadCard, { card: entry.card, unread: entry.unread, human: human, humanMemberId: humanMemberId, accountableOwner: entry.card.task === undefined ? undefined : rosterAccountableOwner(members, humanMemberId, humanName, entry.card.task.accountable), t: t, onOpen: () => {
                        if (entry.card.task === undefined)
                            onOpenDiscussion(entry.card.threadRef);
                        else
                            onOpenTask(entry.card.threadRef, entry.card.task.taskRef, entry.card.task.taskNumber);
                    } }) }, mainEntryKey(entry));
        }
        const { message } = entry;
        const senderStatus = members.find(status => status.member.memberId === message.sender);
        const isHuman = message.sender === humanMemberId;
        const previous = index > 0 ? run[index - 1] : undefined;
        const turnGap = isRunGap(previous?.occurredAt, entry.occurredAt);
        return _jsxs(Fragment, { children: [turnGap && _jsx(TeamRunDivider, {}), _jsx("div", { className: streamCss.entry, "data-main-entry": "message", "data-unread": unread, children: _jsx(TeamMessage, { senderName: isHuman ? humanName : senderStatus?.member.handle ?? message.sender, memberId: message.sender, human: isHuman, readerName: humanName, ...(humanAvatarUrl === undefined ? {} : { avatarUrl: humanAvatarUrl }), body: message.body, attachments: message.attachments, loadAttachment: getAttachment, t: t, occurredAt: message.occurredAt, mentionNames: mentionNamesOf(entry.mentions, handleByMember, humanName), onOpenRef: openRef, onResolveTaskRefs: onResolveTaskRefs, onResolveThreadRefs: onResolveThreadRefs, projectNameOf: projectNameOf, memberOf: memberOf, onOpenMemberSession: openMemberSession, grouped: index > 0 && previous?.kind === 'message', showGroupedTime: true, cardOpen: openCard === message.messageRef, onToggleCard: handleToggleCard, messageRef: message.messageRef, ...(entry.replyTo === undefined || message.replyToMessageRef === undefined ? {} : {
                            replyTo: {
                                senderName: entry.replyTo.sender === 'human' ? humanName : `@${entry.replyTo.sender.replace(/^@/, '')}`,
                                excerpt: entry.replyTo.excerpt,
                                messageRef: message.replyToMessageRef,
                            },
                        }), onReply: handleReply, onOpenReplyTo: handleOpenReplyTo, rowActions: "always", replyTarget: replyTarget === message.messageRef, replyFlash: flashedMessage === message.messageRef, ...(senderStatus === undefined ? {} : { senderTitle: senderStatus.member.description }) }) })] }, mainEntryKey(entry));
    };
    const blocks = chunkRunsWithDays(entries, entry => entry.kind === 'message' ? entry.message.sender : mainEntryKey(entry), entry => entry.occurredAt);
    return _jsxs(_Fragment, { children: [_jsx("section", { ref: timeline.ref, onScroll: timeline.onScroll, className: css.timeline, "aria-label": t('timelineLabel'), children: _jsxs("div", { className: css.timelineContent, children: [stream.loading && entries.length === 0 && stream.error === undefined && _jsx("div", { className: css.emptySurface, children: _jsxs("p", { className: css.loadingState, children: [_jsx("span", { className: css.loadingMark, "aria-hidden": "true" }), t('loadingMainStream')] }) }), !stream.loading && entries.length === 0 && stream.error !== undefined && _jsxs("div", { className: css.errorState, role: "alert", children: [_jsx("span", { children: stream.error }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => { void stream.refresh(); }, children: t('retry') })] }), stream.hasMore && _jsx("div", { className: css.timelineAction, children: _jsx(Button, { size: "sm", disabled: stream.loadingOlder, onClick: () => { void stream.loadOlder(); }, children: t('loadOlder') }) }), !stream.loading && entries.length === 0 && stream.error === undefined && _jsx("div", { className: css.emptySurface, children: _jsxs("div", { className: css.emptyState, children: [_jsx("strong", { children: t('mainEmpty') }), _jsx("span", { children: t('mainEmptyHint') })] }) }), blocks.map((block, blockIndex) => block.kind === 'day'
                            ? _jsx("p", { className: threadCss.daySeparator, children: _jsx("span", { children: block.label }) }, `day-${blockIndex}-${block.label}`)
                            : _jsx("div", { className: css.messageRun, children: block.items.map((entry, index) => renderEntry(entry, index, block.items)) }, `run-${mainEntryKey(block.items[0])}`))] }) }), _jsx(TeamComposer, { members: members, projectMemberIds: projectMemberIds, ownerMemberIds: projectOwnerIds, drafts: drafts, draftKey: draftKey, pending: pending, placeholder: startingThread ? t(asTask ? 'startTaskPlaceholder' : 'startThreadPlaceholder') : t('messagePlaceholder'), ...(notice === undefined ? {} : { notice }), ...(error === undefined ? {} : { error }), onEdit: clearSendState, onSubmit: () => { void send(); }, pendingFiles: pendingFiles, onFilesChange: changePendingFiles, ...(replyEntry === undefined ? {} : {
                    replyTo: { memberId: replyEntry.message.sender, senderName: nameOf(replyEntry.message.sender), excerpt: plainGist(replyEntry.message.body) },
                    onCancelReply: () => { sendIntent.current = undefined; setReplyTarget(undefined); },
                }), toolbarExtra: _jsx(TeamThreadStartControls, { open: startingThread, asTask: asTask, pending: pending, onOpenChange: toggleThreadStart, onAsTaskChange: changeAsTask, t: t }), t: t }, draftKey)] });
}
