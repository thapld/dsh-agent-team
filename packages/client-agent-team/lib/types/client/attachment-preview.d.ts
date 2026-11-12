import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { AgentTeamAttachmentId, AgentTeamGetAttachmentRequest, AgentTeamGetAttachmentResult } from '@contexera/dsh-agent-team/types';
/** Base64 one file payload in chunks so large uploads stay off the call-stack limit. */
export declare function bytesToBase64(bytes: Uint8Array): string;
/** The slot's Remote result union without importing the slots module. */
export type GetAttachment = (request: AgentTeamGetAttachmentRequest) => Promise<RemoteResult<AgentTeamGetAttachmentResult>>;
export type AttachmentPreviewOutcome = {
    readonly kind: 'ready';
    readonly dataUrl: string;
} | {
    readonly kind: 'not-previewable';
} | {
    readonly kind: 'missing';
} | {
    readonly kind: 'failed';
};
export declare function cachedAttachmentDataUrl(attachmentId: AgentTeamAttachmentId): string | undefined;
export declare function invalidateAttachmentDataUrl(attachmentId: AgentTeamAttachmentId): void;
export declare function loadAttachmentPreview(getAttachment: GetAttachment, attachment: {
    attachmentId: AgentTeamAttachmentId;
    mediaType: string;
}): Promise<AttachmentPreviewOutcome>;
export declare function formatByteSize(byteSize: number): string;
//# sourceMappingURL=attachment-preview.d.ts.map