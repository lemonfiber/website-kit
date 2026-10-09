# website-kit

What every lemonfiber site runs, written once: mirroring other repositories'
pages with their provenance, rewriting the links inside them, the guards on a
site's own code and chrome, the check of every address a built site sends a
reader to, the pin checks and the pull request that moves the pins, the brand
check, the accessibility sweep and the layout probe, and the look a site is
drawn in: the Starlight theme on brand's tokens, brand's faces, and tables that
scroll inside a region the keyboard can reach.

The [documentation site](https://github.com/lemonfiber/website-docs.lemonfiber.app)
and the [contributor site](https://github.com/lemonfiber/website-contribute.lemonfiber.app)
take it by commit, the way they take the brand:

```json
"@lemonfiber/website-kit": "github:lemonfiber/website-kit#<commit>"
```

Nothing is published to a registry.

## What it holds

| Import                                         | What it is                                                                                                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lemonfiber/website-kit/mirror`               | Routes, titles, link rewriting and provenance for a mirrored page                                                                                                                      |
| `@lemonfiber/website-kit/mirror-loader`        | The Astro content loader that puts mirrored pages into a Starlight collection, and the schema a collection keeps their provenance with                                                 |
| `@lemonfiber/website-kit/provenance`           | Every route a site renders against the repository, path and revision it came from                                                                                                      |
| `@lemonfiber/website-kit/llms`                 | A site's `llms.txt` and `llms-full.txt`, from its pages' frontmatter                                                                                                                   |
| `@lemonfiber/website-kit/guards`               | The rules on a site's own code and chrome, and on its mirror routes                                                                                                                    |
| `@lemonfiber/website-kit/site`                 | A site read the way the guards read it, and every rule the kit holds it to                                                                                                             |
| `@lemonfiber/website-kit/health`               | The org's community health files against the pages a site renders                                                                                                                      |
| `@lemonfiber/website-kit/tokens`, `/lockfile`  | The installed brand package against the brand submodule and the lockfile                                                                                                               |
| `@lemonfiber/website-kit/links`                | The addresses a built site sends a reader to, into the repositories it pins                                                                                                            |
| `@lemonfiber/website-kit/pins`, `/bump`        | How far each pin is behind, and the pull request that takes them                                                                                                                       |
| `@lemonfiber/website-kit/run/*`                | The runners a site's scripts call: `guards`, `links`, `pins`, `bump`, `a11y`                                                                                                           |
| `@lemonfiber/website-kit/layout`               | `probeLayout`, run in the page by a site's Playwright suite, and `layoutViolations`: a page wider than the screen, and a box that scrolls sideways with nothing the keyboard can reach |
| `@lemonfiber/website-kit/tables`               | `scrollableTables`, the Markdown plugin that wraps every Markdown table in a labelled region that takes focus and scrolls                                                              |
| `@lemonfiber/website-kit/csp`                  | `sitePolicy`, the Astro integration that writes each built page's Content-Security-Policy, hashing every inline script and style the page holds, and the build's `_headers` file       |
| `@lemonfiber/website-kit/headers`              | The response headers the host sends with every page, the `_headers` file that carries them, and `headersViolations` for a site's test of its build                                     |
| `@lemonfiber/website-kit/brand`                | Brand's logo mark, as Starlight's `logo` option takes it                                                                                                                               |
| `@lemonfiber/website-kit/styles/starlight.css` | The Starlight theme on brand's tokens: type, focus, tables, inline code, navigation, the splash hero and motion                                                                        |
| `@lemonfiber/website-kit/styles/fonts.css`     | Golos Text, Bricolage Grotesque and DM Mono, served by the site itself                                                                                                                 |

A site's `scripts/guards.ts` is then a few lines:

```ts
import { runGuards } from "@lemonfiber/website-kit/run/guards";

await runGuards({ root: new URL("..", import.meta.url).pathname });
```

and passes `checks` where it keeps rules of its own.

`run/a11y` serves the built site on a free port and runs the site's Playwright
suite against it, so the site's `playwright.config.ts` takes its `baseURL` from
the variable `ORIGIN_VARIABLE` names:

```ts
import { ORIGIN_VARIABLE } from "@lemonfiber/website-kit/run/a11y";

const origin = process.env[ORIGIN_VARIABLE];
```

A Starlight site takes the look in its `astro.config.ts` and its stylesheet:

```ts
import { satteri } from "@astrojs/markdown-satteri";
import { BRAND_LOGO } from "@lemonfiber/website-kit/brand";
import { sitePolicy } from "@lemonfiber/website-kit/csp";
import { scrollableTables } from "@lemonfiber/website-kit/tables";

export default defineConfig({
  markdown: {
    processor: satteri({ hastPlugins: [scrollableTables({ label: "Table" })] }),
  },
  integrations: [
    starlight({ logo: BRAND_LOGO, customCss: ["./src/app.css"] }),
    sitePolicy(),
  ],
});
```

`sitePolicy` also writes `_headers` at the root of a build served at `/`: HSTS,
`nosniff`, the referrer and permissions policies, `frame-ancestors 'none'`,
`X-Frame-Options` and `Cross-Origin-Opener-Policy` on every page, which a meta
policy cannot carry, and `noindex` on the host's own `workers.dev` addresses.
The host reads the file and does not serve it.

```css
@import "@lemonfiber/brand/tokens.css";
@import "@lemonfiber/website-kit/styles/fonts.css";
@import "@lemonfiber/website-kit/styles/starlight.css";
```

A component that renders a table of its own wraps it the same way, and a
table of records adds `class="lf-cards"` and a `data-label` on each cell to
read as a column of cards on a narrow screen:
`<div class="lf-table" role="region" tabindex="0" aria-labelledby="…">`.

A site's Playwright suite holds each route to the layout at a phone's width:

```ts
import { layoutViolations, probeLayout } from "@lemonfiber/website-kit/layout";

await page.setViewportSize({ width: 375, height: 800 });
expect(layoutViolations(route, await page.evaluate(probeLayout))).toEqual([]);
```

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
