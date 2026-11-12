import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives';
export type TeamStateDotState = StateDotState | 'todo' | 'quiet';
/** Native StateDot states pass through; the quiet statuses mirror its geometry locally: todo a hollow ring, quiet a solid tertiary dot with the same 10% halo. */
export declare function TeamStateDot({ state, size }: {
    readonly state: TeamStateDotState;
    readonly size?: number | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=TeamStateDot.d.ts.map