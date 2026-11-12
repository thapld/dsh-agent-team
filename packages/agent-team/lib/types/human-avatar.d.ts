/** Persistent human avatar store: `<avatarRef>/` payload plus `meta.json`, with no TTL sweep since avatars outlive message attachments. */
export declare function humanAvatarsRoot(): string;
/** The directory id emitted by every released avatar writer; reject every other value before it reaches a path join. */
export declare function assertHumanAvatarRef(avatarRef: string): string;
export interface StoredHumanAvatar {
    readonly name: string;
    readonly mediaType: string;
    readonly byteSize: number;
    readonly uploadedAt: string;
    readonly bytes: Buffer;
}
/** Accept only image payloads; the settings page sends `image/*` exclusively. */
export declare function assertAvatarMediaType(mediaType: string): string;
/** Write one avatar as an immutable entry; the caller stores the ref in settings. */
export declare function writeHumanAvatar(root: string, rawName: string, mediaType: string, bytes: Buffer): Promise<{
    avatarRef: string;
    path: string;
    name: string;
    byteSize: number;
    mediaType: string;
}>;
/** Read one avatar back; `undefined` when removed or never written. */
export declare function readHumanAvatar(root: string, avatarRef: string): Promise<StoredHumanAvatar | undefined>;
/** Remove one avatar entry; missing entries already satisfy the removal. */
export declare function removeHumanAvatar(root: string, avatarRef: string): Promise<void>;
//# sourceMappingURL=human-avatar.d.ts.map