import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MarkdownText, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import { cachedAttachmentDataUrl, formatByteSize, invalidateAttachmentDataUrl, loadAttachmentPreview } from "./attachment-preview.js";
import { copyText } from "./clipboard.js";
import { cachedResolvedTaskRef, resolveUnknownTaskRefs, useResolvedTaskRefVersion } from "./refs.js";
import { cachedResolvedThreadRef, resolveUnknownThreadRefs, useResolvedThreadRefVersion } from "./refs.js";
import { bodyMentionsHuman, formatAbsoluteTime, formatClockTime, formatMessageTime, identityInitial, isSingleBrandedRef, memberHue, plainGist, planMessageBody, shouldClampMessage, splitBrandedRefs, splitMentionNames, unshownMentionNames } from "./team-formatters.js";
import { useAvatarImage } from "./avatar-image.js";
import css from './conversation.module.css';
/**
 * A Thread chip shares its line with prose, so the title it cites is bounded
 * tighter than a card's; the projection happens first, so the cut never lands
 * inside a marker pair.
 */
const THREAD_CHIP_TITLE_MAX_CHARACTERS = 40;
/**
 * One chat message row. Memoized: the Task-ref subscription lives inside this component, so a skipped render never
 * detaches it. Callers must keep per-render props (mention names, ref callbacks) identity-stable.
 */
export const TeamMessage = memo(function TeamMessage({ senderName, memberId, human, avatarUrl, body, occurredAt, mentionNames, senderTitle, grouped, readerName, replyTo, onReply, onOpenReplyTo, rowActions, messageRef, replyTarget, replyFlash, showGroupedTime, cardOpen, onToggleCard, attachments, loadAttachment, t, onOpenRef, onResolveTaskRefs, onResolveThreadRefs, projectNameOf, memberOf, onOpenMemberSession, children }) {
    const avatarStyle = human ? undefined : { '--team-avatar-hue': memberHue(memberId) };
    const identityImage = useAvatarImage(human ? avatarUrl : undefined);
    // The stored body carries machine-facing `[attachment] <path>` prompt lines; the attachment strip renders from message metadata instead.
    // Literal bodies chip mentions inline; rich Markdown keeps unmatched structured mentions in the trailing row.
    const plan = planMessageBody(body, { human, ...(mentionNames === undefined ? {} : { mentionNames }), canOpenRefs: onOpenRef !== undefined });
    // The chip names what the body names, not what the Host delivered to: a Thread reaches its Human in every row.
    const mentionedInBody = bodyMentionsHuman(body, readerName);
    // The fallback row omits the reader's own name and the author the quote line already names.
    const quoteAuthor = replyTo === undefined ? undefined : replyTo.senderName.replace(/^@/, '');
    const fallbackNames = unshownMentionNames(plan.fallbackNames, readerName, quoteAuthor);
    const displayBody = plan.displayBody;
    const quoteExcerpt = replyTo === undefined ? undefined : plainGist(replyTo.excerpt);
    const { markdownRef, markdownLabels, taskLabel, renderRefs } = useResolvedBodyRefs({
        plan,
        mentionNames,
        onOpenRef,
        onOpenMemberSession,
        onResolveTaskRefs,
        onResolveThreadRefs,
        projectNameOf,
        memberOf,
        t,
    });
    const [expanded, setExpanded] = useState(false);
    const [copyState, setCopyState] = useState('idle');
    useEffect(() => {
        if (copyState === 'idle')
            return;
        const timer = setTimeout(() => { setCopyState('idle'); }, 1200);
        return () => { clearTimeout(timer); };
    }, [copyState]);
    // Copy the stored Markdown, not the rendered text. A refused write is reported on the card: silence would read as
    // an untouched button, which is the one thing a reader cannot tell apart from a copy that never happened.
    const copyMessage = useCallback(() => {
        void copyText(body).then(copied => { setCopyState(copied ? 'copied' : 'failed'); });
    }, [body]);
    // A touch surface has no hover, so a tap opens the card; a press on the card itself never toggles it.
    const toggleCard = useCallback((event) => {
        if (onToggleCard === undefined || messageRef === undefined)
            return;
        const target = event.target;
        if (target instanceof Element && target.closest('[data-message-card], button, a[href]') !== null)
            return;
        onToggleCard(messageRef);
    }, [messageRef, onToggleCard]);
    const clampable = shouldClampMessage(displayBody);
    const clamped = clampable && !expanded;
    const bodyNode = plan.render === 'inline' && plan.inline !== undefined
        ? _jsx("div", { className: css.messageText, children: plan.inline.segments.map((segment, index) => segment.mention
                ? _jsx("span", { className: css.mention, "data-mention-chip": "", children: segment.text }, index)
                : _jsx(Fragment, { children: renderRefs(segment.text) }, index)) })
        : plan.render === 'literal'
            ? _jsx("div", { className: css.messageText, children: onOpenRef === undefined ? displayBody : renderRefs(displayBody) })
            : _jsx("div", { ref: markdownRef, className: css.messageMarkdown, children: _jsx(MarkdownText, { text: displayBody, labels: markdownLabels }, `${displayBody}:${onOpenRef === undefined ? 'literal' : 'refs'}`) });
    // The action's own word is the outcome: copied, refused, or still offering the copy.
    const copyLabel = copyState === 'copied'
        ? (t?.('copiedMessage') ?? 'Copied')
        : copyState === 'failed' ? (t?.('copyMessageFailed') ?? 'Copy failed') : (t?.('copyMessage') ?? 'Copy');
    return (_jsxs("article", { className: css.messageRow, "data-human": human || undefined, "data-grouped": grouped || undefined, "data-mentions-me": mentionedInBody || undefined, "data-message-ref": messageRef, "data-replying-to": replyTarget || undefined, "data-reply-flash": replyFlash || undefined, "data-card-open": cardOpen || undefined, onClick: onToggleCard === undefined ? undefined : toggleCard, children: [identityImage.image.kind === 'initial'
                ? _jsx("div", { className: css.messageIdentity, "data-avatar": "initial", style: avatarStyle, "aria-hidden": "true", children: identityInitial(senderName) })
                : _jsx("img", { className: css.messageIdentityImage, "data-avatar": "image", src: identityImage.image.src, alt: "", "aria-hidden": "true", onError: identityImage.failed }), grouped === true && showGroupedTime === true && occurredAt !== undefined && _jsx("span", { className: css.gutterTime, "data-gutter-time": "", "aria-hidden": "true", title: formatAbsoluteTime(occurredAt), children: formatClockTime(occurredAt) }), _jsxs("div", { className: css.messageBody, children: [!grouped && (_jsxs("div", { className: css.nameRow, children: [_jsx("strong", { ...(senderTitle === undefined ? {} : { title: senderTitle }), children: senderName }), occurredAt !== undefined && _jsx("span", { className: css.messageTime, children: formatMessageTime(occurredAt) })] })), replyTo !== undefined && (onOpenReplyTo === undefined
                        ? _jsxs("span", { className: css.quoteLine, "data-quote-line": "", children: [_jsx("span", { className: css.quoteLineBar, "aria-hidden": "true" }), _jsxs("span", { className: css.quoteLineBody, children: [_jsx("span", { className: css.quoteLineAuthor, children: replyTo.senderName }), _jsx("span", { className: css.quoteLineText, children: quoteExcerpt })] })] })
                        : _jsxs("button", { type: "button", className: css.quoteLine, "data-quote-line": "", onClick: () => { onOpenReplyTo(replyTo.messageRef); }, title: t?.('openRepliedMessage') ?? 'Go to the quoted message', children: [_jsx("span", { className: css.quoteLineBar, "aria-hidden": "true" }), _jsxs("span", { className: css.quoteLineBody, children: [_jsx("span", { className: css.quoteLineAuthor, children: replyTo.senderName }), _jsx("span", { className: css.quoteLineText, children: quoteExcerpt })] })] })), clampable ? _jsx("div", { "data-document": "", className: clamped ? css.messageClamp : undefined, children: bodyNode }) : bodyNode, clampable && (_jsx("button", { type: "button", className: css.messageExpand, "data-message-expand": "true", "aria-expanded": expanded, onClick: () => { setExpanded(value => !value); }, children: expanded ? (t?.('collapseMessage') ?? 'Show less') : (t?.('expandMessage') ?? 'Show more') })), (fallbackNames.length > 0 || plan.fallbackRefs.length > 0) && (_jsxs("div", { className: css.mentionsRow, children: [fallbackNames.map(name => _jsxs("span", { className: css.mention, "data-mention-chip": "", children: ["@", name] }, name)), plan.fallbackRefs.map(ref => {
                                const resolved = cachedResolvedTaskRef(ref);
                                const label = resolved !== undefined && ref.startsWith('task:') ? taskLabel(resolved.taskNumber) : ref;
                                return _jsx("button", { type: "button", className: css.refLink, title: ref, onClick: () => { onOpenRef(ref); }, children: label }, ref);
                            })] })), attachments !== undefined && attachments.length > 0 && _jsx(TeamAttachmentStrip, { attachments: attachments, ...(loadAttachment === undefined ? {} : { loadAttachment }), ...(t === undefined ? {} : { t }) }), children] }), (rowActions !== 'never' && (rowActions === 'always' || onReply !== undefined)) && _jsxs("div", { className: css.messageCard, "data-message-card": "", children: [mentionedInBody && _jsx("span", { className: css.cardMention, "data-mentions-you": "", children: t?.('mentionsMe') ?? 'Mentioned you' }), _jsx("button", { type: "button", className: css.cardAction, "data-copy-message": "", onClick: copyMessage, "aria-label": t?.('copyMessageLabel') ?? 'Copy this message', children: copyLabel }), onReply !== undefined && _jsx("button", { type: "button", className: css.cardAction, "data-quote-message": "", onClick: () => { if (messageRef !== undefined)
                            onReply(messageRef); }, "aria-label": t?.('replyToMessage') ?? 'Quote this message', children: t?.('replyMessage') ?? 'Quote' }), _jsx("span", { className: css.cardStatus, role: "status", "aria-live": "polite", children: copyState === 'idle' ? '' : copyLabel })] })] }));
});
/** Kept inside the component so the Task-ref subscription of a memoized row never detaches. */
function useResolvedBodyRefs({ plan, mentionNames, onOpenRef, onOpenMemberSession, onResolveTaskRefs, onResolveThreadRefs, projectNameOf, memberOf, t }) {
    const { richAgentBody } = plan;
    const taskRefVersion = useResolvedTaskRefVersion();
    const threadRefVersion = useResolvedThreadRefVersion();
    const bodyTaskRefs = plan.taskRefs;
    const bodyTaskRefKey = bodyTaskRefs.join(',');
    const bodyThreadRefs = plan.threadRefs;
    const bodyThreadRefKey = bodyThreadRefs.join(',');
    useEffect(() => {
        if (onResolveTaskRefs !== undefined && bodyTaskRefKey !== '')
            void resolveUnknownTaskRefs(bodyTaskRefs, onResolveTaskRefs);
        if (onResolveThreadRefs !== undefined && bodyThreadRefKey !== '')
            void resolveUnknownThreadRefs(bodyThreadRefs, onResolveThreadRefs);
    }, [onResolveTaskRefs, onResolveThreadRefs, bodyTaskRefKey, bodyThreadRefKey, taskRefVersion, threadRefVersion]);
    const taskLabel = useCallback((taskNumber) => t?.('taskLabel', { number: taskNumber }) ?? `Task #${taskNumber}`, [t]);
    // Unresolvable refs never reach this label; they stay plain text (see renderRefs).
    const threadChipLabel = useCallback((title) => {
        const base = t?.('threadLabel') ?? 'Thread';
        const projected = plainGist(title, THREAD_CHIP_TITLE_MAX_CHARACTERS);
        return projected === '' ? base : `${base} · ${projected}`;
    }, [t]);
    // Member chips use a handle, deliberately distinct from `@mention` chips, which notify.
    const projectChipLabel = useCallback((name) => t?.('projectLabel', { name }) ?? `Project · ${name}`, [t]);
    const memberChipLabel = useCallback((name) => t?.('memberLabel', { name }) ?? `Member · @${name}`, [t]);
    // Stable per locale revision: a fresh object per render would rebuild the component table every chunk.
    const markdownLabels = useMemo(() => ({
        code: { copyLabel: t?.('copyCode') ?? 'Copy', copiedLabel: t?.('copiedCode') ?? 'Copied' },
        footnotes: t?.('markdownFootnotes') ?? 'Footnotes',
    }), [t]);
    const markdownRef = useRef(null);
    useLayoutEffect(() => {
        const root = markdownRef.current;
        if (!richAgentBody || root === null || onOpenRef === undefined)
            return;
        const textNodes = markdownProseTextNodes(root);
        const styledRefCodes = markdownStyledRefCodeElements(root);
        const taskRefs = [...new Set([...textNodes.map(node => node.data), ...styledRefCodes.map(code => code.textContent ?? '')]
                .flatMap(text => splitBrandedRefs(text)
                .filter(segment => segment.ref?.startsWith('task:') === true)
                .map(segment => segment.ref)))];
        const threadRefs = [...new Set([...textNodes.map(node => node.data), ...styledRefCodes.map(code => code.textContent ?? '')]
                .flatMap(text => splitBrandedRefs(text)
                .filter(segment => segment.ref?.startsWith('thread:') === true)
                .map(segment => segment.ref)))];
        if (onResolveTaskRefs !== undefined && taskRefs.length > 0)
            void resolveUnknownTaskRefs(taskRefs, onResolveTaskRefs);
        if (onResolveThreadRefs !== undefined && threadRefs.length > 0)
            void resolveUnknownThreadRefs(threadRefs, onResolveThreadRefs);
        for (const code of styledRefCodes)
            renderResolvedMarkdownCodeRef(code, taskLabel, threadChipLabel, projectChipLabel, memberChipLabel, projectNameOf, memberOf);
        for (const node of textNodes)
            renderResolvedMarkdownText(node, mentionNames ?? [], taskLabel, threadChipLabel, projectChipLabel, memberChipLabel, projectNameOf, memberOf);
        for (const button of root.querySelectorAll('button[data-task-ref]')) {
            const taskRef = button.dataset.taskRef;
            const hit = taskRef === undefined ? undefined : cachedResolvedTaskRef(taskRef);
            if (taskRef !== undefined && hit !== undefined)
                button.textContent = taskLabel(hit.taskNumber);
        }
        for (const button of root.querySelectorAll('button[data-thread-ref]')) {
            const threadRef = button.dataset.threadRef;
            const hit = threadRef === undefined ? undefined : cachedResolvedThreadRef(threadRef);
            if (threadRef !== undefined && hit !== undefined)
                button.textContent = threadChipLabel(hit.title);
        }
    }, [richAgentBody, onOpenRef, onResolveTaskRefs, onResolveThreadRefs, taskRefVersion, threadRefVersion, taskLabel, threadChipLabel, projectChipLabel, memberChipLabel, projectNameOf, memberOf, mentionNames]);
    useEffect(() => {
        const root = markdownRef.current;
        if (!richAgentBody || root === null || onOpenRef === undefined)
            return;
        const openTask = (event) => {
            const target = event.target;
            if (!(target instanceof Element))
                return;
            const button = target.closest('button[data-ref], button[data-task-ref], button[data-thread-ref], button[data-member-session]');
            if (button === null || !root.contains(button))
                return;
            if (button instanceof HTMLElement) {
                const sessionId = button.dataset.memberSession;
                if (sessionId !== undefined) {
                    onOpenMemberSession?.(sessionId);
                    return;
                }
                const ref = button.dataset.ref ?? button.dataset.taskRef ?? button.dataset.threadRef;
                if (ref !== undefined)
                    onOpenRef(ref);
            }
        };
        root.addEventListener('click', openTask);
        return () => { root.removeEventListener('click', openTask); };
    }, [richAgentBody, onOpenRef, onOpenMemberSession]);
    const renderRefs = useCallback((text) => renderRefsFromText(text, onOpenRef, onOpenMemberSession, taskLabel, threadChipLabel, projectChipLabel, memberChipLabel, projectNameOf, memberOf), [onOpenRef, onOpenMemberSession, taskLabel, threadChipLabel, projectChipLabel, memberChipLabel, projectNameOf, memberOf]);
    return { markdownRef, markdownLabels, taskLabel, renderRefs };
}
function markdownProseTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (parent === null)
            continue;
        if (parent.closest('code, pre, a, button') !== null)
            continue;
        // Skip text already chipped by an earlier pass, or each rerun wraps another chip around the last.
        if (css.mention !== undefined && parent.closest(`[class~="${css.mention}"]`) !== null)
            continue;
        nodes.push(node);
    }
    return nodes;
}
/** Code spans whose entire content is one branded ref: model styling around a ref, not code. */
function markdownStyledRefCodeElements(root) {
    const elements = [];
    for (const code of root.querySelectorAll('code')) {
        if (code.closest('pre, a, button') !== null)
            continue;
        if (!isSingleBrandedRef(code.textContent ?? ''))
            continue;
        elements.push(code);
    }
    return elements;
}
function resolvedTaskRefButton(taskRef, label) {
    const button = document.createElement('button');
    button.type = 'button';
    if (css.refLink !== undefined)
        button.className = css.refLink;
    button.dataset.taskRef = taskRef;
    button.title = taskRef;
    button.textContent = label;
    return button;
}
function resolvedThreadRefButton(threadRef, label) {
    const button = document.createElement('button');
    button.type = 'button';
    if (css.refLink !== undefined)
        button.className = css.refLink;
    button.dataset.threadRef = threadRef;
    button.title = threadRef;
    button.textContent = label;
    return button;
}
function resolvedProjectRefButton(projectRef, label) {
    const button = document.createElement('button');
    button.type = 'button';
    if (css.refLink !== undefined)
        button.className = css.refLink;
    button.dataset.ref = projectRef;
    button.title = projectRef;
    button.textContent = label;
    return button;
}
/** Openable Members jump to their session through the delegated click listener; others get an inert span. */
function resolvedMemberRefChip(memberRef, label, sessionId) {
    if (sessionId === undefined) {
        const span = document.createElement('span');
        span.title = memberRef;
        span.textContent = label;
        return span;
    }
    const button = document.createElement('button');
    button.type = 'button';
    if (css.refLink !== undefined)
        button.className = css.refLink;
    button.dataset.memberSession = sessionId;
    button.title = memberRef;
    button.textContent = label;
    return button;
}
function renderResolvedMarkdownCodeRef(code, taskLabel, threadChipLabel, projectChipLabel, memberChipLabel, projectNameOf, memberOf) {
    const segments = splitBrandedRefs((code.textContent ?? '').trim());
    const segment = segments.length === 1 ? segments[0] : undefined;
    const ref = segment?.ref;
    if (ref === undefined)
        return;
    // Task and Thread refs need Host resolution; Project and Member refs resolve against loaded rosters; unknown refs stay plain text.
    if (ref.startsWith('task:')) {
        const resolved = cachedResolvedTaskRef(ref);
        if (resolved === undefined)
            return;
        code.replaceWith(resolvedTaskRefButton(ref, taskLabel(resolved.taskNumber)));
        return;
    }
    if (ref.startsWith('thread:')) {
        const resolved = cachedResolvedThreadRef(ref);
        if (resolved === undefined)
            return;
        code.replaceWith(resolvedThreadRefButton(ref, threadChipLabel(resolved.title)));
        return;
    }
    if (ref.startsWith('project:')) {
        const name = projectNameOf?.(ref);
        if (name === undefined)
            return;
        code.replaceWith(resolvedProjectRefButton(ref, projectChipLabel(name)));
        return;
    }
    if (ref.startsWith('member:')) {
        const resolved = memberOf?.(ref);
        if (resolved === undefined)
            return;
        code.replaceWith(resolvedMemberRefChip(ref, memberChipLabel(resolved.handle), resolved.openable ? resolved.sessionId : undefined));
    }
}
/** Replace resolved Task/Thread/Project/Member refs and structured mention handles in one prose text node without changing Markdown structure. */
function renderResolvedMarkdownText(node, mentionNames, taskLabel, threadChipLabel, projectChipLabel, memberChipLabel, projectNameOf, memberOf) {
    let changed = false;
    const fragment = document.createDocumentFragment();
    for (const refSegment of splitBrandedRefs(node.data)) {
        if (refSegment.ref === undefined) {
            for (const mentionSegment of splitMentionNames(refSegment.text, mentionNames).segments) {
                if (!mentionSegment.mention) {
                    fragment.append(mentionSegment.text);
                    continue;
                }
                changed = true;
                const chip = document.createElement('span');
                if (css.mention !== undefined)
                    chip.className = css.mention;
                chip.setAttribute('data-mention-chip', '');
                chip.textContent = mentionSegment.text;
                fragment.append(chip);
            }
            continue;
        }
        if (refSegment.ref.startsWith('task:')) {
            const resolved = cachedResolvedTaskRef(refSegment.ref);
            if (resolved === undefined) {
                fragment.append(refSegment.text);
                continue;
            }
            changed = true;
            fragment.append(resolvedTaskRefButton(refSegment.ref, taskLabel(resolved.taskNumber)));
        }
        else if (refSegment.ref.startsWith('thread:')) {
            const resolved = cachedResolvedThreadRef(refSegment.ref);
            if (resolved === undefined) {
                fragment.append(refSegment.text);
                continue;
            }
            changed = true;
            fragment.append(resolvedThreadRefButton(refSegment.ref, threadChipLabel(resolved.title)));
        }
        else if (refSegment.ref.startsWith('project:')) {
            const name = projectNameOf?.(refSegment.ref);
            if (name === undefined) {
                fragment.append(refSegment.text);
                continue;
            }
            changed = true;
            fragment.append(resolvedProjectRefButton(refSegment.ref, projectChipLabel(name)));
        }
        else if (refSegment.ref.startsWith('member:')) {
            const resolved = memberOf?.(refSegment.ref);
            if (resolved === undefined) {
                fragment.append(refSegment.text);
                continue;
            }
            changed = true;
            fragment.append(resolvedMemberRefChip(refSegment.ref, memberChipLabel(resolved.handle), resolved.openable ? resolved.sessionId : undefined));
        }
        else {
            fragment.append(refSegment.text);
        }
    }
    if (changed)
        node.replaceWith(fragment);
}
function renderRefsFromText(text, onOpenRef, onOpenMemberSession, taskLabel, threadChipLabel, projectChipLabel, memberChipLabel, projectNameOf, memberOf) {
    if (onOpenRef === undefined)
        return text;
    return splitBrandedRefs(text).map((segment, index) => {
        if (segment.ref === undefined)
            return _jsx(Fragment, { children: segment.text }, index);
        if (segment.ref.startsWith('task:')) {
            const resolved = cachedResolvedTaskRef(segment.ref);
            if (resolved === undefined)
                return _jsx(Fragment, { children: segment.text }, index);
            return _jsx("button", { type: "button", className: css.refLink, title: segment.ref, onClick: () => { onOpenRef(segment.ref); }, children: taskLabel(resolved.taskNumber) }, index);
        }
        if (segment.ref.startsWith('thread:')) {
            const resolved = cachedResolvedThreadRef(segment.ref);
            if (resolved === undefined)
                return _jsx(Fragment, { children: segment.text }, index);
            return _jsx("button", { type: "button", className: css.refLink, title: segment.ref, onClick: () => { onOpenRef(segment.ref); }, children: threadChipLabel(resolved.title) }, index);
        }
        if (segment.ref.startsWith('project:')) {
            const name = projectNameOf?.(segment.ref);
            if (name === undefined)
                return _jsx(Fragment, { children: segment.text }, index);
            return _jsx("button", { type: "button", className: css.refLink, title: segment.ref, onClick: () => { onOpenRef(segment.ref); }, children: projectChipLabel(name) }, index);
        }
        if (segment.ref.startsWith('member:')) {
            const resolved = memberOf?.(segment.ref);
            if (resolved === undefined)
                return _jsx(Fragment, { children: segment.text }, index);
            // Known but not openable (suspended Members, the Human): a labelled span that promises no jump.
            if (!resolved.openable || resolved.sessionId === undefined || onOpenMemberSession === undefined) {
                return _jsx("span", { title: segment.ref, children: memberChipLabel(resolved.handle) }, index);
            }
            const sessionId = resolved.sessionId;
            return _jsx("button", { type: "button", className: css.refLink, title: segment.ref, onClick: () => { onOpenMemberSession(sessionId); }, children: memberChipLabel(resolved.handle) }, index);
        }
        return _jsx(Fragment, { children: segment.text }, index);
    });
}
function TeamAttachmentStrip({ attachments, loadAttachment, t }) {
    const [zoomed, setZoomed] = useState();
    return _jsxs("div", { className: css.attachmentStrip, children: [attachments.map(attachment => _jsx(TeamAttachment, { attachment: attachment, ...(loadAttachment === undefined ? {} : { loadAttachment }), ...(t === undefined ? {} : { t }), onZoom: (dataUrl) => { setZoomed({ attachment, dataUrl }); } }, attachment.attachmentId)), zoomed !== undefined && _jsx(Modal, { open: true, ...(css.attachmentModal === undefined ? {} : { className: css.attachmentModal }), title: zoomed.attachment.name, closeLabel: t?.('close') ?? 'Close', onClose: () => { setZoomed(undefined); }, children: _jsx("img", { className: css.attachmentZoom, src: zoomed.dataUrl, alt: zoomed.attachment.name }) })] });
}
function TeamAttachment({ attachment, loadAttachment, t, onZoom }) {
    const wantsPreview = loadAttachment !== undefined && attachment.mediaType.startsWith('image/');
    const cached = wantsPreview ? cachedAttachmentDataUrl(attachment.attachmentId) : undefined;
    const [preview, setPreview] = useState(() => cached === undefined ? { kind: 'loading' } : { kind: 'decoding', dataUrl: cached });
    const chipRef = useRef(null);
    const thumbRef = useRef(null);
    const retryRef = useRef(null);
    const retryPending = useRef(false);
    useEffect(() => {
        if (!wantsPreview || preview.kind !== 'loading')
            return;
        let mounted = true;
        void loadAttachmentPreview(loadAttachment, attachment).then(outcome => {
            if (!mounted)
                return;
            setPreview(outcome.kind === 'ready' ? { kind: 'decoding', dataUrl: outcome.dataUrl } : outcome.kind === 'missing' ? { kind: 'missing' } : { kind: 'failed' });
        });
        return () => { mounted = false; };
    }, [attachment, loadAttachment, preview.kind, wantsPreview]);
    useEffect(() => {
        if (!retryPending.current)
            return;
        if (preview.kind === 'ready') {
            retryPending.current = false;
            thumbRef.current?.focus();
        }
        else if (preview.kind === 'failed') {
            retryPending.current = false;
            retryRef.current?.focus();
        }
        else if (preview.kind === 'missing') {
            retryPending.current = false;
            chipRef.current?.focus();
        }
        else if (preview.kind === 'loading' || preview.kind === 'decoding') {
            chipRef.current?.focus();
        }
    }, [preview.kind]);
    const expired = t?.('attachmentExpired') ?? 'File no longer cached';
    if (wantsPreview && preview.kind === 'ready') {
        return _jsx("button", { ref: thumbRef, type: "button", className: css.attachmentThumb, "aria-label": t?.('viewImage', { name: attachment.name }) ?? attachment.name, title: attachment.name, onClick: () => { onZoom(preview.dataUrl); }, children: _jsx("img", { src: preview.dataUrl, alt: attachment.name, onError: () => {
                    invalidateAttachmentDataUrl(attachment.attachmentId);
                    retryPending.current = true;
                    setPreview({ kind: 'failed' });
                } }) });
    }
    const imageStatus = preview.kind === 'missing'
        ? expired
        : preview.kind === 'failed'
            ? t?.('attachmentUnavailable') ?? 'Image unavailable'
            : t?.('attachmentLoading') ?? 'Loading image';
    return _jsxs("span", { ref: chipRef, tabIndex: wantsPreview ? -1 : undefined, "aria-live": wantsPreview ? 'polite' : undefined, className: css.attachmentChip, title: wantsPreview ? `${attachment.name} · ${imageStatus}` : `${attachment.name} · ${formatByteSize(attachment.byteSize)}`, children: [_jsx("span", { className: css.attachmentChipName, children: attachment.name }), _jsx("span", { className: css.attachmentChipSize, children: wantsPreview ? imageStatus : formatByteSize(attachment.byteSize) }), preview.kind === 'decoding' && _jsx("img", { className: css.attachmentDecodeProbe, src: preview.dataUrl, alt: "", "aria-hidden": true, onLoad: () => { setPreview({ kind: 'ready', dataUrl: preview.dataUrl }); }, onError: () => {
                    invalidateAttachmentDataUrl(attachment.attachmentId);
                    retryPending.current = true;
                    setPreview({ kind: 'failed' });
                } }), preview.kind === 'failed' && _jsx("button", { ref: retryRef, type: "button", className: css.attachmentRetry, onClick: () => {
                    retryPending.current = true;
                    setPreview({ kind: 'loading' });
                }, children: t?.('attachmentRetry') ?? 'Retry reading' })] });
}
