import type { AgentTeamMemberId, AgentTeamMessage, AgentTeamMessageRef, AgentTeamThreadFact, AgentTeamThreadReadFact } from '@contexera/dsh-agent-team/types';
import { type MentionHandle } from './team-formatters.ts';
export type ThreadFactKey = string;
export declare function factKey(fact: AgentTeamThreadFact): ThreadFactKey;
export declare function messageFact(message: AgentTeamMessage, mentions?: readonly AgentTeamMemberId[]): AgentTeamThreadFact;
/** Union of fact groups in sequence order; a later duplicate of one ref replaces the earlier copy. */
export declare function mergeFacts(...groups: readonly (readonly AgentTeamThreadFact[])[]): readonly AgentTeamThreadFact[];
export declare function minSequence(facts: readonly AgentTeamThreadFact[]): number | undefined;
/**
 * First unread Message that names the Human reader — where a discussion opens when the reader arrived from an unread
 * Inbox row. Flags come from the read that produced these facts, so this has to run before the acknowledgement clears
 * them. A body scan, not delivery, is the test: a Thread reaches its Human in every row.
 */
export declare function firstUnreadMention(facts: readonly AgentTeamThreadReadFact[], humanName: string): AgentTeamMessageRef | undefined;
export declare function stableMentionNames(mentions: readonly AgentTeamMemberId[], handles: ReadonlyMap<AgentTeamMemberId, string>, humanName: string): readonly MentionHandle[];
//# sourceMappingURL=thread-facts.d.ts.map