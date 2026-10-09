/**
 * The stylesheet against the brand tokens it is drawn with.
 *
 * `src/app.css` defines no colour, radius or step of its own: it renames
 * brand's tokens into what this site calls them, so a value has one home and a
 * gap stays visible. A name it reads that brand does not declare resolves to
 * nothing, and CSS answers that by falling back to the inherited value rather
 * than by failing — the page renders, in the wrong colours, and no build says
 * so.
 *
 * Brand arrives here twice: as the submodule whose `.docs` are rendered at
 * `/develop/brand/`, and as the npm dependency the stylesheet imports. The
 * lockfile guard compares this repository's declaration with what it resolved;
 * it cannot see the submodule, so two pins at different revisions read clean.
 * The two copies are compared here, which is also what makes holding the
 * stylesheet to the vendored copy mean anything.
 *
 * Pure functions over text. Reading the tree is `site.ts`.
 */

import type { Violation } from "./guards.ts";
import { captured } from "./mirror.ts";

/** The tokens the pinned submodule declares. */
export const TOKENS = "vendor/brand/tokens/tokens.css";

/** The tokens the installed package declares, which are the ones that render. */
export const INSTALLED = "node_modules/@lemonfiber/brand/tokens/tokens.css";

/** The stylesheet held to them. */
export const STYLESHEET = "src/app.css";

/** The shared theme a Starlight site's stylesheet imports, held to them too. */
export const THEME =
  "node_modules/@lemonfiber/website-kit/styles/starlight.css";

/** What every brand custom property's name starts with. */
const PREFIX = "--lf-";

/** A character a custom property's name is spelled with. */
const NAME_CHARACTER = /^[a-z0-9-]$/;

/** A character that may stand between a name and its colon. */
const SPACE = /^\s$/;

/** One brand custom property being read, and whether a fallback follows it. */
const READ = /var\(\s*(--lf-[a-z0-9-]+)\s*([,)])/g;

/** A selector that declares a token for every theme. */
const ROOT = ":root";

/** What a stylesheet declares about the brand's tokens. */
export interface Declared {
  /** Each token's value, under the selector declaring it. */
  readonly values: ReadonlyMap<string, string>;
  /** The names declared at `:root`, which resolve whatever the theme. */
  readonly always: ReadonlySet<string>;
  /** Every name declared, wherever it was declared. */
  readonly names: ReadonlySet<string>;
}

/** One place a stylesheet reads a brand token. */
export interface Read {
  readonly name: string;
  /** Whether the read supplies a value for brand not declaring the name. */
  readonly fallback: boolean;
  readonly line: number;
}

const at = (
  where: string,
  line: number | null,
  message: string,
): Violation => ({ where, line, message });

const listed = (names: Iterable<string>): string =>
  [...new Set(names)].sort((a, b) => a.localeCompare(b)).join(", ");

const lineAt = (text: string, index: number): number =>
  text.slice(0, index).split("\n").length;

/**
 * The brand token named right before `colon`, or null when none is: the run of
 * name characters ending there, from the first `--lf-` in it on.
 */
function nameBefore(statement: string, colon: number): string | null {
  let end = colon;
  while (end > 0 && SPACE.test(statement.charAt(end - 1))) end--;
  let start = end;
  while (start > 0 && NAME_CHARACTER.test(statement.charAt(start - 1))) start--;
  const run = statement.slice(start, end);
  const prefix = run.indexOf(PREFIX);
  return prefix === -1 || prefix + PREFIX.length === run.length
    ? null
    : run.slice(prefix);
}

/**
 * Each brand token one rule's body declares, with its value: in every
 * statement, the first colon a name stands before, and what follows it.
 *
 * Scanned rather than matched. A pattern for `--lf-name: value` restarts at
 * every `--lf-` in a run of name characters no colon follows, which costs the
 * square of the run's length. Here each colon is visited once, and the name
 * read back from it covers characters no other colon reads.
 */
function declarations(body: string): (readonly [string, string])[] {
  const found: (readonly [string, string])[] = [];
  for (const statement of body.split(";")) {
    let colon = statement.indexOf(":");
    while (colon !== -1) {
      const name = nameBefore(statement, colon);
      const value = statement.slice(colon + 1);
      if (name !== null && value !== "") {
        found.push([name, value.trim()]);
        break;
      }
      colon = statement.indexOf(":", colon + 1);
    }
  }
  return found;
}

/** Every brand token a stylesheet declares, and where. */
export function declaredIn(css: string): Declared {
  const values = new Map<string, string>();
  const always = new Set<string>();
  const names = new Set<string>();

  // Split rather than matched: a rule is whatever stands before the next `}`,
  // and a pattern for it spends the run of characters in front of every `{`
  // twice over.
  for (const block of css.split("}")) {
    const opened = block.indexOf("{");
    if (opened === -1) continue;
    const selector = block.slice(0, opened).trim();
    for (const [name, value] of declarations(block.slice(opened + 1))) {
      values.set(`${name} in ${selector}`, value);
      names.add(name);
      if (selector.includes(ROOT)) always.add(name);
    }
  }

  return { values, always, names };
}

/** Every place a stylesheet reads a brand token. */
export function readsIn(css: string): Read[] {
  const found: Read[] = [];
  for (const one of css.matchAll(READ))
    found.push({
      name: captured(one, 1),
      fallback: captured(one, 2) === ",",
      line: lineAt(css, one.index),
    });
  return found;
}

/** What the two copies of brand this repository holds disagree about. */
function copyViolations(vendored: Declared, installed: Declared): Violation[] {
  const differs: string[] = [];

  for (const [where, value] of vendored.values)
    if (installed.values.get(where) !== value) differs.push(where);
  for (const where of installed.values.keys())
    if (!vendored.values.has(where)) differs.push(where);

  return differs.length === 0
    ? []
    : [
        at(
          INSTALLED,
          null,
          `the submodule and the installed package are not one revision of brand — they disagree about ${listed(differs)}`,
        ),
      ];
}

/** One stylesheet held to the tokens, by where it is read from. */
interface Sheet {
  readonly path: string;
  readonly css: string;
}

/** What one read of a brand token gets wrong, if anything. */
function readViolation(
  brand: Declared,
  path: string,
  read: Read,
): Violation | null {
  if (!brand.names.has(read.name))
    return at(
      path,
      read.line,
      `reads ${read.name}, and ${TOKENS} declares no such token`,
    );
  if (!brand.always.has(read.name) && !read.fallback)
    return at(
      path,
      read.line,
      `reads ${read.name} with no fallback, and ${TOKENS} declares it only in a theme`,
    );
  if (brand.always.has(read.name) && read.fallback)
    return at(
      path,
      read.line,
      `gives ${read.name} a fallback, and ${TOKENS} declares it for every theme`,
    );
  return null;
}

/** What the stylesheets read that the tokens do not answer. */
function readViolations(
  brand: Declared,
  sheets: readonly Sheet[],
): Violation[] {
  const reads = sheets.flatMap((sheet) =>
    readsIn(sheet.css).map((read) => ({ path: sheet.path, read })),
  );
  if (reads.length === 0)
    return [
      at(
        STYLESHEET,
        null,
        `no brand token is read here — a rename left this watching nothing`,
      ),
    ];
  return reads.flatMap(({ path, read }) => {
    const wrong = readViolation(brand, path, read);
    return wrong === null ? [] : [wrong];
  });
}

/**
 * The stylesheet, the shared theme it imports, and the two copies of brand,
 * against each other.
 *
 * An empty set of tokens is a violation rather than a clean run: nothing to
 * compare agrees with everything, and a stylesheet held to no tokens at all is
 * the unchecked stylesheet this replaces.
 */
export function tokenViolations(
  vendored: string,
  installed: string,
  css: string,
  theme = "",
): Violation[] {
  const pinned = declaredIn(vendored);
  if (pinned.names.size === 0)
    return [
      at(
        TOKENS,
        null,
        "no brand token here — the tokens are missing or unreadable",
      ),
    ];

  const shipped = declaredIn(installed);
  if (shipped.names.size === 0)
    return [
      at(
        INSTALLED,
        null,
        "no brand token here — the package the stylesheet imports is not installed",
      ),
    ];

  return [
    ...copyViolations(pinned, shipped),
    ...readViolations(pinned, [
      { path: STYLESHEET, css },
      { path: THEME, css: theme },
    ]),
  ];
}
