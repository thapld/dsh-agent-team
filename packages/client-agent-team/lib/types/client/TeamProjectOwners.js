import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { IconQuestionOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamMemberRow } from "./TeamMemberRow.js";
import { HUMAN_MEMBER_ID, identityInitial, memberHue } from "./team-formatters.js";
import { useAvatarImage } from "./avatar-image.js";
import { mintRequestId } from "./requests.js";
import { useHumanIdentity } from "./human-identity.js";
import createCss from './create.module.css';
import rowCss from './member-row.module.css';
import sidebarCss from './sidebar.module.css';
/** The Human owns every Project and is fixed; Agent owners are written through the Host and appear only after the projection refresh. */
export function TeamProjectOwners({ project, members, ownerIds, addProjectOwner, removeProjectOwner, humanIdentity, onCommitted, t }) {
    const identity = useHumanIdentity(humanIdentity);
    const humanName = identity.name ?? t('human');
    const humanImage = useAvatarImage(identity.avatarUrl);
    const [pending, setPending] = useState();
    const [error, setError] = useState();
    const owners = members.filter(status => ownerIds.has(status.member.memberId));
    const eligible = members.filter(status => !ownerIds.has(status.member.memberId)
        && (status.member.state === 'enabled' || status.member.state === 'suspended')
        && status.workspaceIds.includes(project.workspaceId));
    const write = async (write, status) => {
        if (pending !== undefined)
            return;
        setPending(status.member.memberId);
        setError(undefined);
        try {
            const result = await write({
                requestId: mintRequestId(),
                workspaceId: project.workspaceId,
                projectRef: project.projectRef,
                memberId: status.member.memberId,
            });
            if (result.ok)
                await onCommitted();
            else
                setError(result.error.message);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setPending(undefined);
        }
    };
    const action = (kind, status) => {
        const handle = status.member.handle.replace(/^@/, '');
        return {
            label: pending === status.member.memberId ? t('projectOwnerPending') : t(`projectOwner${kind}`),
            ariaLabel: t(`projectOwner${kind}Label`, { handle }),
            disabled: pending !== undefined,
            onSelect: () => { void write(kind === 'Add' ? addProjectOwner : removeProjectOwner, status); },
        };
    };
    return (_jsxs("div", { className: createCss.ownersSection, role: "group", "aria-label": t('projectOwners'), "data-team-project-owners": true, children: [_jsxs("span", { className: createCss.sectionLabel, children: [t('projectOwners'), _jsx(Tooltip, { label: t('projectOwnerHelp'), side: "right", delayMs: 200, portal: true, maxWidth: 280, children: _jsx("button", { type: "button", className: createCss.sectionHint, "aria-label": t('projectOwnerHelpLabel'), children: _jsx(IconQuestionOutlineRegular, { size: 12 }) }) })] }), _jsxs("div", { className: createCss.roster, children: [_jsxs("div", { className: rowCss.row, "data-team-project-owner-human": true, children: [_jsx("span", { className: sidebarCss.agentAvatar, style: { '--team-avatar-hue': memberHue(HUMAN_MEMBER_ID), overflow: 'hidden' }, "aria-hidden": "true", children: humanImage.image.kind === 'image'
                                    ? _jsx("img", { src: humanImage.image.src, alt: "", width: 34, height: 34, onError: humanImage.failed })
                                    : identityInitial(humanName) }), _jsxs("span", { className: rowCss.copy, children: [_jsx("strong", { children: humanName }), _jsx("small", { children: t('projectOwnerHumanHint') })] })] }), owners.map(status => _jsx(TeamMemberRow, { status: status, t: t, action: action('Remove', status) }, status.member.memberId))] }), _jsx("span", { className: createCss.sectionLabel, children: t('projectOwnersAddable') }), eligible.length === 0
                ? _jsx("p", { className: createCss.state, children: t('projectOwnersNoneEligible') })
                : _jsx("div", { className: createCss.roster, children: eligible.map(status => _jsx(TeamMemberRow, { status: status, t: t, action: action('Add', status) }, status.member.memberId)) }), error !== undefined && _jsx("p", { className: createCss.error, role: "alert", children: error })] }));
}
