import type { Agent } from '@deepseek-ai/dsh-agent';
import { type ActivityFact, type ActivityIdentity } from './activity-facts.ts';
import type { AgentTeamMainTimelineEntry, AgentTeamMemberId, AgentTeamProjectRef, AgentTeamThreadReadFact, AgentTeamThreadRef } from './types.ts';
export declare const NOTIFICATION_TRUNCATION_MARKER = "[Message body truncated; use team_thread read for the full Message.]";
export declare const NOTIFICATION_BODY_MAX_CHARACTERS: number;
export type SurfaceActivityBinding = ActivityIdentity & {
    readonly factDigest: string;
};
export type TeamMessageSurface = {
    readonly textDigest: string;
    readonly messages: readonly (MessageAddress & {
        readonly messageRef: string;
        readonly bodyDigest: string;
        readonly start?: number;
        readonly end?: number;
        readonly total?: number;
    })[];
    readonly activities: readonly SurfaceActivityBinding[];
};
type MessageAddress = {
    readonly threadRef: string;
    readonly projectRef?: never;
} | {
    readonly projectRef: string;
    readonly threadRef?: never;
};
export type RenderedTeamMessage = MessageAddress & {
    readonly messageRef: string;
    readonly body: string;
    readonly part?: {
        readonly start: number;
        readonly end: number;
    };
};
/** Bind rendered bodies or exact parts to the producer's complete output text. */
export declare function teamMessageSurface(text: string, messages: readonly RenderedTeamMessage[], activities?: readonly ActivityFact[]): {
    textDigest: string;
    messages: ({
        total?: number;
        start?: number;
        end?: number;
        messageRef: string;
        bodyDigest: string;
        projectRef: string;
    } | {
        total?: number;
        start?: number;
        end?: number;
        messageRef: string;
        bodyDigest: string;
        threadRef: string;
    })[];
    activities: ({
        factDigest: string;
        scope: "thread";
        activityRef: import("./types.ts").AgentTeamActivityRef;
        threadRef: AgentTeamThreadRef;
    } | {
        factDigest: string;
        scope: "main";
        activityRef: import("./types.ts").AgentTeamActivityRef;
        projectRef: AgentTeamProjectRef;
    })[];
};
/** A live projection, not a read receipt. Cropped text cannot attest through retained metadata. */
export declare function visibleTeamSurface(agent: Pick<Agent, 'session'>): readonly TeamMessageSurface[];
export declare function isFactOnSurface(entries: readonly TeamMessageSurface[], fact: AgentTeamThreadReadFact, threadRef: AgentTeamThreadRef): boolean;
export declare function isMainEntryOnSurface(entries: readonly TeamMessageSurface[], entry: AgentTeamMainTimelineEntry, projectRef: AgentTeamProjectRef): boolean;
export declare function missingMessageRange(entries: readonly TeamMessageSurface[], target: RenderedTeamMessage): {
    start: number;
    end: number;
} | undefined;
export declare function surfaceVisibilityProbe(agentFor: (memberId: AgentTeamMemberId) => Agent | undefined): (memberId: AgentTeamMemberId, facts: readonly AgentTeamThreadReadFact[], threadRef: AgentTeamThreadRef) => boolean;
export {};
//# sourceMappingURL=surface-visibility.d.ts.map