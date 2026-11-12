import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { TeamAvatarStack, namedAvatarOwners } from "./TeamAvatarStack.js";
import { TeamOwnerSeat } from "./TeamOwnerSeat.js";
import { TeamStateDot } from "./TeamStateDot.js";
import { accountableLabel, claimersBeyond, claimersLabel, formatAbsoluteTime, formatInboxTime, formatTaskStatus, plainGist, taskStatusDot } from "./team-formatters.js";
import streamCss from './main-stream.module.css';
/**
 * One Thread as a card: the current state of the Thread at the place its anchor was written, rebuilt from the Host's
 * projection on every read. It is the door itself, so it carries no separate row.
 *
 * One component serves every face that shows this projection — the Project's Main stream, a taskless discussion's side
 * panel, and the discussion's own Thread page — because a Task's status, owners or reply count must not depend on which
 * surface the reader happened to open it from.
 */
export function TeamThreadCard({ card, unread, human, humanMemberId, accountableOwner, t, onOpen }) {
    const task = card.task;
    const title = plainGist(card.anchor.preview);
    const resolved = task?.status === 'done' || task?.status === 'closed';
    const owners = namedAvatarOwners(task?.liveClaimOwners ?? [], human);
    // Only a seat that was actually drawn stands for its person; an unresolved owner keeps their face in the group.
    const executors = claimersBeyond(owners, accountableOwner === undefined ? undefined : task?.accountable);
    const replies = t('cardReplies', { count: card.replyCount });
    const people = card.participants.length === 0 || task !== undefined ? undefined : t('cardParticipants', { count: card.participants.length });
    const label = [
        task === undefined ? t('openDiscussionCard', { title }) : t('openTaskCard', { number: task.taskNumber, title }),
        task === undefined ? undefined : formatTaskStatus(task.status, t),
        accountableOwner === undefined ? undefined : accountableLabel(accountableOwner, humanMemberId, t),
        task === undefined || resolved ? undefined : owners.length === 0 ? t('taskAwaitingClaim') : claimersLabel(owners, t),
        replies,
        people,
        unread ? t('cardUnread') : undefined,
    ].filter((part) => part !== undefined).join(' · ');
    return _jsxs("button", { type: "button", className: streamCss.card, "data-main-card": task === undefined ? 'discussion' : 'task', ...(resolved ? { 'data-resolved': '' } : {}), "aria-label": label, onClick: onOpen, children: [_jsxs("span", { className: streamCss.cardHead, children: [_jsx("span", { className: streamCss.cardKind, children: task === undefined ? t('discussionLabel') : _jsxs(_Fragment, { children: [_jsx(TeamStateDot, { size: 8, state: taskStatusDot(task.status) }), t('taskLabel', { number: task.taskNumber })] }) }), task !== undefined && _jsx("span", { className: streamCss.cardStatus, children: formatTaskStatus(task.status, t) }), accountableOwner !== undefined && _jsx(TeamOwnerSeat, { owner: accountableOwner, human: human, humanMemberId: humanMemberId, t: t }), task !== undefined && !resolved && owners.length === 0 && _jsx("span", { children: t('taskAwaitingClaim') }), task !== undefined && !resolved && executors.length > 0 && _jsxs("span", { className: streamCss.cardExecutor, children: [_jsx(TeamAvatarStack, { owners: executors, label: claimersLabel(executors, t), human: human }), _jsx("span", { children: t('taskClaimRole') })] }), _jsxs("span", { className: streamCss.cardMeta, children: [_jsx("span", { children: replies }), people !== undefined && _jsx("span", { children: people }), _jsx("time", { dateTime: card.newestOccurredAt, title: formatAbsoluteTime(card.newestOccurredAt), children: formatInboxTime(card.newestOccurredAt, t) })] })] }), _jsx("span", { className: streamCss.cardTitle, children: title })] });
}
