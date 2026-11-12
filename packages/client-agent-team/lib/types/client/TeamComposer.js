import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { startsMentionAt } from '@contexera/dsh-agent-team/mentions';
import { IconPaperclipOutlineMedium, IconSendOutlineRegular, Tooltip, useAnchoredMaxHeight, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamPresenceDot } from "./TeamPresenceDot.js";
import { buildMentionGroups, enrollmentIds, mentionSurfaceOf } from "./mention-presentation.js";
import { HUMAN_MEMBER_ID, mentionedMemberIds, plainGist } from "./team-formatters.js";
import css from './composer.module.css';
import { formatByteSize } from "./attachment-preview.js";
function findMention(draft, caret) {
    const beforeCaret = draft.slice(0, caret);
    if (beforeCaret.length === 0 || /\s/u.test(beforeCaret.at(-1) ?? ''))
        return undefined;
    let tokenStart = beforeCaret.length;
    while (tokenStart > 0 && !/\s/u.test(beforeCaret[tokenStart - 1]))
        tokenStart -= 1;
    const at = beforeCaret.lastIndexOf('@');
    if (at < tokenStart)
        return undefined;
    // The picker opens exactly where delivery reads a call, so a pick never lands
    // as text the Host would keep prose.
    if (!startsMentionAt(draft, at))
        return undefined;
    return { start: at, end: caret, query: beforeCaret.slice(at + 1) };
}
/** One object URL per draft file; revoked when the draft file is removed. */
const draftPreviewUrls = new WeakMap();
function draftPreviewUrl(file) {
    if (!file.type.startsWith('image/'))
        return undefined;
    let url = draftPreviewUrls.get(file);
    if (url === undefined) {
        url = URL.createObjectURL(file);
        draftPreviewUrls.set(file, url);
    }
    return url;
}
function revokeDraftPreviewUrl(file) {
    const url = draftPreviewUrls.get(file);
    if (url !== undefined)
        URL.revokeObjectURL(url);
}
/** The Human is never delivered to (they read the Thread directly), so quoting them, even oneself, joins no row. */
function deliverableRecipients(draft, members, replyTo) {
    return [...new Set([
            ...mentionedMemberIds(draft, members),
            ...(replyTo?.memberId === undefined || replyTo.memberId === HUMAN_MEMBER_ID ? [] : [replyTo.memberId]),
        ])].sort();
}
export function TeamComposer({ members, followerMemberIds, projectMemberIds, ownerMemberIds, drafts, draftKey, pending, notice, error, onEdit, onSubmit, placeholder, pendingFiles, onFilesChange, replyTo, onCancelReply, toolbarExtra, t }) {
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const activeOptionRef = useRef(null);
    const composingRef = useRef(false);
    /** Nested dragenter depth: a drag crossing the composer's children reports leaves it never left. */
    const dragDepth = useRef(0);
    // Subscribing here, not in the hosting page, keeps a keystroke off the timeline.
    const { draft } = useSyncExternalStore(drafts.subscribe, () => drafts.getSnapshot(draftKey));
    const [mention, setMention] = useState();
    const [dropHover, setDropHover] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const mentionSurface = mentionSurfaceOf(draftKey);
    const groups = mention === undefined
        ? []
        : buildMentionGroups(members, mention.query, mentionSurface, { followers: followerMemberIds, projectMembers: projectMemberIds, owners: ownerMemberIds });
    const options = groups.flatMap(group => group.options);
    const optionIndexById = new Map(options.map((status, index) => [status.member.memberId, index]));
    const menuOpen = mention !== undefined;
    const activeOption = options[highlight];
    const listId = 'team-mention-suggestions';
    const menuMaxHeight = useAnchoredMaxHeight(menuRef, 320, menuOpen ? draft : null);
    useDismissOnOutsidePointer(rootRef, menuOpen, open => { if (!open)
        setMention(undefined); });
    useLayoutEffect(() => {
        const input = inputRef.current;
        if (input === null)
            return;
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    }, [draft]);
    useEffect(() => {
        if (mention === undefined || options.length === 0) {
            setHighlight(0);
            return;
        }
        setHighlight(current => Math.min(current, options.length - 1));
    }, [mention, options.length]);
    // Keeps the keyboard-highlighted row from hiding below the anchored height cap.
    useLayoutEffect(() => {
        if (!menuOpen)
            return;
        // Optional call: jsdom renders the menu without a layout engine.
        activeOptionRef.current?.scrollIntoView?.({ block: 'nearest' });
    }, [menuOpen, highlight, activeOption?.member.memberId]);
    // Team data can load after navigation, so another control may already own focus; do not steal it.
    useEffect(() => {
        const active = document.activeElement;
        if (active !== document.body && active?.closest('[aria-current="page"]') === null)
            return;
        inputRef.current?.focus({ preventScroll: true });
    }, []);
    // A notice settles after a read-only submission span; restore focus so the Human can keep typing.
    useEffect(() => {
        if (notice === undefined || pending)
            return;
        inputRef.current?.focus({ preventScroll: true });
    }, [notice, pending]);
    const memberHandles = new Map(members.map(status => [status.member.memberId, status.member.handle]));
    const notifiedIds = deliverableRecipients(draft, members, replyTo);
    // A name typed outside the Project's roster makes that Member a Project member on send; say so before the send.
    const enrollment = enrollmentIds(notifiedIds, projectMemberIds);
    const groupLabel = (key) => key === 'owner' ? t('mentionGroupOwner')
        : key === 'thread' ? t('mentionGroupThread')
            : key === 'project' ? t('mentionGroupProject')
                : t('mentionGroupOther');
    const updateMention = (nextDraft, caret) => {
        const match = findMention(nextDraft, caret);
        setMention(match);
        if (match === undefined)
            setHighlight(0);
    };
    const onChange = (event) => {
        const nextDraft = event.target.value;
        drafts.writeDraft(draftKey, nextDraft);
        onEdit?.();
        updateMention(nextDraft, event.target.selectionStart ?? nextDraft.length);
    };
    const commitMention = (nextDraft, nextCaret) => {
        drafts.writeDraft(draftKey, nextDraft);
        onEdit?.();
        setMention(undefined);
        setHighlight(0);
        requestAnimationFrame(() => {
            const input = inputRef.current;
            if (input === null)
                return;
            input.focus({ preventScroll: true });
            input.setSelectionRange(nextCaret, nextCaret);
        });
    };
    const selectOption = (status) => {
        if (mention === undefined)
            return;
        const inserted = `@${status.member.handle} `;
        const nextDraft = `${draft.slice(0, mention.start)}${inserted}${draft.slice(mention.end)}`;
        const nextCaret = mention.start + inserted.length;
        commitMention(nextDraft, nextCaret);
    };
    // Only a paste that carries files is intercepted, so plain text keeps native insertion.
    const onPaste = (event) => {
        if (pending || onFilesChange === undefined || pendingFiles === undefined)
            return;
        const files = Array.from(event.clipboardData.items)
            .filter(item => item.kind === 'file')
            .map(item => item.getAsFile())
            .filter((file) => file !== null);
        if (files.length === 0)
            return;
        event.preventDefault();
        onFilesChange([...pendingFiles, ...files]);
    };
    // A file dragged over the composer is the same intake as a pasted one, so it
    // lands on the same list; `dragDepth` survives the child elements a drag
    // crosses, which would otherwise report a leave between every one of them.
    const acceptsDrop = (event) => onFilesChange !== undefined && pendingFiles !== undefined && !pending
        && event.dataTransfer.types.includes('Files');
    const onDragEnter = (event) => {
        if (!acceptsDrop(event))
            return;
        event.preventDefault();
        dragDepth.current += 1;
        setDropHover(true);
    };
    const onDragOver = (event) => {
        if (!acceptsDrop(event))
            return;
        // Without this the browser navigates the tab to the dropped file.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = () => {
        if (dragDepth.current === 0)
            return;
        dragDepth.current -= 1;
        if (dragDepth.current === 0)
            setDropHover(false);
    };
    const onDrop = (event) => {
        if (!acceptsDrop(event) || onFilesChange === undefined || pendingFiles === undefined)
            return;
        event.preventDefault();
        const dropped = [...event.dataTransfer.files];
        dragDepth.current = 0;
        setDropHover(false);
        if (dropped.length > 0)
            onFilesChange([...pendingFiles, ...dropped]);
    };
    // A file dropped beside the composer must not navigate the tab to it either:
    // the composer takes the drop, everything else declines it.
    useEffect(() => {
        if (onFilesChange === undefined || pendingFiles === undefined)
            return undefined;
        const guard = (event) => {
            if (event.dataTransfer?.types.includes('Files') === true)
                event.preventDefault();
        };
        document.addEventListener('dragover', guard);
        document.addEventListener('drop', guard);
        return () => {
            document.removeEventListener('dragover', guard);
            document.removeEventListener('drop', guard);
        };
    }, [onFilesChange, pendingFiles]);
    const onKeyDown = (event) => {
        const composing = composingRef.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
        if (menuOpen && options.length > 0 && event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight(current => (current + 1) % options.length);
            return;
        }
        if (menuOpen && options.length > 0 && event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight(current => (current - 1 + options.length) % options.length);
            return;
        }
        if (event.key === 'Escape' && menuOpen) {
            event.preventDefault();
            setMention(undefined);
            return;
        }
        if (menuOpen && activeOption !== undefined && event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            selectOption(activeOption);
            return;
        }
        if (event.key !== 'Enter' || event.shiftKey || composing || event.repeat)
            return;
        if (menuOpen && activeOption !== undefined) {
            event.preventDefault();
            selectOption(activeOption);
            return;
        }
        event.preventDefault();
        if (!pending && draft.trim() !== '')
            onSubmit();
    };
    return _jsxs("form", { ref: rootRef, className: css.root, onSubmit: event => {
            event.preventDefault();
            if (!pending && draft.trim() !== '')
                onSubmit();
        }, children: [_jsxs("div", { className: css.card, "data-team-composer": true, onDragEnter: onDragEnter, onDragOver: onDragOver, onDragLeave: onDragLeave, onDrop: onDrop, children: [dropHover && _jsx("p", { className: css.notice, role: "status", "data-drop-active": true, children: t('composerDropHint') }), notice !== undefined && _jsx("p", { className: css.notice, role: "status", children: notice }), replyTo !== undefined && _jsxs("div", { className: css.replyBanner, "data-reply-banner": "", children: [_jsxs("span", { className: css.replyBannerBody, children: [_jsx("span", { className: css.replyBannerAuthor, children: t('replyingTo', { name: replyTo.senderName }) }), _jsx("span", { className: css.replyBannerText, children: plainGist(replyTo.excerpt) })] }), onCancelReply !== undefined && _jsx("button", { type: "button", className: css.replyBannerCancel, onClick: onCancelReply, "aria-label": t('cancelReply'), title: t('cancelReply'), children: "\u00D7" })] }), _jsxs("div", { className: css.inputArea, children: [menuOpen && _jsx("div", { id: listId, ref: menuRef, className: css.mentionMenu, role: "listbox", "aria-label": t('mentionSuggestions'), style: { maxHeight: menuMaxHeight }, children: options.length === 0
                                    ? _jsx("p", { className: css.mentionEmpty, role: "presentation", children: t('mentionNoMatch') })
                                    : groups.map(group => (_jsxs("div", { className: css.mentionGroup, role: "group", "aria-label": groupLabel(group.key), children: [_jsx("p", { className: css.mentionGroupLabel, "aria-hidden": "true", children: groupLabel(group.key) }), group.options.map(status => {
                                                const index = optionIndexById.get(status.member.memberId) ?? 0;
                                                const selected = index === highlight;
                                                return _jsxs("button", { id: `${listId}-${status.member.memberId}`, type: "button", role: "option", "aria-selected": selected, className: css.mentionOption, ref: selected ? activeOptionRef : undefined, onMouseDown: event => { event.preventDefault(); }, onClick: () => { selectOption(status); }, "data-mention-group": group.key, "data-mention-inside": String(group.key !== 'other'), children: [_jsx(TeamPresenceDot, { status: status, t: t }), _jsxs("span", { className: css.mentionName, children: ["@", status.member.handle] }), _jsx("span", { className: css.mentionDescription, children: status.member.description })] }, status.member.memberId);
                                            })] }, group.key))) }), _jsx("textarea", { ref: inputRef, "aria-label": t('messageDraft'), "aria-autocomplete": "list", "aria-controls": menuOpen ? listId : undefined, "aria-activedescendant": menuOpen && activeOption !== undefined ? `${listId}-${activeOption.member.memberId}` : undefined, "aria-expanded": menuOpen, value: draft, readOnly: pending, placeholder: placeholder ?? t('messagePlaceholder'), rows: 1, onChange: onChange, onPaste: onPaste, onKeyDown: onKeyDown, onSelect: event => { updateMention(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length); }, onCompositionStart: () => { composingRef.current = true; }, onCompositionEnd: () => { setTimeout(() => { composingRef.current = false; }, 10); } })] }), notifiedIds.length > 0 && _jsxs("p", { className: css.notifyRow, "data-team-notify": true, children: [t('composerNotify', { ids: notifiedIds.map(memberId => `@${memberHandles.get(memberId) ?? memberId}`).join(', ') }), enrollment.length > 0 && _jsxs("span", { className: css.notifyJoin, children: [' ', t('composerNotifyJoin', { ids: enrollment.map(memberId => `@${memberHandles.get(memberId) ?? memberId}`).join(', ') })] })] }), onFilesChange !== undefined && pendingFiles !== undefined && pendingFiles.length > 0 && (_jsx("ul", { className: css.fileChips, "aria-label": t('attachFiles'), children: pendingFiles.map((file, index) => {
                            const previewUrl = draftPreviewUrl(file);
                            return _jsxs("li", { className: `${css.fileChip} ${previewUrl !== undefined ? css.imageChip : ''}`, children: [previewUrl !== undefined && _jsx("img", { src: previewUrl, alt: "", className: css.imageChipPreview }), _jsxs("span", { className: css.fileChipName, title: file.name, children: [file.name, _jsx("span", { className: css.fileChipSize, children: formatByteSize(file.size) })] }), _jsx("button", { type: "button", className: css.fileChipRemove, "aria-label": t('removeFile', { name: file.name }), disabled: pending, onClick: () => {
                                            revokeDraftPreviewUrl(file);
                                            onFilesChange(pendingFiles.filter((_, candidate) => candidate !== index));
                                        }, children: "\u00D7" })] }, `${file.name}-${index}`);
                        }) })), _jsxs("div", { className: css.toolbar, children: [onFilesChange !== undefined && (_jsxs(_Fragment, { children: [_jsx("input", { ref: fileInputRef, type: "file", multiple: true, className: css.fileInput, "aria-hidden": "true", tabIndex: -1, onChange: event => {
                                            const chosen = [...event.target.files ?? []];
                                            if (chosen.length > 0 && pendingFiles !== undefined)
                                                onFilesChange([...pendingFiles, ...chosen]);
                                            event.target.value = '';
                                        } }), _jsx(Tooltip, { label: t('attachFiles'), side: "top", delayMs: 500, children: _jsx("button", { type: "button", className: css.attachButton, "aria-label": t('attachFiles'), disabled: pending, onClick: () => { fileInputRef.current?.click(); }, children: _jsx(IconPaperclipOutlineMedium, { size: 14 }) }) })] })), toolbarExtra, _jsx("button", { type: "submit", className: css.sendButton, "aria-label": pending ? t('sendingMessage') : t('sendMessage'), disabled: pending || draft.trim() === '', onMouseDown: event => {
                                    // Keep the composer focused when the send control is clicked.
                                    event.preventDefault();
                                    inputRef.current?.focus({ preventScroll: true });
                                }, children: _jsx(IconSendOutlineRegular, { size: 16 }) })] })] }), error !== undefined && _jsx("p", { className: css.error, role: "alert", children: error })] });
}
