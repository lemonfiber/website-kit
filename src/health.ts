/**
 * The org's community health files, against the pages this site renders.
 *
 * `lemonfiber/.github` holds the files GitHub serves on behalf of every
 * repository in the org that defines none of its own, and this site's
 * contributing section is where a reader meets them. Each arrives as a mirror:
 * a symlink into `vendor/org`, declared in `mirrors.json`.
 *
 * A mirror pointing at a file that is not there is caught by the mirror rule. A
 * file that is there and no mirror points at is not: the org gains a governance
 * document, the contributing section carries on without it, and nothing here
 * has an opinion. This asks the other direction as well.
 *
 * Which names count is GitHub's rule rather than this site's judgment, and it
 * is the question rather than the answer: what the org publishes is whichever
 * of them the tree actually holds, read on every run.
 *
 * Pure functions over text. Reading the tree is `site.ts`.
 */

import type { Declared, Violation } from "./guards.ts";

/** The org repository, whose whole tree decides what is published. */
export const HEALTH = "vendor/org";

/** The repository a mirror from the org names. */
const ORG = "org";

/**
 * The prose files GitHub serves org-wide from a `.github` repository.
 *
 * The set is GitHub's and is closed. A file outside it — an issue template, a
 * funding declaration, the org profile — is not a page a reader is sent to.
 */
const PUBLISHED = [
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "SECURITY.md",
  "SUPPORT.md",
];

/** The three places GitHub reads them from, innermost first. */
const WHERE = ["", ".github/", "docs/"];

const at = (where: string, message: string): Violation => ({
  where,
  line: null,
  message,
});

const listed = (paths: Iterable<string>): string =>
  [...new Set(paths)].sort((a, b) => a.localeCompare(b)).join(", ");

/**
 * Every community health file the org publishes, by its path in that tree.
 *
 * `paths` is every path under `vendor/org`, repository-relative.
 */
export function healthFiles(paths: readonly string[]): string[] {
  const held = new Set(
    paths
      .filter((path) => path.startsWith(`${HEALTH}/`))
      .map((path) => path.slice(HEALTH.length + 1)),
  );

  return PUBLISHED.flatMap((name) => {
    const found = WHERE.map((dir) => `${dir}${name}`).find((path) =>
      held.has(path),
    );
    return found === undefined ? [] : [found];
  });
}

/** The path inside the org each mirror of it renders. */
export function mirroredFromOrg(declared: readonly Declared[]): string[] {
  return declared
    .filter((mirror) => mirror.repo === ORG)
    .map((mirror) => mirror.path);
}

/**
 * What the org publishes and what this site renders, against each other.
 *
 * An org tree holding no health file at all is a violation rather than a clean
 * run: two empty sets agree about everything, so a submodule that failed to
 * check out would report the contributing section as complete.
 */
export function healthViolations(
  paths: readonly string[],
  declared: readonly Declared[],
): Violation[] {
  const published = healthFiles(paths);
  if (published.length === 0)
    return [
      at(
        HEALTH,
        "no community health file here — the org repository is missing or unreadable",
      ),
    ];

  const mirrored = mirroredFromOrg(declared);
  if (mirrored.length === 0)
    return [
      at(
        "mirrors.json",
        "no mirror renders anything from the org — a rename left this watching nothing",
      ),
    ];

  const rendered = new Set(mirrored);
  const found: Violation[] = [];

  const unrendered = published.filter((path) => !rendered.has(path));
  if (unrendered.length > 0)
    found.push(
      at(
        "mirrors.json",
        `the org publishes these and no page here renders them: ${listed(unrendered)}`,
      ),
    );

  const held = new Set(published);
  const invented = mirrored.filter((path) => !held.has(path));
  if (invented.length > 0)
    found.push(
      at(
        "mirrors.json",
        `this site renders these from the org and it publishes no such file: ${listed(invented)}`,
      ),
    );

  return found;
}
