import z from '@deepseek-ai/schemastery';
/** Fallback display name before any user override is stored. */
export declare const HUMAN_PROFILE_DEFAULT_NAME = "human";
/** Repository home for the version footnote link. */
export declare const HUMAN_PROFILE_REPO_URL = "https://github.com/Contexera/dsh-agent-team";
/** Bundle version of the package this Host runs from, read once from the installed manifest; `'unknown'` when the manifest is unreadable or malformed. Informational only. */
export declare const HUMAN_PROFILE_VERSION: string;
/** Schemastery schema of the Human profile (the Team Host row's Config). Both fields are volatile so edits reach the running Host without remounting. */
export declare const HUMAN_PROFILE_SETTINGS_SCHEMA: z<Schemastery.ObjectS<NoInfer<{
    name: z<string, string, "volatile-defined">;
    avatarRef: z<string | null, string | null, "volatile">;
}>>, Schemastery.ObjectT<NoInfer<{
    name: z<string, string, "volatile-defined">;
    avatarRef: z<string | null, string | null, "volatile">;
}>>, "plain">;
/** Normalize one candidate display name the way Member handles normalize. */
export declare function normalizeHumanName(raw: string): string;
export declare function assertValidHumanName(raw: string): string;
/** Retired settings section. The Harness `settings.yaml` importer rejects it, so its values survive only in the renamed document; this Host adopts them. */
export declare const LEGACY_HUMAN_PROFILE_SECTION = "agent-team-human";
/** Fields recoverable from the legacy section; either may be absent. */
export interface LegacyHumanProfileFields {
    readonly name?: string;
    readonly avatarRef?: string | null;
}
/** Reads the legacy section from a legacy settings document. An unparsable document or missing section means nothing to adopt; each field is validated independently. */
export declare function parseLegacyHumanProfile(yamlText: string): LegacyHumanProfileFields | undefined;
/**
 * Reads the config a profile patch document stores under one row id.
 *
 * The pre-rename Host row kept the Human profile AND the operational Host
 * settings as that row's `config`, and after the rename no loader entry answers
 * to the old id any more — the patch is skipped at composition time — so the
 * document itself is the only place those values still exist.
 *
 * Values are returned as the document holds them, minus every field that
 * contains a Cordis expression: the loader would evaluate `!!js` in the row's
 * own context, and this recovery runs outside that context, so an expression
 * cannot be written back as a literal without silently replacing a computed
 * setting with its source text. Such a field is left to its default.
 *
 * A missing document, a non-array patch, a duplicate id, an unparsable
 * document, or a malformed config all read as absent: this is a recovery path,
 * and a half-understood document must not overwrite a stored setting.
 */
export declare function parseRowHumanProfile(yamlText: string, rowId: string): Record<string, unknown> | undefined;
/** Reads the Human profile fields out of a settings namespace's user layer, tolerating either field being absent or unusable. */
export declare function readProfileFields(fields: Record<string, unknown>): LegacyHumanProfileFields | undefined;
//# sourceMappingURL=human-profile.d.ts.map