import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAvatarImage } from "./avatar-image.js";
import { identityInitial, memberHue } from "./team-formatters.js";
import css from './avatar-stack.module.css';
/** Distinct owners past this count collapse into one `+N` chip. */
const MAX_VISIBLE = 3;
/** The Client's Human identity outranks the Host-projected name, so a rename moves label and initial together. */
export function namedAvatarOwners(owners, human) {
    if (human === undefined)
        return owners;
    return owners.map(owner => owner.memberId === human.memberId ? { memberId: owner.memberId, name: human.name } : owner);
}
/** The circles are presentational, so the stack is one `role="img"` whose label carries the whole roster. */
export function TeamAvatarStack({ owners, label, human }) {
    if (owners.length === 0)
        return null;
    const shown = owners.slice(0, MAX_VISIBLE);
    const overflow = owners.length - shown.length;
    return _jsxs("span", { className: css.stack, role: "img", "aria-label": label, children: [shown.map(owner => _jsx(TeamAvatarFace, { owner: owner, human: human }, owner.memberId)), overflow > 0 && _jsx("span", { className: css.overflow, children: `+${overflow}` })] });
}
/**
 * One face at the size a row draws people, so a stack's circles and a seat's person are the same mark. Only the Human
 * consults an image; undecodable bytes keep the initial.
 */
export function TeamAvatarFace({ owner, human }) {
    const image = useAvatarImage(human !== undefined && owner.memberId === human.memberId ? human.avatarUrl : undefined);
    const hue = { '--team-avatar-hue': memberHue(owner.memberId) };
    if (image.image.kind === 'initial')
        return _jsx("span", { className: css.avatar, style: hue, children: identityInitial(owner.name) });
    return _jsx("img", { className: css.avatarImage, style: hue, src: image.image.src, alt: "", "aria-hidden": "true", onError: image.failed });
}
