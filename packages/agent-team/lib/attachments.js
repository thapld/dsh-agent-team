import { lstat, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, relative, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { stableRequestUuid } from "./request-scoped-id.js";
import { recoveryFor } from "./recovery-hints.js";
import { truncateToCharacters } from "./text.js";
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
/** Composer attachment cache: `$DSH_HOME/agent-team/attachments/v1/<attachmentId>/` holds the payload (sanitized name) plus a `meta.json` sidecar. Bytes are temporary; the ledger keeps the metadata. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
/** Sidecar name; `sanitizeFileName` escapes client names that collide with it. */
const ATTACHMENT_SIDECAR_NAME = 'meta.json';
/** Cache ids are UUID directory names; arbitrary path-like text is not a reference. */
const ATTACHMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Referenced uploads survive this long after upload for member consumption. */
export const ATTACHMENT_REFERENCED_TTL_MS = 72 * 60 * 60 * 1000;
/** Unreferenced uploads (uploaded but never sent) are cleaned much sooner. */
export const ATTACHMENT_ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;
export function attachmentsRoot() {
    return dshHomePath('agent-team', 'attachments', 'v1');
}
/** Absolute payload path of one stored attachment, as offered to Member agents. */
export function attachmentPayloadPath(attachmentId, name) {
    if (name.length === 0 || sanitizeFileName(name) !== name)
        throw new Error(`attachment '${attachmentId}' has an invalid stored file name`);
    return join(attachmentDir(attachmentsRoot(), attachmentId), name);
}
export function newAttachmentId() {
    return randomUUID();
}
/** Request-stable cache id (see `stableRequestUuid`); `scope` separates path copies from the request's own upload. */
export function requestScopedAttachmentId(requestId, scope) {
    return stableRequestUuid('attachment-request', requestId, scope);
}
/** The request-stable id of the `index`-th path copy one message or reply request prepares. */
export function pathAttachmentId(requestId, index) {
    return requestScopedAttachmentId(requestId, `path:${index}`);
}
/** Strip path separators, control characters, Windows-illegal characters, reserved device names, and leading dots from one client-supplied name. */
export function sanitizeFileName(raw) {
    // oxlint-disable no-control-regex -- strip ASCII control characters, separators, and Windows-reserved characters from client filenames.
    const cleaned = truncateToCharacters(raw
        .replaceAll(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '')
        .replaceAll(/^\.+/g, '')
        .trim(), 180)
        .replace(/[\s.]+$/g, '');
    // oxlint-enable no-control-regex
    if (cleaned === '')
        return 'attachment';
    if (cleaned.toLowerCase() === ATTACHMENT_SIDECAR_NAME)
        return `_${cleaned}`;
    // Win32 CreateFile resolves these device names (with or without an
    // extension) as hardware, so the payload write would fail or alias a device.
    return /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(cleaned) ? `_${cleaned}` : cleaned;
}
/** Extension-derived media types for agent-supplied files; unknown types stay generic. */
const PATH_MEDIA_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
};
/** Best-effort media type from one path's extension, so images render as thumbnails. */
export function mediaTypeForPath(raw) {
    return PATH_MEDIA_TYPES[extname(raw).toLowerCase()] ?? 'application/octet-stream';
}
/** Refuse with the subject named and the way out in one sentence, so the model can resend the same value. */
function refuseAttachment(subject, fault) {
    throw new Error(`attachment ${subject} ${fault} — ${recoveryFor('attachment_path_rejected').sentence({ refused: subject })}`);
}
/** Validate an agent-supplied path before any cache write, so a rejection leaves the cache untouched. */
export async function validatePathAttachment(raw) {
    if (!isAbsolute(raw))
        refuseAttachment(`path '${raw}'`, 'must be absolute');
    const info = await stat(raw).catch(() => undefined);
    if (info === undefined)
        refuseAttachment(`path '${raw}'`, 'does not exist');
    if (!info.isFile())
        refuseAttachment(`path '${raw}'`, 'is not a regular file');
    if (info.size === 0)
        refuseAttachment(`'${basename(raw)}'`, 'must not be empty');
    if (info.size > ATTACHMENT_MAX_BYTES)
        refuseAttachment(`'${basename(raw)}'`, `exceeds the ${ATTACHMENT_MAX_BYTES} byte limit`);
}
/** Copy a validated file under the request-stable id. A committed Message may reference that id, so an existing entry is never overwritten: identical content replays, anything else is refused as a request-id collision. */
export async function copyPathAttachment(root, raw, attachmentId, requestId) {
    const bytes = await readFile(raw);
    const name = sanitizeFileName(basename(raw));
    const mediaType = mediaTypeForPath(raw);
    const existing = await readAttachmentForWrite(root, attachmentId);
    if (existing !== undefined) {
        collideUnlessSamePayload(existing, name, mediaType, bytes, requestId);
        return { attachmentId, name: existing.name, byteSize: existing.byteSize, mediaType: existing.mediaType };
    }
    const stored = await writeAttachment(root, attachmentId, basename(raw), mediaType, bytes);
    return { attachmentId: stored.attachmentId, name: stored.name, byteSize: stored.byteSize, mediaType: stored.mediaType };
}
/** Store an upload under its request-derived id: identical payload replays, a different payload for the same request is refused. */
export async function writeRequestScopedAttachment(root, requestId, rawName, mediaType, bytes) {
    const attachmentId = requestScopedAttachmentId(requestId);
    const existing = await readAttachmentForWrite(root, attachmentId);
    if (existing !== undefined) {
        collideUnlessSamePayload(existing, sanitizeFileName(rawName), mediaType, bytes, requestId);
        return { attachmentId, path: join(attachmentDir(root, attachmentId), existing.name), name: existing.name, byteSize: existing.byteSize, mediaType: existing.mediaType };
    }
    return writeAttachment(root, attachmentId, rawName, mediaType, bytes);
}
/** Refuse a reused request id whose stored payload no longer matches this attempt. */
function collideUnlessSamePayload(existing, name, mediaType, bytes, requestId) {
    if (existing.name !== name || existing.mediaType !== mediaType || !existing.bytes.equals(bytes)) {
        throw new Error(`agent-team request id '${requestId}' was reused with a different operation or payload`);
    }
}
function attachmentDir(root, attachmentId) {
    if (!ATTACHMENT_ID_PATTERN.test(attachmentId)) {
        throw new AttachmentCacheInvalidError(`attachment '${attachmentId}' is not a UUID cache id`);
    }
    return join(root, attachmentId);
}
function errorCode(error) {
    return typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;
}
class AttachmentCacheInvalidError extends Error {
    repairable;
    constructor(message, repairable = false) {
        super(message);
        this.repairable = repairable;
        this.name = 'AttachmentCacheInvalidError';
    }
}
function outside(root, target) {
    const path = relative(root, target);
    return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
}
async function resolveCacheDirectory(root, attachmentId) {
    const dir = attachmentDir(root, attachmentId);
    let info;
    try {
        info = await lstat(dir);
    }
    catch (error) {
        if (errorCode(error) === 'ENOENT')
            return undefined;
        throw error;
    }
    if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new AttachmentCacheInvalidError(`attachment '${attachmentId}' does not name a cache directory`);
    }
    const [realRoot, realDir] = await Promise.all([realpath(root), realpath(dir)]);
    if (outside(realRoot, realDir)) {
        throw new AttachmentCacheInvalidError(`attachment '${attachmentId}' points outside the attachment cache`);
    }
    return realDir;
}
async function cacheFile(dir, name) {
    const path = join(dir, name);
    let info;
    try {
        info = await lstat(path);
    }
    catch (error) {
        if (errorCode(error) === 'ENOENT')
            return undefined;
        throw error;
    }
    if (!info.isFile() || info.isSymbolicLink()) {
        throw new AttachmentCacheInvalidError(`attachment cache file '${name}' is not a regular file`, true);
    }
    const real = await realpath(path);
    if (outside(dir, real)) {
        throw new AttachmentCacheInvalidError(`attachment cache file '${name}' points outside its entry`);
    }
    return real;
}
function parseAttachmentMeta(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw.toString('utf8'));
    }
    catch {
        throw new AttachmentCacheInvalidError('attachment metadata is not valid JSON', true);
    }
    if (typeof parsed !== 'object' || parsed === null) {
        throw new AttachmentCacheInvalidError('attachment metadata is not an object', true);
    }
    const meta = parsed;
    if (typeof meta.name !== 'string' || meta.name.length === 0 || sanitizeFileName(meta.name) !== meta.name) {
        throw new AttachmentCacheInvalidError('attachment metadata has an invalid file name', true);
    }
    if (typeof meta.mediaType !== 'string' || sanitizeMediaType(meta.mediaType) !== meta.mediaType) {
        throw new AttachmentCacheInvalidError('attachment metadata has an invalid media type', true);
    }
    if (typeof meta.uploadedAt !== 'string' || !Number.isFinite(Date.parse(meta.uploadedAt))) {
        throw new AttachmentCacheInvalidError('attachment metadata has an invalid upload time', true);
    }
    return { name: meta.name, mediaType: meta.mediaType, uploadedAt: meta.uploadedAt };
}
/** Write one upload as an immutable payload plus its metadata sidecar. */
export async function writeAttachment(root, attachmentId, rawName, mediaType, bytes) {
    const name = sanitizeFileName(rawName);
    const storedMediaType = sanitizeMediaType(mediaType);
    const dir = attachmentDir(root, attachmentId);
    const existing = await lstat(dir).catch(error => {
        if (errorCode(error) === 'ENOENT')
            return undefined;
        throw error;
    });
    if (existing !== undefined) {
        if (!existing.isDirectory() || existing.isSymbolicLink()) {
            throw new AttachmentCacheInvalidError(`attachment '${attachmentId}' does not name a cache directory`);
        }
    }
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), bytes);
    const meta = { name, mediaType: storedMediaType, uploadedAt: new Date().toISOString() };
    await writeFile(join(dir, ATTACHMENT_SIDECAR_NAME), JSON.stringify(meta), 'utf8');
    return { attachmentId, path: join(dir, name), name, byteSize: bytes.byteLength, mediaType: storedMediaType };
}
/** Read one attachment back, separating a confirmed absent entry from corrupt or unreadable cache state. */
export async function readAttachment(root, attachmentId) {
    const dir = await resolveCacheDirectory(root, attachmentId);
    if (dir === undefined)
        return { kind: 'missing' };
    const metaPath = await cacheFile(dir, ATTACHMENT_SIDECAR_NAME);
    if (metaPath === undefined)
        throw new AttachmentCacheInvalidError(`attachment '${attachmentId}' has no metadata sidecar`, true);
    const meta = parseAttachmentMeta(await readFile(metaPath));
    const entries = await readdir(dir);
    const payloads = entries.filter(entry => entry !== ATTACHMENT_SIDECAR_NAME);
    if (payloads.length !== 1 || payloads[0] !== meta.name) {
        throw new AttachmentCacheInvalidError(`attachment '${attachmentId}' does not contain exactly the payload its metadata names`, true);
    }
    const payloadPath = await cacheFile(dir, meta.name);
    if (payloadPath === undefined) {
        throw new AttachmentCacheInvalidError(`attachment '${attachmentId}' metadata has no payload`, true);
    }
    const bytes = await readFile(payloadPath);
    return { kind: 'found', attachment: { name: meta.name, mediaType: meta.mediaType, byteSize: bytes.byteLength, uploadedAt: meta.uploadedAt, bytes } };
}
/** A retried write may replace its own partial entry, but never a redirected path or an I/O failure. */
async function readAttachmentForWrite(root, attachmentId) {
    try {
        const outcome = await readAttachment(root, attachmentId);
        return outcome.kind === 'found' ? outcome.attachment : undefined;
    }
    catch (error) {
        if (!(error instanceof AttachmentCacheInvalidError) || !error.repairable)
            throw error;
        await removeAttachment(root, attachmentId);
        return undefined;
    }
}
/** Read one cache entry's sidecar; `undefined` for a half-written or foreign directory the sweep skips. */
async function readCacheEntry(root, id) {
    try {
        const dir = await resolveCacheDirectory(root, id);
        if (dir === undefined)
            return undefined;
        const metaPath = await cacheFile(dir, ATTACHMENT_SIDECAR_NAME);
        if (metaPath === undefined)
            return undefined;
        const meta = parseAttachmentMeta(await readFile(metaPath));
        return { attachmentId: id, uploadedAt: Date.parse(meta.uploadedAt) };
    }
    catch {
        return undefined;
    }
}
/** List every cache entry with its upload instant for the GC sweep. */
export async function scanAttachmentCache(root) {
    let ids;
    try {
        ids = await readdir(root);
    }
    catch {
        return [];
    }
    const entries = [];
    for (const id of ids) {
        const entry = await readCacheEntry(root, id);
        if (entry !== undefined)
            entries.push(entry);
    }
    return entries;
}
/** Remove one cache entry's bytes; missing entries already satisfy the sweep. */
export async function removeAttachment(root, attachmentId) {
    await rm(attachmentDir(root, attachmentId), { recursive: true, force: true });
}
/** One GC pass: drops orphans past the orphan TTL and referenced uploads past the consumption TTL; returns removed ids. */
export async function sweepAttachmentCache(root, referenced, now) {
    const removed = [];
    for (const entry of await scanAttachmentCache(root)) {
        const age = now - entry.uploadedAt;
        const ttl = referenced.has(entry.attachmentId) ? ATTACHMENT_REFERENCED_TTL_MS : ATTACHMENT_ORPHAN_TTL_MS;
        if (age > ttl) {
            await removeAttachment(root, entry.attachmentId);
            removed.push(entry.attachmentId);
        }
    }
    return removed;
}
/** Accept only well-formed `type/subtype` media types; anything else falls back to the generic binary type. */
export function sanitizeMediaType(raw) {
    const candidate = (raw ?? '').trim().toLowerCase();
    return /^[a-z0-9][-.\w]*\/[-.\w]+$/.test(candidate) ? candidate : 'application/octet-stream';
}
