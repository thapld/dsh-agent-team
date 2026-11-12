/**
 * The agent-facing Team timestamp formatter. Ledger storage keeps UTC ISO instants; rendering converts them to the fixed Team zone UTC+8 with an explicit offset (`2026-09-08T17:00:00+08:00`). A fixed offset has no daylight-saving component, so a stored instant renders byte-identically on every reread (context-cache invariant). The Web Client renders browser-local time and does not use this module; the subscription form formats its own short UTC+8 reference clock without seconds or offset.
 * @module @contexera/dsh-agent-team/time-format
 */
/** Formats a stored UTC ISO instant as UTC+8 with explicit offset; returns the input unchanged when unparsable, never a fabricated time. */
export declare function formatTeamTimestamp(occurredAt: string): string;
/** Formats a non-negative elapsed millisecond count as whole-second units (`2d 3h 12m 8s`), matching the harness time-context vocabulary. */
export declare function formatTeamDuration(elapsedMs: number): string;
//# sourceMappingURL=time-format.d.ts.map