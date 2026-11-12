/**
 * Project subscription domain rules that never touch the Host: script
 * snapshots, the output contract, the credential environment, and the
 * scheduling arithmetic. Everything here is pure so a fake clock and a fake
 * executor can drive it directly.
 * @module @contexera/dsh-agent-team/subscriptions
 */
/** A script snapshot is what runs; the repository file it came from is never read again. */
export declare const SUBSCRIPTION_SCRIPT_MAX_BYTES: number;
export declare const SUBSCRIPTION_NAME_MAX_CHARACTERS = 80;
export declare const SUBSCRIPTION_EVENT_ID_MAX_CHARACTERS = 200;
export declare const SUBSCRIPTION_EVENT_TITLE_MAX_CHARACTERS = 200;
export declare const SUBSCRIPTION_EVENT_DETAIL_MAX_CHARACTERS = 2000;
export declare const SUBSCRIPTION_EVENT_URL_MAX_CHARACTERS = 2000;
/** Below this interval a timer subscription would outrun a person's ability to read its events. */
export declare const SUBSCRIPTION_MIN_INTERVAL_MINUTES = 5;
export declare const SUBSCRIPTION_MAX_PER_PROJECT = 20;
export declare const SUBSCRIPTION_MAX_CREDENTIALS = 8;
/** The one prefix the Host reserves for its own injected variables; a subscription may not write there. */
export declare const SUBSCRIPTION_ENV_PREFIX = "DSH_TEAM_";
export declare const SUBSCRIPTION_RUN_TIMEOUT_MS = 60000;
/** Explicit stdout budget: the executor's own default (64,000) is not this contract. */
export declare const SUBSCRIPTION_STDOUT_MAX_BYTES = 65536;
/** Team-owned admission, because the Harness executor does not provide one. */
export declare const SUBSCRIPTION_CONCURRENT_RUNS = 4;
export declare const SUBSCRIPTION_PUBLISH_PER_MINUTE = 20;
/** Accepted-but-unpublished ceiling per subscription; a run that would cross it is refused whole. */
export declare const SUBSCRIPTION_PENDING_MAX = 500;
/** Failed runs in a row that pause the subscription. Any success clears the count. */
export declare const SUBSCRIPTION_FAILURES_BEFORE_PAUSE = 3;
/** A boot spreads its first timer runs over this window so twenty subscriptions do not all fire at once. */
export declare const SUBSCRIPTION_FIRST_RUN_MAX_DELAY_MS = 60000;
/** The shell a snapshot was recorded under; a mismatched live executor fails the run. */
export type SubscriptionShell = 'bash' | 'pwsh';
export interface SubscriptionScriptSnapshot {
    readonly content: string;
    readonly sha256: string;
    /** Shell family the creating Host ran the trial under; the running executor must agree. */
    readonly shell: SubscriptionShell;
}
export interface SubscriptionIntervalTrigger {
    readonly minutes: number;
}
export interface SubscriptionTriggers {
    readonly interval?: SubscriptionIntervalTrigger | undefined;
    readonly webhook?: true | undefined;
}
/** One credential reference the Host resolves per run and injects as an environment name. */
export interface SubscriptionCredential {
    /** Harness credential reference (a POSIX environment-variable name). */
    readonly ref: string;
    /** Name it is injected under; never inside the Host's reserved prefix. */
    readonly env: string;
}
/** One event exactly as a script printed it. */
export interface SubscriptionEvent {
    readonly id: string;
    readonly title: string;
    readonly url?: string | undefined;
    readonly detail?: string | undefined;
}
export type SubscriptionOutput = {
    readonly ok: true;
    readonly events: readonly SubscriptionEvent[];
} | {
    readonly ok: false;
    readonly reason: string;
};
/** The identity of one script snapshot: its exact bytes, so an update is visible in the ledger. */
export declare function scriptHash(content: string): string;
export declare function isScriptHash(value: string): boolean;
export type ScriptSnapshotResult = {
    readonly ok: true;
    readonly script: SubscriptionScriptSnapshot;
} | {
    readonly ok: false;
    readonly reason: string;
};
/**
 * Freeze one script body into the snapshot the ledger stores. The size ceiling
 * applies to the bytes that will be written, not to the characters a person
 * typed: a multi-byte script may cross it earlier.
 */
export declare function snapshotScript(content: string, shell: SubscriptionShell): ScriptSnapshotResult;
/** Why a trigger set cannot be used, or `undefined` when it can. */
export declare function triggersProblem(triggers: SubscriptionTriggers): string | undefined;
/** Whether a name is usable as a subscription label, and why not when it is not. */
export declare function nameProblem(name: string): string | undefined;
/**
 * Validate one credential mapping. Both halves name an environment variable —
 * the reference is the Harness lookup key and the environment name is what the
 * script reads — so both follow the same grammar, and the Host's reserved
 * prefix is refused on the destination only.
 */
export declare function credentialsProblem(credentials: readonly SubscriptionCredential[]): string | undefined;
/**
 * Parse the stdout contract: one JSON object per line, empty lines ignored,
 * nothing published unless every line is legal.
 *
 * Parse one run's JSON-lines output from the original bytes, so a fatal decoder
 * rejects illegal sequences while a replacement character printed as data
 * stays data.
 */
export declare function parseSubscriptionOutput(raw: Uint8Array): SubscriptionOutput;
export interface SubscriptionRunEnvironmentInput {
    readonly projectRef: string;
    readonly subscriptionRef: string;
    readonly trigger: 'interval' | 'webhook' | 'test';
    /** When the last output was accepted, if this subscription ever succeeded. */
    readonly lastSuccessAt?: string | undefined;
    /** The admission id a webhook run hands the script, so it can tell a retry from a new delivery. */
    readonly deliveryId?: string | undefined;
    readonly resolved: Readonly<Record<string, string>>;
}
/**
 * The environment deltas one run adds on top of the executor's own scrub.
 * The Host's own four variables are always present because a script that
 * cannot tell what it is running for is debugged by guessing.
 */
export declare function subscriptionRunEnvironment(input: SubscriptionRunEnvironmentInput): Record<string, string>;
/** The test envelope a webhook-only subscription runs under while it is validated. */
export declare const SUBSCRIPTION_TEST_TRIGGER = "test";
/**
 * The trial envelope's stdin. A webhook-only subscription has no live input to
 * replay at creation, so the contract supplies a sample the script can reject
 * on signature grounds before it is ever deployed.
 */
export declare function subscriptionTestStdin(): string;
/** Next due instant after `from`, or `undefined` for a subscription that has no timer. */
export declare function nextDueAfter(from: number, minutes: number): number;
export type SubscriptionScheduleAction = 'run' | 'wait' | 'skip';
export interface SubscriptionScheduleInput {
    /** Due instant persisted for this subscription, if any. */
    readonly dueAt?: number | undefined;
    readonly now: number;
    readonly paused: boolean;
    readonly deleted: boolean;
    readonly archived: boolean;
    /** Accepted-but-unpublished events for this subscription. */
    readonly pending: number;
    /** Running or queued for a run slot right now. */
    readonly busy: boolean;
}
/**
 * What a timer tick does with one subscription. Waiting is not failing: a due
 * run whose own subscription is already executing (a trial, typically) waits
 * for its turn in the queue, the backlog ceiling skips without counting, and a
 * skip keeps the failure count and re-targets the due instant.
 */
export declare function scheduleAction(input: SubscriptionScheduleInput): SubscriptionScheduleAction;
/** Why a stored snapshot cannot be run as recorded, or `undefined` when it can. */
export declare function scriptSnapshotProblem(script: SubscriptionScriptSnapshot): string | undefined;
/** Everything a definition must satisfy before it may be stored, as the first problem found. */
export declare function subscriptionDefinitionProblem(definition: {
    readonly name: string;
    readonly triggers: SubscriptionTriggers;
    readonly script: SubscriptionScriptSnapshot;
    readonly credentials: readonly SubscriptionCredential[];
}): string | undefined;
//# sourceMappingURL=subscriptions.d.ts.map