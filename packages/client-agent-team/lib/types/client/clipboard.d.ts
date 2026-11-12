/**
 * Copy text on the browser's terms, then on the document's.
 *
 * The shipped helper falls back to `execCommand('copy')` only when a host omits the async API; a host that carries the
 * API but refuses the write (a clipboard policy, an unfocused document, a remote browser) leaves the reader with
 * nothing and no word about it. That refusal is the one refusal this page can still answer itself, so the legacy path
 * gets one turn before the card reports failure.
 * @param text - The exact text to place on the clipboard.
 * @returns Whether any path placed it there.
 */
export declare function copyText(text: string): Promise<boolean>;
//# sourceMappingURL=clipboard.d.ts.map