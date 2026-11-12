/**
 * Guidance for foreign Agent-scope registrations that the current Harness
 * restriction API cannot remove from the model schema.
 * @module @contexera/dsh-agent-team/tool-availability-guidance
 */
/** Section name; the Host evaluates its names again at every prompt assembly. */
export declare const TOOL_AVAILABILITY_SECTION = "team:tool-availability";
/** Warn about exactly the visible names the Member execution guard still denies. */
export declare function toolAvailabilityGuidance(toolNames: readonly string[]): string;
//# sourceMappingURL=tool-availability-guidance.d.ts.map