/** The installed bundle's own manifest, read once. */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/** Root of the installed bundle: three levels above `packages/agent-team/{src,lib}` in both `link:` and registry installs. */
function installedPackageRoot() {
    return resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
}
/** Parsed manifest of the installed bundle, or `undefined` when unreadable; callers degrade to `'unknown'` so Host boot never fails. */
export function readInstalledManifest() {
    try {
        const parsed = JSON.parse(readFileSync(resolve(installedPackageRoot(), 'package.json'), 'utf8'));
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? parsed
            : undefined;
    }
    catch {
        return undefined;
    }
}
/** Version of the manifest this package installed from, or `'unknown'`. */
export function bundleVersionOf(manifest) {
    const version = manifest?.version;
    return typeof version === 'string' && version !== '' ? version : 'unknown';
}
