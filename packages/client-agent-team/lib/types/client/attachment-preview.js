/** Base64 one file payload in chunks so large uploads stay off the call-stack limit. */
export function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let start = 0; start < bytes.length; start += chunk) {
        binary += String.fromCharCode(...bytes.subarray(start, start + chunk));
    }
    return btoa(binary);
}
/** Session-wide cache for usable bytes only. Missing and failed reads stay retryable. */
const dataUrlCache = new Map();
const inFlight = new Map();
export function cachedAttachmentDataUrl(attachmentId) {
    return dataUrlCache.get(attachmentId);
}
export function invalidateAttachmentDataUrl(attachmentId) {
    dataUrlCache.delete(attachmentId);
}
async function readAttachmentPreview(getAttachment, attachment) {
    const cached = dataUrlCache.get(attachment.attachmentId);
    if (cached !== undefined)
        return { kind: 'ready', dataUrl: cached };
    let result;
    try {
        result = await getAttachment({ attachmentId: attachment.attachmentId });
    }
    catch {
        return { kind: 'failed' };
    }
    if (!result.ok) {
        return { kind: result.error.code === 'team/attachment-not-found' ? 'missing' : 'failed' };
    }
    if (!attachment.mediaType.startsWith('image/'))
        return { kind: 'not-previewable' };
    const dataUrl = `data:${attachment.mediaType};base64,${result.value.bytesBase64}`;
    dataUrlCache.set(attachment.attachmentId, dataUrl);
    return { kind: 'ready', dataUrl };
}
export async function loadAttachmentPreview(getAttachment, attachment) {
    const cached = dataUrlCache.get(attachment.attachmentId);
    if (cached !== undefined)
        return { kind: 'ready', dataUrl: cached };
    const pending = inFlight.get(attachment.attachmentId);
    if (pending !== undefined)
        return pending;
    const request = readAttachmentPreview(getAttachment, attachment).finally(() => {
        inFlight.delete(attachment.attachmentId);
    });
    inFlight.set(attachment.attachmentId, request);
    return request;
}
export function formatByteSize(byteSize) {
    if (byteSize < 1024)
        return `${byteSize} B`;
    if (byteSize < 1024 * 1024)
        return `${(byteSize / 1024).toFixed(0)} KB`;
    return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}
