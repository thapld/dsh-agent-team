import { TEAM_PANEL_ID } from "./navigation.js";
/**
 * One chord for every device. Web keeps Alt in the chord because the browser
 * owns the bare Command combinations (N, W, T) and never delivers them here.
 * @param code - physical key code.
 * @param options - `linux: false` leaves Linux Desktop unbound; it reserves arrow chords.
 * @returns defaults for the Desktop and Web profiles this Client ships on.
 */
function altPrimary(code, options = {}) {
    const binding = { code, modifiers: ['primary', 'alt'] };
    return {
        'desktop:macos': binding,
        'desktop:windows': binding,
        ...(options.linux === false ? {} : { 'desktop:linux': binding }),
        'web:macos': binding,
        'web:windows': binding,
    };
}
/**
 * A digit chord with every modifier. macOS keeps Command+Shift+3, 4, and 5 for
 * screenshots and never delivers them, so the whole family carries Alt instead
 * of leaving three of its nine members dead.
 * @param code - physical key code.
 * @returns defaults for the Desktop and Web profiles this Client ships on.
 */
function altShiftPrimary(code) {
    const binding = { code, modifiers: ['primary', 'alt', 'shift'] };
    return {
        'desktop:macos': binding,
        'desktop:windows': binding,
        'desktop:linux': binding,
        'web:macos': binding,
        'web:windows': binding,
    };
}
/** The Team composer's editable element, or undefined on a face that carries none (Inbox, Task board). */
function composerInput() {
    if (typeof document === 'undefined')
        return undefined;
    return document.querySelector('[data-team-composer] textarea') ?? undefined;
}
/** Project rows in the order the sidebar shows them: the visible list is the order a reader means. */
function projectRows() {
    if (typeof document === 'undefined')
        return [];
    return [...document.querySelectorAll('[data-team-project-row]')]
        .flatMap(row => row.dataset.teamProjectRow === undefined ? [] : [row.dataset.teamProjectRow]);
}
/** Inbox rows in the order the page shows them. */
function inboxRows() {
    if (typeof document === 'undefined')
        return [];
    return [...document.querySelectorAll('[data-team-inbox-row]')];
}
/**
 * Register Team mode's commands against the window's shortcut service.
 * @param host - Team navigation, rail selection, and dictionary.
 * @param shortcuts - the Client's command service.
 * @returns disposer removing every command.
 */
export function registerTeamShortcuts(host, shortcuts) {
    // The rail row is a destination: leaving Team mode also hands the column back to the conversation.
    const leave = () => {
        host.navigation.actions().leaveTeamForConversation(() => { host.selectPanel(null); });
    };
    // A face is a destination too: the mode and the rail selection are one fact,
    // so asking for the mode first keeps a Member Session view from swallowing it.
    const open = (select) => {
        host.navigation.actions().enterTeam();
        host.selectPanel(TEAM_PANEL_ID);
        select();
    };
    // The list wraps, so one chord reaches every Project without a second gesture.
    const step = (delta) => {
        const refs = projectRows();
        if (refs.length === 0)
            return;
        const current = host.navigation.getSnapshot().projectRef;
        const index = current === undefined ? -1 : refs.indexOf(current);
        const next = index === -1
            ? (delta === 1 ? 0 : refs.length - 1)
            : (index + delta + refs.length) % refs.length;
        open(() => { host.navigation.actions().selectProject(refs[next]); });
    };
    const commands = [
        {
            id: 'team.mode.toggle',
            label: () => host.t('shortcutTeamMode'),
            aliases: ['team mode', 'toggle team'],
            defaults: altPrimary('KeyT'),
            regions: ['page', 'editable'],
            modals: [],
            resolve: () => ({ status: 'handled', run: () => {
                    if (host.navigation.getSnapshot().mode === 'team')
                        leave();
                    else
                        host.selectPanel(TEAM_PANEL_ID);
                } }),
        },
        {
            id: 'team.inbox',
            label: () => host.t('inboxTitle'),
            aliases: ['inbox', 'unread'],
            defaults: altPrimary('Digit1'),
            regions: ['page', 'editable'],
            modals: [],
            resolve: () => ({ status: 'handled', run: () => { open(() => { host.navigation.actions().selectInbox(); }); } }),
        },
        {
            id: 'team.board',
            label: () => host.t('taskBoard'),
            aliases: ['task board', 'board'],
            defaults: altPrimary('Digit2'),
            regions: ['page', 'editable'],
            modals: [],
            resolve: () => ({ status: 'handled', run: () => { open(() => { host.navigation.actions().selectBoard(); }); } }),
        },
        {
            id: 'team.composer.focus',
            label: () => host.t('shortcutFocusComposer'),
            aliases: ['composer', 'focus input', 'reply'],
            // Not KeyI: Chrome and Safari keep Command+Alt+I for DevTools and never deliver it to the page.
            defaults: altPrimary('KeyM'),
            regions: ['page', 'editable'],
            modals: [],
            resolve: () => ({ status: 'handled', run: () => { composerInput()?.focus(); } }),
        },
        {
            id: 'team.back',
            label: () => host.t('shortcutBack'),
            aliases: ['back', 'go back', 'up'],
            // ArrowLeft pairs with the Project stepping chords; Linux Desktop reserves arrow chords.
            defaults: altPrimary('ArrowLeft', { linux: false }),
            regions: ['page', 'editable'],
            modals: [],
            resolve: () => ({ status: 'handled', run: () => { host.navigation.actions().back(); } }),
        },
        {
            id: 'team.forward',
            label: () => host.t('shortcutForward'),
            aliases: ['forward', 'go forward', 'down'],
            defaults: altPrimary('ArrowRight', { linux: false }),
            regions: ['page', 'editable'],
            modals: [],
            resolve: () => ({ status: 'handled', run: () => { host.navigation.actions().forward(); } }),
        },
        {
            id: 'team.project.previous',
            label: () => host.t('shortcutPreviousProject'),
            aliases: ['previous project', 'project up'],
            defaults: altPrimary('ArrowUp', { linux: false }),
            regions: ['page', 'editable'],
            modals: [],
            resolve: () => ({ status: 'handled', run: () => { step(-1); } }),
        },
        {
            id: 'team.project.next',
            label: () => host.t('shortcutNextProject'),
            aliases: ['next project', 'project down'],
            defaults: altPrimary('ArrowDown', { linux: false }),
            regions: ['page', 'editable'],
            modals: [],
            resolve: () => ({ status: 'handled', run: () => { step(1); } }),
        },
        // One command per digit: the registry matches exact combinations, so a
        // family of nine is nine rows in the reference and nine rebindable actions.
        ...Array.from({ length: 9 }, (_, offset) => ({
            id: `team.inbox.item.${offset + 1}`,
            label: () => host.t('shortcutInboxItem', { index: String(offset + 1) }),
            aliases: [`inbox item ${offset + 1}`],
            defaults: altShiftPrimary(`Digit${offset + 1}`),
            regions: ['page', 'editable'],
            modals: [],
            // The row opens exactly as a click on it does; a face without that row does nothing.
            resolve: () => ({ status: 'handled', run: () => { inboxRows()[offset]?.click(); } }),
        })),
    ];
    const disposers = commands.map(command => shortcuts.register(command));
    return () => { for (const dispose of disposers)
        dispose(); };
}
