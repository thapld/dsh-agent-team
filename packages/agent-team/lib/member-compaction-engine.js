import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic';
import { estimateToolsTokens } from '@deepseek-ai/dsh-token-meter/estimate';
import { MEMBER_SUMMARY_INSTRUCTION_TOKENS } from "./member-compaction.js";
const sameRoute = (left, right) => left.provider === right.provider && left.model === right.model;
export default class MemberCompactionEngine extends BasicCompactionEngine {
    stepRoute;
    alternativeSpent = false;
    manualAgents = new WeakSet();
    summaryFailures = new WeakSet();
    degradedRoutes = new WeakMap();
    compactIfNeeded(agent, trigger, signal) {
        if (trigger === 'pressure' && this.ctx.get('agentTeam')?.config.memberCompaction.get().enabled === true) {
            return Promise.resolve(null);
        }
        return super.compactIfNeeded(agent, trigger, signal);
    }
    /** Bind the step's fixed route, or clear it at that step's end. */
    useStepRoute(agent, route) {
        this.stepRoute = route;
        if (route === undefined)
            return;
        this.alternativeSpent = false;
        // A pause names the route that failed; another route makes it stale, so the Agent's return can try again.
        const failed = this.degradedRoutes.get(agent);
        if (failed !== undefined && !sameRoute(failed, route))
            this.degradedRoutes.delete(agent);
    }
    /** Whether a bounded failure opened the circuit for this route. */
    degraded(agent, route) {
        const recorded = this.degradedRoutes.get(agent);
        return recorded !== undefined && sameRoute(recorded, route);
    }
    /** Whether the last automatic attempt failed for a reason other than cancellation. */
    takeSummaryFailure(agent) {
        const failed = this.summaryFailures.has(agent);
        if (failed)
            this.summaryFailures.delete(agent);
        return failed;
    }
    async compactNow(agent, signal, sourceCommandId) {
        // An explicit request from the Human is how the circuit is cleared, so it
        // always gets its attempt.
        this.manualAgents.add(agent);
        try {
            const result = await super.compactNow(agent, signal, sourceCommandId);
            if (result !== null)
                this.degradedRoutes.delete(agent);
            return result;
        }
        finally {
            this.manualAgents.delete(agent);
        }
    }
    async summarize(input, agent, signal) {
        const decision = await this.summaryDecision(agent, input, signal);
        const route = this.circuitRoute(agent);
        // A route that already cost its summaries is not called again; /compact is the way out.
        if (!this.manualAgents.has(agent) && route !== undefined && this.degraded(agent, route)) {
            throw new Error(`agent-team: summarization is paused for ${route.provider}/${route.model} after a bounded failure`);
        }
        try {
            return await this.attemptSummary(input, agent, decision, signal);
        }
        catch (error) {
            // Cancellation opens nothing.
            if (signal?.aborted === true)
                throw error;
            if (decision.kind !== 'route' || this.alternativeSpent) {
                this.recordFailure(agent, route);
                throw error;
            }
            // One further route, once per step: no rotation, no second alternative.
            this.alternativeSpent = true;
            if (route !== undefined)
                this.degradedRoutes.delete(agent);
            try {
                return await super.summarize(input, agent, signal);
            }
            catch (alternativeError) {
                if (signal?.aborted)
                    throw alternativeError;
                this.recordFailure(agent, route);
                throw alternativeError;
            }
        }
    }
    circuitRoute(agent) {
        const step = this.stepRoute;
        if (step !== undefined)
            return { provider: step.provider, model: step.model };
        return agent.session.requestHeader()?.config;
    }
    attemptSummary(input, agent, decision, signal) {
        return decision.kind === 'route'
            ? super.summarize(input, this.routedView(agent, decision.route), signal)
            : super.summarize(input, agent, signal);
    }
    recordFailure(agent, route) {
        if (route === undefined)
            return;
        this.summaryFailures.add(agent);
        this.degradedRoutes.set(agent, { provider: route.provider, model: route.model });
    }
    async summaryDecision(agent, input, signal) {
        const committed = agent.session.requestHeader()?.config;
        const step = this.stepRoute;
        if (committed === undefined || step === undefined)
            return { kind: 'committed' };
        const stepRoute = { provider: step.provider, model: step.model };
        // The shipped resolution for the committed route already reaches a global
        // target and one configured for that route, so only a target configured for
        // the step's own route needs the routed view.
        if (this.config.summarizationProvider !== '' || this.explicitSummaryTarget(committed))
            return { kind: 'committed' };
        if (stepRoute.provider === committed.provider && stepRoute.model === committed.model)
            return { kind: 'committed' };
        // A target on the step's policy outranks that route's window: the route is only
        // its key, and the shipped switch path reaches this branch first.
        if (this.explicitSummaryTarget(stepRoute))
            return { kind: 'route', route: stepRoute };
        if (!await this.canHoldSummary(agent, input, stepRoute, signal))
            return { kind: 'committed' };
        return { kind: 'route', route: stepRoute };
    }
    /** Whether `route` can hold this call's own input, instruction and cap inside its window; equality refuses. */
    async canHoldSummary(agent, input, route, signal) {
        const llm = this.ctx.get('llm');
        const meter = this.ctx.get('tokenMeter');
        if (llm === undefined || meter === undefined)
            return false;
        let window;
        try {
            window = (await llm.resolveModelInfo(route.provider, route.model, signal)).context?.contextWindow;
        }
        catch {
            return false;
        }
        if (window === undefined)
            return false;
        const transcript = input.messages.reduce((sum, message) => sum + meter.estimateMessage(message), 0);
        return transcript + MEMBER_SUMMARY_INSTRUCTION_TOKENS + estimateToolsTokens(agent.session.requestHeader())
            + this.summaryCap(route) < window;
    }
    /** A configured summary target outranks the step's route. */
    explicitSummaryTarget(route) {
        return (this.policyFor(route)?.summarizationProvider ?? this.config.summarizationProvider) !== '';
    }
    /** The cap this route resolves to: its own override, else the shared default. */
    summaryCap(route) {
        return this.policyFor(route)?.maxTokens ?? this.config.maxTokens;
    }
    policyFor(route) {
        return this.config.modelPolicies.find(policy => policy.provider === route.provider && policy.model === route.model);
    }
    /** The agent the shipped summarizer reads: one route supplied, the rest forwarded, real session methods bound. */
    routedView(agent, route) {
        const session = agent.session;
        const header = session.requestHeader();
        const view = Object.create(agent);
        Object.defineProperty(view, 'session', {
            value: {
                id: session.id,
                requestHeader: () => (header === undefined ? undefined : { ...header, config: { ...header.config, ...route } }),
                toolHistory: () => session.toolHistory(),
            },
        });
        return view;
    }
}
