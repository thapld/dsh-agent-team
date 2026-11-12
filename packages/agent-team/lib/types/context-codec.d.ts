/**
 * The one context envelope this build still writes: the quiet checkpoint
 * continuation a restart re-sends when a checkpoint's delivery was never
 * recorded.
 *
 * Its text and its one-section envelope are read back through
 * `context-source.ts`, and logs written by earlier generations carry the same
 * bytes.
 * @module @contexera/dsh-agent-team/context-codec
 */
import { type UserMessage } from '@deepseek-ai/dsh-llm';
export declare const CHECKPOINT_CONTINUATION_TEXT = "A context checkpoint was recorded at the end of the previous turn. Continue the work you were doing.";
export declare function createCheckpointContinuationMessage(checkpointRef: string): UserMessage;
//# sourceMappingURL=context-codec.d.ts.map