# Installable fork

This fork exists so the plugin can be installed directly from GitHub without a
sibling DeepSeek Harness source checkout.

## What changed

- `packages/agent-team/lib`, `packages/tool-agent-team/lib`, and
  `packages/client-agent-team/lib` are committed. They are the prebuilt
  artifacts from the published `@contexera/dsh-agent-team@0.2.8` package.
- `prepack` now runs `scripts/prepack.mjs`, which exits successfully when those
  artifacts are present. Upstream's `prepack` ran `npm run build`, and a GitHub
  install runs it from a pnpm temporary directory where `../deepseek-harness`
  does not exist, so the install failed.

## Install

```sh
dsh plugin --profile desktop add github:thapld/dsh-agent-team
```

The package name stays `@contexera/dsh-agent-team`; only the source location
changed. Keep the DSH line at `0.2.2-rc.2` (`engines.dsh` in `package.json`).

## Rebuild

Building from source still needs the sibling checkout:

```text
parent/
  deepseek-harness/   # DSH source checkout
  dsh-agent-team/     # this repository
```

Then run `npm run build`. `prepack` will keep using the committed artifacts.

## Upstream

Upstream: https://github.com/Contexera/dsh-agent-team (MIT). This fork only
changes packaging so GitHub installs work; the plugin code is upstream's.
