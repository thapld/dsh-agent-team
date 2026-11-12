import type { AgentTeamActivity, AgentTeamClaim, AgentTeamClientMemberStatus, AgentTeamInboxActor, AgentTeamMemberId, AgentTeamTask, AgentTeamTaskRef, AgentTeamThreadRef, AgentTeamWorkerRef, AgentTeamWorkerStateView } from '@contexera/dsh-agent-team/types';
import type { TeamKey } from './locales.ts';
import type { TeamConversationProps } from './slots.ts';
import type { TeamStateDotState } from './TeamStateDot.tsx';
export declare function formatTaskStatus(status: AgentTeamTask['status'], t: TeamConversationProps['t']): string;
/**
 * The two localized halves of one runtime-risk statement: the class label names
 * what kind of problem this is, and the sentence key states it of the Member
 * (it keeps its `{member}` placeholder so the caller supplies the handle). The
 * Host's own diagnostic stays English and belongs in the row's title, so the
 * visible line reads in the interface language.
 */
export declare function formatRiskClass(status: Pick<AgentTeamClientMemberStatus, 'diagnostic'>, t: TeamConversationProps['t']): {
    readonly label: string;
    readonly sentenceKey: TeamKey;
};
/**
 * The first sentence of a Host diagnostic: risk rows read one line, and the
 * Host writes the reason as its first sentence with recovery context after it.
 * A terminator the Host used mid-sentence becomes a full stop so the clamped
 * line reads as a sentence; the untouched text stays in the row's title.
 */
export declare function firstSentence(detail: string): string;
/**
 * Status indicator for a Task status, the dot every Task surface renders.
 * Active states map to StateDot variants; every status renders a dot so they
 * share one shape language — todo is a hollow ring (not started), closed a
 * quiet gray dot (archived).
 */
export declare function taskStatusDot(status: AgentTeamTask['status']): TeamStateDotState;
/**
 * One body line as compact plain text: the first non-empty line with its
 * Markdown presentation projected away, whitespace compacted, then bounded.
 * Projection runs before the bound, so a marker pair like `**…**` is never cut
 * into an opener that never closes. A Message body keeps its Markdown wherever
 * it renders as a Message; every label, card title, chip and quote line reads
 * the body through here. Both bounds and the ellipsis decision count code
 * points, so an astral character never leaves half of itself behind.
 */
export declare function plainGist(text: string, max?: number): string;
export declare function memberHue(memberId: string): number;
/**
 * The one place an avatar initial is derived. It counts code points, not UTF-16
 * units: `slice(0, 1)` hands a handle that opens with an astral character half a
 * surrogate pair, which renders as a replacement mark. A caller with its own
 * empty fallback supplies it — this answers only what the text starts with.
 */
export declare function identityInitial(text: string): string;
export interface RefSegment {
    readonly text: string;
    readonly ref?: string;
}
/** Splits a literal run into plain and canonical branded-ref segments; prose colons never linkify. */
export declare function splitBrandedRefs(text: string): readonly RefSegment[];
/**
 * Whether one string's whole content is exactly one branded ref. A code span
 * like this is the model styling a ref as an identifier, not publishing code,
 * so the Markdown pass may linkify it; anything larger stays literal.
 */
export declare function isSingleBrandedRef(text: string): boolean;
export interface MentionSegment {
    readonly text: string;
    readonly mention: boolean;
    readonly name?: string;
}
/**
 * The Human's durable Member id. It is the ledger's own identity for the
 * reader (`AGENT_TEAM_HUMAN_MEMBER_ID` on the Host), spelled here because a
 * client package must not import a Host package. The same literal is already
 * the reference for the historic handle below and for draft mention
 * resolution, so there is one spelling in this package, not three.
 */
export declare const HUMAN_MEMBER_ID: AgentTeamMemberId;
export declare const HUMAN_HISTORIC_HANDLE = "human";
/** Every handle that addresses the Human reader, so the mention scan and chips agree on who the reader is. */
export declare function humanMentionHandle(humanName: string): MentionHandle;
/**
 * Whether one Message's body itself spells a handle of the reader: the same
 * shared scan the mention chips render by, so the card's "mentioned you" says
 * what the words say. This is deliberately not the delivery set — a Thread
 * delivers to its Human without ever naming them, and a delivery is not a
 * mention, so a delivery-based answer would light the card on Messages that
 * never addressed the reader.
 *
 * The question is about the reader and nobody else, so the scan runs over the
 * reader's own handles rather than over the Message's mentioned Members: naming
 * someone else is the one thing that must never raise this. An unknown reader
 * is named by nothing.
 */
export declare function bodyMentionsHuman(body: string, humanName: string | undefined): boolean;
/**
 * One mentioned Member as a Message renders them: the display name the seat
 * prints, plus every older handle that still addresses the same person. A
 * rename must not orphan the mentions written before it — the bodies say
 * `@human`, the roster says the new name, and both are the Human.
 */
export type MentionHandle = string | {
    readonly name: string;
    readonly also: readonly string[];
};
export declare function mentionNameOf(mention: MentionHandle): string;
/**
 * Locate one Message's delivered mention names inside its literal body. Matching
 * is the shared Host delivery scan — an authored `@`, case-insensitive on Unicode
 * word boundaries, longest handle first, code quoted rather than called — so a chip
 * never lands where delivery would not reach. A chip names the person by their
 * current name, the way member refs do: a body that wrote an older handle of a
 * renamed Human chips as the name they answer to today. A person whose entry
 * matched through any of their handles counts as matched, so the fallback row
 * never repeats someone already chipped inline; names absent from the body come
 * back unmatched so the consumer can append them as a fallback chip row.
 */
export declare function splitMentionNames(text: string, mentions: readonly MentionHandle[]): {
    segments: MentionSegment[];
    unmatched: readonly string[];
};
/** Uses the shared delivery scan so the composer agrees with the Host on what a draft mentions. */
export declare function containsMention(body: string, handle: string): boolean;
/**
* Member ids a draft notifies by text alone, previewing the Host's body mention resolution.
* A written handle counts whenever its Member can still take a Message (offline included).
* Preview-only: the body is the sole delivery authority, so this is exactly what the Host derives.
*/
export declare function mentionedMemberIds(body: string, members: readonly AgentTeamClientMemberStatus[]): readonly AgentTeamMemberId[];
/**
* Canonical chip handles for one Message's structured mention refs. The Human is not in
* `members()`, so the caller passes their profile name; the historic `human` alias keeps
* pre-rename bodies chipping inline.
*/
export declare function mentionNamesOf(mentions: readonly AgentTeamMemberId[], handles: ReadonlyMap<AgentTeamMemberId, string>, humanName: string): MentionHandle[];
/** One Member written the way every surface addresses them: `@handle`, with one prefix however the name was spelled. */
export declare function memberTag(name: string): string;
export declare function claimersLabel(owners: ReadonlyArray<{
    readonly name: string;
}>, t: TeamConversationProps['t']): string;
/**
 * The faces an executor group lists: the live Claim owners other than the accountable, whose face the seat beside the
 * group has already drawn. One person was otherwise drawn twice in one line — once as the owner, once as an executor —
 * which read as two roles disagreeing about who holds the Task rather than as one person doing both.
 */
export declare function claimersBeyond<T extends {
    readonly memberId: AgentTeamMemberId;
}>(owners: readonly T[], accountable: AgentTeamMemberId | undefined): readonly T[];
/**
 * How a Task's responsibility is stated: the reader in the second person, a suspended owner as a standing, any other
 * Member by handle. The card, the board and the Thread page therefore cannot describe one Task three ways.
 */
export declare function accountableLabel(owner: Pick<AgentTeamInboxActor, 'memberId' | 'name' | 'state'>, humanMemberId: AgentTeamMemberId | undefined, t: TeamConversationProps['t']): string;
/**
 * The standing as the seat writes it: the face beside it already names the person, so the words carry only the role —
 * `负责`, the reader as `你负责`, a suspended owner as `负责 · 已暂停`. `accountableLabel` keeps the full sentence the
 * card's accessible name and the seat's own label speak, so the concise line never becomes the only description.
 */
export declare function accountableWord(owner: Pick<AgentTeamInboxActor, 'memberId' | 'state'>, humanMemberId: AgentTeamMemberId | undefined, t: TeamConversationProps['t']): string;
/**
* Mention names still worth a trailing chip: not the reader (chipped in place or unnamed),
* and not an author the quote line already names. An unresolved quote names nobody.
*/
export declare function unshownMentionNames(names: readonly string[], readerName: string | undefined, quoteAuthor: string | undefined): readonly string[];
/**
* Whether an Agent body survives literal rendering unchanged. Only such bodies may use inline
* mention chips; richer Markdown cannot interleave them and keeps the trailing chip row.
*/
export declare function isPlainTextBody(text: string): boolean;
export declare function formatAbsoluteTime(occurredAt: string): string;
export declare function formatMessageTime(occurredAt: string, now?: Date): string;
/**
* Clock-only label with no date: the continuation row's 28px time seat cannot fit the date
* forms of `formatMessageTime`. The date is shown by the run's identity line and day separator.
*/
export declare function formatClockTime(occurredAt: string): string;
/**
* Recency label for an Inbox row, shared with the Project feed entry line. Today is a bare
* clock time; yesterday keeps its word; older entries use the Message date form.
*/
export declare function formatInboxTime(occurredAt: string, t: TeamConversationProps['t'], now?: Date): string;
/**
 * One Activity row's sentence. A Worker start carries no state of its own, so
 * its word comes from the read's `workerStates`, never from the fact.
 */
export declare function formatActivity(activity: AgentTeamActivity, options: {
    readonly t: TeamConversationProps['t'];
    readonly actorName: (memberId: AgentTeamMemberId) => string;
    readonly claims: readonly AgentTeamClaim[];
    readonly workerStates?: ReadonlyMap<AgentTeamWorkerRef, AgentTeamWorkerStateView> | undefined;
}): string;
export declare function stripAttachmentLines(body: string): string;
/** Bodies past this length render clamped; derived from the body alone so every surface agrees. */
export declare const MESSAGE_COLLAPSE_CHARS = 600;
export declare function shouldClampMessage(displayBody: string): boolean;
export type MessageBodyRender = 'inline' | 'literal' | 'markdown';
export interface PlannedMessageBody {
    readonly displayBody: string;
    /** Rich Agent Markdown: only such bodies get the post-render chipify pass. */
    readonly richAgentBody: boolean;
    readonly render: MessageBodyRender;
    readonly inline?: ReturnType<typeof splitMentionNames>;
    readonly fallbackNames: readonly string[];
    /** Non-Task branded refs for the trailing fallback row; rich Agent bodies keep the legacy row. */
    readonly fallbackRefs: readonly string[];
    readonly taskRefs: readonly AgentTeamTaskRef[];
    readonly threadRefs: readonly AgentTeamThreadRef[];
}
/**
* Decide how one Message body renders. Rich Agent Markdown keeps unmatched mentions and
* non-Task refs in the trailing fallback row; surfaces without ref navigation render literally.
*/
export declare function planMessageBody(body: string, options: {
    readonly human: boolean;
    readonly mentionNames?: readonly MentionHandle[];
    readonly canOpenRefs: boolean;
}): PlannedMessageBody;
//# sourceMappingURL=team-formatters.d.ts.map