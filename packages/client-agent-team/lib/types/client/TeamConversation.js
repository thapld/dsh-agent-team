import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSyncExternalStore } from 'react';
import { useHumanIdentity } from "./human-identity.js";
import { TeamProjectPage } from "./TeamProjectPage.js";
import { TeamInboxPage } from "./TeamInboxPage.js";
import { TeamTaskBoardPage } from "./TeamTaskBoardPage.js";
import { TeamThreadPage } from "./TeamThreadPage.js";
import css from './conversation.module.css';
export function TeamConversation({ t, useWorkspaces, navigation, drafts, humanIdentity, putAttachment, getAttachment, loadProjects, loadTaskBoard, readThread, loadThreadHistory, threadObservations, subscribeChanges, loadMembers, loadInbox, postMainMessage, startThread, readMainStream, mainStreamHistory, reply, changeAttention, transferTask, changeTask, promoteThread, selectThread, selectDiscussion, closeDiscussion, selectProject, selectWorkspace, backToWorkspace, resolveTaskRefs, resolveThreadRefs, resolveMessageRefs, openMemberSession, loadSubscriptions, loadSubscriptionLogs, pauseSubscription, resumeSubscription, deleteSubscription }) {
    const navigationState = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot, navigation.getSnapshot);
    const identity = useHumanIdentity(humanIdentity);
    const humanName = identity.name ?? t('human');
    const workspaces = useWorkspaces(state => state.items);
    const current = workspaces.find(workspace => workspace.workspaceId === navigationState.workspaceId);
    if (navigationState.inbox === true) {
        // The Inbox page is global; selecting it clears the Project/Thread faces, so this face owns the seat while the flag stands.
        return _jsx(TeamInboxPage, { useWorkspaces: useWorkspaces, loadInbox: loadInbox, subscribeChanges: subscribeChanges, selectWorkspace: selectWorkspace, selectThread: selectThread, selectDiscussion: selectDiscussion, selectProject: selectProject, humanName: humanName, ...(identity.avatarUrl === undefined ? {} : { humanAvatarUrl: identity.avatarUrl }), t: t }, "inbox");
    }
    if (navigationState.board === true)
        return _jsx(TeamTaskBoardPage, { useWorkspaces: useWorkspaces, loadTaskBoard: loadTaskBoard, subscribeChanges: subscribeChanges, selectWorkspace: selectWorkspace, selectThread: selectThread, t: t });
    if (current !== undefined && navigationState.threadRef !== undefined) {
        return _jsx(TeamThreadPage, { humanName: humanName, resolveMessageRefs: resolveMessageRefs, ...(identity.avatarUrl === undefined ? {} : { humanAvatarUrl: identity.avatarUrl }), workspaceId: current.workspaceId, putAttachment: putAttachment, threadRef: navigationState.threadRef, backToWorkspace: backToWorkspace, selectProject: selectProject, selectThread: selectThread, selectDiscussion: selectDiscussion, resolveTaskRefs: resolveTaskRefs, resolveThreadRefs: resolveThreadRefs, openMemberSession: openMemberSession, ...(navigationState.projectRef === undefined ? {} : { projectRef: navigationState.projectRef }), ...(navigationState.taskRef === undefined ? {} : { taskRef: navigationState.taskRef }), ...(navigationState.taskNumber === undefined ? {} : { taskNumber: navigationState.taskNumber }), drafts: drafts, getAttachment: getAttachment, readThread: readThread, loadProjects: loadProjects, loadThreadHistory: loadThreadHistory, threadObservations: threadObservations, subscribeChanges: subscribeChanges, loadMembers: loadMembers, reply: reply, changeAttention: changeAttention, transferTask: transferTask, changeTask: changeTask, promoteThread: promoteThread, t: t }, navigationState.threadRef);
    }
    if (current !== undefined && navigationState.projectRef !== undefined) {
        // A discussion swap must not remount the Project page: its panel replaces the open one in place and re-reads the
        // discussion it was handed, so the feed behind it keeps its scroll.
        return _jsx(TeamProjectPage, { humanName: humanName, resolveMessageRefs: resolveMessageRefs, ...(identity.avatarUrl === undefined ? {} : { humanAvatarUrl: identity.avatarUrl }), workspaceId: current.workspaceId, projectRef: navigationState.projectRef, drafts: drafts, putAttachment: putAttachment, getAttachment: getAttachment, loadProjects: loadProjects, loadTaskBoard: loadTaskBoard, subscribeChanges: subscribeChanges, loadMembers: loadMembers, loadInbox: loadInbox, postMainMessage: postMainMessage, startThread: startThread, readMainStream: readMainStream, mainStreamHistory: mainStreamHistory, readThread: readThread, loadThreadHistory: loadThreadHistory, threadObservations: threadObservations, reply: reply, changeAttention: changeAttention, promoteThread: promoteThread, selectThread: selectThread, selectDiscussion: selectDiscussion, closeDiscussion: closeDiscussion, selectProject: selectProject, ...(navigationState.discussionRef === undefined ? {} : { discussionRef: navigationState.discussionRef }), ...(navigationState.discussionAnchor === undefined ? {} : { discussionAnchor: navigationState.discussionAnchor }), resolveTaskRefs: resolveTaskRefs, resolveThreadRefs: resolveThreadRefs, openMemberSession: openMemberSession, loadSubscriptions: loadSubscriptions, loadSubscriptionLogs: loadSubscriptionLogs, pauseSubscription: pauseSubscription, resumeSubscription: resumeSubscription, deleteSubscription: deleteSubscription, t: t }, navigationState.projectRef);
    }
    const welcome = current === undefined
        ? { eyebrow: t('teamMode'), title: t('team'), body: t('empty') }
        : { eyebrow: current.title, title: t('projects'), body: t('selectProjectHint') };
    return _jsx("main", { className: css.welcomeSurface, "data-team-conversation": true, children: _jsxs("div", { className: css.welcome, children: [_jsx("span", { className: css.welcomeEyebrow, children: welcome.eyebrow }), _jsx("h1", { children: welcome.title }), _jsx("p", { children: welcome.body })] }) });
}
