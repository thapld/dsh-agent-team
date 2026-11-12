import { createHash } from 'node:crypto';
import { SessionLogOffset } from '@deepseek-ai/dsh-session';
import { activityFact, activityFactDigest, activityIdentity } from "./activity-facts.js";
import { isAgentTeamSource } from "./context-source.js";
export const NOTIFICATION_TRUNCATION_MARKER = '[Message body truncated; use team_thread read for the full Message.]';
export const NOTIFICATION_BODY_MAX_CHARACTERS = 8 * 1024;
const digest = (text) => createHash('sha256').update(text).digest('hex');
/** Bind rendered bodies or exact parts to the producer's complete output text. */
export function teamMessageSurface(text, messages, activities = []) {
    const boundActivities = activities.map(fact => ({ ...activityIdentity(fact), factDigest: activityFactDigest(fact) }));
    return { textDigest: digest(text), messages: messages.map(message => ({
            ...(message.threadRef === undefined ? { projectRef: message.projectRef } : { threadRef: message.threadRef }),
            messageRef: message.messageRef, bodyDigest: digest(message.body),
            ...(message.part === undefined ? {} : { ...message.part, total: message.body.length }),
        })), activities: boundActivities };
}
/** A live projection, not a read receipt. Cropped text cannot attest through retained metadata. */
export function visibleTeamSurface(agent) {
    const entries = [];
    for (const sequence of agent.session.surface.nodes) {
        const event = agent.session.snapshotEvents(SessionLogOffset(sequence), SessionLogOffset(sequence + 1))[0];
        if (event === undefined)
            continue;
        const message = agent.session.deriveEventMessage(event);
        if (message === null)
            continue;
        let binding;
        if (event.type === 'user/message' && message.role === 'user' && isAgentTeamSource(message.source) && message.source.form === 'notice') {
            binding = message.source.teamFacts;
        }
        else if (event.type === 'tool/result' && message.role === 'tool' && !message.isError) {
            const ownCall = event.sourceEventSeqs?.some(sequence => {
                const call = agent.session.snapshotEvents(SessionLogOffset(sequence), SessionLogOffset(sequence + 1))[0];
                return call?.type === 'tool/call' && call.data.callId === message.toolCallId
                    && (call.data.name === 'team_thread' || call.data.name === 'team_message' || call.data.name === 'team_task');
            });
            if (!ownCall)
                continue;
            const meta = event.data.meta;
            if (typeof meta !== 'object' || meta === null || Array.isArray(meta))
                continue;
            binding = meta['teamFacts'];
        }
        const surface = surfaceOf(binding);
        if (surface === undefined || message.content.some(part => part.type !== 'text'))
            continue;
        const text = message.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('\n');
        if (digest(text) === surface.textDigest)
            entries.push(surface);
    }
    return entries;
}
function surfaceOf(value) {
    if (typeof value !== 'object' || value === null)
        return undefined;
    const surface = value;
    if (typeof surface.textDigest !== 'string' || !Array.isArray(surface.messages))
        return undefined;
    if (!surface.messages.every(message => message !== null && typeof message === 'object'
        && ((typeof message.threadRef === 'string' && message.projectRef === undefined)
            || (typeof message.projectRef === 'string' && message.threadRef === undefined))
        && typeof message.messageRef === 'string' && typeof message.bodyDigest === 'string'))
        return undefined;
    const activities = surface.activities;
    if (activities !== undefined && (!Array.isArray(activities) || !activities.every(isSurfaceActivityBinding)))
        return undefined;
    return { ...surface, activities: (activities ?? []) };
}
function isSurfaceActivityBinding(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const item = value;
    if (typeof item.activityRef !== 'string' || typeof item.factDigest !== 'string')
        return false;
    return (item.scope === 'thread' && typeof item.threadRef === 'string' && item.projectRef === undefined)
        || (item.scope === 'main' && typeof item.projectRef === 'string' && item.threadRef === undefined);
}
export function isFactOnSurface(entries, fact, threadRef) {
    if (fact.fact.kind === 'activity') {
        return fact.fact.activity.threadRef === threadRef && isActivityOnSurface(entries, activityFact(fact.fact.activity));
    }
    if (fact.fact.kind !== 'message' || fact.fact.message.body === '')
        return false;
    const { messageRef, body } = fact.fact.message;
    return missingMessageRange(entries, { threadRef, messageRef, body }) === undefined;
}
export function isMainEntryOnSurface(entries, entry, projectRef) {
    if (entry.kind === 'activity') {
        return entry.activity.projectRef === projectRef && isActivityOnSurface(entries, activityFact(entry.activity));
    }
    if (entry.kind !== 'message' || entry.message.body === '')
        return false;
    return missingMessageRange(entries, { projectRef, messageRef: entry.message.messageRef, body: entry.message.body }) === undefined;
}
/** A Command or Remote projection is not a Session output: only the bound activity text attests. */
function isActivityOnSurface(entries, fact) {
    const identity = activityIdentity(fact);
    const factDigest = activityFactDigest(fact);
    return entries.some(entry => entry.activities.some(activity => activity.factDigest === factDigest
        && activity.activityRef === identity.activityRef
        && (identity.scope === 'thread'
            ? activity.scope === 'thread' && activity.threadRef === identity.threadRef
            : activity.scope === 'main' && activity.projectRef === identity.projectRef)));
}
export function missingMessageRange(entries, target) {
    const bodyDigest = digest(target.body);
    const ranges = entries.flatMap(entry => entry.messages.filter(message => message.threadRef === target.threadRef
        && message.projectRef === target.projectRef && message.messageRef === target.messageRef && message.bodyDigest === bodyDigest)
        .flatMap(message => message.start === undefined && message.end === undefined && message.total === undefined
        ? [{ start: 0, end: target.body.length }]
        : Number.isInteger(message.start) && Number.isInteger(message.end) && message.total === target.body.length
            && message.start >= 0 && message.end > message.start && message.end <= target.body.length
            ? [{ start: message.start, end: message.end }] : []))
        .sort((left, right) => left.start - right.start);
    let start = 0;
    for (const range of ranges) {
        if (range.start > start)
            return { start, end: range.start };
        start = Math.max(start, range.end);
    }
    return start >= target.body.length ? undefined : { start, end: target.body.length };
}
export function surfaceVisibilityProbe(agentFor) {
    return (memberId, facts, threadRef) => {
        const agent = agentFor(memberId);
        if (agent === undefined)
            return false;
        const entries = visibleTeamSurface(agent);
        return facts.every(fact => isFactOnSurface(entries, fact, threadRef));
    };
}
