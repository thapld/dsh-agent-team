import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { namedAvatarOwners, TeamAvatarStack } from "./TeamAvatarStack.js";
import { TeamOwnerSeat } from "./TeamOwnerSeat.js";
import { claimersBeyond, claimersLabel, formatAbsoluteTime, formatInboxTime } from "./team-formatters.js";
import css from './project.module.css';
/**
 * The one foot every Task card wears: who owns the outcome, who is executing it, and when.
 *
 * The two roles take two shapes because their counts differ: the accountable is exactly one person, drawn as the
 * `TeamOwnerSeat` every other face draws them with; executors are 0–N people read at a glance, so they are the avatar
 * stack under their own caption — the claimants other than the accountable, who is already drawn at the seat. Once the
 * Task is resolved nobody is executing it, so the executor slot is dropped rather than replaced with an "unassigned" word.
 */
export function BoardCardFoot({ item, human, humanMemberId, t }) {
    const task = item.task;
    const resolved = task.status === 'done' || task.status === 'closed';
    const claimers = namedAvatarOwners(item.liveClaimOwners, human);
    const executors = claimersBeyond(claimers, task.accountable);
    return _jsxs("span", { className: css.boardCardFoot, children: [_jsx(TeamOwnerSeat, { owner: item.accountableOwner, human: human, humanMemberId: humanMemberId, t: t }), !resolved && (claimers.length === 0
                ? _jsx("span", { className: css.boardCardAwaiting, children: t('taskAwaitingClaim') })
                : executors.length > 0 && _jsxs("span", { className: css.boardCardExecutor, children: [_jsx(TeamAvatarStack, { owners: executors, label: claimersLabel(executors, t), human: human }), _jsx("span", { className: css.boardCardRole, children: t('taskClaimRole') })] })), _jsx("time", { dateTime: item.lastActivityAt, title: formatAbsoluteTime(item.lastActivityAt), children: formatInboxTime(item.lastActivityAt, t) })] });
}
