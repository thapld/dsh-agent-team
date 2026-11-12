import { bytesToBase64 } from "./attachment-preview.js";
export const mintRequestId = () => crypto.randomUUID();
/** Keep each file's upload identity while the composer input still holds the same File. */
export const reconcileComposerUploads = (files, previous) => {
    const available = [...previous];
    return files.map(file => {
        const index = available.findIndex(upload => upload.file === file);
        if (index === -1)
            return { file, requestId: mintRequestId() };
        return available.splice(index, 1)[0];
    });
};
export const sameComposerFiles = (uploads, files) => uploads.length === files.length && uploads.every((upload, index) => upload.file === files[index]);
/** Carry upload results into a newer intent only when the same file and upload request still stand. */
export const mergeSettledComposerUploads = (current, settled) => current.map(upload => {
    const completed = settled.find(candidate => candidate.file === upload.file && candidate.requestId === upload.requestId);
    return completed?.attachmentId === undefined ? upload : { ...upload, attachmentId: completed.attachmentId };
});
export const uploadComposerFiles = async (putAttachment, workspaceId, uploads) => {
    const completed = [];
    const attachmentIds = [];
    for (const [index, upload] of uploads.entries()) {
        if (upload.attachmentId !== undefined) {
            completed.push(upload);
            attachmentIds.push(upload.attachmentId);
            continue;
        }
        const remaining = uploads.slice(index);
        try {
            const uploaded = await putAttachment({
                requestId: upload.requestId, workspaceId,
                name: upload.file.name,
                mediaType: upload.file.type === '' ? undefined : upload.file.type,
                bytesBase64: bytesToBase64(new Uint8Array(await upload.file.arrayBuffer())),
            });
            if (!uploaded.ok)
                return { ok: false, error: uploaded.error.message, uploads: [...completed, ...remaining] };
            const settled = { ...upload, attachmentId: uploaded.value.attachmentId };
            completed.push(settled);
            attachmentIds.push(settled.attachmentId);
        }
        catch (cause) {
            return { ok: false, error: cause instanceof Error ? cause.message : String(cause), uploads: [...completed, ...remaining] };
        }
    }
    return { ok: true, attachmentIds, uploads: completed };
};
/** DSH reports carrier loss and ordinary Host exceptions as gateway/internal; an unclassified failure is equally ambiguous. */
export const isUncertainRemoteFailure = (error) => {
    const code = error.code;
    return code === undefined || code === 'gateway/internal' || code === 'gateway/cancelled';
};
