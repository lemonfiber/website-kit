/**
 * Reading a site's tree for the guards, and writing back what they correct.
 *
 * The rules in `guards.ts` are pure functions over what this hands them: the
 * files a directory holds, the symlinks standing where a mirror is declared,
 * and where each of those resolves.
 */
import { readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import type { Fix, MirrorState, Violation } from "./guards.ts";

/** What a walk found: the plain files, and the symlinks it did not follow. */
export interface Walked {
  readonly files: string[];
  readonly links: string[];
}

/**
 * Every file and symlink under a directory, in the order the directories list.
 *
 * A directory that cannot be read yields nothing: several trees a site points
 * this at are optional. The caller refuses a tree that is not optional and came
 * back empty, because a rule over nothing passes.
 */
export async function walk(dir: string): Promise<Walked> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return { files: [], links: [] };
  }
  const files: string[] = [];
  const links: string[] = [];
  const below: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) links.push(path);
    else if (entry.isDirectory()) below.push(path);
    else files.push(path);
  }
  for (const found of await Promise.all(below.map(walk))) {
    files.push(...found.files);
    links.push(...found.links);
  }
  return { files, links };
}

/** A path relative to the root, with forward slashes whatever the platform. */
export const relativeTo = (root: string, path: string): string =>
  relative(root, path).split(sep).join("/");

/**
 * What stands at each symlink under the content directory, as a mirror route.
 *
 * A symlink that resolves nowhere is reported as resolving to nothing rather
 * than dropped, so the mirror rule names it. Where it resolves is said against
 * the root's own real path, which a temporary or linked checkout differs from.
 */
export async function mirrorStates(
  root: string,
  content: string,
  links: readonly string[],
): Promise<MirrorState[]> {
  const real = await realpath(root);
  const base = join(root, content);
  return Promise.all(
    links
      .filter((link) => link.startsWith(base + sep))
      .map(async (link) => ({
        route: relativeTo(base, link),
        isSymlink: true,
        exists: true,
        resolvesTo: await realpath(link).then(
          (target) => relativeTo(real, target),
          () => null,
        ),
      })),
  );
}

/** One file's text, or nothing where it is not there to read. */
export async function textOf(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

/**
 * Write the corrections that have exactly one right answer, and say how many.
 *
 * Applied last-first within each file so an earlier edit does not move a later
 * one's span. A page may state the same count twice, and one pass corrects each
 * occurrence the rule matched on that read, so the caller reads again after.
 */
export async function repair(
  root: string,
  violations: readonly Violation[],
): Promise<number> {
  const byFile = new Map<string, Fix[]>();
  for (const violation of violations)
    if (violation.fix)
      byFile.set(violation.fix.path, [
        ...(byFile.get(violation.fix.path) ?? []),
        violation.fix,
      ]);

  const written = await Promise.all(
    [...byFile].map(async ([path, fixes]) => {
      const file = join(root, path);
      let text = await readFile(file, "utf8");
      for (const fix of [...fixes].sort((a, b) => b.start - a.start))
        text = text.slice(0, fix.start) + fix.replacement + text.slice(fix.end);
      await writeFile(file, text, "utf8");
      return fixes.length;
    }),
  );
  return written.reduce((sum, one) => sum + one, 0);
}
