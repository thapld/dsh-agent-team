/** Team mode's keyboard commands: the rail row, the two sidebar cards, the composer, the project list, and Inbox rows. */
import type { Shortcuts } from '@deepseek-ai/dsh-client-shortcuts/client';
import { TEAM_PANEL_ID, type TeamNavigation } from './navigation.ts';
import type { TeamKey } from './locales.ts';
/** What the commands act on: Team navigation, the rail's panel selection, and the Team dictionary. */
export interface TeamShortcutHost {
    readonly navigation: TeamNavigation;
    /** The shipped layout's panel selection; the rail row and these commands share it. */
    selectPanel(panelId: typeof TEAM_PANEL_ID | null): void;
    readonly t: (key: TeamKey, params?: Record<string, string>) => string;
}
/**
 * Register Team mode's commands against the window's shortcut service.
 * @param host - Team navigation, rail selection, and dictionary.
 * @param shortcuts - the Client's command service.
 * @returns disposer removing every command.
 */
export declare function registerTeamShortcuts(host: TeamShortcutHost, shortcuts: Shortcuts): () => void;
//# sourceMappingURL=team-shortcuts.d.ts.map