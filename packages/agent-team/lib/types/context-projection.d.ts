/**
 * Team's Session projection: durable ref naming and the fold every Host registers.
 *
 * `context_rollover`, `new_context`, and `context_checkpoint` are log decoders only, not tools: existing Session logs still fold so a parked intent can finish or discard its swap.
 * @module @contexera/dsh-agent-team/context-projection
 */
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
import { z } from 'zod';
import type { AgentTeamContextCheckpointRef } from './types/entities.ts';
export declare const CONTEXT_CONTINUITY_PROJECTION_KEY = "contextContinuity";
export declare const TEAM_INBOX_NOTICE_SUMMARY = "Team Inbox has unread work.";
export declare const TEAM_RECOVERY_NOTICE_SUMMARY = "Recovery: continue your interrupted work.";
/** One-line account of the post-acceptance context reminder, read back by the wake guards. */
export declare const TEAM_ACCEPTANCE_NOTICE_SUMMARY = "Task accepted: record what is durable.";
/** Whether a Team notice is the post-acceptance reminder rather than a wake the Host rederives. */
export declare function isAcceptanceNotice(message: UserMessage): boolean;
export interface ContextCheckpointEntry {
    /** Opaque stable ref; the selection authority for a seeded return. */
    readonly checkpointRef: string;
    readonly name: string;
    readonly resultSeq: number;
    readonly turn: number;
    /** Seq of the resolving `turn/end`; -1 until resolved. */
    readonly turnEndSeq: number;
}
export interface PendingRolloverIntent {
    readonly handoff: string;
    readonly checkpointRef?: string | undefined;
    readonly relatedFiles: readonly {
        readonly path: string;
        readonly reason: string;
    }[];
    readonly toolCallId: string;
    readonly resultSeq: number;
    readonly turn: number;
    /** Seq of the `turn/end` that released the intent; -1 until observed. */
    readonly turnEndSeq: number;
}
export interface ContinuationDeliveryState {
    readonly checkpointRef: string;
    /** Seq of the delivered notice; -1 until delivered. */
    readonly deliveredSeq: number;
}
export interface CarriedCandidate {
    readonly messageId: string;
    readonly surfacedTurn: number;
    readonly consumed: boolean;
}
export interface TeamContextProjectionState {
    /** The Session this state folds; it keys every durable ref the fold derives. */
    readonly sessionId: string;
    /** Fork-inherited prefix length; events below it belong to the ancestor. */
    readonly inheritedEventCount: number;
    readonly checkpoints: readonly ContextCheckpointEntry[];
    /** Rollover intent awaiting its containing turn end, at most one. */
    readonly pending: PendingRolloverIntent | null;
    readonly continuations: readonly ContinuationDeliveryState[];
    readonly carriedCandidates: readonly CarriedCandidate[];
    /** The most recently opened turn; `user/message` carries no turn of its own. */
    readonly lastTurn: number;
    readonly openCalls: readonly {
        readonly callId: string;
        readonly name: string;
        readonly arguments: string;
    }[];
}
/** Cached rows are validated with this before seeding a fold, so an older shape is discarded, never forward-applied. */
export declare const contextProjectionStateSchema: z.ZodType<TeamContextProjectionState>;
export interface ContextFoldTarget {
    readonly sessionId: string;
    /** Omit for a Session whose log inherited no prefix. */
    readonly inheritedEventCount?: number;
    /** Committed wake-swap boundary; omitted for legacy-only folds. */
    readonly inputFromSeq?: number;
}
export declare function checkpointRefFor(sessionId: string, callId: string): AgentTeamContextCheckpointRef;
export declare function isRedeliverableTeamNotice(message: UserMessage): boolean;
export declare function foldTeamContextProjection(events: readonly SessionEvent[], target: ContextFoldTarget): TeamContextProjectionState;
/** Register once per Host: the framework keeps one unit per key for every Session. */
export declare function createTeamContextProjectionDefinition(): ProjectionDefinition<typeof CONTEXT_CONTINUITY_PROJECTION_KEY, TeamContextProjectionState>;
export declare function carriedInputOf(state: TeamContextProjectionState, events: readonly SessionEvent[]): readonly UserMessage[];
//# sourceMappingURL=context-projection.d.ts.map