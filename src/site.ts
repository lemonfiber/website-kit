/**
 * A site, read the way the guards read it, and every rule the kit holds it to.
 *
 * `readTree` hands back the tree a site's own rules read from, and what the
 * kit's rules found in it. Reporting and exiting is `run/guards.ts`.
 */
import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import {
  collisionViolations,
  fileViolations,
  mirrorViolations,
  routeOf,
  type Declared,
  type MirrorState,
  type SourceFile,
  type Violation,
} from "./guards.ts";
import { HEALTH, healthViolations, pinsOrg } from "./health.ts";
import { lockViolations } from "./lockfile.ts";
import {
  INSTALLED,
  STYLESHEET,
  THEME,
  TOKENS,
  tokenViolations,
} from "./tokens.ts";
import { mirrorStates, relativeTo, textOf, walk } from "./tree.ts";

/** Where Starlight keeps a site's pages, relative to its root. */
export const CONTENT = "src/content/docs";

/** Directories whose files a generator writes, and no rule is held to. */
const GENERATED = [`${sep}paraglide${sep}`, `${sep}generated${sep}`];

/** One page of the site's own prose, relative to its root. */
export interface Page {
  readonly path: string;
  readonly text: string;
}

/** What the guards read of a site, handed to the site's own rules. */
export interface Tree {
  readonly root: string;
  /** The site's own code and chrome, outside the content directory. */
  readonly authored: readonly SourceFile[];
  /** The site's own pages: every `.md` and `.mdx` that is not a mirror. */
  readonly pages: readonly Page[];
  /** The mirrors `mirrors.json` declares. */
  readonly declared: readonly Declared[];
  /** What stands at each symlink under the content directory. */
  readonly state: readonly MirrorState[];
  /** One file's text by its path from the root, or nothing where it is absent. */
  readonly text: (path: string) => Promise<string>;
  /** Every file under a directory, by its path from the root. */
  readonly files: (path: string) => Promise<string[]>;
}

/** A tree a rule reads that came back empty: every rule over it passed on nothing. */
export const empty = (what: string): Violation => ({
  where: what,
  line: null,
  message: "holds nothing, so every rule over it passed on nothing",
});

/** Read the tree and every rule the kit holds a site to. */
export async function readTree(
  root: string,
): Promise<{ tree: Tree; found: Violation[] }> {
  const content = join(root, CONTENT);
  const code = await walk(join(root, "src"));
  const scripts = await walk(join(root, "scripts"));
  const paths = [...code.files, ...scripts.files].filter(
    (path) => !GENERATED.some((dir) => path.includes(dir)),
  );
  const own = paths.filter((path) => !path.startsWith(content + sep));
  const prose = paths.filter(
    (path) => path.startsWith(content + sep) && /\.(md|mdx)$/.test(path),
  );

  const authored = await Promise.all(
    own.map(async (path) => ({
      path: relativeTo(root, path),
      text: await readFile(path, "utf8"),
    })),
  );
  const pages = await Promise.all(
    prose.map(async (path) => ({
      path: relativeTo(root, path),
      text: await readFile(path, "utf8"),
    })),
  );
  const manifest = JSON.parse(await textOf(join(root, "mirrors.json"))) as {
    mirrors: Declared[];
  };
  const declared = manifest.mirrors;
  const state = await mirrorStates(root, CONTENT, code.links);

  const text = (path: string): Promise<string> => textOf(join(root, path));
  const files = async (path: string): Promise<string[]> =>
    (await walk(join(root, path))).files.map((one) => relativeTo(root, one));

  const owned = prose.map((path) =>
    routeOf(relative(content, path).split(sep).join("/")),
  );

  const found: Violation[] = [
    ...authored.flatMap((file) => fileViolations(file)),
    ...mirrorViolations(declared, state),
    ...collisionViolations(owned, declared),
    ...(pinsOrg(await text(".gitmodules"))
      ? healthViolations(await files(HEALTH), declared)
      : []),
    ...tokenViolations(
      await text(TOKENS),
      await text(INSTALLED),
      await text(STYLESHEET),
      await text(THEME),
    ),
    ...lockViolations(
      await text("package.json"),
      await text("package-lock.json"),
    ),
  ];
  if (authored.length === 0) found.push(empty("src"));
  if (pages.length === 0) found.push(empty(CONTENT));

  return {
    tree: { root, authored, pages, declared, state, text, files },
    found,
  };
}
