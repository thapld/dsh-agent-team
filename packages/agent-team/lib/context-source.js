/**
 * Producer-attributed message sources for Agent Team context management.
 *
 * Messages are ordinary `UserMessage`s under this plugin's producer kind with the `snapshot` context form, the shape Session format V4 admits. The handoff envelope and checkpoint correlation travel as named {@link ContextSnapshotSection}s. The validators here are the only place that recognizes these messages; callers never match on body text.
 * @module @contexera/dsh-agent-team/context-source
 */
/** The producer kind attributing every Agent Team message source this bundle writes now. */
export const AGENT_TEAM_PLUGIN_ID = '@contexera/dsh-agent-team';
/**
 * Producer kinds this bundle wrote before the published identity moved from
 * `@wowyuarm` to `@contexera`. Read-only: no writer emits them, but Session
 * logs written before the rename carry them, so every read path must keep
 * recognizing them or an existing Session loses its own context attribution on
 * upgrade.
 */
export const AGENT_TEAM_LEGACY_PLUGIN_IDS = ['@wowyuarm/dsh-agent-team'];
/** Every producer kind this bundle accepts, current first; the read-side union of {@link AGENT_TEAM_PLUGIN_ID} and its renamed history. */
export const AGENT_TEAM_PLUGIN_IDS = [AGENT_TEAM_PLUGIN_ID, ...AGENT_TEAM_LEGACY_PLUGIN_IDS];
/** Kind the Harness's V4 read-time conversion gives this plugin's released V3 `plugin` sources: `plugin:` + producer id, payload fields preserved. */
export const AGENT_TEAM_V3_RENAMED_KIND = `plugin:${AGENT_TEAM_PLUGIN_ID}`;
/** The kind the read-time conversion renames one producer's released V3 sources into. */
export const v3RenamedSourceKind = (producer) => `plugin:${producer}`;
/** Whether a source kind is a producer's own, by exact equality on its current or V3-converted kind; a `plugin:` prefix test would claim third-party rows. */
export function matchesProducerKind(kind, producer) {
    return kind === producer || kind === v3RenamedSourceKind(producer);
}
/** Whether a source kind belongs to any of `producers`, each matched exactly or through its V3 conversion. */
export function matchesAnyProducerKind(kind, producers) {
    return producers.some(producer => matchesProducerKind(kind, producer));
}
/** Whether one message source carries this plugin's own attribution, including the producer kinds it carried before the identity rename. */
export function isAgentTeamSource(source) {
    return matchesAnyProducerKind(source.kind, AGENT_TEAM_PLUGIN_IDS);
}
/** Handoff snapshot section name carrying the model-authored prose. */
export const HANDOFF_SECTION_NAME = 'HANDOFF';
/** Stable section name marking a checkpoint continuation and carrying its ref. */
export const CHECKPOINT_SECTION_NAME = 'Checkpoint';
/** This message's snapshot sections when it is this plugin's own snapshot, else `undefined`. */
function ownSections(message) {
    const source = message.source;
    if (!isAgentTeamSource(source))
        return undefined;
    if (source.form !== 'snapshot')
        return undefined;
    return source.sections;
}
/** The text of one named section, or undefined when it is absent. */
function sectionText(sections, name) {
    return sections.find(section => section.name === name)?.text;
}
/** Decodes the `Related files` section: a JSON path array (safe for paths containing commas), falling back to the legacy `', '`-joined split for older generations. */
function parseRelatedFiles(text) {
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.every(path => typeof path === 'string' && path.length > 0)) {
            return parsed;
        }
    }
    catch {
        // Not JSON: the section predates the JSON encoding.
    }
    return text.split(', ').filter(path => path.length > 0);
}
/** The rollover handoff a message carries, or `undefined`. */
export function handoffOf(message) {
    const sections = ownSections(message);
    if (sections === undefined)
        return undefined;
    const handoff = sectionText(sections, HANDOFF_SECTION_NAME);
    if (handoff === undefined)
        return undefined;
    const previousSessionId = sectionText(sections, HANDOFF_PREVIOUS_SESSION);
    const newSessionId = sectionText(sections, HANDOFF_NEW_SESSION);
    const trigger = sectionText(sections, HANDOFF_TRIGGER);
    const handoffEventSeq = sectionText(sections, HANDOFF_EVENT_SEQ);
    if (previousSessionId === undefined || newSessionId === undefined)
        return undefined;
    if (trigger !== 'model' && trigger !== 'pressure')
        return undefined;
    const seq = Number(handoffEventSeq);
    if (handoffEventSeq === undefined || !Number.isSafeInteger(seq))
        return undefined;
    const checkpointRef = sectionText(sections, HANDOFF_CHECKPOINT);
    const relatedFiles = sectionText(sections, HANDOFF_RELATED_FILES);
    return {
        previousSessionId,
        newSessionId,
        trigger,
        handoffEventSeq: seq,
        ...(checkpointRef === undefined ? {} : { checkpointRef }),
        ...(relatedFiles === undefined ? {} : { relatedFiles: parseRelatedFiles(relatedFiles) }),
        sections,
    };
}
export function continuationCheckpointRefOf(message) {
    const sections = ownSections(message);
    if (sections === undefined || sections.length !== 1)
        return undefined;
    const ref = sectionText(sections, CHECKPOINT_SECTION_NAME);
    return ref === undefined || ref.length === 0 ? undefined : ref;
}
/** Whether one user message is a rollover handoff snapshot. */
export function isHandoffMessage(message) {
    return handoffOf(message) !== undefined;
}
/** Whether one user message is a checkpoint continuation, optionally for one checkpoint. */
export function isCheckpointContinuationMessage(message, checkpointRef) {
    const ref = continuationCheckpointRefOf(message);
    return ref !== undefined && (checkpointRef === undefined || ref === checkpointRef);
}
export function isAgentTeamContextSource(message) {
    return isHandoffMessage(message) || isCheckpointContinuationMessage(message);
}
/** Envelope section names; stable because they are read back from the log. */
export const HANDOFF_PREVIOUS_SESSION = 'Previous session';
export const HANDOFF_NEW_SESSION = 'New session';
export const HANDOFF_TRIGGER = 'Trigger';
export const HANDOFF_EVENT_SEQ = 'Handoff event seq';
export const HANDOFF_CHECKPOINT = 'Continued from checkpoint';
export const HANDOFF_RELATED_FILES = 'Related files';
