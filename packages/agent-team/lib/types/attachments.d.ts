import type { AgentTeamAttachmentId } from './types.ts';
/** Composer attachment cache: `$DSH_HOME/agent-team/attachments/v1/<attachmentId>/` holds the payload (sanitized name) plus a `meta.json` sidecar. Bytes are temporary; the ledger keeps the metadata. */
export declare const ATTACHMENT_MAX_BYTES: number;
/** Referenced uploads survive this long after upload for member consumption. */
export declare const ATTACHMENT_REFERENCED_TTL_MS: number;
/** Unreferenced uploads (uploaded but never sent) are cleaned much sooner. */
export declare const ATTACHMENT_ORPHAN_TTL_MS: number;
export declare function attachmentsRoot(): string;
/** Absolute payload path of one stored attachment, as offered to Member agents. */
export declare function attachmentPayloadPath(attachmentId: AgentTeamAttachmentId, name: string): string;
export declare function newAttachmentId(): AgentTeamAttachmentId;
/** Request-stable cache id (see `stableRequestUuid`); `scope` separates path copies from the request's own upload. */
export declare function requestScopedAttachmentId(requestId: string, scope?: string): AgentTeamAttachmentId;
/** The request-stable id of the `index`-th path copy one message or reply request prepares. */
export declare function pathAttachmentId(requestId: string, index: number): AgentTeamAttachmentId;
/** Strip path separators, control characters, Windows-illegal characters, reserved device names, and leading dots from one client-supplied name. */
export declare function sanitizeFileName(raw: string): string;
/** Best-effort media type from one path's extension, so images render as thumbnails. */
export declare function mediaTypeForPath(raw: string): string;
/** Validate an agent-supplied path before any cache write, so a rejection leaves the cache untouched. */
export declare function validatePathAttachment(raw: string): Promise<void>;
/** Copy a validated file under the request-stable id. A committed Message may reference that id, so an existing entry is never overwritten: identical content replays, anything else is refused as a request-id collision. */
export declare function copyPathAttachment(root: string, raw: string, attachmentId: AgentTeamAttachmentId, requestId: string): Promise<{
    attachmentId: AgentTeamAttachmentId;
    name: string;
    byteSize: number;
    mediaType: string;
}>;
/** Store an upload under its request-derived id: identical payload replays, a different payload for the same request is refused. */
export declare function writeRequestScopedAttachment(root: string, requestId: string, rawName: string, mediaType: string, bytes: Buffer): Promise<{
    attachmentId: AgentTeamAttachmentId;
    path: string;
    name: string;
    byteSize: number;
    mediaType: string;
}>;
/** Write one upload as an immutable payload plus its metadata sidecar. */
export declare function writeAttachment(root: string, attachmentId: AgentTeamAttachmentId, rawName: string, mediaType: string, bytes: Buffer): Promise<{
    attachmentId: AgentTeamAttachmentId;
    path: string;
    name: string;
    byteSize: number;
    mediaType: string;
}>;
export interface StoredAttachment {
    readonly name: string;
    readonly mediaType: string;
    readonly byteSize: number;
    readonly uploadedAt: string;
    readonly bytes: Buffer;
}
export type AttachmentReadOutcome = {
    readonly kind: 'found';
    readonly attachment: StoredAttachment;
} | {
    readonly kind: 'missing';
};
/** Read one attachment back, separating a confirmed absent entry from corrupt or unreadable cache state. */
export declare function readAttachment(root: string, attachmentId: AgentTeamAttachmentId): Promise<AttachmentReadOutcome>;
export interface CacheEntryScan {
    readonly attachmentId: AgentTeamAttachmentId;
    readonly uploadedAt: number;
}
/** List every cache entry with its upload instant for the GC sweep. */
export declare function scanAttachmentCache(root: string): Promise<readonly CacheEntryScan[]>;
/** Remove one cache entry's bytes; missing entries already satisfy the sweep. */
export declare function removeAttachment(root: string, attachmentId: AgentTeamAttachmentId): Promise<void>;
/** Ids of uploads a Message still references — everything else is an orphan. */
export type ReferencedAttachments = ReadonlySet<AgentTeamAttachmentId>;
/** One GC pass: drops orphans past the orphan TTL and referenced uploads past the consumption TTL; returns removed ids. */
export declare function sweepAttachmentCache(root: string, referenced: ReferencedAttachments, now: number): Promise<readonly AgentTeamAttachmentId[]>;
/** Accept only well-formed `type/subtype` media types; anything else falls back to the generic binary type. */
export declare function sanitizeMediaType(raw?: string | undefined): string;
//# sourceMappingURL=attachments.d.ts.map