import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { AgentTeamEnvironmentResult } from '@contexera/dsh-agent-team/types';
export interface TeamEnvironmentSnapshot {
    readonly status: 'loading' | 'ready';
    readonly report?: AgentTeamEnvironmentResult | undefined;
}
export interface TeamEnvironmentSource {
    getSnapshot(): TeamEnvironmentSnapshot;
    subscribe(listener: () => void): () => void;
}
export interface TeamEnvironmentLoader {
    loadEnvironment: () => Promise<RemoteResult<AgentTeamEnvironmentResult>>;
}
export declare class TeamEnvironmentCheck implements TeamEnvironmentSource {
    private snapshot;
    private readonly listeners;
    private reading;
    private readonly loader;
    constructor(loader: TeamEnvironmentLoader);
    readonly getSnapshot: () => TeamEnvironmentSnapshot;
    readonly subscribe: (listener: () => void) => (() => void);
    /** Concurrent callers share one round trip; a failed read keeps the last accepted report. */
    refresh(): Promise<void>;
    dispose(): void;
    private read;
    /** Settle a read that produced no report so a reader stops waiting on a `loading` that never finishes; a standing report is untouched. */
    private fail;
    private commit;
}
export declare function useEnvironmentCheck(environment: TeamEnvironmentSource): TeamEnvironmentSnapshot;
//# sourceMappingURL=environment-check.d.ts.map