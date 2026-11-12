/**
 * The private state a Project subscription keeps outside the ledger: the
 * scheduling checkpoint, the last fifty runs, the failed deliveries waiting for
 * an owner, and the answers already given to a replay request. Deleting every
 * row changes no domain result — the ledger's accepted and published records
 * remain the authority for what happened.
 * @module @contexera/dsh-agent-team/subscription-store
 */
import type { AgentTeamSubscriptionRef } from './types/entities.ts';
import { type SubscriptionAdmissionRecord } from './subscription-admissions.ts';
import type { SubscriptionCheckpoint } from './subscription-runtime.ts';
import { type SubscriptionDeliveryRecord, type SubscriptionReplayRecord, type SubscriptionRunRecord } from './subscription-runs.ts';
export declare const subscriptionDomainSpec: {
    name: string;
    version: number;
    compatibleVersions: number[];
    tables: {
        checkpoints: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<AgentTeamSubscriptionRef, SubscriptionCheckpoint>;
        runs: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, SubscriptionRunRecord>;
        deliveries: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, SubscriptionDeliveryRecord>;
        replays: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, SubscriptionReplayRecord>;
        admissions: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, SubscriptionAdmissionRecord>;
    };
};
//# sourceMappingURL=subscription-store.d.ts.map