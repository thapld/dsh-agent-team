/**
 * One home for counting and cutting characters: every Team ceiling counts code points, and anything that
 * shortens a string has to cut on the same boundary it counted on.
 * @module @contexera/dsh-agent-team/text
 */
/** Code-point length, which is what the contract's character ceilings count. */
export declare function characterLength(value: string): number;
/**
 * At most `limit` code points, cut where no astral character straddles the edge: `slice` counts UTF-16 code
 * units, so it can end the result between the halves of one and leave a lone surrogate behind.
 */
export declare function truncateToCharacters(value: string, limit: number): string;
//# sourceMappingURL=text.d.ts.map