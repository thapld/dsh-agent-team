import z from '@deepseek-ai/schemastery';
import { isCollection, isMap, isPair, isScalar, isSeq, parse, parseDocument } from 'yaml';
import { bundleVersionOf, readInstalledManifest } from "./installed-manifest.js";
import { HUMAN_AVATAR_NONE } from "./human-settings.js";
/** Fallback display name before any user override is stored. */
export const HUMAN_PROFILE_DEFAULT_NAME = 'human';
/** Repository home for the version footnote link. */
export const HUMAN_PROFILE_REPO_URL = 'https://github.com/Contexera/dsh-agent-team';
/** Bundle version of the package this Host runs from, read once from the installed manifest; `'unknown'` when the manifest is unreadable or malformed. Informational only. */
export const HUMAN_PROFILE_VERSION = bundleVersionOf(readInstalledManifest());
/** Schemastery schema of the Human profile (the Team Host row's Config). Both fields are volatile so edits reach the running Host without remounting. */
export const HUMAN_PROFILE_SETTINGS_SCHEMA = z.object({
    name: z.string().default(HUMAN_PROFILE_DEFAULT_NAME).volatile(),
    // A missing field may inherit an avatar; explicit `null` is the Human's choice
    // to show no avatar and must shadow every inherited layer.
    avatarRef: z.union([z.string(), z.const(HUMAN_AVATAR_NONE)]).volatile(),
});
/** Normalize one candidate display name the way Member handles normalize. */
export function normalizeHumanName(raw) {
    return raw.normalize('NFKC').trim();
}
export function assertValidHumanName(raw) {
    const name = normalizeHumanName(raw);
    if (name === '')
        throw new Error('human name must not be empty');
    return name;
}
/** Retired settings section. The Harness `settings.yaml` importer rejects it, so its values survive only in the renamed document; this Host adopts them. */
export const LEGACY_HUMAN_PROFILE_SECTION = 'agent-team-human';
/** Reads the legacy section from a legacy settings document. An unparsable document or missing section means nothing to adopt; each field is validated independently. */
export function parseLegacyHumanProfile(yamlText) {
    let document;
    try {
        document = parse(yamlText);
    }
    catch {
        return undefined;
    }
    if (typeof document !== 'object' || document === null)
        return undefined;
    const section = document[LEGACY_HUMAN_PROFILE_SECTION];
    if (typeof section !== 'object' || section === null)
        return undefined;
    return readProfileFields(section);
}
/** YAML tag the Cordis entry-list dialect gives an unevaluated `!!js` expression. */
const EXPRESSION_TAG = 'tag:yaml.org,2002:js';
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
export function parseRowHumanProfile(yamlText, rowId) {
    const document = parseDocument(yamlText);
    if (document.errors.length !== 0)
        return undefined;
    const parsed = document.toJS();
    if (!Array.isArray(parsed))
        return undefined;
    const rows = parsed.filter(row => isRecord(row) && row.id === rowId);
    // Two rows for one id would make "the stored value" ambiguous; the loader
    // would apply them in order, but a recovery must not guess which one won.
    if (rows.length !== 1)
        return undefined;
    const config = rows[0].config;
    if (!isRecord(config))
        return undefined;
    const expressed = expressionFields(document, rowId);
    const carried = {};
    for (const [field, value] of Object.entries(config)) {
        if (!expressed.has(field))
            carried[field] = value;
    }
    return Object.keys(carried).length === 0 ? undefined : carried;
}
/** Whether a parsed YAML node is a mapping with named fields. */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** The `config` fields of the row that carries `rowId`, that hold or contain an unevaluated expression. */
function expressionFields(document, rowId) {
    const fields = new Set();
    const rows = isSeq(document.contents) ? document.contents.items : [];
    for (const row of rows) {
        if (!isMap(row) || scalarText(row.get('id', true)) !== rowId)
            continue;
        const config = row.get('config', true);
        if (!isMap(config))
            continue;
        for (const pair of config.items) {
            const field = scalarText(pair.key);
            if (field !== undefined && holdsExpression(pair.value))
                fields.add(field);
        }
    }
    return fields;
}
/** Whether a node is an expression, or a collection with one anywhere beneath it. */
function holdsExpression(node) {
    if (isScalar(node))
        return node.tag === EXPRESSION_TAG;
    if (!isCollection(node))
        return false;
    const { items } = node;
    return items.some(item => holdsExpression(isPair(item) ? item.value : item));
}
/** The scalar text of a node, or `undefined` when it is not a scalar string. */
function scalarText(node) {
    return isScalar(node) && typeof node.value === 'string' ? node.value : undefined;
}
/** Reads the Human profile fields out of a settings namespace's user layer, tolerating either field being absent or unusable. */
export function readProfileFields(fields) {
    let name;
    if (typeof fields.name === 'string') {
        try {
            name = assertValidHumanName(fields.name);
        }
        catch {
            name = undefined;
        }
    }
    const avatarRef = fields.avatarRef === HUMAN_AVATAR_NONE
        ? HUMAN_AVATAR_NONE
        : typeof fields.avatarRef === 'string' && fields.avatarRef.trim() !== ''
            ? fields.avatarRef.trim()
            : undefined;
    if (name === undefined && avatarRef === undefined)
        return undefined;
    return { ...(name === undefined ? {} : { name }), ...(avatarRef === undefined ? {} : { avatarRef }) };
}
