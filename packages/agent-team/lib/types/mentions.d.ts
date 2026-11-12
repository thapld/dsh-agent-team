import type { AgentTeamMemberId } from './types/entities.ts';
/** One addressable name in a Message body: the Member's stable id plus the handle authors write. The Human uses the same shape. */
export interface AgentTeamBodyMentionCandidate {
    readonly memberId: AgentTeamMemberId;
    readonly handle: string;
}
/** Outcome of scanning one Message body for authored mentions. */
export interface AgentTeamBodyMentionResolution {
    /** Candidate Member ids named in the body, in candidate order; never the caller's own id. */
    readonly memberIds: readonly AgentTeamMemberId[];
    /** The body carried an `@all` marker, so the caller decides how wide that reaches. */
    readonly all: boolean;
}
/** One `@Handle` occurrence the delivery scan reads as a call, in body order. */
export interface AgentTeamBodyHandleMatch {
    /** The candidate handle, in its canonical spelling rather than the authored casing. */
    readonly handle: string;
    readonly start: number;
    readonly end: number;
}
/** Whether an `@` at `at` would start a call, so the composer opens its picker exactly where delivery reads one. */
export declare function startsMentionAt(body: string, at: number): boolean;
/** Whether one body carries the `@all` marker outside code. */
export declare function hasAllMarker(body: string): boolean;
/** Every `@Handle` occurrence naming one of `handles`: case-insensitive, on the ASCII word boundaries `CALL_BOUNDARY_START`/`CALL_BOUNDARY_END` define, longest first, outside code. The `@` is required. This is the single definition of an authored mention, shared by Host delivery and Client chip rendering. */
export declare function scanBodyHandles(body: string, handles: readonly string[]): readonly AgentTeamBodyHandleMatch[];
/** Resolves `@Handle` mentions authored in a Message body. Callers pass the candidates reachable in the Project; other handles stay prose. `sender` is excluded, so the result works as a recipient set. */
export declare function resolveBodyMentions(body: string, candidates: readonly AgentTeamBodyMentionCandidate[], sender: AgentTeamMemberId): AgentTeamBodyMentionResolution;
//# sourceMappingURL=mentions.d.ts.map