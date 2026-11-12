import { z } from 'zod';
import type { AgentTeamOperation, AgentTeamOperationId } from './types.ts';
/** Durable validator for the closed Agent Team operation union; ledgers written before message occurredAt existed normalize on load. */
export declare const agentTeamOperationSchema: z.ZodType<AgentTeamOperation>;
/** Versioned durable declaration. The version moves only when a stored record would mean something different: there is no migration, so a bump breaks every existing ledger. Additive operation kinds stay at v1. */
export declare const agentTeamDomainSpec: {
    name: string;
    version: number;
    tables: {
        operations: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<AgentTeamOperationId, AgentTeamOperation>;
    };
};
//# sourceMappingURL=spec.d.ts.map