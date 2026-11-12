import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { TeamAvatarFace } from "./TeamAvatarStack.js";
import { accountableLabel, accountableWord } from "./team-formatters.js";
import css from './owner-seat.module.css';
/**
 * One Task's accountable as the card, the board and the Thread page draw them: the 18px face the stack draws, then the
 * role word alone — `负责`, the reader as `你负责`, a suspended owner as `负责 · 已暂停` — because the face beside the
 * word already names the person, and a handle there made one Task's responsibility a third size of text on every line.
 *
 * The seat is one `role="img"`: the face is decoration and the short word is not a sentence, so the label carries the
 * full `负责人 @handle` that `accountableLabel` states and the same sentence is the hover `title`. A card's own
 * accessible name sets the same fact from the same function, so the short line never becomes the only description.
 */
export function TeamOwnerSeat({ owner, human, humanMemberId, t }) {
    const label = accountableLabel(owner, humanMemberId, t);
    return _jsxs("span", { className: css.seat, "data-team-owner": true, role: "img", "aria-label": label, title: label, children: [_jsx(TeamAvatarFace, { owner: owner, human: human }), _jsx("span", { className: css.standing, children: accountableWord(owner, humanMemberId, t) })] });
}
