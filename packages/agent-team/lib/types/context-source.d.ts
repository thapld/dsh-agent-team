/**
 * Producer-attributed message sources for Agent Team context management.
 *
 * Messages are ordinary `UserMessage`s under this plugin's producer kind with the `snapshot` context form, the shape Session format V4 admits. The handoff envelope and checkpoint correlation travel as named {@link ContextSnapshotSection}s. The validators here are the only place that recognizes these messages; callers never match on body text.
 * @module @contexera/dsh-agent-team/context-source
 */
import type { ContextFormed, ContextSnapshotSection, MessageSource, UserMessage } from '@deepseek-ai/dsh-llm';
import type { TeamMessageSurface } from './surface-visibility.ts';
/** The producer kind attributing every Agent Team message source this bundle writes now. */
export declare const AGENT_TEAM_PLUGIN_ID = "@contexera/dsh-agent-team";
/**
 * Producer kinds this bundle wrote before the published identity moved from
 * `@wowyuarm` to `@contexera`. Read-only: no writer emits them, but Session
 * logs written before the rename carry them, so every read path must keep
 * recognizing them or an existing Session loses its own context attribution on
 * upgrade.
 */
export declare const AGENT_TEAM_LEGACY_PLUGIN_IDS: readonly ["@wowyuarm/dsh-agent-team"];
/** Every producer kind this bundle accepts, current first; the read-side union of {@link AGENT_TEAM_PLUGIN_ID} and its renamed history. */
export declare const AGENT_TEAM_PLUGIN_IDS: readonly ["@contexera/dsh-agent-team", "@wowyuarm/dsh-agent-team"];
/** Kind the Harness's V4 read-time conversion gives this plugin's released V3 `plugin` sources: `plugin:` + producer id, payload fields preserved. */
export declare const AGENT_TEAM_V3_RENAMED_KIND = "plugin:@contexera/dsh-agent-team";
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        /** The kind this plugin writes now; V4 admission requires a producer-owned kind. */
        [AGENT_TEAM_PLUGIN_ID]: {
            kind: typeof AGENT_TEAM_PLUGIN_ID;
            readonly teamFacts?: TeamMessageSurface;
        } & ContextFormed;
        /** The converted shape of this plugin's released V3 history; read-side only. */
        [AGENT_TEAM_V3_RENAMED_KIND]: {
            kind: typeof AGENT_TEAM_V3_RENAMED_KIND;
            readonly teamFacts?: TeamMessageSurface;
        } & ContextFormed;
        /** The pre-rename producer kind; read-side only, and only ever in history. */
        '@wowyuarm/dsh-agent-team': {
            kind: '@wowyuarm/dsh-agent-team';
            readonly teamFacts?: TeamMessageSurface;
        } & ContextFormed;
        /** The converted shape of that pre-rename history. */
        'plugin:@wowyuarm/dsh-agent-team': {
            kind: 'plugin:@wowyuarm/dsh-agent-team';
            readonly teamFacts?: TeamMessageSurface;
        } & ContextFormed;
    }
}
/** The source shapes carrying this plugin's attribution: its current kind, its pre-rename history, and the V3 conversions of both. */
export type AgentTeamMessageSource = Extract<MessageSource, {
    kind: typeof AGENT_TEAM_PLUGIN_ID | typeof AGENT_TEAM_V3_RENAMED_KIND | 'plugin:@wowyuarm/dsh-agent-team' | '@wowyuarm/dsh-agent-team';
}>;
/** The kind the read-time conversion renames one producer's released V3 sources into. */
export declare const v3RenamedSourceKind: <const P extends string>(producer: P) => `plugin:${P}`;
/** Whether a source kind is a producer's own, by exact equality on its current or V3-converted kind; a `plugin:` prefix test would claim third-party rows. */
export declare function matchesProducerKind(kind: string | undefined, producer: string): boolean;
/** Whether a source kind belongs to any of `producers`, each matched exactly or through its V3 conversion. */
export declare function matchesAnyProducerKind(kind: string | undefined, producers: readonly string[]): boolean;
/** Whether one message source carries this plugin's own attribution, including the producer kinds it carried before the identity rename. */
export declare function isAgentTeamSource(source: MessageSource): source is AgentTeamMessageSource;
/** Handoff snapshot section name carrying the model-authored prose. */
export declare const HANDOFF_SECTION_NAME = "HANDOFF";
/** Stable section name marking a checkpoint continuation and carrying its ref. */
export declare const CHECKPOINT_SECTION_NAME = "Checkpoint";
/**
 * The rollover handoff envelope: the model-authored prose plus the verifiable
 * Host facts, all as named snapshot contributions.
 */
export interface AgentTeamContextHandoff {
    /** The Member's Session before this rollover. */
    readonly previousSessionId: string;
    /** The rollover generation this handoff opened. */
    readonly newSessionId: string;
    /** Why the rollover happened. */
    readonly trigger: 'model' | 'pressure';
    /** Seq of the retired rollover tool result in the previous Session log. */
    readonly handoffEventSeq: number;
    /** The checkpoint a return was seeded from; absent on a fresh rollover. */
    readonly checkpointRef?: string;
    /** Workspace paths the handoff called out as relevant. */
    readonly relatedFiles?: readonly string[];
    /** Named contributions, starting with the model-authored handoff prose. */
    readonly sections: readonly ContextSnapshotSection[];
}
/** The rollover handoff a message carries, or `undefined`. */
export declare function handoffOf(message: UserMessage): AgentTeamContextHandoff | undefined;
export declare function continuationCheckpointRefOf(message: UserMessage): string | undefined;
/** Whether one user message is a rollover handoff snapshot. */
export declare function isHandoffMessage(message: UserMessage): boolean;
/** Whether one user message is a checkpoint continuation, optionally for one checkpoint. */
export declare function isCheckpointContinuationMessage(message: UserMessage, checkpointRef?: string): boolean;
export declare function isAgentTeamContextSource(message: UserMessage): boolean;
/** Envelope section names; stable because they are read back from the log. */
export declare const HANDOFF_PREVIOUS_SESSION = "Previous session";
export declare const HANDOFF_NEW_SESSION = "New session";
export declare const HANDOFF_TRIGGER = "Trigger";
export declare const HANDOFF_EVENT_SEQ = "Handoff event seq";
export declare const HANDOFF_CHECKPOINT = "Continued from checkpoint";
export declare const HANDOFF_RELATED_FILES = "Related files";
//# sourceMappingURL=context-source.d.ts.map