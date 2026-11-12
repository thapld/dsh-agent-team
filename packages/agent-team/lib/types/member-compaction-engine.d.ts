import type { Agent } from '@deepseek-ai/dsh-agent';
import type { CompactionResult, CompactionTrigger } from '@deepseek-ai/dsh-compaction';
import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic';
import type { CommandId } from '@deepseek-ai/dsh-commands/brand';
import type { Message, ToolSchema } from '@deepseek-ai/dsh-llm';
/** One provider/model route a summarization call can go to. */
export interface MemberSummaryRoute {
    readonly provider: string;
    readonly model: string;
}
/** The step's fixed route, captured from `agent/pre-step`. */
export interface MemberStepRoute extends MemberSummaryRoute {
    readonly step: number;
}
type SummaryInput = {
    readonly messages: readonly Message[];
    readonly tools?: readonly ToolSchema[];
};
export default class MemberCompactionEngine extends BasicCompactionEngine {
    private stepRoute;
    private alternativeSpent;
    private readonly manualAgents;
    private readonly summaryFailures;
    private readonly degradedRoutes;
    compactIfNeeded(agent: Agent, trigger: CompactionTrigger, signal: AbortSignal): Promise<CompactionResult | null>;
    /** Bind the step's fixed route, or clear it at that step's end. */
    useStepRoute(agent: Agent, route: MemberStepRoute | undefined): void;
    /** Whether a bounded failure opened the circuit for this route. */
    degraded(agent: Agent, route: MemberSummaryRoute): boolean;
    /** Whether the last automatic attempt failed for a reason other than cancellation. */
    takeSummaryFailure(agent: Agent): boolean;
    compactNow(agent: Agent, signal: AbortSignal, sourceCommandId?: CommandId): Promise<CompactionResult | null>;
    protected summarize(input: SummaryInput, agent: Agent, signal?: AbortSignal): Promise<import("../../../../deepseek-harness/packages/compaction/compaction-basic/lib/types/summarizer").SummaryResult>;
    private circuitRoute;
    private attemptSummary;
    private recordFailure;
    private summaryDecision;
    /** Whether `route` can hold this call's own input, instruction and cap inside its window; equality refuses. */
    canHoldSummary(agent: Agent, input: {
        readonly messages: readonly Message[];
    }, route: MemberSummaryRoute, signal?: AbortSignal): Promise<boolean>;
    /** A configured summary target outranks the step's route. */
    private explicitSummaryTarget;
    /** The cap this route resolves to: its own override, else the shared default. */
    private summaryCap;
    private policyFor;
    /** The agent the shipped summarizer reads: one route supplied, the rest forwarded, real session methods bound. */
    private routedView;
}
export {};
//# sourceMappingURL=member-compaction-engine.d.ts.map