import type { ReactNode } from 'react';
import type { AgentTeamClientMemberStatus, AgentTeamMemberId } from '@contexera/dsh-agent-team/types';
import type { TeamConversationProps } from './slots.ts';
import type { TeamDraftKey, TeamDraftStore } from './drafts.ts';
/** The Human is excluded from delivery, so a quote naming them joins no notify row. */
export interface ReplyTarget {
    /** Absent when the parent did not resolve and cannot name an author. */
    readonly memberId?: AgentTeamMemberId;
    readonly senderName: string;
    readonly excerpt: string;
}
export declare function TeamComposer({ members, followerMemberIds, projectMemberIds, ownerMemberIds, drafts, draftKey, pending, notice, error, onEdit, onSubmit, placeholder, pendingFiles, onFilesChange, replyTo, onCancelReply, toolbarExtra, t }: {
    readonly members: readonly AgentTeamClientMemberStatus[];
    /** Current Thread followers; the Thread surface passes them so they form this Thread's group. */
    readonly followerMemberIds?: ReadonlySet<AgentTeamMemberId>;
    /** Every Member taking part in the Project; the rest of the roster is a Workspace peer a pick would enroll. */
    readonly projectMemberIds?: ReadonlySet<AgentTeamMemberId>;
    /** The Project's Agent owners; they lead the list. */
    readonly ownerMemberIds?: ReadonlySet<AgentTeamMemberId>;
    /** Subscribing here, not in the hosting page, keeps a keystroke from re-rendering the timeline. */
    readonly drafts: TeamDraftStore;
    readonly draftKey: TeamDraftKey;
    readonly pending: boolean;
    readonly notice?: string;
    readonly error?: string;
    /** The Human edited the draft: the hosting page drops its one-shot send state. */
    readonly onEdit?: () => void;
    readonly onSubmit: () => void;
    readonly placeholder?: string;
    /** Upload-capable surfaces pass this to enable the "+" file picker; the reply path omits it. */
    readonly pendingFiles?: readonly File[];
    readonly onFilesChange?: (files: readonly File[]) => void;
    readonly replyTo?: ReplyTarget | undefined;
    readonly onCancelReply?: (() => void) | undefined;
    /** Extra controls after the attach button, for surfaces whose send has modes. */
    readonly toolbarExtra?: ReactNode;
    readonly t: TeamConversationProps['t'];
}): import("react").JSX.Element;
//# sourceMappingURL=TeamComposer.d.ts.map