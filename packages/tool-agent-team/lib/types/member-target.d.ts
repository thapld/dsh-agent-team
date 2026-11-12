/**
 * One Member named by a caller, read the same way everywhere.
 *
 * Every field that takes a Member — a Task's `target` or `accountable`, a
 * subscription's event recipients — accepts what an Agent actually sees: a
 * branded ref, an `@Handle`, a unique 6+ hex prefix of the id, or the Human's
 * own alias. Accepting only refs would force every caller to look up ids for
 * names it already knows, and a rejection would then read as "not a member"
 * when the real problem was the written form.
 * @module @contexera/dsh-agent-team-tools/member-target
 */
import type { AgentTeamMemberId } from '@contexera/dsh-agent-team/types';
import AgentTeam from '@contexera/dsh-agent-team/host';
/** Resolve one written Member into its id, refusing an unknown form and an ambiguous prefix differently. */
export declare function memberTarget(host: AgentTeam, raw: string): AgentTeamMemberId;
//# sourceMappingURL=member-target.d.ts.map