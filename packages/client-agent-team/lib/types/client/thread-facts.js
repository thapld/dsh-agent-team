import { bodyMentionsHuman, mentionNameOf, mentionNamesOf } from "./team-formatters.js";
export function factKey(fact) {
    return fact.kind === 'message' ? `message:${fact.message.messageRef}` : `activity:${fact.activity.activityRef}`;
}
export function messageFact(message, mentions = []) {
    return { kind: 'message', sequence: message.sequence, message, mentions, occurredAt: message.occurredAt };
}
/** Union of fact groups in sequence order; a later duplicate of one ref replaces the earlier copy. */
export function mergeFacts(...groups) {
    const byKey = new Map();
    for (const group of groups)
        for (const fact of group)
            byKey.set(factKey(fact), fact);
    return [...byKey.values()].sort((left, right) => left.sequence - right.sequence);
}
export function minSequence(facts) {
    return facts.reduce((minimum, fact) => minimum === undefined ? fact.sequence : Math.min(minimum, fact.sequence), undefined);
}
/**
 * First unread Message that names the Human reader — where a discussion opens when the reader arrived from an unread
 * Inbox row. Flags come from the read that produced these facts, so this has to run before the acknowledgement clears
 * them. A body scan, not delivery, is the test: a Thread reaches its Human in every row.
 */
export function firstUnreadMention(facts, humanName) {
    for (const entry of facts) {
        if (entry.unread !== true || entry.fact.kind !== 'message')
            continue;
        if (!bodyMentionsHuman(entry.fact.message.body, humanName))
            continue;
        return entry.fact.message.messageRef;
    }
    return undefined;
}
/** Cached against the fact's mention array; compares resolved names, not map identity, since every roster refresh hands over an identical fresh Map and a memoized row must not re-render. */
const mentionNamesCache = new WeakMap();
export function stableMentionNames(mentions, handles, humanName) {
    const names = mentionNamesOf(mentions, handles, humanName);
    const cached = mentionNamesCache.get(mentions);
    if (cached !== undefined && cached.length === names.length && cached.every((name, index) => mentionNameOf(name) === mentionNameOf(names[index])))
        return cached;
    mentionNamesCache.set(mentions, names);
    return names;
}
