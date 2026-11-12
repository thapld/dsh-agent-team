/**
 * The Team's one seam for reading an engine's own record of one Worker run after
 * the process that wrote it exited. Callers never touch a path, a format
 * generation, or an engine's error text: they hand over the anchors the
 * settlement recorded and get a bounded set of fragments, or a reason there are
 * none.
 *
 * Three rules hold the whole design. The reader opens only the location the
 * settlement recorded, resolves it through every symlink, and requires the
 * record's own first line to name the session the settlement recorded — never a
 * scan for the newest file, never a path a caller supplied, never a file whose
 * identity the content does not confirm. Its byte bound applies to the read
 * itself, so an oversized line is never buffered or parsed. And a fragment whose
 * text looks like a credential is withheld instead of masked, because a masked
 * secret is still a secret the reader read.
 *
 * The two engines name the same facts differently: Codex writes a session header
 * and a turn id, Claude writes a queue header and names the turn by the prompting
 * user message. The reader keeps one bounded pass and one set of rules; the
 * engine only chooses which fields identify the session, the turn, and a failure.
 * @module @contexera/dsh-agent-team/worker-inspection
 */
import type { AgentTeamWorkerInspectionHistory } from './types/requests-results.ts';
import type { WorkerEngine } from './worker-settings.ts';
/** How much of one native record the reader will take before it stops and says so. */
export declare const WORKER_HISTORY_MAX_BYTES: number;
/** How many fragments one read returns; the report is a diagnostic, not a transcript. */
export declare const WORKER_HISTORY_MAX_FRAGMENTS = 4;
/** How long one fragment may be, in code points. */
export declare const WORKER_FRAGMENT_MAX_CHARACTERS = 600;
/** How long a recorded location may be before this reader refuses it instead of carrying it. */
export declare const WORKER_LOCATION_MAX_CHARACTERS = 4096;
/** The anchors a settlement recorded, as a look-up takes them. */
export interface WorkerHistoryAnchors {
    /** The engine the run used: it decides which record shape the reader expects. */
    readonly engine: WorkerEngine;
    readonly nativeSessionId?: string | undefined;
    readonly nativeTurnId?: string | undefined;
    /** The bounded native turn anchors retained at settlement; older records carry only `nativeTurnId`. */
    readonly nativeTurnIds?: readonly string[] | undefined;
    /** The bounded native input UUIDs retained at settlement; Claude names turns by these. */
    readonly nativeInputIds?: readonly string[] | undefined;
    readonly nativeStorage?: string | undefined;
}
/**
 * Read one run's native record, bounded and fail-closed. The handle is closed on
 * every path, and every way the record cannot answer becomes its own reason —
 * a missing file, an unreadable one, a shape this Team does not read, or a record
 * that holds no turn with the recorded id.
 */
export declare function readWorkerHistory(anchors: WorkerHistoryAnchors): Promise<AgentTeamWorkerInspectionHistory>;
//# sourceMappingURL=worker-inspection.d.ts.map