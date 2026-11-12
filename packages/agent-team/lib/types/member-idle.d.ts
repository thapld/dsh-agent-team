import type { AgentTeamMemberId } from './types/entities.ts';
/** Process-local presence observations; intentionally empty after a Host restart. */
export declare class MemberIdleTracker {
    private readonly idleSince;
    status(memberId: AgentTeamMemberId, status: 'running' | 'idle' | 'error', nowMs: number): void;
    idleMs(memberId: AgentTeamMemberId, nowMs: number): number | undefined;
    forget(memberId: AgentTeamMemberId): void;
}
//# sourceMappingURL=member-idle.d.ts.map