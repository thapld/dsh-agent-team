/** The one local environment check: how the running DSH compares to the line this bundle declares. */
import type { AgentTeamEnvironmentSupportRange, AgentTeamEnvironmentVerdict } from './types.ts';
/** What the settings page needs; unlike the wire `AgentTeamEnvironmentResult`, `bundleVersion` is required because the checker always knows it. */
export interface EnvironmentReport {
    readonly verdict: AgentTeamEnvironmentVerdict;
    /** Host-side diagnostic for an `undetermined` verdict; never rendered as user copy. */
    readonly reason?: string | undefined;
    /** Version of the bundle this Host runs from, or `'unknown'` when its manifest is unreadable. */
    readonly bundleVersion: string;
    /** The running DSH version; omitted when unreadable. Distinct from `certifiedDshVersion`, the line this bundle declares. */
    readonly dshVersion?: string | undefined;
    /** Lower bound of the declared support range: the certified, actually-tested DSH line. */
    readonly certifiedDshVersion?: string | undefined;
    readonly supportRange?: AgentTeamEnvironmentSupportRange | undefined;
}
/** Support line from the installed manifest's DSH peers; `undefined` unless every peer carries the same `>=lower <upper>` range (`scripts/check-version-consistency.mjs` holds the same shape). */
export declare function supportRangeOf(manifest: object): AgentTeamEnvironmentSupportRange | undefined;
/** Judges one resolved triple with the Harness's `evaluatePluginCompatibility`, the plugin manager's own installability check (it orders prereleases correctly). */
export declare function evaluateEnvironment(manifest: object, runtimeVersion: string, bundleVersion: string, unavailable?: string): EnvironmentReport;
/** Reads this Host's environment. The certified DSH version is the range's lower bound, not the newest tested cut (`docs/dsh-release-compatibility.md` §4). */
export declare function reportEnvironment(): EnvironmentReport;
//# sourceMappingURL=environment-check.d.ts.map