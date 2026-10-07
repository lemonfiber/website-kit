# AGENTS.md — website-kit

Guidance for any AI agent working in this repo.

> **Common rules for every lemonfiber repo are canonical in the spec:**
> [50-governance/ai-contributors.md](https://github.com/lemonfiber/spec/blob/main/50-governance/ai-contributors.md).
> Read them. This file is the `website-kit`-specific header only.

## What this repo is

What the documentation site and the contributor site both run, written once and
taken by each at an exact commit: `"@lemonfiber/website-kit":
"github:lemonfiber/website-kit#<commit>"`. Spec:
[`30-repos/website-kit.md`](https://github.com/lemonfiber/spec/blob/main/30-repos/website-kit.md).

## The rules you cannot break

- **`dist/` is committed and is what the source builds.** A site installs this
  repository with its install scripts off, so nothing builds it there. Run
  `npm run build` and commit `dist/` with the change; `npm run built` refuses a
  `dist/` that differs.
- **No site's pages, routes or words.** What a site renders and says stays in
  that site; a site passes what is its own (the paths its guards read, the
  command that runs them) into the functions here.
- **`src/` is covered at 100%.** The runners under `run/` hand the rules the
  process, the console and the network, and are typed and linted.
- **No runtime dependencies.** A site's dependency tree is its own.

## Before you push

```sh
npm ci        # also what turns this clone's git hooks on
npm run ci
```
