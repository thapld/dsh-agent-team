import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { Button, IconCloseOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamComposer } from "./TeamComposer.js";
import { TeamPanelHandle } from "./TeamPanelHandle.js";
import { TeamMessage } from "./TeamMessage.js";
import { TeamThreadCard } from "./TeamThreadCard.js";
import { formatActivity } from "./team-formatters.js";
import { factKey, firstUnreadMention, mergeFacts, messageFact, stableMentionNames } from "./thread-facts.js";
import { chunkTimeline, placeCards } from "./team-separators.js";
import { cachedResolvedMessageRef, useResolvedMessageRefVersion } from "./refs.js";
import { hostTaskRefLookup, hostThreadRefLookup, jumpToTaskThread, jumpToThread, resolvedThreadDestination, rosterAccountableOwner } from "./refs.js";
import { useThreadFollow } from "./thread-actions.js";
import { useTeamThreadController } from "./thread-controller.js";
import projectCss from './project.module.css';
import css from './conversation.module.css';
import threadCss from './thread.module.css';
const factSender = (fact) => fact.kind === 'message' ? fact.message.sender : undefined;
const factOccurredAt = (fact) => fact.kind === 'message' ? fact.message.occurredAt : undefined;
/** A taskless Thread's whole face beside its feed. Claims and acceptance stay on the Thread page. */
export function TeamProjectPanel({ surface, workspaceId, projectRef, threadRef, anchor, projectName, humanName, humanAvatarUrl, humanMemberId, members, projectMemberIds, projectOwnerIds, drafts, getAttachment, putAttachment, readThread, loadThreadHistory, threadObservations, reply, promoteThread, changeAttention, subscribeChanges, selectThread, selectDiscussion, selectProject, resolveTaskRefs, resolveThreadRefs, resolveMessageRefs, openMemberSession, projectNameOf, memberOf, taskNumberOf, onRead, onPromoted, onClose, t }) {
    const [openCard, setOpenCard] = useState();
    // The promote button's own label: a reply send also raises the shared `pending` gate, and must not retitle it.
    const [mutating, setMutating] = useState();
    const rootRef = useRef(null);
    const projectMembers = members.filter(status => projectMemberIds.size === 0 || projectMemberIds.has(status.member.memberId));
    const memberName = (memberId) => {
        if (memberId === humanMemberId)
            return humanName;
        const status = members.find(candidate => candidate.member.memberId === memberId);
        return status === undefined ? t('memberUnknown') : `@${status.member.handle}`;
    };
    // The full page's opening rule, applied to the panel: only an Inbox arrival asks for the first unread Message that
    // names the Human; a plain open still lands at the latest fact. Memoized so its identity is stable across renders.
    const openingTarget = useMemo(() => anchor === 'unread' ? (facts) => firstUnreadMention(facts, humanName) : undefined, [anchor, humanName]);
    const controller = useTeamThreadController({
        workspaceId, threadRef, readThread, loadThreadHistory, threadObservations, subscribeChanges, resolveMessageRefs, reply, drafts, putAttachment,
        projectMembers: () => projectMembers,
        memberName, t,
        onRead: () => { onRead(threadRef); },
        openingTarget,
    });
    const { projection, task, thread, workerStates, currentFacts, readFacts, olderFacts, taskCards, followerIds, historyHasMore, loading, error, pending, autoReadExhausted, replyTarget, replyTo, pendingFiles, draftKey, flashedMessage, timelineRef, readCurrent, loadOlder, retryAutoRead, onTimelineScroll, setReplyTarget, setPendingFiles, clearSendState, sendReply, commit, } = controller;
    const mentionHandlesMap = useMemo(() => new Map(members.map(status => [status.member.memberId, status.member.handle.replace(/^@/, '')])), [members]);
    // Stable: it is a dependency of the memoized ref opener below, and TeamMessage is memoized on that.
    // A resolved ref carries its own Project: a discussion may cite one in a sibling Project, and the panel opens there.
    const openThreadRef = useMemo(() => resolvedThreadDestination(selectThread, selectDiscussion), [selectThread, selectDiscussion]);
    const openRef = useCallback((ref) => {
        if (ref.startsWith('project:')) {
            if (ref !== projectRef)
                selectProject(ref);
            return;
        }
        if (ref === threadRef)
            return;
        if (ref.startsWith('thread:')) {
            jumpToThread(resolveThreadRefs, workspaceId, ref, openThreadRef);
            return;
        }
        if (ref.startsWith('task:')) {
            jumpToTaskThread(resolveTaskRefs, workspaceId, ref, selectThread);
        }
    }, [projectRef, threadRef, workspaceId, selectProject, openThreadRef, selectThread, resolveTaskRefs, resolveThreadRefs]);
    const lookupTaskRefs = useMemo(() => hostTaskRefLookup(resolveTaskRefs, workspaceId), [resolveTaskRefs, workspaceId]);
    const lookupThreadRefs = useMemo(() => hostThreadRefLookup(resolveThreadRefs, workspaceId), [resolveThreadRefs, workspaceId]);
    const messageRefVersion = useResolvedMessageRefVersion();
    const replyContexts = useMemo(() => {
        const contexts = new Map();
        const nameOf = (memberId) => {
            if (memberId === humanMemberId)
                return humanName;
            const status = members.find(candidate => candidate.member.memberId === memberId);
            return status === undefined ? t('memberUnknown') : `@${status.member.handle}`;
        };
        for (const fact of currentFacts) {
            if (fact.kind !== 'message' || fact.message.replyToMessageRef === undefined)
                continue;
            const parent = cachedResolvedMessageRef(fact.message.replyToMessageRef);
            contexts.set(fact.message.messageRef, parent === undefined
                ? { senderName: t('memberUnknown'), excerpt: '', messageRef: fact.message.replyToMessageRef }
                : { senderName: nameOf(parent.sender), excerpt: parent.excerpt, messageRef: parent.messageRef });
        }
        return contexts;
    }, [currentFacts, messageRefVersion, members, humanMemberId, humanName, t]);
    const handleReply = useCallback((messageRef) => { setReplyTarget(messageRef); }, []);
    const handleToggleCard = useCallback((messageRef) => {
        setOpenCard(current => current === messageRef ? undefined : messageRef);
    }, []);
    const jumpToMessage = useCallback((messageRef) => {
        const row = rootRef.current?.querySelector(`[data-message-ref="${messageRef}"]`);
        if (row instanceof HTMLElement)
            row.scrollIntoView({ block: 'center' });
    }, []);
    const renderFact = (fact, grouped = false) => {
        if (fact.kind === 'message') {
            const sender = memberName(fact.message.sender);
            const senderStatus = members.find(candidate => candidate.member.memberId === fact.message.sender);
            const human = fact.message.sender === humanMemberId;
            return _jsx(TeamMessage, { senderName: sender, memberId: fact.message.sender, human: human, readerName: humanName, ...(human && humanAvatarUrl !== undefined ? { avatarUrl: humanAvatarUrl } : {}), body: fact.message.body, attachments: fact.message.attachments, loadAttachment: getAttachment, t: t, occurredAt: fact.message.occurredAt, mentionNames: stableMentionNames(fact.mentions, mentionHandlesMap, humanName), onOpenRef: openRef, onResolveTaskRefs: lookupTaskRefs, onResolveThreadRefs: lookupThreadRefs, projectNameOf: projectNameOf, memberOf: memberOf, onOpenMemberSession: openMemberSession, grouped: grouped, showGroupedTime: true, cardOpen: openCard === fact.message.messageRef, onToggleCard: handleToggleCard, messageRef: fact.message.messageRef, ...(replyContexts.has(fact.message.messageRef) ? { replyTo: replyContexts.get(fact.message.messageRef), onOpenReplyTo: jumpToMessage } : {}), onReply: handleReply, rowActions: "always", replyTarget: replyTarget === fact.message.messageRef, replyFlash: flashedMessage === fact.message.messageRef, ...(senderStatus === undefined ? {} : { senderTitle: senderStatus.member.description }) }, factKey(fact));
        }
        return _jsxs("p", { className: threadCss.activityRow, children: [_jsx("span", { className: threadCss.activityMark, "aria-hidden": "true" }), _jsx("span", { className: threadCss.activityText, children: formatActivity(fact.activity, { t, actorName: memberName, claims: projection?.claims ?? [], workerStates }) })] }, factKey(fact));
    };
    const humanIdentity = humanMemberId === undefined
        ? undefined
        : { memberId: humanMemberId, name: humanName, ...(humanAvatarUrl === undefined ? {} : { avatarUrl: humanAvatarUrl }) };
    /**
     * One derived Task card, rendered by the same component as the Project's Main stream and the discussion's own page: the
     * status, the live Claim owners and the reply count must not depend on which of the three faces is open.
     */
    const renderTaskCard = (entry) => {
        const task = entry.card.task;
        return _jsx(TeamThreadCard, { card: entry.card, unread: false, human: humanIdentity, humanMemberId: humanMemberId, accountableOwner: rosterAccountableOwner(members, humanMemberId, humanName, task.accountable), t: t, onOpen: () => { selectThread(entry.card.threadRef, projectRef, task.taskRef, task.taskNumber); } }, `task-card-${task.taskRef}`);
    };
    /** The one fact the unread boundary sits above: the first unread fact of the open discussion, or none once it is read. */
    const firstUnread = readFacts.find(fact => fact.unread)?.fact;
    const firstUnreadKey = firstUnread === undefined ? undefined : factKey(firstUnread);
    /** Facts and derived cards in one sequence-ordered stream, with the day dividers and the unread boundary the page draws. */
    const renderTimeline = (facts, cards) => {
        const placements = new Map(cards.map(card => [`task-card-${card.card.task.taskRef}`, card]));
        const entries = placeCards(facts, cards, fact => fact.sequence, card => ({ sequence: card.sequence, key: `task-card-${card.card.task.taskRef}` }));
        // The boundary sits above the first unread fact of the whole open discussion, as on the full page — not at every gap.
        // It belongs to the Inbox opening only: a plain card click keeps the panel it already was.
        const boundary = anchor === 'unread' ? firstUnreadKey : undefined;
        const isBoundary = boundary === undefined ? undefined : (fact) => factKey(fact) === boundary;
        const nodes = [...chunkTimeline(entries, factSender, factOccurredAt, isBoundary)];
        return nodes.map((node, nodeIndex) => {
            if (node.kind === 'day')
                return _jsx("p", { className: threadCss.daySeparator, children: _jsx("span", { children: node.label }) }, `day-${nodeIndex}-${node.label}`);
            if (node.kind === 'boundary')
                return _jsx("p", { className: threadCss.unreadBoundary, role: "separator", children: _jsx("span", { children: t('unreadBoundary') }) }, `boundary-${nodeIndex}`);
            if (node.kind === 'card')
                return _jsx(Fragment, { children: renderTaskCard(placements.get(node.key)) }, node.key);
            if (node.kind === 'lone')
                return _jsx(Fragment, { children: renderFact(node.fact) }, factKey(node.fact));
            return _jsx("div", { className: css.messageRun, children: node.items.map((entry, entryIndex) => _jsx(Fragment, { children: renderFact(entry, entryIndex > 0) }, factKey(entry))) }, `run-${factKey(node.items[0])}`);
        });
    };
    // The same hook the Thread page uses, so the panel's follow control shows the Host's
    // current observation and recovers from a failed write exactly like the other face. The
    // follower set the Host projects is every Member's Attention, so the control is told which
    // id is the Human's — another Member's follow must not read as the Human's own.
    const follow = useThreadFollow(changeAttention, threadObservations, { workspaceId, threadRef }, undefined, humanMemberId);
    // The panel's only Task action; the promotion walks the reader into the Task's own Thread.
    const convertToTask = async () => {
        if (pending || thread === undefined || task !== undefined)
            return;
        setMutating('promote');
        try {
            await commit({
                key: 'promote',
                write: requestId => promoteThread({ requestId, workspaceId, threadRef, baseRevision: thread.revision }),
                onCommitted: committed => { onPromoted(committed.task.taskRef); },
            });
        }
        finally {
            setMutating(undefined);
        }
    };
    const currentFactsWithAnchor = mergeFacts(projection === undefined ? [] : [messageFact(projection.anchor, projection.anchorMentions)], currentFacts);
    const resolvedTaskNumber = task === undefined ? undefined : taskNumberOf(task.taskRef);
    const title = `${t('threadLabel')} · #${projectName}`;
    return _jsxs("aside", { ref: rootRef, className: projectCss.panel, "aria-label": t('threadLabel'), "data-team-panel": threadRef, "data-team-thread": threadRef, children: [_jsx(TeamPanelHandle, { surface: surface, label: t('panelResize') }), _jsxs("div", { className: projectCss.panelHead, children: [_jsx("span", { className: projectCss.panelTitle, title: title, children: title }), thread !== undefined && _jsx(Tooltip, { label: follow.following === true ? t('unfollowHint') : t('followHint'), side: "bottom", delayMs: 500, portal: true, maxWidth: 260, children: _jsx(Button, { size: "sm", variant: "outline", className: follow.following === true ? css.toggleOn : undefined, disabled: follow.pending, "aria-pressed": follow.following === true, "aria-label": follow.pending ? t('followPending') : follow.following === true ? t('unfollowThread') : t('followThread'), onClick: () => { void follow.toggle(follow.following === true ? 'unfollow' : 'follow'); }, children: follow.pending ? t('followPendingLabel') : follow.following === true ? t('unfollowLabel') : t('followLabel') }) }), task === undefined && thread !== undefined && _jsx(Tooltip, { label: t('promoteHint'), side: "bottom", delayMs: 500, portal: true, maxWidth: 260, children: _jsx(Button, { size: "sm", variant: "primary", disabled: pending, onClick: () => { void convertToTask(); }, children: mutating === 'promote' ? t('promotingTask') : t('promoteToTask') }) }), task !== undefined && _jsx(Button, { size: "sm", variant: "primary", onClick: () => { onPromoted(task.taskRef); }, children: t('openTask', { number: resolvedTaskNumber ?? '…' }) }), _jsx(Button, { size: "sm", icon: _jsx(IconCloseOutlineRegular, { size: 14 }), "aria-label": t('panelClose'), onClick: onClose })] }), follow.error !== undefined && _jsx("p", { className: css.actionError, role: "alert", children: follow.error }), _jsxs("section", { ref: timelineRef, onScroll: onTimelineScroll, className: projectCss.panelBody, "aria-label": t('timelineLabel'), children: [loading && projection === undefined && error === undefined && _jsx("div", { className: css.emptySurface, children: _jsxs("p", { className: css.loadingState, children: [_jsx("span", { className: css.loadingMark, "aria-hidden": "true" }), t('loadingThread')] }) }), projection === undefined && error !== undefined && _jsxs("div", { className: css.errorState, role: "alert", children: [_jsx("span", { children: error }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => { void readCurrent(); }, children: t('retry') })] }), renderTimeline(olderFacts, taskCards.filter(card => card.sequence < (currentFactsWithAnchor[0]?.sequence ?? Number.POSITIVE_INFINITY))), historyHasMore && _jsx("div", { className: css.timelineAction, children: _jsx(Button, { size: "sm", onClick: () => { void loadOlder(); }, children: t('loadOlder') }) }), renderTimeline(currentFactsWithAnchor, taskCards.filter(card => card.sequence >= (currentFactsWithAnchor[0]?.sequence ?? 0))), autoReadExhausted && _jsxs("div", { className: css.timelineAction, role: "alert", children: [_jsx("span", { children: t('autoReadIncomplete') }), _jsx(Button, { size: "sm", onClick: retryAutoRead, disabled: loading, children: t('retry') })] })] }), projection !== undefined && thread !== undefined && _jsx(TeamComposer, { members: members, followerMemberIds: followerIds, projectMemberIds: projectMemberIds, ownerMemberIds: projectOwnerIds, drafts: drafts, draftKey: draftKey, pending: pending, ...(error === undefined ? {} : { error }), onEdit: clearSendState, onSubmit: () => { void sendReply(); }, placeholder: t('replyPlaceholder'), pendingFiles: pendingFiles, onFilesChange: setPendingFiles, ...(replyTo === undefined ? {} : {
                    replyTo,
                    onCancelReply: () => { setReplyTarget(undefined); },
                }), t: t }, draftKey)] });
}
