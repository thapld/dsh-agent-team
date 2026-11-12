import type { RemoteFailure, RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { AgentTeamAttachmentId, AgentTeamPutAttachmentRequest, AgentTeamPutAttachmentResult, AgentTeamRequestId } from '@contexera/dsh-agent-team/types';
export declare const mintRequestId: () => AgentTeamRequestId;
export interface ComposerUpload {
    readonly file: File;
    readonly requestId: AgentTeamRequestId;
    readonly attachmentId?: AgentTeamAttachmentId | undefined;
}
/** Keep each file's upload identity while the composer input still holds the same File. */
export declare const reconcileComposerUploads: (files: readonly File[], previous: readonly ComposerUpload[]) => readonly ComposerUpload[];
export declare const sameComposerFiles: (uploads: readonly ComposerUpload[], files: readonly File[]) => boolean;
/** Carry upload results into a newer intent only when the same file and upload request still stand. */
export declare const mergeSettledComposerUploads: (current: readonly ComposerUpload[], settled: readonly ComposerUpload[]) => readonly ComposerUpload[];
export declare const uploadComposerFiles: (putAttachment: (request: AgentTeamPutAttachmentRequest) => Promise<RemoteResult<AgentTeamPutAttachmentResult>>, workspaceId: AgentTeamPutAttachmentRequest["workspaceId"], uploads: readonly ComposerUpload[]) => Promise<{
    ok: true;
    attachmentIds: readonly AgentTeamAttachmentId[];
    uploads: readonly ComposerUpload[];
} | {
    ok: false;
    error: string;
    uploads: readonly ComposerUpload[];
}>;
/** DSH reports carrier loss and ordinary Host exceptions as gateway/internal; an unclassified failure is equally ambiguous. */
export declare const isUncertainRemoteFailure: (error: RemoteFailure) => boolean;
//# sourceMappingURL=requests.d.ts.map