#!/usr/bin/env node
/**
 * Install-time guard for this fork.
 *
 * Upstream builds `packages/<package>/lib` in `prepack`, which requires the sibling
 * `../deepseek-harness` checkout. GitHub installs run `prepack` from a pnpm
 * temporary directory, where that sibling checkout does not exist, so the
 * install fails before any lib exists.
 *
 * This fork commits the built artifacts (see FORK.md), so installing from
 * GitHub only needs them to be present. A source developer who wants to
 * rebuild still runs `npm run build` explicitly with the sibling checkout.
 */
import { existsSync } from 'node:fs'

const artifacts = [
  'packages/agent-team/lib/index.js',
  'packages/tool-agent-team/lib/index.js',
  'packages/client-agent-team/lib/index.js',
]

if (artifacts.every((path) => existsSync(path))) {
  console.log('prepack: committed build artifacts found; skipping source build')
  process.exit(0)
}

console.error(
  'prepack: build artifacts are missing.\n'
    + 'This fork commits packages/*/lib so a GitHub install never needs ../deepseek-harness.\n'
    + 'To rebuild: keep this repository beside a DSH source checkout named deepseek-harness, '
    + 'run `npm run build`, then commit the packages/*/lib outputs.',
)
process.exit(1)
