/** The rail row selects this panel and Team mode follows (see the panel-ownership effect in `index.ts`). */
export const TEAM_PANEL_ID = 'agent-team';
const STORAGE_KEY = 'dsh.agent-team.navigation';
function readSnapshot() {
    if (typeof localStorage === 'undefined')
        return { mode: 'conversation' };
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '');
        // Projects were called Channels; a snapshot saved before the rename still reopens its page.
        const projectRef = typeof parsed.channelRef === 'string' ? parsed.channelRef.replace(/^channel:/, 'project:') : parsed.projectRef;
        const hasThread = typeof parsed.threadRef === 'string';
        // A discussion panel is a Project face: a snapshot naming one without its Project cannot reopen.
        const hasDiscussion = typeof parsed.discussionRef === 'string' && typeof projectRef === 'string';
        return {
            mode: parsed.mode === 'team' ? 'team' : 'conversation',
            ...(typeof parsed.workspaceId === 'string' ? { workspaceId: parsed.workspaceId } : {}),
            ...(typeof projectRef === 'string' ? { projectRef: projectRef } : {}),
            ...(parsed.inbox === true ? { inbox: true } : {}),
            ...(parsed.board === true ? { board: true } : {}),
            ...(hasDiscussion ? {
                discussionRef: parsed.discussionRef,
                ...(parsed.discussionAnchor === 'unread' ? { discussionAnchor: 'unread' } : {}),
            } : {}),
            ...(hasThread ? {
                threadRef: parsed.threadRef,
                ...(typeof parsed.taskRef === 'string' ? { taskRef: parsed.taskRef } : {}),
                ...(typeof parsed.taskNumber === 'number' && Number.isInteger(parsed.taskNumber) && parsed.taskNumber > 0 ? { taskNumber: parsed.taskNumber } : {}),
            } : {}),
        };
    }
    catch {
        return { mode: 'conversation' };
    }
}
function persistSnapshot(snapshot) {
    if (typeof localStorage === 'undefined')
        return;
    const { mode, workspaceId, projectRef, taskRef, threadRef, taskNumber, discussionRef, discussionAnchor, inbox, board } = snapshot;
    persistLocallyBestEffort({
        mode,
        ...(workspaceId === undefined ? {} : { workspaceId }),
        ...(projectRef === undefined ? {} : { projectRef }),
        ...(inbox === true ? { inbox: true } : {}),
        ...(board === true ? { board: true } : {}),
        ...(taskRef === undefined ? {} : { taskRef }),
        ...(threadRef === undefined ? {} : { threadRef }),
        ...(taskNumber === undefined ? {} : { taskNumber }),
        ...(discussionRef === undefined ? {} : { discussionRef }),
        ...(discussionAnchor === undefined ? {} : { discussionAnchor }),
    });
}
/** Remember the position for the next reload; a browser that refuses storage (private mode, quota) loses only that. */
function persistLocallyBestEffort(payload) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    catch {
    }
}
function isReselectingActiveMember(snapshot, sessionId) {
    return snapshot.memberSessionId === sessionId && snapshot.mode === 'team';
}
export class TeamNavigation {
    snapshot = readSnapshot();
    listeners = new Set();
    /** Faces Back left behind, most recent last: Forward replays them until another destination is chosen. */
    forwardFaces = [];
    /** Set while Back or Forward moves, so its own commits do not discard what the other one keeps. */
    keepsForward = false;
    getSnapshot = () => this.snapshot;
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    actions() {
        return {
            enterTeam: () => { this.clearMemberSession(); this.setMode('team'); },
            leaveTeam: () => { this.setMode('conversation'); },
            leaveTeamForConversation: releasePanel => {
                this.clearMemberSession();
                releasePanel();
                this.setMode('conversation');
            },
            selectWorkspace: workspaceId => { this.clearMemberSession(); this.setWorkspace(workspaceId); },
            selectProject: projectRef => { this.clearMemberSession(); this.setProject(projectRef); },
            selectThread: (threadRef, projectRef, taskRef, taskNumber, options) => { this.clearMemberSession(); this.setThread(threadRef, projectRef, taskRef, taskNumber, options); },
            selectDiscussion: (threadRef, projectRef, options) => { this.clearMemberSession(); this.setDiscussion(threadRef, projectRef, options); },
            closeDiscussion: () => { this.clearMemberSession(); this.setDiscussion(undefined); },
            selectInbox: () => { this.clearMemberSession(); this.setInbox(); },
            selectBoard: () => { this.clearMemberSession(); this.setBoard(); },
            backToWorkspace: () => { this.clearMemberSession(); this.setThread(undefined); },
            leaveProject: () => { this.clearMemberSession(); this.clearProject(); },
            back: () => {
                const before = this.snapshot;
                this.keepsForward = true;
                try {
                    this.runBackLadder();
                }
                finally {
                    this.keepsForward = false;
                }
                if (this.snapshot !== before)
                    this.forwardFaces.push(before);
            },
            forward: () => {
                const target = this.forwardFaces.pop();
                if (target === undefined)
                    return;
                const { memberSessionId: _memberSessionId, returnToSessionId: _returnToSessionId, ...face } = target;
                this.keepsForward = true;
                try {
                    this.snapshot = face;
                    this.commit();
                }
                finally {
                    this.keepsForward = false;
                }
            },
            enterMemberSession: (sessionId, returnToSessionId) => { this.setMemberSession(sessionId, returnToSessionId); },
            exitMemberSession: () => { this.clearMemberSession(); },
        };
    }
    dispose() {
        this.listeners.clear();
    }
    setMode(mode) {
        if (this.snapshot.mode === mode)
            return;
        this.snapshot = { ...this.snapshot, mode };
        this.commit();
    }
    setMemberSession(sessionId, returnToSessionId) {
        if (isReselectingActiveMember(this.snapshot, sessionId))
            return;
        const { memberSessionId: _memberSessionId, ...base } = this.snapshot;
        this.snapshot = {
            ...base,
            mode: 'team',
            memberSessionId: sessionId,
            ...(returnToSessionId === undefined ? {} : { returnToSessionId }),
        };
        this.commit();
    }
    /** Any explicit Team navigation or the footer leave closes a Member view. */
    clearMemberSession() {
        if (this.snapshot.memberSessionId === undefined && this.snapshot.returnToSessionId === undefined)
            return;
        const { memberSessionId: _memberSessionId, returnToSessionId: _returnToSessionId, ...base } = this.snapshot;
        this.snapshot = base;
        this.commit();
    }
    setWorkspace(workspaceId) {
        if (this.snapshot.workspaceId === workspaceId && this.snapshot.inbox !== true && this.snapshot.board !== true && this.snapshot.discussionRef === undefined)
            return;
        const { projectRef: _projectRef, taskRef: _taskRef, threadRef: _threadRef, taskNumber: _taskNumber, discussionRef: _discussionRef, discussionAnchor: _discussionAnchor, inbox: _inbox, board: _board, ...base } = this.snapshot;
        this.snapshot = { ...base, workspaceId };
        this.commit();
    }
    /** The Project face and everything seated in it: a Thread page, a discussion panel, and the Inbox or Board faces. */
    clearProject() {
        if (this.snapshot.projectRef === undefined && this.snapshot.threadRef === undefined && this.snapshot.discussionRef === undefined
            && this.snapshot.inbox !== true && this.snapshot.board !== true)
            return;
        const { projectRef: _projectRef, taskRef: _taskRef, threadRef: _threadRef, taskNumber: _taskNumber, discussionRef: _discussionRef, discussionAnchor: _discussionAnchor, inbox: _inbox, board: _board, ...base } = this.snapshot;
        this.snapshot = base;
        this.commit();
    }
    setProject(projectRef) {
        if (this.snapshot.projectRef === projectRef && this.snapshot.threadRef === undefined && this.snapshot.inbox !== true && this.snapshot.board !== true && this.snapshot.discussionRef === undefined)
            return;
        const { taskRef: _taskRef, threadRef: _threadRef, taskNumber: _taskNumber, discussionRef: _discussionRef, discussionAnchor: _discussionAnchor, inbox: _inbox, board: _board, ...base } = this.snapshot;
        this.snapshot = { ...base, projectRef };
        this.commit();
    }
    /** The Inbox is a face, not workspace content: selecting a Workspace leaves it. */
    setInbox() {
        if (this.snapshot.inbox === true && this.snapshot.projectRef === undefined && this.snapshot.threadRef === undefined && this.snapshot.board !== true)
            return;
        const { projectRef: _projectRef, taskRef: _taskRef, threadRef: _threadRef, taskNumber: _taskNumber, discussionRef: _discussionRef, discussionAnchor: _discussionAnchor, board: _board, ...base } = this.snapshot;
        this.snapshot = { ...base, inbox: true };
        this.commit();
    }
    setBoard() {
        if (this.snapshot.board === true && this.snapshot.projectRef === undefined && this.snapshot.threadRef === undefined && this.snapshot.discussionRef === undefined)
            return;
        const { projectRef: _projectRef, taskRef: _taskRef, threadRef: _threadRef, taskNumber: _taskNumber, discussionRef: _discussionRef, discussionAnchor: _discussionAnchor, inbox: _inbox, ...base } = this.snapshot;
        this.snapshot = { ...base, board: true };
        this.commit();
    }
    setThread(threadRef, projectRef, taskRef, taskNumber, options) {
        if (this.snapshot.threadRef === threadRef && this.snapshot.taskRef === taskRef && this.snapshot.projectRef === projectRef && this.snapshot.taskNumber === taskNumber && this.snapshot.inbox !== true && this.snapshot.board !== true)
            return;
        // A Task opened from its own Project covers that Project face; keep the panel state underneath so Back restores it.
        // Entry from anywhere else (Inbox, Board, another Task page, a sibling Project) and promotion clear it instead.
        const keepsDiscussion = threadRef === undefined
            ? this.snapshot.discussionRef !== undefined
            : options?.preserveDiscussion !== false
                && this.snapshot.threadRef === undefined
                && this.snapshot.inbox !== true
                && this.snapshot.board !== true
                && this.snapshot.projectRef !== undefined
                && this.snapshot.projectRef === projectRef
                && this.snapshot.discussionRef !== undefined;
        const baseSnapshot = (() => {
            if (keepsDiscussion)
                return this.snapshot;
            const { discussionRef: _discussionRef, discussionAnchor: _discussionAnchor, ...withoutDiscussion } = this.snapshot;
            return withoutDiscussion;
        })();
        if (threadRef === undefined) {
            const { taskRef: _taskRef, threadRef: _threadRef, taskNumber: _taskNumber, ...base } = baseSnapshot;
            this.snapshot = base;
        }
        else {
            const { projectRef: _projectRef, taskRef: _taskRef, threadRef: _threadRef, taskNumber: _taskNumber, inbox: _inbox, board: _board, ...base } = baseSnapshot;
            this.snapshot = {
                ...base,
                threadRef,
                ...(projectRef === undefined ? {} : { projectRef }),
                ...(taskRef === undefined ? {} : { taskRef }),
                ...(taskNumber === undefined ? {} : { taskNumber }),
            };
        }
        this.commit();
    }
    /**
     * The panel is a face of its Project page, so opening one is a location like any other: it replaces the Inbox, Board
     * and full Thread faces, and the Project and Workspace it names move with it. Task Threads keep the full page, so
     * {@link setDiscussion} never touches `threadRef`.
     *
     * `anchor` is deliberately part of the comparison: entering the same discussion from an Inbox row must re-aim a panel
     * that is already open, and leaving through a plain card must retire a stale aim.
     */
    setDiscussion(threadRef, projectRef, options) {
        const anchor = options?.anchor;
        if (threadRef === undefined) {
            if (this.snapshot.discussionRef === undefined && this.snapshot.discussionAnchor === undefined)
                return;
            const { discussionRef: _discussionRef, discussionAnchor: _discussionAnchor, ...base } = this.snapshot;
            this.snapshot = base;
            this.commit();
            return;
        }
        const workspaceId = options?.workspaceId ?? this.snapshot.workspaceId;
        if (this.snapshot.discussionRef === threadRef && this.snapshot.projectRef === projectRef && this.snapshot.discussionAnchor === anchor
            && this.snapshot.workspaceId === workspaceId && this.snapshot.threadRef === undefined
            && this.snapshot.inbox !== true && this.snapshot.board !== true)
            return;
        const { taskRef: _taskRef, threadRef: _threadRef, taskNumber: _taskNumber, discussionRef: _discussionRef, discussionAnchor: _discussionAnchor, inbox: _inbox, board: _board, ...base } = this.snapshot;
        this.snapshot = {
            ...base,
            ...(workspaceId === undefined ? {} : { workspaceId }),
            ...(projectRef === undefined ? {} : { projectRef }),
            discussionRef: threadRef,
            ...(anchor === undefined ? {} : { discussionAnchor: anchor }),
        };
        this.commit();
    }
    /**
     * The ladder Back climbs, innermost face first. A rung that has nothing to leave returns without a commit, so Back on
     * the welcome surface moves nothing and leaves no face for Forward.
     */
    runBackLadder() {
        const state = this.snapshot;
        if (state.memberSessionId !== undefined || state.returnToSessionId !== undefined) {
            this.clearMemberSession();
            return;
        }
        if (state.threadRef !== undefined) {
            this.setThread(undefined);
            return;
        }
        if (state.discussionRef !== undefined) {
            this.setDiscussion(undefined);
            return;
        }
        if (state.inbox === true || state.board === true) {
            if (state.workspaceId !== undefined)
                this.setWorkspace(state.workspaceId);
            return;
        }
        if (state.projectRef !== undefined)
            this.clearProject();
    }
    commit() {
        if (!this.keepsForward)
            this.forwardFaces.length = 0;
        persistSnapshot(this.snapshot);
        for (const listener of this.listeners)
            listener();
    }
}
export { STORAGE_KEY };
