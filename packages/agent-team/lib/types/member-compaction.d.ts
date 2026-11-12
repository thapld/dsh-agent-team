import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type LlmCallConfig, type Message, type ToolSchema } from '@deepseek-ai/dsh-llm';
import type { CompactionEngine } from '@deepseek-ai/dsh-compaction';
import { type PromptPresentation } from '@deepseek-ai/dsh-system-prompt';
export interface MemberCompactionConfig {
    readonly enabled: boolean;
    readonly tokens: number;
}
export declare const MEMBER_COMPACT_TOKENS = 256000;
export declare const MEMBER_SUMMARY_TOKENS = 32768;
/** Conservative price of the instruction the shipped summarizer appends after the replayed region. */
export declare const MEMBER_SUMMARY_INSTRUCTION_TOKENS = 2048;
export declare const DEFAULT_MEMBER_COMPACTION: MemberCompactionConfig;
export declare function memberCompactionThreshold(tokens: number, contextWindow: number | undefined): number | undefined;
export declare function memberOutputTokens(inputTokens: number, contextWindow: number, requestedTokens: number | undefined): number;
export declare function measureMemberInput(ctx: Context, agent: Agent, config: LlmCallConfig, pending: readonly Message[], assembly?: PromptPresentation, stepTools?: readonly ToolSchema[]): number;
export declare function installMemberCompaction(ctx: Context, agent: Agent, config: () => MemberCompactionConfig, engineFor: () => CompactionEngine | undefined, retiring: () => boolean): void;
//# sourceMappingURL=member-compaction.d.ts.map