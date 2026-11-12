/**
 * K/M-suffixed token counts for the settings page.
 *
 * A copy of the shipped Models editor's capacity matcher, scale, and
 * round-trip formatter, so this bundle spells a capacity the way the Harness
 * does. It is a copy and not a dependency because the upstream client face
 * does not re-export these two functions.
 *
 * Source: deepseek-ai/deepseek-harness
 * `packages/client/ui-settings-models/src/client/DeepSeekModelsEditor.tsx`.
 * A copy cannot notice an upstream edit, so sync it by diffing against that
 * file whenever a DSH compat round runs, the way the vendored sqlite fork is
 * synced. Only the parseCapacity doc sentence differs.
 */
/**
 * Read a typed capacity, so a user can write `256K` or `1M` instead of counting
 * zeroes. The stored value stays a plain token count.
 * @param text - raw field text.
 * @returns the count; `undefined` when blank (inherit), `NaN` when unreadable.
 */
export declare function parseCapacity(text: string): number | undefined;
/**
 * Spell a stored count back in the shortest form that survives a round trip
 * through {@link parseCapacity}; a count that is not a whole number of
 * thousands stays written out.
 * @param value - stored capacity.
 * @returns the field text.
 */
export declare function formatCapacity(value: number): string;
//# sourceMappingURL=capacity.d.ts.map