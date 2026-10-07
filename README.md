# website-kit

What every lemonfiber site runs, written once: mirroring other repositories'
pages with their provenance, rewriting the links inside them, the guards on a
site's own code and chrome, the check of every address a built site sends a
reader to, the pin checks and the pull request that moves the pins, the brand
check and the accessibility sweep.

The [documentation site](https://github.com/lemonfiber/website-docs.lemonfiber.app)
and the [contributor site](https://github.com/lemonfiber/website-contribute.lemonfiber.app)
take it by commit, the way they take the brand:

```json
"@lemonfiber/website-kit": "github:lemonfiber/website-kit#<commit>"
```

Nothing is published to a registry.

## What it holds

| Import                                        | What it is                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `@lemonfiber/website-kit/mirror`              | Routes, titles, link rewriting and provenance for a mirrored page             |
| `@lemonfiber/website-kit/mirror-loader`       | The Astro content loader that puts mirrored pages into a Starlight collection |
| `@lemonfiber/website-kit/guards`              | The rules on a site's own code and chrome, and on its mirror routes           |
| `@lemonfiber/website-kit/site`                | A site read the way the guards read it, and every rule the kit holds it to    |
| `@lemonfiber/website-kit/health`              | The org's community health files against the pages a site renders             |
| `@lemonfiber/website-kit/tokens`, `/lockfile` | The installed brand package against the brand submodule and the lockfile      |
| `@lemonfiber/website-kit/links`               | The addresses a built site sends a reader to, into the repositories it pins   |
| `@lemonfiber/website-kit/pins`, `/bump`       | How far each pin is behind, and the pull request that takes them              |
| `@lemonfiber/website-kit/run/*`               | The runners a site's scripts call: `guards`, `links`, `pins`, `bump`, `a11y`  |

A site's `scripts/guards.ts` is then a few lines:

```ts
import { runGuards } from "@lemonfiber/website-kit/run/guards";

await runGuards({ root: new URL("..", import.meta.url).pathname });
```

and passes `checks` where it keeps rules of its own.

## Working here

```sh
npm ci
npm run ci     # format, lint, types, tests at 100% coverage, and dist/ as built
npm run build  # rewrite dist/, which is committed
```

Every change cites a requirement in the
[specification](https://github.com/lemonfiber/spec); start with the
[contributing guide](https://github.com/lemonfiber/spec/blob/main/50-governance/contributing.md).

## Licence

[Hippocratic License 3.0](LICENSE): source-available and ethical-source, not
OSI-approved. Made by NightWorksIO.
