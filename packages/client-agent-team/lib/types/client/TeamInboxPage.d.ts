import type { TeamConversationProps } from './slots.ts';
interface TeamInboxPageProps {
    readonly useWorkspaces: TeamConversationProps['useWorkspaces'];
    readonly loadInbox: TeamConversationProps['loadInbox'];
    /** Wake source while the page is open: one scope-less subscription, shared with the badge poll. */
    readonly subscribeChanges: TeamConversationProps['subscribeChanges'];
    readonly selectWorkspace: TeamConversationProps['selectWorkspace'];
    readonly selectThread: TeamConversationProps['selectThread'];
    readonly selectDiscussion: TeamConversationProps['selectDiscussion'];
    readonly selectProject: TeamConversationProps['selectProject'];
    readonly humanName: string;
    readonly humanAvatarUrl?: string | undefined;
    readonly t: TeamConversationProps['t'];
}
/**
 * The Human Inbox: one Inbox call per visible Workspace, merged in the Host's order into the Host's two slices: the unread
 * queue (「需要我」, Thread rows and one Main stream row per Project) and the 「最近活跃」 tail. Opening the page acknowledges
 * nothing; only a durable read advances the watermark. A Thread with unread is only in the queue (the Host excludes it from
 * the tail); this page never re-derives that.
 */
export declare function TeamInboxPage({ useWorkspaces, loadInbox, subscribeChanges, selectWorkspace, selectThread, selectDiscussion, selectProject, humanName, humanAvatarUrl, t }: TeamInboxPageProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=TeamInboxPage.d.ts.map