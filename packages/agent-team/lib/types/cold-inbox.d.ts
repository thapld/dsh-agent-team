/**
 * Pending agent input reconstructed from a Session's durable inbox splices.
 *
 * @module agent-team/cold-inbox
 */
import type { InboxState } from '@deepseek-ai/dsh-agent';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
/**
 * Fold one Session's `agent/inbox/spliced` history for a generation that has no
 * live Agent. Coordinates are validated exactly as the driver's own fold
 * validates them, so an unsafe range or a message pending in both lists yields
 * undefined instead of a repaired guess.
 * @param events - events of one Session, in log order.
 * @returns pending input by boundary, or undefined when the history is invalid.
 */
export declare function coldInboxOf(events: readonly SessionEvent[]): InboxState | undefined;
//# sourceMappingURL=cold-inbox.d.ts.map