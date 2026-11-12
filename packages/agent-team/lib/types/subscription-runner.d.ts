/**
 * Unattended execution of one subscription script: which shell family the
 * mounted executor really runs, the sandbox policy the Host builds from its own
 * Workspace record, the credential injection, and the output contract applied
 * to the captured streams.
 *
 * Two facts shape this module. The Harness shell result exposes decoded text,
 * so the run forces and recovers the collect reader's bounded raw spill before
 * validating UTF-8 and the byte ceiling. And a subscription runs with no
 * Session, so nothing here may inherit the process cwd or an Agent's sandbox
 * setting: the policy is always explicit and never the escalating mode.
 * @module @contexera/dsh-agent-team/subscription-runner
 */
import type { ShellExecRequest, ShellExecSpec, ShellRunResult } from '@deepseek-ai/dsh-shell';
import type { CredentialInfo, CredentialRef, ResolvedCredential } from '@deepseek-ai/dsh-credentials';
import { type SubscriptionEvent, type SubscriptionShell } from './subscriptions.ts';
import type { AgentTeamSubscription } from './types/entities.ts';
/**
 * The executor subset a run drives — resolve, execute, and settle. Spelled out
 * rather than `Pick<ShellExecutor, …>` so a test double only has to model the
 * one call the runner makes, and a Host that mounts no executor supplies
 * `undefined`.
 */
export interface SubscriptionShellExecutor {
    resolve(request: ShellExecRequest): ShellExecSpec;
    execute(spec: ShellExecSpec): Promise<{
        result(): Promise<ShellRunResult>;
    }>;
}
/** The credential subset a run drives. */
export interface SubscriptionCredentials {
    resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined>;
    describe(ref: CredentialRef): Promise<CredentialInfo>;
}
/** Every declared reference the Host cannot resolve right now. */
export declare function missingCredentials(credentials: SubscriptionCredentials | undefined, declared: AgentTeamSubscription['credentials']): Promise<readonly string[]>;
/** A probe must never outlive a run's own budget, and a hung executor must not hang the scheduler. */
export declare const SUBSCRIPTION_PROBE_TIMEOUT_MS = 10000;
/** How much of one stream a refusal returns: enough to fix the script, never a whole log. */
export declare const SUBSCRIPTION_FAILURE_TAIL_BYTES: number;
/**
 * The structured outcome of one run. The first two are successes; the rest name
 * what the owner has to change, so a Main stream line or a record never has to
 * parse prose to tell a timeout from a rejected script.
 */
export type SubscriptionRunCategory = 'accepted' | 'empty'
/** A trial run the caller asked for: its output was valid, and it published nothing. */
 | 'verified' | 'timeout' | 'exit-code' | 'stdout-truncated'
/** Persisted run records from older releases may carry this category; current runs do not produce it. */
 | 'invalid-utf8' | 'invalid-output' | 'executor-missing' | 'shell-mismatch' | 'workspace-missing' | 'credentials-missing' | 'spawn-failed' | 'backlog-full';
export declare const SUBSCRIPTION_RUN_CATEGORIES: readonly SubscriptionRunCategory[];
/** A success is a run whose output was durably accepted, an empty one accepted nothing new, and a trial one published nothing at all. */
export declare function runSucceeded(category: SubscriptionRunCategory): boolean;
export interface SubscriptionRunReport {
    /** True only when the script exited 0 with a complete, valid event stream. */
    readonly ok: boolean;
    /** Set by every failure path: what the owner has to change. A success has none. */
    readonly category?: SubscriptionRunCategory | undefined;
    /** Why the run failed, in the words an owner reads in the Main stream or a refusal. */
    readonly reason?: string | undefined;
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number | null;
    readonly timedOut: boolean;
    readonly events: readonly SubscriptionEvent[];
}
/** The category a failed run must carry; a failure without one is a bug, not a default. */
export declare function failureCategory(report: SubscriptionRunReport): SubscriptionRunCategory;
/** The last bytes of one stream, decoded on a character boundary. */
export declare function failureTail(text: string, maxBytes?: number): string;
/** The family the executor answered as, or the refusal an owner can act on. */
export interface ShellFamilyProbe {
    readonly family?: SubscriptionShell | undefined;
    readonly failure?: string | undefined;
}
/** The first family that answers, or the first refusal's own words. */
export declare function probeShellFamily(executor: SubscriptionShellExecutor | undefined): Promise<ShellFamilyProbe>;
/** The family the executor runs, or undefined when no probe answered at all. */
export declare function detectShellFamily(executor: SubscriptionShellExecutor | undefined): Promise<SubscriptionShell | undefined>;
export interface SubscriptionRunRequest {
    readonly executor: SubscriptionShellExecutor | undefined;
    readonly credentials: SubscriptionCredentials | undefined;
    /** The family the mounted executor was probed as; the snapshot must agree. */
    readonly liveShell: SubscriptionShell | undefined;
    /** Why the family probe answered nothing; a refused run hands this to the owner. */
    readonly liveShellFailure?: string | undefined;
    readonly subscription: AgentTeamSubscription;
    /** What triggered this run: a timer, a webhook delivery, or an owner's trial. */
    readonly trigger: 'interval' | 'webhook' | 'test';
    /** The Project Workspace root from the Host's own registry record; absent when the directory is gone. */
    readonly workspaceRoot: string | undefined;
    readonly lastSuccessAt: string | undefined;
    /** The stdin a webhook run replays, already shaped as `{headers, body}`. */
    readonly stdin?: string | undefined;
    /** The admission id a webhook run hands the script, so it can tell a retry from a redelivery. */
    readonly deliveryId?: string | undefined;
    readonly stdoutMaxBytes?: number | undefined;
    readonly timeoutMs?: number | undefined;
}
/**
 * Run one snapshot under the Host's own policy and apply the output contract.
 * The report's `category` distinguishes what the owner must change: the
 * executor, the credentials, the Workspace, the script's exit, its output, or
 * the size it printed.
 */
export declare function runSubscriptionScript(request: SubscriptionRunRequest): Promise<SubscriptionRunReport>;
/** Whether a trial output should seed the deduplication baseline. */
export declare function baselineIdsOf(events: readonly SubscriptionEvent[]): readonly string[];
//# sourceMappingURL=subscription-runner.d.ts.map