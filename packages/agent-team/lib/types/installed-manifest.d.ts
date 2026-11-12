/** The installed bundle's own manifest, read once. */
/** Parsed manifest of the installed bundle, or `undefined` when unreadable; callers degrade to `'unknown'` so Host boot never fails. */
export declare function readInstalledManifest(): Record<string, unknown> | undefined;
/** Version of the manifest this package installed from, or `'unknown'`. */
export declare function bundleVersionOf(manifest: Record<string, unknown> | undefined): string;
//# sourceMappingURL=installed-manifest.d.ts.map