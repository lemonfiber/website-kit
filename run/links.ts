/** Reads the built site and applies the rules in src/links.ts. */
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  addresses,
  faults,
  held,
  pageOf,
  report,
  type Checkout,
  type Fault,
} from "../src/links.ts";

export interface LinkOptions {
  /** The site's checkout, holding the built site under `dist/`. */
  readonly root: string;
}

/** Read the built site and refuse an address into a pinned repository that does not hold. */
export async function runLinks(options: LinkOptions): Promise<never> {
  const ROOT = options.root.endsWith("/") ? options.root : `${options.root}/`;

  const DIST = join(ROOT, "dist");
  const GIT = "/usr/bin/git";

  /** Git, named by absolute path, answering about one checkout. */
  const git = (directory: string, ...args: string[]): string =>
    execFileSync(GIT, ["-C", directory, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

  const json = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(join(ROOT, path), "utf8")) as unknown;

  interface Declared {
    readonly repo: string;
    readonly remote: string;
  }

  const manifest = (await json("mirrors.json")) as { mirrors: Declared[] };
  const own = (await json("package.json")) as { repository: { url: string } };

  // One entry per repository: several mirrors may render out of the same one.
  const byRemote = new Map<string, Checkout>();
  for (const mirror of manifest.mirrors) {
    if (byRemote.has(mirror.remote)) continue;
    const directory = join(ROOT, "vendor", mirror.repo);
    byRemote.set(mirror.remote, {
      remote: mirror.remote,
      revision: git(directory, "rev-parse", "HEAD").trim(),
      paths: held(git(directory, "ls-tree", "-r", "--name-only", "HEAD")),
    });
  }

  // The site's own repository, which its edit links point into. It pins no
  // revision of itself, so what answers for those links is the working tree.
  const home = own.repository.url.replace(/\.git$/, "");
  byRemote.set(home, {
    remote: home,
    revision: null,
    paths: held(
      `${git(ROOT, "ls-files")}\n${git(ROOT, "ls-files", "--others", "--exclude-standard")}`,
    ),
  });

  const checkouts = [...byRemote.values()];

  let entries: string[];
  try {
    entries = await readdir(DIST, { recursive: true, encoding: "utf8" });
  } catch {
    console.error(`links: no ${DIST} — run \`npm run build\` first`);
    process.exit(1);
  }

  const pages = entries
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter((entry) => entry.endsWith(".html"))
    .sort((a, b) => a.localeCompare(b));

  const read = await Promise.all(
    pages.map(async (page) => ({
      page,
      on: addresses(await readFile(join(DIST, page), "utf8"), checkouts),
    })),
  );

  const found: Fault[] = [];
  let checked = 0;
  for (const { page, on } of read) {
    checked += on.length;
    found.push(...faults(pageOf(page), on));
  }

  if (found.length > 0) {
    console.error(
      `links: ${String(found.length)} address(es) that do not hold\n`,
    );
    console.error(report(found));
    process.exit(1);
  }
  console.log(
    `links: clean (${String(pages.length)} pages, ${String(checked)} addresses into ${String(checkouts.length)} checkouts)`,
  );
  process.exit(0);
}
