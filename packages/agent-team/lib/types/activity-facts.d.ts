import type { AgentTeamActivity, AgentTeamActivityRef, AgentTeamClaimRef, AgentTeamMainActivity, AgentTeamMemberId, AgentTeamProjectRef, AgentTeamTaskRef, AgentTeamThreadRef, AgentTeamWorkerRef, AgentTeamWorkerState } from './types.ts';
import type { WorkerEngine } from './worker-settings.ts';
/** One Thread Activity projected from its ledger fact alone. Absent arrays have already become empty. */
export interface ThreadActivityFact {
    readonly scope: 'thread';
    readonly activityRef: AgentTeamActivityRef;
    readonly sequence: number;
    readonly kind: AgentTeamActivity['kind'];
    readonly actor: AgentTeamMemberId;
    /** The Task this Activity is about; null on a discussion Thread, which holds no Task. */
    readonly taskRef: AgentTeamTaskRef | null;
    readonly threadRef: AgentTeamThreadRef;
    readonly claimRef: AgentTeamClaimRef | null;
    readonly claimRefs: readonly AgentTeamClaimRef[];
    readonly completedClaimRefs: readonly AgentTeamClaimRef[];
    readonly acceptedClaimRefs: readonly AgentTeamClaimRef[];
    readonly releasedClaimRefs: readonly AgentTeamClaimRef[];
    readonly from: AgentTeamMemberId | null;
    readonly to: AgentTeamMemberId | null;
    readonly refollowedMembers: readonly AgentTeamMemberId[];
    readonly workerRef: AgentTeamWorkerRef | null;
    readonly workerEngine: WorkerEngine | null;
    readonly workerState: Exclude<AgentTeamWorkerState, 'running'> | null;
    readonly workerReason: string | null;
}
/** One Main stream Activity projected from its ledger fact alone. */
export interface MainActivityFact {
    readonly scope: 'main';
    readonly activityRef: AgentTeamActivityRef;
    readonly sequence: number;
    readonly kind: AgentTeamMainActivity['kind'];
    /** The Member who acted, or the Host handle when the Host itself paused a subscription. */
    readonly actor: AgentTeamMemberId | 'agent-team';
    readonly projectRef: AgentTeamProjectRef;
    /** The Agent whose ownership changed; absent on a subscription lifecycle line. */
    readonly memberId?: AgentTeamMemberId | undefined;
    /** The subscription a lifecycle line concerns; absent on an ownership change. */
    readonly subscriptionRef?: import('./types.ts').AgentTeamSubscriptionRef | undefined;
}
export type ActivityFact = ThreadActivityFact | MainActivityFact;
/** What a surface must match before a fact digest is even considered. */
export type ActivityIdentity = {
    readonly scope: 'thread';
    readonly activityRef: AgentTeamActivityRef;
    readonly threadRef: AgentTeamThreadRef;
} | {
    readonly scope: 'main';
    readonly activityRef: AgentTeamActivityRef;
    readonly projectRef: AgentTeamProjectRef;
};
export declare function activityFact(activity: AgentTeamActivity): ThreadActivityFact;
export declare function activityFact(activity: AgentTeamMainActivity): MainActivityFact;
export declare function activityFact(activity: AgentTeamActivity | AgentTeamMainActivity): ActivityFact;
export declare function activityIdentity(fact: ActivityFact): ActivityIdentity;
/** Complete immutable event fields, without current Task/Claim state or empty optional lists. */
export declare function activityText(fact: ActivityFact): string;
export declare function activityFactDigest(fact: ActivityFact): string;
//# sourceMappingURL=activity-facts.d.ts.map