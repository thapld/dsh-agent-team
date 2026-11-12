import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import { type TeamEnvironmentSource } from './environment-check.ts';
/**
 * The local environment check: which DSH line this installation runs against and whether it is inside the declared range.
 * Three verdicts only; a fact the Host could not establish is `undetermined`, not a mismatch. Every verdict is text plus an
 * icon so it survives color blindness. The tested combination prints only when the Host derived both versions.
 */
export type EnvironmentCheckProps = PropsLocale<'team'> & {
    readonly environment: TeamEnvironmentSource;
};
export declare function EnvironmentCheck({ t, environment }: EnvironmentCheckProps): import("react").JSX.Element | null;
//# sourceMappingURL=EnvironmentCheck.d.ts.map