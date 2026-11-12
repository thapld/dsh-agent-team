import { type ReactNode } from 'react';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { AgentTeamProjectRef, AgentTeamMemberId, AgentTeamMessageAttachment, AgentTeamMessageRef, AgentTeamTaskRef, AgentTeamThreadRef } from '@contexera/dsh-agent-team/types';
import type { TeamConversationProps } from './slots.ts';
import type { ResolvedMemberRef } from './refs.ts';
import { type ResolvedTaskRef } from './refs.ts';
import { type ResolvedThreadRef } from './refs.ts';
import { type MentionHandle } from './team-formatters.ts';
export interface TeamMessageProps {
    readonly senderName: string;
    readonly memberId: AgentTeamMemberId;
    /** Human input stays literal text; Agent output renders as Markdown. */
    readonly human: boolean;
    readonly body: string;
    readonly occurredAt?: string;
    /** Structured mention handles of this Message; the only names that render as chips. */
    readonly mentionNames?: readonly MentionHandle[];
    readonly senderTitle?: string;
    /** Continuation of one same-sender run: suppress repeated identity chrome. */
    readonly grouped?: boolean;
    /** The reader's own name, so the trailing fallback row never repeats it; the body chips it in place. */
    readonly readerName?: string;
    /** Resolved quote context from the Host, never the body, so a quote cannot drift from the Message it points at. */
    readonly replyTo?: {
        readonly senderName: string;
        readonly excerpt: string;
        readonly messageRef: AgentTeamMessageRef;
    } | undefined;
    /**
     * Opens the Message as the composer's quote target; the ref travels as the argument so one identity-stable
     * callback serves every row and the memo holds. Absent surfaces offer no quote action.
     */
    readonly onReply?: ((messageRef: AgentTeamMessageRef) => void) | undefined;
    /** Jumps to the Message this one quotes, which travels as the argument; absent keeps the quote inert. */
    readonly onOpenReplyTo?: ((messageRef: AgentTeamMessageRef) => void) | undefined;
    /** Stable identity of this Message: the anchor a quote line jumps to. */
    readonly messageRef?: AgentTeamMessageRef;
    readonly replyTarget?: boolean;
    readonly replyFlash?: boolean;
    /** Continuation rows show their time in the empty avatar seat; only the Thread asks for it. */
    readonly showGroupedTime?: boolean;
    /** Actions open on a surface without hover; the hosting page owns the flag so only one row holds it. */
    readonly cardOpen?: boolean;
    /** Opens or closes this row's actions; absent surfaces offer none. */
    readonly onToggleCard?: ((messageRef: AgentTeamMessageRef) => void) | undefined;
    /**
     * Whether the surface offers row actions (copy, the reader's mention notice). `inherit` offers them when a quote is
     * offered; `always` offers them without one; `never` withholds them.
     */
    readonly rowActions?: 'inherit' | 'always' | 'never';
    readonly attachments?: readonly AgentTeamMessageAttachment[] | undefined;
    /** The Human's uploaded avatar; absent or undecodable bytes draw the initial on the tinted chip. */
    readonly avatarUrl?: string | undefined;
    /** Cache readback for thumbnails; absent on surfaces without the remotes. */
    readonly loadAttachment?: TeamConversationProps['getAttachment'] | undefined;
    readonly t?: TeamConversationProps['t'] | undefined;
    /** Resolve a branded ref found in the body; absent surfaces render refs as plain text. */
    readonly onOpenRef?: ((ref: string) => void) | undefined;
    /** Host lookup turning task refs into human-facing numbers; absent keeps raw refs. */
    readonly onResolveTaskRefs?: ((taskRefs: readonly AgentTeamTaskRef[]) => Promise<readonly ResolvedTaskRef[]>) | undefined;
    /** Host lookup turning thread refs into titled chips; absent keeps raw refs. */
    readonly onResolveThreadRefs?: ((threadRefs: readonly AgentTeamThreadRef[]) => Promise<readonly ResolvedThreadRef[]>) | undefined;
    /** Roster name for one authored project ref; absent or unknown keeps plain text. */
    readonly projectNameOf?: ((ref: AgentTeamProjectRef) => string | undefined) | undefined;
    /** Roster facts for one authored member ref; absent or unknown keeps plain text. */
    readonly memberOf?: ((ref: AgentTeamMemberId) => ResolvedMemberRef | undefined) | undefined;
    /** Agent-card session jump for member chips; absent renders them as plain text. */
    readonly onOpenMemberSession?: ((sessionId: SessionId) => void) | undefined;
    readonly children?: ReactNode;
}
/**
 * One chat message row. Memoized: the Task-ref subscription lives inside this component, so a skipped render never
 * detaches it. Callers must keep per-render props (mention names, ref callbacks) identity-stable.
 */
export declare const TeamMessage: import("react").NamedExoticComponent<TeamMessageProps>;
//# sourceMappingURL=TeamMessage.d.ts.map