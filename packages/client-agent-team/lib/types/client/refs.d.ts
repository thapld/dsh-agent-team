import type { SessionId } from '@deepseek-ai/dsh-session';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { AgentTeamInboxActor, AgentTeamProject, AgentTeamProjectRef, AgentTeamClientMemberStatus, AgentTeamMemberId, AgentTeamMessageRef, AgentTeamResolveMessageRefsRequest, AgentTeamResolveMessageRefsResult, AgentTeamResolveTaskRefsRequest, AgentTeamResolveTaskRefsResult, AgentTeamResolveThreadRefsRequest, AgentTeamResolveThreadRefsResult, AgentTeamTaskRef, AgentTeamThreadRef } from '@contexera/dsh-agent-team/types';
/** Navigation facts for one branded Task ref, resolved once per session. */
export interface ResolvedTaskRef {
    readonly taskRef: AgentTeamTaskRef;
    readonly projectRef: AgentTeamProjectRef;
    readonly threadRef: AgentTeamThreadRef;
    readonly taskNumber: number;
}
/** Navigation facts for one branded Thread ref, resolved once per session. */
export interface ResolvedThreadRef {
    readonly threadRef: AgentTeamThreadRef;
    readonly projectRef: AgentTeamProjectRef;
    readonly taskRef?: AgentTeamTaskRef;
    readonly taskNumber?: number;
    readonly title: string;
}
/** Author and excerpt come from the Host, which holds the whole ledger, so a parent outside the loaded history window still resolves. */
export interface ResolvedMessageRef {
    readonly messageRef: AgentTeamMessageRef;
    /** Absent for a Main stream Message. */
    readonly threadRef?: AgentTeamThreadRef;
    readonly sender: AgentTeamMemberId;
    readonly excerpt: string;
}
/** One roster-resolved Member behind a `member:` chip. */
export interface ResolvedMemberRef {
    readonly memberId: AgentTeamMemberId;
    readonly handle: string;
    /** Present for agent Members; absent for the Human (no session to open). */
    readonly sessionId?: SessionId;
    /** Only active agent Members open a session — mirrors the agent card rule. */
    readonly openable: boolean;
}
/** Compare refs by branded prefix plus hyphen-stripped UUID, so abbreviated spellings line up with their full form. */
export declare function refKeyOf(ref: string): string;
export declare const useResolvedTaskRefVersion: () => number;
export declare const cachedResolvedTaskRef: (ref: AgentTeamTaskRef) => ResolvedTaskRef | undefined;
export declare const resolveUnknownTaskRefs: (refs: readonly AgentTeamTaskRef[], lookup: (refs: readonly AgentTeamTaskRef[]) => Promise<readonly ResolvedTaskRef[]>) => Promise<void>;
export declare const useResolvedThreadRefVersion: () => number;
export declare const cachedResolvedThreadRef: (ref: AgentTeamThreadRef) => ResolvedThreadRef | undefined;
export declare const rememberResolvedThreadRef: (entry: ResolvedThreadRef) => void;
export declare const resolveUnknownThreadRefs: (refs: readonly AgentTeamThreadRef[], lookup: (refs: readonly AgentTeamThreadRef[]) => Promise<readonly ResolvedThreadRef[]>) => Promise<void>;
export declare const useResolvedMessageRefVersion: () => number;
export declare const cachedResolvedMessageRef: (ref: AgentTeamMessageRef) => ResolvedMessageRef | undefined;
export declare const resolveUnknownMessageRefs: (refs: readonly AgentTeamMessageRef[], lookup: (refs: readonly AgentTeamMessageRef[]) => Promise<readonly ResolvedMessageRef[]>) => Promise<void>;
export declare const hostTaskRefLookup: (resolveTaskRefs: (request: AgentTeamResolveTaskRefsRequest) => Promise<RemoteResult<AgentTeamResolveTaskRefsResult>>, workspaceId: AgentTeamResolveTaskRefsRequest["workspaceId"]) => ((taskRefs: readonly AgentTeamTaskRef[]) => Promise<readonly ResolvedTaskRef[]>);
export declare const hostThreadRefLookup: (resolveThreadRefs: (request: AgentTeamResolveThreadRefsRequest) => Promise<RemoteResult<AgentTeamResolveThreadRefsResult>>, workspaceId: AgentTeamResolveThreadRefsRequest["workspaceId"]) => ((threadRefs: readonly AgentTeamThreadRef[]) => Promise<readonly ResolvedThreadRef[]>);
/** Reply parents are read-only context: fill quotes in place and leave unknown ones unresolved rather than render a quote of nothing. */
export declare const hostMessageRefLookup: (resolveMessageRefs: (request: AgentTeamResolveMessageRefsRequest) => Promise<RemoteResult<AgentTeamResolveMessageRefsResult>>, workspaceId: AgentTeamResolveMessageRefsRequest["workspaceId"]) => ((messageRefs: readonly AgentTeamMessageRef[]) => Promise<readonly ResolvedMessageRef[]>);
export declare const jumpToTaskThread: (resolveTaskRefs: (request: AgentTeamResolveTaskRefsRequest) => Promise<RemoteResult<AgentTeamResolveTaskRefsResult>>, workspaceId: AgentTeamResolveTaskRefsRequest["workspaceId"], taskRef: AgentTeamTaskRef, selectThread: (threadRef: AgentTeamThreadRef, projectRef?: AgentTeamProjectRef, taskRef?: AgentTeamTaskRef, taskNumber?: number) => void) => void;
/** Where a resolved Thread ref points: a Task Thread, or a taskless discussion. */
export interface ThreadDestination {
    readonly threadRef: AgentTeamThreadRef;
    readonly projectRef: AgentTeamProjectRef;
    readonly taskRef?: AgentTeamTaskRef | undefined;
    readonly taskNumber?: number | undefined;
}
export type OpenResolvedThread = (entry: ThreadDestination) => void;
/**
 * One resolved Thread ref, sent to the face its kind belongs to: a Task Thread keeps the full page, a taskless
 * discussion opens beside its Project's Main stream. Every reader of a `thread:` ref routes through this, so a ref
 * cannot land on the full page from one surface and in the panel from another.
 */
export declare const resolvedThreadDestination: (selectThread: (threadRef: AgentTeamThreadRef, projectRef?: AgentTeamProjectRef, taskRef?: AgentTeamTaskRef, taskNumber?: number) => void, selectDiscussion: (threadRef: AgentTeamThreadRef, projectRef: AgentTeamProjectRef) => void) => OpenResolvedThread;
export declare const jumpToThread: (resolveThreadRefs: (request: AgentTeamResolveThreadRefsRequest) => Promise<RemoteResult<AgentTeamResolveThreadRefsResult>>, workspaceId: AgentTeamResolveThreadRefsRequest["workspaceId"], threadRef: AgentTeamThreadRef, open: OpenResolvedThread) => void;
/** Undefined when the loaded roster does not know the ref (the caller keeps plain text). Archived Projects never resolve. */
export declare const rosterProjectName: (projects: readonly AgentTeamProject[], projectRef: AgentTeamProjectRef) => string | undefined;
/** Undefined when nobody on the roster answers to it. The Human resolves to a handle with no session, never a link. */
export declare const rosterMember: (members: readonly AgentTeamClientMemberStatus[], humanMemberId: AgentTeamMemberId | undefined, humanHandle: string, memberRef: AgentTeamMemberId) => ResolvedMemberRef | undefined;
/**
 * A Task's accountable as this roster draws them: the Human by their own name, a Member by handle, and — like the Host's
 * own resolution — an unresolvable id left as the id. The state rides along so a suspended owner reads as a standing.
 */
export declare const rosterAccountableOwner: (members: readonly AgentTeamClientMemberStatus[], humanMemberId: AgentTeamMemberId | undefined, humanHandle: string, accountable: AgentTeamMemberId) => AgentTeamInboxActor;
//# sourceMappingURL=refs.d.ts.map