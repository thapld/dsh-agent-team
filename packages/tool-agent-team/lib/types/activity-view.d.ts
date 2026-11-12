import { type ActivityFact } from '@contexera/dsh-agent-team/host';
/** The immutable Activity fields a tool result carries; no current Task or Claim state is among them. */
export interface ActivityViewFields {
    readonly kind?: string;
    readonly activity?: string;
    readonly activityRef?: string;
    readonly sequence: number;
    readonly actor?: string;
    readonly threadRef?: string;
    readonly taskRef?: string;
    readonly projectRef?: string;
    readonly workerRef?: string;
    readonly engine?: string;
    readonly state?: string;
    readonly reason?: string;
    readonly memberId?: string;
    readonly claimRef?: string;
    readonly claimRefs?: readonly string[];
    readonly completedClaimRefs?: readonly string[];
    readonly acceptedClaimRefs?: readonly string[];
    readonly releasedClaimRefs?: readonly string[];
    readonly from?: string;
    readonly to?: string;
    readonly refollowedMembers?: readonly string[];
}
/** Rebuild the exact Host Activity fact a view came from; a view missing its identity yields none, so it can never bind. */
export declare function activityFromView(value: ActivityViewFields, projectRef?: string): ActivityFact | undefined;
//# sourceMappingURL=activity-view.d.ts.map