/**
 * A dependency pinned to an exact revision, against the revision it resolved to.
 *
 * `package.json` names a revision and `package-lock.json` records the one an
 * install took. For a git dependency `npm ci` re-resolves the declaration
 * rather than refusing the disagreement, so the two can name different commits
 * and the install still succeeds; what the build then holds is neither the
 * declared revision nor the reviewed one.
 *
 * Pure functions over text. Reading the tree is `site.ts`.
 */

import type { Violation } from "./guards.ts";
import { captured } from "./mirror.ts";

const PACKAGE = "package.json";
const LOCK = "package-lock.json";
const PREFIX = "node_modules/";
const FIELDS = ["dependencies", "devDependencies"];

/** The revision a dependency spec or a resolved URL ends with. */
const REVISION = /#([0-9a-f]{7,40})$/;

const at = (where: string, message: string): Violation => ({
  where,
  line: null,
  message,
});

const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const read = (json: string): Record<string, unknown> => {
  try {
    return asObject(JSON.parse(json));
  } catch {
    return {};
  }
};

/** The revision named at the end of a spec, where it names one. */
export function revisionIn(spec: string): string | null {
  const found = REVISION.exec(spec);
  return found === null ? null : captured(found, 1);
}

/** Two revisions agree when one is the other, abbreviated or in full. */
export const sameRevision = (one: string, other: string): boolean =>
  one.startsWith(other) || other.startsWith(one);

/** Every dependency `package.json` pins to an exact revision. */
export function pinnedDependencies(manifest: string): Map<string, string> {
  const found = new Map<string, string>();
  const root = read(manifest);

  for (const field of FIELDS)
    for (const [name, spec] of Object.entries(asObject(root[field]))) {
      const revision = revisionIn(String(spec));
      if (revision !== null) found.set(name, revision);
    }

  return found;
}

/** The revision `package-lock.json` records for each dependency it resolved. */
export function resolvedRevisions(lock: string): Map<string, string> {
  const found = new Map<string, string>();

  for (const [path, entry] of Object.entries(
    asObject(read(lock)["packages"]),
  )) {
    if (!path.startsWith(PREFIX)) continue;
    const revision = revisionIn(String(asObject(entry)["resolved"]));
    if (revision !== null) found.set(path.slice(PREFIX.length), revision);
  }

  return found;
}

/**
 * What the declaration and the lockfile disagree about.
 *
 * A manifest that pins nothing is a violation rather than a clean run: a
 * renamed field would leave this comparing two empty sets, which agree about
 * everything.
 */
export function lockViolations(manifest: string, lock: string): Violation[] {
  const declared = pinnedDependencies(manifest);
  if (declared.size === 0)
    return [
      at(
        PACKAGE,
        "no dependency names an exact revision — a rename left this watching nothing",
      ),
    ];

  const resolved = resolvedRevisions(lock);
  const found: Violation[] = [];

  for (const [name, revision] of declared) {
    const took = resolved.get(name);
    if (took === undefined)
      found.push(
        at(LOCK, `${name} is declared at ${revision} and nothing resolves it`),
      );
    else if (!sameRevision(revision, took))
      found.push(
        at(
          LOCK,
          `${name} is declared at ${revision} and the lockfile resolved ${took}`,
        ),
      );
  }

  return found;
}
