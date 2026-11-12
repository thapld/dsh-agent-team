import agentTeamRemote from '@contexera/dsh-agent-team/remote';
import { HUMAN_PROFILE_SETTINGS_NAMESPACE } from '@contexera/dsh-agent-team/human-settings';
import { TeamSettingsSection } from "./TeamSettingsSection.js";
import { TeamConfigController, WorkerConfigController, teamConfigScope, workerConfigScope, } from "./team-config.js";
import { TeamHumanIdentity, TeamHumanProfileWriter } from "./human-identity.js";
import { ExtraToolGrantsController } from "./extra-tool-grants.js";
import { TeamEnvironmentCheck } from "./environment-check.js";
import { bytesToBase64 } from "./attachment-preview.js";
import { TEAM_PANEL_ID, TeamNavigation } from "./navigation.js";
import { registerTeamShortcuts } from "./team-shortcuts.js";
import { TeamChangeStream, TeamReadStream } from "./team-changes.js";
import { TeamQueries, teamQueryKey } from "./team-queries.js";
import { TeamDraftStore } from "./drafts.js";
import { TeamPanelIcon } from "./TeamPanelIcon.js";
import { TeamConversation } from "./TeamConversation.js";
import { attachSidebarOrderHost } from "./sidebar-order.js";
import { TeamWorkspaceBrowser } from "./TeamWorkspaceBrowser.js";
import { TeamSettingsNavIcon } from "./TeamSettingsNavIcon.js";
import { en, zh } from "./locales.js";
export { TeamNavigation } from "./navigation.js";
const NS = 'team';
export const inject = [
    'slots', 'workspaces', 'layout', 'locale', 'remote', 'remote.session', 'sessions', 'connection', 'conversation', 'uiWorkspace',
    'configForms', 'remote.settings',
];
/** The rendered session is the one holding its `mainView` reference, so the selection is read through retention. */
function currentMainSessionId(ctx) {
    const sessions = ctx.sessions;
    return Object.values(sessions.list.getSnapshot().byId)
        .find(session => (session.retainedBy.mainView ?? 0) > 0)?.id;
}
/**
 * Member session ids this client opened. The workspace service exposes no clear, so excluding them from the
 * next capture keeps a stale Member selection from becoming a false return target.
 */
const openedMemberSessions = new WeakMap();
/**
 * The main seat lives for the life of the client: a rail row can only select a panel whose main entry is live.
 * The mode follows the selection (see the ownership effect in `applyUi`).
 */
function registerTeamPanel(ctx, navigation, queries, reads, drafts, humanIdentity) {
    const sharedRemotes = teamSharedRemotes(ctx, navigation, queries, reads, drafts, humanIdentity);
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: TEAM_PANEL_ID,
        order: 20,
        label: () => ctx.locale.bind(NS)('team'),
        locale: NS,
    }, TeamPanelIcon));
    ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: TEAM_PANEL_ID,
        priority: -100,
        locale: NS,
        inject: () => teamSeatInject(ctx, navigation, reads, sharedRemotes, 'main'),
    }, TeamConversation));
}
/**
 * Embed a Member's Session in the conversation seat while staying in Team mode. The Team panel yields the column
 * first, or it would render the Team page over the Member conversation.
 */
function openMemberSessionImpl(ctx, navigation, sessionId, reportFailure) {
    const snapshot = navigation.getSnapshot();
    const current = currentMainSessionId(ctx);
    // Captured on first entry only, so switching between Member Sessions keeps the original return target.
    const memberSessions = openedMemberSessions.get(ctx) ?? new Set();
    openedMemberSessions.set(ctx, memberSessions);
    memberSessions.add(sessionId);
    const returnTo = snapshot.memberSessionId === undefined && current !== undefined && current !== sessionId && !memberSessions.has(current) ? current : undefined;
    const open = () => ctx.uiWorkspace.openSession(sessionId);
    // `openSession` is a synchronous void; a Session the catalog does not carry yet would fail silently,
    // so undo the navigation and let the caller report it.
    const restore = () => {
        if (snapshot.memberSessionId !== undefined)
            navigation.actions().enterMemberSession(snapshot.memberSessionId, undefined);
        else
            navigation.actions().exitMemberSession();
    };
    const report = (cause) => {
        reportFailure?.(cause instanceof Error ? cause.message : String(cause));
    };
    navigation.actions().enterMemberSession(sessionId, returnTo);
    ctx.layout.selectPanel(null);
    try {
        open();
    }
    catch (cause) {
        // The seat's refusal is the Client's reading of its own pull of the Host list, and a Member Session the Host
        // swapped in (wake recycle, rollover) is newer than any pull this page has taken: the Host has the Session, this
        // catalog has not asked for it yet. One pull is cheap, and a second refusal is the real answer.
        if (!isUnknownToCatalog(cause)) {
            restore();
            report(cause);
            return;
        }
        void (async () => {
            try {
                await ctx.sessions.refresh();
                // A click elsewhere while the pull was in flight owns the seat now; it is no longer this Session's to open.
                if (navigation.getSnapshot().memberSessionId !== sessionId)
                    return;
                open();
            }
            catch (retryCause) {
                if (navigation.getSnapshot().memberSessionId === sessionId)
                    restore();
                report(retryCause);
            }
        })();
    }
}
/** `sessions.retain` refusing an identity means this Client never listed it, which a fresh pull may repair. */
function isUnknownToCatalog(cause) {
    return cause instanceof Error && cause.message.startsWith('sessions.retain: unknown session ');
}
const ROSTER_SCOPE_KINDS = ['presence', 'workspace'];
/**
 * The key's result type is what the read hands back. The remote facade declares the unwrapped type, but every
 * consumer branches on `result.ok` and reads `result.value`, so the query layer carries the envelope: typing the key
 * with the declared type would let a key be read through a loader that never unwraps, and the mismatch would only
 * surface at the first failure.
 */
function membersQuery(request) {
    return {
        key: teamQueryKey(`members:${request.workspaceId}`),
        rule: { kinds: ROSTER_SCOPE_KINDS, workspaceId: request.workspaceId },
    };
}
/** Inbox data moves with any shared-projection commit (a mention can land in any Thread), so the scope-less stream is its home; presence wakes never reach it. */
function inboxQuery(request) {
    return {
        key: teamQueryKey(`inbox:${request.workspaceId}:${request.limit ?? 'all'}`),
        rule: { kinds: ['scopeLess', 'workspace', 'project', 'thread'], workspaceId: request.workspaceId },
    };
}
function teamSharedRemotes(ctx, navigation, queries, reads, drafts, humanIdentity) {
    return {
        loadProjects: (request) => ctx.remote.agentTeam.view(request),
        loadInbox: (request) => queries.read(inboxQuery(request), () => ctx.remote.agentTeam.inbox(request)),
        loadTaskBoard: (request) => ctx.remote.agentTeam.taskBoard(request),
        subscribeReads: (listener) => reads.subscribe(listener),
        subscribeChanges: (scope, listener) => queries.subscribeChanges(scope, listener),
        drafts,
        humanIdentity,
        loadMembers: (request) => queries.read(membersQuery(request), () => ctx.remote.agentTeam.members(request)),
        updateProject: (request) => ctx.remote.agentTeam.updateProject(request),
        archiveProject: (request) => ctx.remote.agentTeam.archiveProject(request),
        addProjectOwner: (request) => ctx.remote.agentTeam.addProjectOwner(request),
        removeProjectOwner: (request) => ctx.remote.agentTeam.removeProjectOwner(request),
        updateMember: (request) => ctx.remote.agentTeam.updateMember(request),
        // Member detail's reminder list and cancel: a Human surface over the same Host authority
        // the Member's own `team_reminder` tool uses, so a reminder is withdrawn exactly once.
        loadMemberReminders: (request) => ctx.remote.agentTeam.memberReminders(request),
        cancelMemberReminder: (request) => ctx.remote.agentTeam.cancelMemberReminder(request),
        // The Human's Worker controls: the same Host stop transaction a Member's tool
        // uses, read by the Member the edit surface belongs to.
        loadWorkerRuns: (request) => ctx.remote.agentTeam.workerRuns(request),
        stopWorker: (request) => ctx.remote.agentTeam.stopWorker(request),
        // A read-only look-up: the same Host authority the Member's own `team_worker`
        // inspect mode uses, so the Human and the initiator see one report.
        inspectWorker: (request) => ctx.remote.agentTeam.inspectWorker(request),
        recoverMember: (request) => ctx.remote.agentTeam.recoverMember(request),
        archiveMember: (request) => ctx.remote.agentTeam.archiveMember(request),
        joinWorkspace: (request) => ctx.remote.agentTeam.joinWorkspace(request),
        leaveWorkspace: (request) => ctx.remote.agentTeam.leaveWorkspace(request),
        // The Host-scoped catalog needs no live Member, so suspended ones stay editable too.
        loadModels: () => ctx.remote.session.modelCatalog(),
        openMemberSession: (sessionId, reportFailure) => {
            openMemberSessionImpl(ctx, navigation, sessionId, reportFailure);
        },
    };
}
/** `main` writes the conversation; the sidebar's browser seat writes the roster and Projects. */
function teamSeatInject(ctx, navigation, reads, sharedRemotes, name) {
    return {
        navigation,
        ...navigation.actions(),
        // The rail row is a destination: leaving Team mode also hands the column back to the conversation.
        leaveTeam: () => { navigation.actions().leaveTeamForConversation(() => { ctx.layout.selectPanel(null); }); },
        ...sharedRemotes,
        ...(name === 'main' ? {
            // A committed durable read consumes mention markers; the Host's changes stream never wakes on reads,
            // so refresh the badge from the read itself. Both read paths move the same private watermark and the
            // Host derives both Inbox slices from it, so both answer the badge.
            readThread: async (request) => {
                const result = await ctx.remote.agentTeam.readThread(request);
                if (result.ok)
                    reads.bump();
                return result;
            },
            loadThreadHistory: (request) => ctx.remote.agentTeam.threadHistory(request),
            threadObservations: (request) => ctx.remote.agentTeam.threadObservations(request),
            postMainMessage: (request) => ctx.remote.agentTeam.postMainMessage(request),
            startThread: (request) => ctx.remote.agentTeam.startThread(request),
            readMainStream: async (request) => {
                const result = await ctx.remote.agentTeam.readMainStream(request);
                if (result.ok)
                    reads.bump();
                return result;
            },
            mainStreamHistory: (request) => ctx.remote.agentTeam.mainStreamHistory(request),
            putAttachment: (request) => ctx.remote.agentTeam.putAttachment(request),
            getAttachment: (request) => ctx.remote.agentTeam.getAttachment(request),
            reply: (request) => ctx.remote.agentTeam.reply(request),
            changeAttention: (request) => ctx.remote.agentTeam.changeAttention(request),
            transferTask: (request) => ctx.remote.agentTeam.transferTask(request),
            changeTask: (request) => ctx.remote.agentTeam.changeTask(request),
            promoteThread: (request) => ctx.remote.agentTeam.promoteThread(request),
            resolveTaskRefs: (request) => ctx.remote.agentTeam.resolveTaskRefs(request),
            resolveThreadRefs: (request) => ctx.remote.agentTeam.resolveThreadRefs(request),
            resolveMessageRefs: (request) => ctx.remote.agentTeam.resolveMessageRefs(request),
            // A Project's subscriptions are the Project page's own surface: the list,
            // the owner-only run tails, and the writes that each reread the Host.
            loadSubscriptions: (request) => ctx.remote.agentTeam.subscriptions(request),
            loadSubscriptionLogs: (request) => ctx.remote.agentTeam.subscriptionLogs(request),
            testSubscriptionDraft: (request) => ctx.remote.agentTeam.testSubscriptionDraft(request),
            createSubscription: (request) => ctx.remote.agentTeam.createSubscription(request),
            updateSubscription: (request) => ctx.remote.agentTeam.updateSubscription(request),
            pauseSubscription: (request) => ctx.remote.agentTeam.pauseSubscription(request),
            resumeSubscription: (request) => ctx.remote.agentTeam.resumeSubscription(request),
            deleteSubscription: (request) => ctx.remote.agentTeam.deleteSubscription(request),
            resetSubscriptionWebhook: (request) => ctx.remote.agentTeam.resetSubscriptionWebhook(request),
            loadSubscriptionDeliveries: (request) => ctx.remote.agentTeam.subscriptionDeliveries(request),
            replaySubscriptionDelivery: (request) => ctx.remote.agentTeam.replaySubscriptionDelivery(request),
        } : {}),
        ...(name === 'sidebar.workspaces' ? {
            addMember: (request) => ctx.remote.agentTeam.addMember(request),
            createProject: (request) => ctx.remote.agentTeam.createProject(request),
        } : {}),
    };
}
function registerModeShadow(ctx, navigation, queries, reads, drafts, humanIdentity, name, component, 
// The reserved 'conversation' key is where the shipped Conversation registers, so the Team seat shadows that panel rather than adding one.
entryKey) {
    const sharedRemotes = teamSharedRemotes(ctx, navigation, queries, reads, drafts, humanIdentity);
    ctx.slots.inject(name, () => {
        let dispose;
        const reconcile = () => {
            const snapshot = navigation.getSnapshot();
            // The main seat yields to the shipped conversation root while a Member Session is embedded;
            // the browser seat stays shadowed so Team chrome keeps working.
            const active = snapshot.mode === 'team' && !(name === 'main' && snapshot.memberSessionId !== undefined);
            if (active && dispose === undefined) {
                dispose = ctx.slots.register({
                    name,
                    ...(entryKey === undefined ? {} : { key: entryKey }),
                    priority: -100,
                    locale: NS,
                    inject: () => teamSeatInject(ctx, navigation, reads, sharedRemotes, name),
                }, component);
            }
            else if (!active && dispose !== undefined) {
                dispose();
                dispose = undefined;
            }
        };
        const unsubscribe = navigation.subscribe(reconcile);
        reconcile();
        return () => {
            unsubscribe();
            dispose?.();
            dispose = undefined;
        };
    });
}
function applyUi(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'agent-team: dictionaries');
    const navigation = new TeamNavigation();
    const disposeNavigation = ctx.reflect.provide('teamNavigation', navigation);
    const drafts = new TeamDraftStore();
    const disposeDrafts = ctx.reflect.provide('teamDrafts', drafts);
    // One identity projection for every seat, re-read after a profile write. Reads are demand-driven: the first subscriber starts the read.
    const humanIdentity = new TeamHumanIdentity({
        loadProfile: () => ctx.remote.agentTeam.humanProfile({}),
        loadAvatarUrl: async (avatarRef) => {
            // Avatar bytes ride the avatar Remote, not the TTL-bound attachment cache; a data URL lets an `<img>` show them directly.
            const result = await ctx.remote.agentTeam.getHumanAvatar({ avatarRef });
            if (!result.ok || !result.value.mediaType.startsWith('image/'))
                return null;
            return `data:${result.value.mediaType};base64,${result.value.bytesBase64}`;
        },
    });
    const humanProfileWriter = new TeamHumanProfileWriter(humanIdentity, {
        setHumanName: (name, expectedFence) => ctx.remote.agentTeam.setHumanProfile({ name, expectedFence }),
        replaceAvatar: (request, expectedFence) => ctx.remote.agentTeam.putHumanAvatar({ ...request, expectedFence }),
        removeAvatar: expectedFence => ctx.remote.agentTeam.removeHumanAvatar({ expectedFence }),
    });
    let settingsRowRefresh = Promise.resolve();
    const refreshSettingsRowFence = () => {
        settingsRowRefresh = humanIdentity.refreshAfterWrite();
        void settingsRowRefresh;
    };
    const currentSettingsFence = async () => {
        await settingsRowRefresh;
        const fence = humanIdentity.getSnapshot().settingsFence;
        if (fence === undefined)
            throw new Error('the Human profile settings are unavailable');
        return fence;
    };
    // The sidebar row order is a Host preference (the row's `sidebarOrder` setting) cached in
    // this browser; the panels persist through these two calls without threading props.
    attachSidebarOrderHost({
        load: () => ctx.remote.agentTeam.sidebarOrder({}),
        save: request => ctx.remote.agentTeam.setSidebarOrder(request),
    });
    // An installation fact, not part of the Human's identity. Read once on the first subscriber; never written back.
    const environment = new TeamEnvironmentCheck({
        loadEnvironment: () => ctx.remote.agentTeam.environment({}),
    });
    // The Host row's two configuration groups. The shared settings form addresses
    // top-level section fields only, so each scope flattens one group this page
    // edits and maps its writes back onto that group's child paths — saving a
    // threshold never restates the sibling fields beside it, and saving a Worker
    // setting never restates the group's own siblings either.
    const rowForm = ctx.configForms?.get(HUMAN_PROFILE_SETTINGS_NAMESPACE);
    const teamConfig = rowForm === undefined ? undefined : new TeamConfigController(teamConfigScope(rowForm, refreshSettingsRowFence));
    const workerConfig = rowForm === undefined ? undefined : new WorkerConfigController(workerConfigScope(rowForm, refreshSettingsRowFence));
    // The extra-tool editor writes the settings namespace directly. The shared
    // ConfigForm loses the conflict/rejection distinction and also reloads before
    // the Human can review a stale draft.
    const extraToolGrants = new ExtraToolGrantsController({
        namespace: HUMAN_PROFILE_SETTINGS_NAMESPACE,
        settings: {
            describe: () => ctx.remote.settings.describe(),
            mutate: (namespace, ops, expectedRevision) => ctx.remote.settings.mutate(namespace, [...ops], expectedRevision),
        },
        catalog: {
            load: () => ctx.remote.agentTeam.toolCatalog({}),
        },
    });
    ctx.effect(() => () => {
        navigation.dispose();
        drafts.dispose();
        humanIdentity.dispose();
        environment.dispose();
        teamConfig?.dispose();
        workerConfig?.dispose();
        void disposeNavigation();
        void disposeDrafts();
    }, 'agent-team: navigation service');
    // Leaving an embedded Member Session view must rebind the selection, or the departed session stays retained as `mainView`.
    // Takeover is conditional so a selection made in the meantime survives; a dead return target keeps the departed
    // selection, as no public clear exists.
    ctx.effect(() => {
        let previous = navigation.getSnapshot();
        const restore = () => {
            const snapshot = navigation.getSnapshot();
            const departed = previous.memberSessionId;
            const returnTo = previous.returnToSessionId;
            previous = snapshot;
            if (departed === undefined || snapshot.memberSessionId !== undefined)
                return;
            if (currentMainSessionId(ctx) !== departed)
                return;
            if (returnTo !== undefined && ctx.sessions.list.getSnapshot().byId[returnTo] !== undefined)
                ctx.uiWorkspace.openSession(returnTo);
            // The Member view cleared the panel to own the column; re-enter the panel the mode names.
            if (snapshot.mode === 'team' && ctx.layout.panelInfo.getSnapshot().activePanelId === null)
                ctx.layout.selectPanel(TEAM_PANEL_ID);
        };
        const unsubscribe = navigation.subscribe(restore);
        return () => {
            unsubscribe();
            restore();
        };
    }, 'agent-team: member session restore');
    const changes = new TeamChangeStream(ctx.remote);
    ctx.effect(() => () => changes.dispose(), 'agent-team: change subscriptions');
    // One owner for data reads: shares in-flight reads per query, folds changes into invalidations before consumers
    // re-read, and drops superseded responses.
    const queries = new TeamQueries(changes);
    const disposeQueries = ctx.reflect.provide('teamQueries', queries);
    ctx.effect(() => () => { void disposeQueries(); queries.dispose(); }, 'agent-team: shared reads');
    // A stream that ended for good must be rebuilt here; a new Host generation also restarts the presence epoch,
    // so watermarks reset and in-flight reads stop being joinable.
    ctx.on('connection/reset', () => { changes.recover(); queries.newGeneration(); });
    const reads = new TeamReadStream();
    registerTeamPanel(ctx, navigation, queries, reads, drafts, humanIdentity);
    registerModeShadow(ctx, navigation, queries, reads, drafts, humanIdentity, 'sidebar.workspaces', TeamWorkspaceBrowser);
    registerModeShadow(ctx, navigation, queries, reads, drafts, humanIdentity, 'main', TeamConversation, 'conversation');
    // Rail selection and Team mode are one fact: selecting the Team panel enters the mode, another panel leaves it.
    // A null selection is left alone, since a Member Session view clears the panel to own the column.
    ctx.effect(() => {
        const sync = () => {
            const active = ctx.layout.panelInfo.getSnapshot().activePanelId;
            const snapshot = navigation.getSnapshot();
            if (active === TEAM_PANEL_ID) {
                if (snapshot.memberSessionId !== undefined)
                    navigation.actions().exitMemberSession();
                if (snapshot.mode !== 'team')
                    navigation.actions().enterTeam();
                return;
            }
            if (active !== null && snapshot.mode === 'team')
                navigation.actions().leaveTeam();
        };
        const unsubscribe = ctx.layout.panelInfo.subscribe(sync);
        // A reload re-selects the panel the mode was left in, unless a restored Member Session view owns the column.
        const restored = navigation.getSnapshot();
        if (restored.mode === 'team' && restored.memberSessionId === undefined
            && ctx.layout.panelInfo.getSnapshot().activePanelId === null)
            ctx.layout.selectPanel(TEAM_PANEL_ID);
        sync();
        return unsubscribe;
    }, 'agent-team: panel ownership');
    // Team mode's commands come from the shell's own registry, so they appear in
    // the shortcut reference and stay rebindable instead of being a private listener.
    ctx.inject(['shortcuts'], (ready) => {
        const scoped = ready;
        const t = scoped.locale.bind(NS);
        scoped.effect(() => registerTeamShortcuts({
            navigation,
            selectPanel: panelId => { scoped.layout.selectPanel(panelId); },
            t,
        }, scoped.shortcuts), 'agent-team: shortcuts');
    });
    // The Team sidebar's CSS keys off this marker (the shell's New Session button stands down).
    ctx.effect(() => {
        const apply = () => {
            if (typeof document === 'undefined')
                return;
            if (navigation.getSnapshot().mode === 'team')
                document.documentElement.dataset.agentTeamMode = 'team';
            else
                delete document.documentElement.dataset.agentTeamMode;
        };
        const unsubscribe = navigation.subscribe(apply);
        apply();
        return () => {
            unsubscribe();
            if (typeof document !== 'undefined')
                delete document.documentElement.dataset.agentTeamMode;
        };
    }, 'agent-team: mode marker');
    // Ordered between General (0) and Models (10). The Team Remote returns the Host's own rejection reason;
    // the shared identity re-reads afterwards.
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'team-settings',
        order: 5,
        label: () => ctx.locale.bind(NS)('teamSettingsNav'),
        locale: NS,
        inject: () => ({
            identity: humanIdentity,
            environment,
            teamConfig,
            workerConfig,
            extraToolGrants,
            saveName: async (name) => humanProfileWriter.setName(name, await currentSettingsFence()),
            uploadAvatar: async (file) => {
                const expectedFence = await currentSettingsFence();
                return humanProfileWriter.replaceAvatar({
                    name: file.name,
                    ...(file.type === '' ? {} : { mediaType: file.type }),
                    bytesBase64: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
                }, expectedFence);
            },
            removeAvatar: async () => humanProfileWriter.removeAvatar(await currentSettingsFence()),
        }),
    }, TeamSettingsSection));
    // The nav mark rides the shell's own icon seat, addressed by the section id above, so
    // the row draws the bundle's mark instead of the generic gear. Registered beside the
    // section rather than observed in the DOM: the shell renders the icon it is given and
    // drops it with the registration, so nothing is left to clean up on unload.
    ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
        name: 'settings.section.icon',
        id: 'team-settings',
    }, TeamSettingsNavIcon));
}
export async function apply(ctx) {
    const disposeRemote = await ctx.remote.$mount(agentTeamRemote);
    ctx.effect(() => () => { void disposeRemote(); }, 'agent-team: remote');
    ctx.inject(['remote.agentTeam'], ready => { applyUi(ready); });
}
