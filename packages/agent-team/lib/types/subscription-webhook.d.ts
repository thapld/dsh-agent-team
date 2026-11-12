/**
 * The webhook trigger's contract, outside the Host so it is provable without a socket.
 * @module @contexera/dsh-agent-team/subscription-webhook
 */
/** Where a subscription's hook lives on the public origin, before its token. */
export declare const WEBHOOK_PATH_PREFIX = "/team/hooks/";
/** One request's body limit. Larger is refused rather than read: a partial body cannot be verified. */
export declare const WEBHOOK_BODY_MAX_BYTES: number;
/** One forwarded header value's limit, in bytes. A longer value is refused, never truncated. */
export declare const WEBHOOK_HEADER_VALUE_MAX_BYTES = 1024;
/** Deliveries one subscription may have queued or retrying at once. */
export declare const WEBHOOK_QUEUE_LIMIT = 10;
/** What a full queue asks an auto-retrying provider to wait: shorter than its own ladder, so a burst drains. */
export declare const WEBHOOK_QUEUE_RETRY_AFTER_SECONDS = 60;
/** Backoff before each retry of a delivery whose script failed: 1, 5 and 30 minutes. */
export declare const WEBHOOK_RETRY_DELAYS_MS: readonly number[];
/** Retries one delivery gets before it becomes a failed delivery an owner must handle. */
export declare const WEBHOOK_RETRY_LIMIT: number;
/** What a subscription carries in the ledger: the hash, never the address it names. */
export interface SubscriptionWebhookArm {
    readonly tokenHash: string;
    readonly generation: number;
    /** When this generation's token was minted, for the operator reading the ledger. */
    readonly armedAt: string;
}
/** A fresh token: random, so a reset relates old and new address in no way. */
export declare function mintWebhookToken(random?: (size: number) => Buffer): string;
/** The ledger's copy of a token: its SHA-256, so a leak of storage does not yield addresses. */
export declare function webhookTokenHash(token: string): string;
/** Whether two hex hashes name the same token, compared without leaking where they diverge. */
export declare function sameWebhookTokenHash(left: string, right: string): boolean;
/** The token a request path names, or `undefined` when the path is not a hook address. */
export declare function webhookTokenOfPath(pathname: string): string | undefined;
/** Why a public origin cannot carry hook addresses: a path, query or fragment makes one ambiguous. */
export declare function webhookOriginProblem(origin: string): string | undefined;
/** One subscription's address on the configured origin. */
export declare function webhookAddress(origin: string, token: string): string;
/** The sentence an arming write refuses with, so the operator learns which setting to write. */
export declare function webhookOriginRefusal(origin: string): string | undefined;
export type WebhookHeadersResult = {
    readonly ok: true;
    readonly headers: Readonly<Record<string, string>>;
} | {
    readonly ok: false;
    readonly reason: string;
    readonly header: string;
};
/**
 * The headers a script may see, lowercased, or why one cannot be forwarded. A value
 * past the limit refuses the delivery: a cut signature verifies nothing (see docs/architecture/host-authority.md).
 */
export declare function forwardableHeaders(raw: Readonly<Record<string, string | readonly string[] | undefined>>): WebhookHeadersResult;
/** The stdin a webhook run reads: headers, and the raw body a signature hashes. */
export declare function webhookStdin(headers: Readonly<Record<string, string>>, body: string): string;
/** How long to wait before retry number `attempt`, counting the first retry as one. */
export declare function webhookRetryDelayMs(retry: number): number | undefined;
/** How often the Host looks for a delivery that is due. One second is a run's granularity, not a queue's. */
export declare const WEBHOOK_PUMP_INTERVAL_MS = 5000;
/** How long the entry waits for one body, so a slow client never holds a queue slot. */
export declare const WEBHOOK_READ_DEADLINE_MS = 10000;
/**
 * The status table from docs/architecture/host-authority.md plus its four refusals, so the entry and the tests
 * read one list.
 */
export declare const WEBHOOK_STATUS: Readonly<{
    queued: 202;
    notFound: 404;
    paused: 409;
    bodyTooLarge: 413;
    notPost: 405;
    queueFull: 429;
    storageFailed: 503;
    headerTooLarge: 431;
    unsupportedEncoding: 415;
    notUtf8: 400;
}>;
//# sourceMappingURL=subscription-webhook.d.ts.map