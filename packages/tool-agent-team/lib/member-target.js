import { AGENT_TEAM_HUMAN_MEMBER_ID } from '@contexera/dsh-agent-team/host';
import { recoveryFor } from '@contexera/dsh-agent-team/recovery-hints';
/** Resolve one written Member into its id, refusing an unknown form and an ambiguous prefix differently. */
export function memberTarget(host, raw) {
    const trimmed = raw.trim();
    const handle = trimmed.replace(/^@/u, '').toLowerCase();
    if (trimmed === AGENT_TEAM_HUMAN_MEMBER_ID || handle === 'human' || handle === host.humanHandle().toLowerCase()) {
        return AGENT_TEAM_HUMAN_MEMBER_ID;
    }
    const named = host.members().find(status => status.member.handle.toLowerCase() === handle);
    if (named !== undefined)
        return named.member.memberId;
    const hex = trimmed.replace(/^member:/u, '').toLowerCase();
    if (/^[0-9a-f]{6,}$/u.test(hex)) {
        const matches = host.members().filter(status => status.member.memberId.slice('member:'.length).toLowerCase().startsWith(hex));
        if (matches.length === 1)
            return matches[0].member.memberId;
        if (matches.length > 1) {
            const candidates = matches.map(status => status.member.memberId).join(', ');
            throw new Error(`${trimmed} matches ${matches.length} Members (${candidates}) — ${recoveryFor('ambiguous_ref').sentence({ refused: trimmed })}`);
        }
    }
    if (trimmed.startsWith('member:'))
        return trimmed;
    throw new Error(`${trimmed} names no Member — pass a memberRef, an @Handle, a unique 6+ hex prefix, or 'human'. ${recoveryFor('unknown_ref').sentence({ refused: trimmed })}`);
}
