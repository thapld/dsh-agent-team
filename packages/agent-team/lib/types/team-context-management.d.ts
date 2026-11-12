/**
 * Serializes Host-requested generation swaps and restores legacy rollover
 * intents and checkpoint continuations. Owns process locks only; committed
 * transitions remain recoverable from the ledger and Session log.
 * @module @contexera/dsh-agent-team/team-context-management
 */
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { AgentTeamAgentMember, AgentTeamMemberId } from './types.ts';
import type { TeamContextProjectionState } from './context-projection.ts';
import { type TransitionIdentity } from './wake-recycle.ts';
export type TeamContextState = Pick<TeamContextProjectionState, 'pending' | 'checkpoints' | 'continuations'>;
export interface TeamTransitionPlan extends TransitionIdentity {
    readonly previousSessionId: SessionId;
}
/** The generation-boundary messages, built by the wiring that owns the codec. */
export interface TeamContextMessages {
    readonly continuation: (checkpointRef: string) => UserMessage;
}
export interface TeamContextManagementOptions {
    readonly memberForAgent: (agent: Agent) => AgentTeamAgentMember | undefined;
    readonly projectionForMember: (memberId: AgentTeamMemberId, sessionId: SessionId) => TeamContextState | undefined;
    readonly executeTransition: (memberId: AgentTeamMemberId, plan: TeamTransitionPlan) => Promise<void>;
    readonly messages: TeamContextMessages;
    readonly log: (message: string) => void;
}
/** Durable identity of one rollover: a result seq is session-local and collides across generations. */
export declare function teamRolloverIdentity(previousSessionId: SessionId, toolCallId: string): TransitionIdentity;
export declare class TeamContextManagement {
    private readonly options;
    private readonly members;
    private readonly settleWaiters;
    private readonly scheduledContinuations;
    private readonly spentIntents;
    private disposed;
    constructor(options: TeamContextManagementOptions);
    isTransitioning(memberId: AgentTeamMemberId): boolean;
    /** Resolves once no swap is in flight for this Member (immediately if none), so callers don't deliver into a Session about to be disposed. */
    whenSettled(memberId: AgentTeamMemberId): Promise<void>;
    dispose(): void;
    /**
     * Start the generation swap a Host wake decision asked for. There is no
     * durable intent to wait for: the decision is already taken, and the
     * identity derives from the retired Session so a crash between commit and
     * activation converges on the same successor.
     */
    requestRecycle(memberId: AgentTeamMemberId, member: AgentTeamAgentMember): Promise<void>;
    private performTransition;
    private settleMember;
    private settleAll;
    /**
     * Crash-recovery hook the Host runs during activation: finish a rollover a
     * restart interrupted. Only a log written by the retired tool path can carry
     * an intent; its turn must have ended durably, because no live event can
     * complete it afterwards.
     */
    recoverPendingTransition(memberId: AgentTeamMemberId, agent: Agent, sessionId: SessionId): void;
    repairContinuations(agent: Agent, state: TeamContextState): void;
    private claimContinuationLatch;
}
//# sourceMappingURL=team-context-management.d.ts.map