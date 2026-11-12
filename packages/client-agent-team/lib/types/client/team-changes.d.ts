import type { ClientRemote } from '@deepseek-ai/dsh-api-gateway/client';
import type { AgentTeamChangeScope } from '@contexera/dsh-agent-team/types';
export type TeamChangeScope = AgentTeamChangeScope | undefined;
export type TeamChangeUpdate = 
/** `baseline` marks the first item of a stream (re)open: it invalidates no matter its version. */
{
    readonly type: 'changed';
    readonly version: number;
    readonly baseline?: true;
} | {
    readonly type: 'failed';
    readonly message: string;
};
export type TeamChangeListener = (update: TeamChangeUpdate) => void;
/** One logical stream per scope per page; Harness owns the shared transport and recovery. */
export declare class TeamChangeStream {
    private readonly remote;
    private readonly subscriptions;
    constructor(remote: Pick<ClientRemote, '$stream' | 'agentTeam'>);
    subscribe(scope: TeamChangeScope, listener: TeamChangeListener): () => void;
    /** Reopen every scope whose stream ended for good. The Harness resumes a live generation across reconnects, but a terminated one is gone; listeners keep their seats, so only the stream is replaced. */
    recover(): void;
    private open;
    dispose(): Promise<void>;
    private fail;
    private run;
}
/**
 * The Host's `changes` stream never wakes on a Thread read (it moves only the reader's private watermark), but a durable
 * read consumes the reader's mention markers, so the badge and Inbox refresh from the completed read itself.
 */
export declare class TeamReadStream {
    private version;
    private readonly listeners;
    bump(): void;
    subscribe(listener: () => void): () => void;
}
//# sourceMappingURL=team-changes.d.ts.map