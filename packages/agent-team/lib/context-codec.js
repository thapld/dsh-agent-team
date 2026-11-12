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
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { AGENT_TEAM_PLUGIN_ID, CHECKPOINT_SECTION_NAME } from "./context-source.js";
export const CHECKPOINT_CONTINUATION_TEXT = 'A context checkpoint was recorded at the end of the previous turn. Continue the work you were doing.';
export function createCheckpointContinuationMessage(checkpointRef) {
    return createUserMessage({
        content: [{ type: 'text', text: CHECKPOINT_CONTINUATION_TEXT }],
        source: {
            kind: AGENT_TEAM_PLUGIN_ID,
            form: 'snapshot',
            sections: [{ name: CHECKPOINT_SECTION_NAME, text: checkpointRef }],
        },
    });
}
