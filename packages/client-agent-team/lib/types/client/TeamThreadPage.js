import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, IconChevronLeftOutlineRegular, Modal, Pill, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamComposer } from "./TeamComposer.js";
import { diagnosticText, TeamPresenceDot } from "./TeamPresenceDot.js";
import { TeamMessage } from "./TeamMessage.js";
import { firstSentence, formatActivity, formatRiskClass, formatTaskStatus, plainGist, taskStatusDot } from "./team-formatters.js";
import { TeamStateDot } from "./TeamStateDot.js";
import { TeamOwnerSeat } from "./TeamOwnerSeat.js";
import { TeamThreadCard } from "./TeamThreadCard.js";
import { daySeparatorLabel, localDateKey } from "./team-separators.js";
import { useTaskTransfer, useThreadFollow } from "./thread-actions.js";
import { useTeamThreadController } from "./thread-controller.js";
import { cachedResolvedMessageRef, useResolvedMessageRefVersion } from "./refs.js";
import { factKey, firstUnreadMention, mergeFacts, messageFact, stableMentionNames } from "./thread-facts.js";
import { hostTaskRefLookup, jumpToTaskThread } from "./refs.js";
import { hostThreadRefLookup, jumpToThread, resolvedThreadDestination } from "./refs.js";
import { rosterAccountableOwner, rosterProjectName, rosterMember } from "./refs.js";
import css from './conversation.module.css';
import threadCss from './thread.module.css';
function readMeta(facts) {
    return new Map(facts.map(fact => [factKey(fact.fact), fact]));
}
export function TeamThreadPage(props) {
    const { workspaceId, humanName, humanAvatarUrl, projectRef, taskRef, threadRef, taskNumber, backToWorkspace, selectProject, selectThread, selectDiscussion, resolveTaskRefs, resolveThreadRefs, openMemberSession, putAttachment, loadProjects, readThread, loadThreadHistory, threadObservations, subscribeChanges, loadMembers, drafts, getAttachment, reply, changeAttention, transferTask, changeTask, promoteThread, resolveMessageRefs, t, } = props;
    const threadRequest = { threadRef, ...(taskRef === undefined ? {} : { taskRef }) };
    const [projectView, setProjectView] = useState();
    const [members, setMembers] = useState([]);
    // Early acceptance: the Human may accept while Claims are still open; the
    // confirm dialog lists exactly what will be completed with the Task.
    const [confirmingAccept, setConfirmingAccept] = useState(false);
    const [openCard, setOpenCard] = useState();
    // Label source for the promote/accept buttons only: a reply send also raises
    // the shared `pending` gate, and must not retitle those buttons.
    const [mutating, setMutating] = useState();
    const [transferDialogOpen, setTransferDialogOpen] = useState(false);
    const mountedRef = useRef(false);
    const supplementalRef = useRef();
    const supplementalPendingRef = useRef(false);
    const memberName = (memberId) => {
        if (memberId === projectView?.humanMemberId)
            return humanName;
        const status = members.find(candidate => candidate.member.memberId === memberId);
        return status === undefined ? t('memberUnknown') : `@${status.member.handle}`;
    };
    const controller = useTeamThreadController({
        workspaceId, threadRef, ...(taskRef === undefined ? {} : { taskRef }), readThread, loadThreadHistory, threadObservations, subscribeChanges,
        resolveMessageRefs, reply, drafts, putAttachment,
        projectMembers: () => projectMembers,
        memberName, t,
        openingTarget: facts => firstUnreadMention(facts, humanName),
        afterWrite: () => refreshSupplemental(),
    });
    const applySupplemental = async () => {
        try {
            const [loadedMembers, loadedView] = await Promise.all([
                loadMembers({ workspaceId }),
                loadProjects({ workspaceId, ...(projectRef === undefined ? {} : { projectRef }), threadRef, includeActivities: false, limit: 1 }),
            ]);
            if (!mountedRef.current)
                return false;
            if (loadedMembers.ok)
                setMembers(loadedMembers.value);
            if (loadedView.ok)
                setProjectView(loadedView.value);
            const failure = [loadedMembers, loadedView].find(result => !result.ok);
            if (failure !== undefined && !failure.ok)
                controller.reportError(failure.error.message);
            return true;
        }
        catch (cause) {
            if (mountedRef.current)
                controller.reportError(cause instanceof Error ? cause.message : String(cause));
            return mountedRef.current;
        }
    };
    const refreshSupplemental = () => {
        supplementalPendingRef.current = true;
        if (supplementalRef.current !== undefined)
            return supplementalRef.current;
        const round = (async () => {
            await Promise.resolve();
            while (mountedRef.current && supplementalPendingRef.current) {
                supplementalPendingRef.current = false;
                if (!await applySupplemental())
                    return;
            }
        })().finally(() => {
            if (supplementalRef.current === round)
                supplementalRef.current = undefined;
        });
        supplementalRef.current = round;
        return round;
    };
    const refreshMembers = async () => {
        if (!mountedRef.current)
            return;
        try {
            const loaded = await loadMembers({ workspaceId });
            if (!mountedRef.current)
                return;
            if (loaded.ok)
                setMembers(loaded.value);
            else
                controller.reportError(loaded.error.message);
        }
        catch (cause) {
            if (mountedRef.current)
                controller.reportError(cause instanceof Error ? cause.message : String(cause));
        }
    };
    const { projection: activeProjection, task, thread, currentFacts, readFacts, olderFacts, taskCards, workerStates, followerIds, historyHasMore, loading, error, pending, autoReadExhausted, newFactsCount, replyTarget, replyTo, pendingFiles, draftKey, flashedMessage, timelineRef, readCurrent, loadOlder, refreshAfterFence, refreshPassiveFacts, retryAutoRead, onTimelineScroll, jumpToNewest, flashMessage, setReplyTarget, setPendingFiles, clearSendState, sendReply, commit, applyTaskCommit, } = controller;
    useEffect(() => {
        if (confirmingAccept && task?.resolution === 'accepted')
            setConfirmingAccept(false);
    }, [confirmingAccept, task?.resolution]);
    useEffect(() => {
        mountedRef.current = true;
        supplementalRef.current = undefined;
        supplementalPendingRef.current = false;
        setProjectView(undefined);
        setMembers([]);
        setOpenCard(undefined);
        void refreshSupplemental();
        const disposers = [
            subscribeChanges({ kind: 'workspace', workspaceId }, update => {
                if (!mountedRef.current)
                    return;
                if (update.type === 'failed') {
                    controller.reportError(update.message);
                    return;
                }
                void refreshSupplemental();
            }),
            // Presence commits nothing: refresh the roster alone; the project view is reserved for workspace membership changes.
            subscribeChanges({ kind: 'presence', workspaceId }, update => {
                if (!mountedRef.current)
                    return;
                if (update.type === 'failed') {
                    controller.reportError(update.message);
                    return;
                }
                void refreshMembers();
            }),
        ];
        return () => {
            mountedRef.current = false;
            for (const dispose of disposers)
                dispose();
        };
    }, [workspaceId, taskRef, threadRef]);
    const resolvedTaskNumber = taskNumber ?? projectView?.taskNumbers.find(entry => entry.taskRef === task?.taskRef)?.taskNumber;
    const taskTitle = activeProjection === undefined ? undefined : plainGist(activeProjection.anchor.body);
    const taskClaims = activeProjection?.claims ?? [];
    const effectiveProjectRef = task?.projectRef ?? projectRef;
    const projectMemberIds = useMemo(() => new Set(projectView?.members.filter(item => item.projectRef === effectiveProjectRef).map(item => item.memberId) ?? []), [projectView, effectiveProjectRef]);
    const projectOwnerIds = useMemo(() => new Set((projectView?.owners ?? []).filter(item => item.projectRef === effectiveProjectRef).map(item => item.memberId)), [projectView, effectiveProjectRef]);
    const projectMembers = members.filter(status => projectMemberIds.size === 0 || projectMemberIds.has(status.member.memberId));
    const mentionHandlesMap = useMemo(() => new Map(members.map(status => [status.member.memberId, status.member.handle.replace(/^@/, '')])), [members]);
    const humanIdentity = projectView?.humanMemberId === undefined
        ? undefined
        : { memberId: projectView.humanMemberId, name: humanName, ...(humanAvatarUrl === undefined ? {} : { avatarUrl: humanAvatarUrl }) };
    const metadata = useMemo(() => readMeta(readFacts), [readFacts]);
    const unreadIndex = useMemo(() => {
        const all = mergeFacts(...(activeProjection === undefined ? [] : [[messageFact(activeProjection.anchor, activeProjection.anchorMentions)]]), readFacts.map(fact => fact.fact), currentFacts);
        return all.findIndex(fact => metadata.get(factKey(fact))?.unread === true);
    }, [activeProjection?.anchor, readFacts, currentFacts, metadata]);
    const messageSender = (fact) => fact.kind === 'message' ? fact.message.sender : undefined;
    // The dialog offers this Thread's enabled followers, and nothing else: a handover is a move inside a
    // conversation, so the readers already in it are the people it can land on. The Host accepts any enabled
    // Project member, so this is the Client's narrower offer rather than a second authority — it reads the same
    // follower set the composer and the follow control use. The Human is a candidate only by following, because
    // that set is every Member's Attention and the Human's own follow writes its row. The current accountable is
    // never offered: a transfer it already holds is refused as a no-op.
    const transferCandidates = useMemo(() => {
        if (task === undefined)
            return [];
        const human = projectView?.humanMemberId;
        return [...followerIds]
            .filter(memberId => memberId !== task.accountable
            // The Human is not a row of the Agent roster, so its own id is enabled by definition.
            && (memberId === human || members.some(status => status.member.memberId === memberId && status.member.state === 'enabled')))
            .sort((left, right) => memberName(left).localeCompare(memberName(right)));
    }, [followerIds, members, projectView?.humanMemberId, task?.accountable]);
    // Identity-stable: `openRef` feeds every row's props, so a fresh destination per render would re-render the timeline. The
    // resolved ref carries its own Project, so a cross-Project discussion opens beside that Project's feed — this page's
    // `projectRef` is the wrong answer, and a Thread page without one has no Project to substitute at all.
    const openThreadRef = useMemo(() => resolvedThreadDestination(selectThread, selectDiscussion), [selectThread, selectDiscussion]);
    // Unresolvable refs never become links (see TeamMessage), so only Host-confirmed refs reach here. Identity-stable: a fresh
    // closure per render would defeat TeamMessage's memo.
    const openRef = useCallback((ref) => {
        if (ref.startsWith('project:') && ref !== projectRef) {
            selectProject(ref);
            return;
        }
        if (ref.startsWith('thread:') && ref !== threadRef) {
            jumpToThread(resolveThreadRefs, workspaceId, ref, openThreadRef);
            return;
        }
        if (ref.startsWith('task:') && ref !== taskRef) {
            jumpToTaskThread(resolveTaskRefs, workspaceId, ref, selectThread);
        }
    }, [projectRef, threadRef, taskRef, workspaceId, selectProject, openThreadRef, resolveTaskRefs, resolveThreadRefs]);
    const lookupTaskRefs = useMemo(() => hostTaskRefLookup(resolveTaskRefs, workspaceId), [resolveTaskRefs, workspaceId]);
    const lookupThreadRefs = useMemo(() => hostThreadRefLookup(resolveThreadRefs, workspaceId), [resolveThreadRefs, workspaceId]);
    const jumpToMessage = useCallback((messageRef) => {
        const node = document.querySelector(`[data-message-ref="${messageRef}"]`);
        if (node === null)
            return;
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        flashMessage(messageRef);
    }, [flashMessage]);
    // One stable callback for every row: TeamMessage is memoized, so a fresh
    // closure per row would re-render the whole timeline on any page render.
    const handleReply = useCallback((messageRef) => { setReplyTarget(messageRef); }, []);
    const handleToggleCard = useCallback((messageRef) => {
        setOpenCard(current => current === messageRef ? undefined : messageRef);
    }, []);
    const handleOpenReplyTo = useCallback((messageRef) => { jumpToMessage(messageRef); }, [jumpToMessage]);
    // Keyed on roster content, not array identity, so memoized rows survive change bursts that leave the roster untouched.
    const rosterKey = useMemo(() => [
        (projectView?.projects ?? []).map(project => `${project.projectRef}=${project.name}=${project.state}`).join(','),
        members.map(status => `${status.member.memberId}=${status.member.handle}=${status.member.sessionId}=${status.availability}`).join(','),
        projectView?.humanMemberId ?? '',
    ].join(';'), [projectView, members]);
    const projectNameOf = useMemo(() => {
        const projects = projectView?.projects ?? [];
        return (ref) => rosterProjectName(projects, ref);
    }, [rosterKey]);
    const memberOf = useMemo(() => {
        const humanMemberId = projectView?.humanMemberId;
        return (ref) => rosterMember(members, humanMemberId, humanName, ref);
    }, [rosterKey, humanName]);
    const messageRefVersion = useResolvedMessageRefVersion();
    // One stable object per row: TeamMessage is memoized and an object literal per render would undo it.
    const replyContexts = useMemo(() => {
        const contexts = new Map();
        const nameOf = (memberId) => {
            if (memberId === projectView?.humanMemberId)
                return humanName;
            const status = members.find(candidate => candidate.member.memberId === memberId);
            return status === undefined ? t('memberUnknown') : `@${status.member.handle}`;
        };
        for (const fact of currentFacts) {
            if (fact.kind !== 'message' || fact.message.replyToMessageRef === undefined)
                continue;
            const parent = cachedResolvedMessageRef(fact.message.replyToMessageRef);
            // The ref travels whether or not the parent is resolved: it is the fact's
            // own pointer, so the quote line can always name where it goes.
            contexts.set(fact.message.messageRef, parent === undefined
                ? { senderName: t('memberUnknown'), excerpt: '', messageRef: fact.message.replyToMessageRef }
                : { senderName: nameOf(parent.sender), excerpt: parent.excerpt, messageRef: parent.messageRef });
        }
        return contexts;
    }, [currentFacts, messageRefVersion, members, projectView, humanName, t]);
    const renderFact = (fact, grouped = false) => {
        if (fact.kind === 'message') {
            const sender = memberName(fact.message.sender);
            const senderStatus = members.find(candidate => candidate.member.memberId === fact.message.sender);
            const human = fact.message.sender === projectView?.humanMemberId;
            return _jsx(TeamMessage, { senderName: sender, memberId: fact.message.sender, human: human, readerName: humanName, ...(human && humanAvatarUrl !== undefined ? { avatarUrl: humanAvatarUrl } : {}), body: fact.message.body, attachments: fact.message.attachments, loadAttachment: getAttachment, t: t, occurredAt: fact.message.occurredAt, mentionNames: stableMentionNames(fact.mentions, mentionHandlesMap, humanName), onOpenRef: openRef, onResolveTaskRefs: lookupTaskRefs, onResolveThreadRefs: lookupThreadRefs, projectNameOf: projectNameOf, memberOf: memberOf, onOpenMemberSession: openMemberSession, grouped: grouped, showGroupedTime: true, cardOpen: openCard === fact.message.messageRef, onToggleCard: handleToggleCard, messageRef: fact.message.messageRef, ...(replyContexts.has(fact.message.messageRef) ? { replyTo: replyContexts.get(fact.message.messageRef), onOpenReplyTo: handleOpenReplyTo } : {}), onReply: handleReply, rowActions: "always", replyTarget: replyTarget === fact.message.messageRef, replyFlash: flashedMessage === fact.message.messageRef, ...(senderStatus === undefined ? {} : { senderTitle: senderStatus.member.description }) }, factKey(fact));
        }
        return _jsxs("p", { className: threadCss.activityRow, children: [_jsx("span", { className: threadCss.activityMark, "aria-hidden": "true" }), _jsx("span", { className: threadCss.activityText, children: formatActivity(fact.activity, { t, actorName: memberName, claims: taskClaims, workerStates }) })] }, factKey(fact));
    };
    /**
     * One derived Task card: the discussion's own projection of work it spawned, jumping to the Task Thread. It renders the
     * same component the Main stream and the side panel use, so the three faces cannot describe one Task differently.
     */
    const renderTaskCard = (entry) => {
        const task = entry.card.task;
        return _jsx(TeamThreadCard, { card: entry.card, unread: false, human: humanIdentity, humanMemberId: projectView?.humanMemberId, accountableOwner: rosterAccountableOwner(members, projectView?.humanMemberId, humanName, task.accountable), t: t, onOpen: () => selectThread(entry.card.threadRef, projectRef, task.taskRef, task.taskNumber) }, `task-card-${task.taskRef}`);
    };
    /** One run = one same-sender reply turn; activities, derived Task cards, the unread boundary, and day changes break runs. */
    const renderFactBlocks = (facts, boundaryIndex, cards = []) => {
        const nodes = [];
        let run = [];
        let lastDay;
        let nextCard = 0;
        const flushRun = () => {
            if (run.length > 0) {
                nodes.push(_jsx("div", { className: css.messageRun, children: run.map((entry, entryIndex) => _jsx(Fragment, { children: renderFact(entry, entryIndex > 0) }, factKey(entry))) }, `run-${factKey(run[0])}`));
            }
            run = [];
        };
        facts.forEach((fact, index) => {
            const occurredAt = fact.kind === 'message' ? fact.message.occurredAt : undefined;
            if (occurredAt !== undefined) {
                const day = localDateKey(occurredAt);
                if (lastDay !== undefined && day !== lastDay) {
                    flushRun();
                    nodes.push(_jsx("p", { className: threadCss.daySeparator, children: _jsx("span", { children: daySeparatorLabel(occurredAt) }) }, `day-${index}`));
                }
                lastDay = day;
            }
            while (nextCard < cards.length && cards[nextCard].sequence < fact.sequence) {
                flushRun();
                nodes.push(renderTaskCard(cards[nextCard]));
                nextCard += 1;
            }
            const sender = messageSender(fact);
            if (sender !== undefined && run.length > 0 && sender === messageSender(run[run.length - 1])) {
                run.push(fact);
                return;
            }
            flushRun();
            if (boundaryIndex === index)
                nodes.push(_jsx("p", { className: threadCss.unreadBoundary, role: "separator", children: _jsx("span", { children: t('unreadBoundary') }) }, `boundary-${index}`));
            if (sender !== undefined)
                run.push(fact);
            else
                nodes.push(_jsx(Fragment, { children: renderFact(fact) }, factKey(fact)));
        });
        while (nextCard < cards.length) {
            flushRun();
            nodes.push(renderTaskCard(cards[nextCard]));
            nextCard += 1;
        }
        flushRun();
        return nodes;
    };
    // The follow control and the transfer menu share the same two hooks the discussion panel uses, so both
    // faces display the Host's current observation and recover from a refusal the same way. The page's mount
    // observation already answered the follower set, so the control starts from that answer instead of
    // issuing a second read for the same state. That set is every Member's Attention, so the control is also
    // told which id is the Human's: the Host projects it, and it is what keeps another Member's follow from
    // reading as the Human's own.
    // The page hands in the same follower set it refreshes for the composer, so a change another face or
    // another client makes reaches the control: the set is re-read on every subscription tick, not only on
    // the mount read that seeded it.
    const follow = useThreadFollow(changeAttention, threadObservations, { workspaceId, ...threadRequest }, followerIds, projectView?.humanMemberId);
    const transfer = useTaskTransfer(transferTask, {
        workspaceId,
        taskRef: task?.taskRef,
        revisionOf: () => thread?.revision,
        onCommitted: async (committed) => {
            setTransferDialogOpen(false);
            await applyTaskCommit(committed);
        },
        // A fence re-reads through the page's own recovery path, exactly as accept, close, and reopen do:
        // the unread gate drains, the stale revision re-projects the Thread, and the Task's current
        // accountable stays on screen untouched while it happens.
        onRefusal: async (refusal) => {
            setTransferDialogOpen(false);
            if (refusal.kind === 'unread_required')
                await refreshAfterFence();
            else
                await refreshPassiveFacts();
        },
    });
    const convertToTask = async () => {
        if (pending || thread === undefined || task !== undefined)
            return;
        setMutating('promote');
        try {
            await commit({
                key: 'promote',
                write: requestId => promoteThread({ requestId, workspaceId, threadRef, baseRevision: thread.revision }),
                onCommitted: async (committed) => { await applyTaskCommit(committed); },
            });
        }
        finally {
            setMutating(undefined);
        }
    };
    const mutateTask = async (action) => {
        if (pending || task === undefined || thread === undefined)
            return;
        if (action === 'accept')
            setMutating('accept');
        try {
            await commit({
                key: `task:${action}`,
                write: requestId => changeTask({ requestId, workspaceId, taskRef: task.taskRef, action, baseRevision: thread.revision }),
                onCommitted: async (committed) => { await applyTaskCommit(committed); },
            });
        }
        finally {
            setMutating(undefined);
        }
    };
    const currentFactsWithAnchor = mergeFacts(activeProjection === undefined ? [] : [messageFact(activeProjection.anchor, activeProjection.anchorMentions)], currentFacts);
    const unreadBoundary = unreadIndex >= 0 ? unreadIndex : undefined;
    // One row per erroring Member holding a live Claim: the diagnostic's structured class beside the first sentence of the Host's
    // reason; the full text rides the row's title.
    const risks = taskClaims.filter(claim => claim.state === 'active').flatMap(claim => {
        const status = members.find(candidate => candidate.member.memberId === claim.owner);
        if (status?.presence !== 'error')
            return [];
        const risk = formatRiskClass(status, t);
        const detail = diagnosticText(status);
        return [{
                claim, status, ...risk,
                reason: detail === '' ? t('statusError') : firstSentence(detail),
                full: detail === '' ? t('statusError') : detail,
            }];
    });
    // Threads are always entered through a Project page, so a Project origin
    // returns to its timeline; a Thread restored without one returns further.
    const backLabel = projectRef === undefined ? t('backToWorkspace') : t('backToProject');
    // The action band's lifecycle group, decided once so the divider can ask whether that group renders:
    // a closed Task's reopen lives only in the composer-slot notice, so that state carries no group at all.
    const activeClaimCount = activeProjection?.claims.filter(claim => claim.taskRef === task?.taskRef && claim.state === 'active').length ?? 0;
    // Accepting early closes Claims with the Task, so it asks first; a todo Task's work finished outside
    // the ledger, so there is nothing to confirm and no Claims to list.
    const earlyAccept = task?.resolution === 'open' && task.status === 'in_progress' && activeClaimCount > 0;
    const canAccept = task?.resolution === 'open' && (task.status === 'in_review' || task.status === 'todo' || earlyAccept);
    const showLifecycleGroup = task === undefined || task.resolution !== 'closed';
    // The transfer receipt stands only while the Host still shows the Task where the write put it, so a later
    // move — this band's or anyone else's — retires the line instead of contradicting the Task on screen.
    const transferLandedOn = transfer.landedOn !== undefined && task?.accountable === transfer.landedOn ? transfer.landedOn : undefined;
    // One failure, two placements: the band states it while the dialog is shut, and the dialog states it while
    // open, because a modal stands over the band's line. Rendering it once keeps the wording in one place.
    const transferFailure = transfer.error ?? (transfer.refusal === undefined ? undefined
        : transfer.refusal.kind === 'unread_required'
            ? t('transferUnreadRequired', { count: transfer.refusal.unreadCount })
            : t('transferStaleRevision'));
    return _jsxs("main", { className: css.surface, "data-team-thread": threadRef, children: [_jsxs("div", { className: `${css.surfaceHeader} ${css.surfaceHeaderStacked}`, children: [_jsx("div", { className: css.backRow, children: _jsx(Button, { size: "sm", icon: _jsx(IconChevronLeftOutlineRegular, {}), onClick: backToWorkspace, children: backLabel }) }), _jsxs("header", { className: css.headerRow, children: [_jsxs("div", { className: css.headerCopy, children: [_jsxs("div", { className: threadCss.titleLine, children: [_jsx("h1", { children: task === undefined ? t('threadLabel') : t('taskLabel', { number: resolvedTaskNumber ?? '…' }) }), task !== undefined && _jsxs(Pill, { children: [_jsx(TeamStateDot, { size: 8, state: taskStatusDot(task.status) }), formatTaskStatus(task.status, t)] }), task !== undefined && _jsx(TeamOwnerSeat, { owner: rosterAccountableOwner(members, projectView?.humanMemberId, humanName, task.accountable), human: humanIdentity, humanMemberId: projectView?.humanMemberId, t: t })] }), taskTitle !== undefined && taskTitle !== '' && _jsx("p", { className: threadCss.taskTitle, title: taskTitle, children: taskTitle })] }), thread !== undefined && _jsxs("div", { className: css.headerActions, "data-team-action-band": true, children: [_jsxs("div", { className: css.actionGroup, "data-team-action-group": "thread", children: [_jsx(Tooltip, { label: follow.following === true ? t('unfollowHint') : t('followHint'), side: "bottom", delayMs: 500, portal: true, maxWidth: 260, children: _jsx(Button, { size: "sm", variant: "outline", className: follow.following === true ? css.toggleOn : undefined, disabled: follow.pending, "aria-pressed": follow.following === true, "aria-label": follow.pending ? t('followPending') : follow.following === true ? t('unfollowThread') : t('followThread'), onClick: () => { void follow.toggle(follow.following === true ? 'unfollow' : 'follow'); }, children: follow.pending ? t('followPendingLabel') : follow.following === true ? t('unfollowLabel') : t('followLabel') }) }), task !== undefined && _jsx(Tooltip, { label: t('transferHint'), side: "bottom", delayMs: 500, portal: true, maxWidth: 260, children: _jsx(Button, { size: "sm", variant: "outline", disabled: transfer.pending, "aria-haspopup": "dialog", "aria-label": transfer.pending ? t('transferringTask') : t('transferTask'), onClick: () => { setTransferDialogOpen(true); }, children: transfer.pending ? t('transferPendingLabel') : t('transferLabel') }) })] }), showLifecycleGroup && _jsx("div", { className: css.actionGroup, "data-team-action-group": "lifecycle", children: task === undefined
                                            ? _jsx(Tooltip, { label: t('promoteHint'), side: "bottom", delayMs: 500, portal: true, maxWidth: 260, children: _jsx(Button, { size: "sm", variant: "primary", disabled: pending, onClick: () => { void convertToTask(); }, children: mutating === 'promote' ? t('promotingTask') : t('promoteToTask') }) })
                                            : task.resolution === 'open'
                                                ? _jsxs(_Fragment, { children: [canAccept && _jsx(Tooltip, { label: t('acceptHint'), side: "bottom", delayMs: 500, portal: true, maxWidth: 260, children: _jsx(Button, { size: "sm", variant: "primary", disabled: pending, onClick: () => { if (earlyAccept) {
                                                                    setConfirmingAccept(true);
                                                                }
                                                                else {
                                                                    void mutateTask('accept');
                                                                } }, children: t('acceptTask') }) }), _jsx(Tooltip, { label: t('closeHint'), side: "bottom", delayMs: 500, portal: true, maxWidth: 260, children: _jsx(Button, { size: "sm", variant: "outline", disabled: pending, onClick: () => { void mutateTask('close'); }, children: t('closeTask') }) })] })
                                                : _jsx(Tooltip, { label: t('reopenHint'), side: "bottom", delayMs: 500, portal: true, maxWidth: 260, children: _jsx(Button, { size: "sm", variant: "primary", disabled: pending, onClick: () => { void mutateTask('reopen'); }, children: t('reopenTask') }) }) })] })] }), follow.error !== undefined && _jsx("p", { className: css.actionError, role: "alert", children: follow.error }), !transferDialogOpen && transferFailure !== undefined && _jsx("p", { className: css.actionError, role: "alert", children: transferFailure }), transferLandedOn !== undefined && _jsx("p", { className: css.actionNotice, role: "status", children: transferLandedOn === projectView?.humanMemberId ? t('transferDoneYou') : t('transferDone', { name: memberName(transferLandedOn) }) }), risks.length > 0 && _jsxs("section", { className: threadCss.riskSection, "aria-label": t('runtimeRisk'), children: [_jsx("h2", { children: t('runtimeRisk') }), risks.map(({ claim, status, label, sentenceKey, reason, full }) => _jsxs("p", { className: threadCss.riskRow, children: [_jsx(TeamPresenceDot, { status: status, t: t }), _jsxs("span", { title: full, children: [_jsx("strong", { className: threadCss.riskClass, children: label }), " \u00B7 ", t(sentenceKey, { member: status.member.handle }), " \u2014 ", reason] })] }, claim.claimRef))] }), task !== undefined && _jsxs(Modal, { open: transferDialogOpen, onClose: () => { if (!transfer.pending)
                            setTransferDialogOpen(false); }, title: t('transferTitle'), closeLabel: t('cancel'), footer: _jsx(Button, { variant: "outline", disabled: transfer.pending, onClick: () => { setTransferDialogOpen(false); }, children: t('cancel') }), children: [_jsx("p", { className: css.confirmBody, children: t('transferBody') }), transferCandidates.length === 0
                                ? _jsx("p", { className: css.transferEmpty, role: "status", children: t('transferEmpty') })
                                : _jsx("ul", { className: css.transferList, children: transferCandidates.map(memberId => _jsx("li", { children: _jsx("button", { type: "button", className: css.transferCandidate, disabled: transfer.pending, onClick: () => { void transfer.transfer(memberId); }, children: memberId === projectView?.humanMemberId ? t('transferTargetYou') : t('transferTargetLabel', { name: memberName(memberId) }) }) }, memberId)) }), transferFailure !== undefined && _jsx("p", { className: css.actionError, role: "alert", children: transferFailure })] }), task !== undefined && thread !== undefined && (() => {
                        const activeClaims = activeProjection?.claims.filter(claim => claim.taskRef === task.taskRef && claim.state === 'active') ?? [];
                        return _jsxs(Modal, { open: confirmingAccept, onClose: () => { if (!pending)
                                setConfirmingAccept(false); }, title: t('acceptEarlyTitle'), closeLabel: t('cancel'), footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: pending, onClick: () => { setConfirmingAccept(false); }, children: t('cancel') }), _jsx(Button, { variant: "primary", disabled: pending, onClick: () => { void mutateTask('accept'); }, children: mutating === 'accept' ? t('acceptingTask') : t('acceptTask') })] }), children: [_jsx("p", { className: css.confirmBody, children: t('acceptEarlyBody', { count: activeClaims.length }) }), _jsx("ul", { className: css.confirmList, children: activeClaims.map(claim => (_jsxs("li", { children: [memberName(claim.owner), " \u00B7 ", claim.direction] }, claim.claimRef))) })] });
                    })()] }), _jsx("section", { ref: timelineRef, onScroll: onTimelineScroll, className: css.timeline, "aria-label": t('timelineLabel'), children: _jsxs("div", { className: css.timelineContent, children: [loading && activeProjection === undefined && error === undefined && _jsx("div", { className: css.emptySurface, children: _jsxs("p", { className: css.loadingState, children: [_jsx("span", { className: css.loadingMark, "aria-hidden": "true" }), t('loadingThread')] }) }), activeProjection === undefined && error !== undefined && _jsxs("div", { className: css.errorState, role: "alert", children: [_jsx("span", { children: error }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => { void readCurrent(); }, children: t('retry') })] }), olderFacts.length > 0 && _jsxs("section", { className: threadCss.historySection, "aria-label": t('olderHistory'), children: [_jsx("h2", { children: t('olderHistory') }), renderFactBlocks(olderFacts, undefined, taskCards.filter(card => card.sequence < (currentFactsWithAnchor[0]?.sequence ?? Number.POSITIVE_INFINITY)))] }), historyHasMore && _jsx("div", { className: css.timelineAction, children: _jsx(Button, { size: "sm", onClick: () => { void loadOlder(); }, children: t('loadOlder') }) }), currentFactsWithAnchor.length > 0 && _jsx("section", { className: threadCss.publicSection, children: renderFactBlocks(currentFactsWithAnchor, unreadBoundary, taskCards.filter(card => card.sequence >= (currentFactsWithAnchor[0]?.sequence ?? 0))) }), autoReadExhausted && _jsxs("div", { className: css.timelineAction, role: "alert", children: [_jsx("span", { children: t('autoReadIncomplete') }), _jsx(Button, { size: "sm", onClick: retryAutoRead, disabled: loading, children: t('retry') })] }), newFactsCount > 0 && _jsx("div", { className: threadCss.newUpdates, role: "status", children: _jsx("button", { type: "button", className: threadCss.newUpdatesJump, onClick: jumpToNewest, children: t('newUpdatesJump', { count: newFactsCount }) }) })] }) }), activeProjection !== undefined && thread !== undefined ? (task?.resolution === 'closed'
                ? _jsxs("div", { className: threadCss.closedBar, "data-team-closed": true, children: [error !== undefined && _jsx("p", { className: css.error, role: "alert", children: error }), _jsxs("div", { className: threadCss.closedNotice, children: [_jsx("span", { children: t('taskClosedNotice') }), _jsx(Button, { size: "sm", variant: "outline", disabled: pending, onClick: () => { void mutateTask('reopen'); }, children: t('reopenTask') })] })] })
                : _jsx(TeamComposer, { members: members, followerMemberIds: followerIds, projectMemberIds: projectMemberIds, ownerMemberIds: projectOwnerIds, drafts: drafts, draftKey: draftKey, pending: pending, ...(error === undefined ? {} : { error }), onEdit: clearSendState, onSubmit: () => { void sendReply(); }, placeholder: t('replyPlaceholder'), pendingFiles: pendingFiles, onFilesChange: setPendingFiles, ...(replyTo === undefined ? {} : {
                        replyTo,
                        onCancelReply: () => { setReplyTarget(undefined); },
                    }), t: t }, draftKey)) : _jsx("div", {})] });
}
