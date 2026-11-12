import type { SessionId } from '@deepseek-ai/dsh-session';
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import type { AgentTeamProjectRef, AgentTeamTaskRef, AgentTeamThreadRef } from '@contexera/dsh-agent-team/types';
export type TeamMode = 'conversation' | 'team';
/** The rail row selects this panel and Team mode follows (see the panel-ownership effect in `index.ts`). */
export declare const TEAM_PANEL_ID: MainPanelId;
/** What an opening of a taskless discussion should land on. Persisted with the destination so a reload lands the same way. */
export type TeamDiscussionAnchor = 'unread';
export interface TeamNavigationSnapshot {
    mode: TeamMode;
    workspaceId?: WorkspaceId;
    projectRef?: AgentTeamProjectRef;
    taskRef?: AgentTeamTaskRef;
    threadRef?: AgentTeamThreadRef;
    taskNumber?: number;
    /**
     * A taskless discussion open in the Project page's side panel. A Task Thread covers the whole page, but the panel
     * stays part of the Project face underneath: returning from a Task opened inside that Project restores it.
     */
    discussionRef?: AgentTeamThreadRef;
    /**
     * Why the reader arrived at that discussion. `unread` asks the panel to open on the first unread Message naming the
     * Human, the rule a Thread page already follows; every other entry keeps the panel's newest-first opening.
     */
    discussionAnchor?: TeamDiscussionAnchor;
    /** A navigation fact, not an unread fact: selecting Inbox clears the Project/Thread faces, and a reload reopens the page. */
    inbox?: boolean;
    board?: boolean;
    /** Runtime-only Member Session embedded in the conversation seat; never persisted. */
    memberSessionId?: SessionId;
    /** Runtime-only session to restore when the Member view closes; never persisted. */
    returnToSessionId?: SessionId;
}
declare const STORAGE_KEY = "dsh.agent-team.navigation";
export interface TeamNavigationActions {
    enterTeam: () => void;
    /** Flip the mode only; a caller that also owns the column releases it through {@link leaveTeamForConversation}. */
    leaveTeam: () => void;
    /**
     * Leave Team mode and hand the column back in one move. The panel release runs before the mode flips, or a
     * still-selected Team panel would put the mode straight back.
     */
    leaveTeamForConversation: (releasePanel: () => void) => void;
    selectWorkspace: (workspaceId: WorkspaceId) => void;
    selectProject: (projectRef: AgentTeamProjectRef) => void;
    selectThread: (threadRef: AgentTeamThreadRef, projectRef?: AgentTeamProjectRef, taskRef?: AgentTeamTaskRef, taskNumber?: number, options?: SelectThreadOptions) => void;
    /**
     * Open a taskless discussion beside its Project's Main stream. `workspaceId` moves the seat and the destination in one
     * step — the Inbox reads across Workspaces — and `anchor` chooses where inside the discussion the panel lands.
     */
    selectDiscussion: (threadRef: AgentTeamThreadRef, projectRef: AgentTeamProjectRef, options?: SelectDiscussionOptions) => void;
    /** Close the side panel and keep the Project page it was seated in. */
    closeDiscussion: () => void;
    selectInbox: () => void;
    selectBoard: () => void;
    backToWorkspace: () => void;
    /**
     * Close the Project face and land on the workspace's welcome surface. The sidebar keeps listing Projects, so this is
     * the one step up from a Project page — the ladder a Back command climbs.
     */
    leaveProject: () => void;
    /**
     * One step up the face ladder: the Member view, a Thread page, the discussion panel beside a Project, the Inbox or
     * Board, then the Project itself. Each rung is the action its own visible control uses, so the keyboard never takes a
     * path the pointer cannot, and the face it left is kept for {@link forward}.
     */
    back: () => void;
    /**
     * Re-enter the face the last Back left. A Member view is a session swap rather than a face, so Forward restores the
     * face alone; any other destination discards what Back left behind.
     */
    forward: () => void;
    /** Swap the conversation seat to a Member Session. `returnToSessionId` is captured once, so switching Member Sessions keeps the original target. */
    enterMemberSession: (sessionId: SessionId, returnToSessionId?: SessionId) => void;
    exitMemberSession: () => void;
}
export interface SelectDiscussionOptions {
    readonly workspaceId?: WorkspaceId;
    readonly anchor?: TeamDiscussionAnchor;
}
export interface SelectThreadOptions {
    /**
     * False drops any open discussion panel even when the Task is in the same Project. Promotion is the one caller that
     * needs this: the discussion became the Task, so there is no separate panel to restore.
     */
    readonly preserveDiscussion?: boolean;
}
export declare class TeamNavigation {
    private snapshot;
    private readonly listeners;
    /** Faces Back left behind, most recent last: Forward replays them until another destination is chosen. */
    private readonly forwardFaces;
    /** Set while Back or Forward moves, so its own commits do not discard what the other one keeps. */
    private keepsForward;
    readonly getSnapshot: () => TeamNavigationSnapshot;
    readonly subscribe: (listener: () => void) => (() => void);
    actions(): TeamNavigationActions;
    dispose(): void;
    private setMode;
    private setMemberSession;
    /** Any explicit Team navigation or the footer leave closes a Member view. */
    private clearMemberSession;
    private setWorkspace;
    /** The Project face and everything seated in it: a Thread page, a discussion panel, and the Inbox or Board faces. */
    private clearProject;
    private setProject;
    /** The Inbox is a face, not workspace content: selecting a Workspace leaves it. */
    private setInbox;
    private setBoard;
    private setThread;
    /**
     * The panel is a face of its Project page, so opening one is a location like any other: it replaces the Inbox, Board
     * and full Thread faces, and the Project and Workspace it names move with it. Task Threads keep the full page, so
     * {@link setDiscussion} never touches `threadRef`.
     *
     * `anchor` is deliberately part of the comparison: entering the same discussion from an Inbox row must re-aim a panel
     * that is already open, and leaving through a plain card must retire a stale aim.
     */
    private setDiscussion;
    /**
     * The ladder Back climbs, innermost face first. A rung that has nothing to leave returns without a commit, so Back on
     * the welcome surface moves nothing and leaves no face for Forward.
     */
    private runBackLadder;
    private commit;
}
export { STORAGE_KEY };
//# sourceMappingURL=navigation.d.ts.map