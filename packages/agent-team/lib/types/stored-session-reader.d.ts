/**
 * The Team's single seam for reading stored Sessions: one `open → read → close` cycle that always closes the handle and normalizes failures into five categories. Callers never touch a `SessionHandle`, artifact path, format generation, or Harness error text. Reading and classification only; no Member lifecycle, Agent create/resume, UI, or ledger.
 *
 * The JSONL backend throws its `corrupt session log` family as plain `Error`s, so corruption is detected by that message prefix; if the text changes, failures degrade to `unknown`, which consumers treat conservatively. Typed refusals are also matched through `error.cause` chains because the Harness agent layer wraps persistence failures during resume.
 * @module @contexera/dsh-agent-team/stored-session-reader
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SessionEvent, SessionHeader, SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session';
import { type SessionLocation } from '@deepseek-ai/dsh-session-persistence';
/** Why one stored Session could not be read; the policy axis for consumers. */
export type StoredSessionFailureKind = 'missing' | 'refused' | 'corrupt' | 'io' | 'unknown';
/** One normalized stored-Session read failure. */
export interface StoredSessionFailure {
    readonly kind: StoredSessionFailureKind;
    readonly sessionId: SessionId;
    /** The underlying reason, from the matched error's own message. */
    readonly detail: string;
    /** The refused artifact's location, when the backend reported one. */
    readonly location?: SessionLocation;
}
/** A complete, validated stored-Session read: storage metadata plus the whole event log. */
export interface StoredSessionInspection {
    readonly header: SessionHeader;
    readonly inheritedEventCount: SessionLogOffset;
    readonly events: readonly SessionEvent[];
}
/** The result of one read: the inspection, or its normalized failure. */
export type StoredSessionReadResult = {
    readonly ok: true;
    readonly inspection: StoredSessionInspection;
} | {
    readonly ok: false;
    readonly failure: StoredSessionFailure;
};
/** A call site's session-read failure, carrying the typed classification so activation can route the diagnostic without re-matching error text. */
export declare class StoredSessionReadError extends Error {
    readonly failure: StoredSessionFailure;
    constructor(message: string, failure: StoredSessionFailure);
}
/** Classifies any failure as a stored-Session read failure; total: unmatched errors become `unknown`, a direct system error code becomes `io`. Call only where the failed operation is known to be a session read. */
export declare function classifyStoredSessionFailure(error: unknown, sessionId: SessionId): StoredSessionFailure;
/** The session-shaped failure carried by an error, if any: deterministic markers are matched through the cause chain, transient fs errors are not (unprovable outside the reader). `undefined` means not session-shaped. */
export declare function sessionFailureOf(error: unknown, sessionId: SessionId): StoredSessionFailure | undefined;
/** Read stored Sessions through one seam: full validated reads with normalized failures. */
export declare class StoredSessionReader {
    private readonly ctx;
    constructor(ctx: Context);
    /** Reads one stored Session completely; the handle is closed on every path and failures are returned as a category, never thrown. */
    read(sessionId: SessionId): Promise<StoredSessionReadResult>;
    exists(sessionId: SessionId): Promise<boolean>;
}
//# sourceMappingURL=stored-session-reader.d.ts.map