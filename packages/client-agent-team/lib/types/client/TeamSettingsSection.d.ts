import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type TeamHumanIdentityFace, type TeamHumanProfileActionOutcome } from './human-identity.ts';
import { type ExtraToolGrantsFace } from './extra-tool-grants.ts';
import type { TeamEnvironmentSource } from './environment-check.ts';
import { type TeamConfigFace, type WorkerConfigFace } from './team-config.ts';
/** The Team's settings page: identity, the Host row's two configuration groups, the local environment check, and the version footnote. It owns no durable fact and no copy of one — identity writes through the Team Remote, both groups through the shared configuration form — and a failed write keeps the typed value and reports the Host's reason. */
export interface TeamSettingsInjected {
    /** The shared Human identity projection: profile facts plus post-write refresh. */
    identity: TeamHumanIdentityFace;
    /** Persist one renamed display name; the failure message when the Host refuses it. */
    saveName: (name: string) => Promise<TeamHumanProfileActionOutcome>;
    /** Upload one image file, persist its reference; the failure message when it does not stick. */
    uploadAvatar: (file: File) => Promise<TeamHumanProfileActionOutcome>;
    removeAvatar: () => Promise<TeamHumanProfileActionOutcome>;
    environment: TeamEnvironmentSource;
    /** The Host row's compaction threshold; absent when the settings service is. */
    teamConfig?: TeamConfigFace | undefined;
    /** The Host row's Worker delegation group; absent when the settings service is. */
    workerConfig?: WorkerConfigFace | undefined;
    /** The profile-wide exact tool-name grants; absent when either Remote is. */
    extraToolGrants?: ExtraToolGrantsFace | undefined;
}
export type TeamSettingsProps = PropsRuntime<'settings.section'> & PropsLocale<'team'> & TeamSettingsInjected;
export declare function TeamSettingsSection(props: TeamSettingsProps): import("react").JSX.Element;
//# sourceMappingURL=TeamSettingsSection.d.ts.map