/**
 * The guards every site runs, and the place a site adds its own.
 *
 * A site's `scripts/guards.ts` calls `runGuards` with its root and, where it has
 * rules of its own, a function that reads what it needs from the tree handed to
 * it and returns what it found. Everything reports the same way, writes the
 * corrections that have one right answer under `--fix`, and exits.
 */
import { format, type Violation } from "../src/guards.ts";
import { readTree, type Tree } from "../src/site.ts";
import { repair } from "../src/tree.ts";

export interface Site {
  /** The site's checkout. */
  readonly root: string;
  /** The rules only this site keeps. */
  readonly checks?: (tree: Tree) => Promise<Violation[]>;
}

/** Run every guard, and the site's own, then report, correct and exit. */
export async function runGuards(site: Site): Promise<never> {
  const { tree, found } = await readTree(site.root);
  if (site.checks) found.push(...(await site.checks(tree)));

  if (found.length === 0) {
    console.log(
      `guards: clean (${String(tree.authored.length)} authored, ${String(tree.state.length)} mirror(s), ${String(tree.pages.length)} page(s))`,
    );
    process.exit(0);
  }

  if (process.argv.includes("--fix")) {
    const written = await repair(site.root, found);
    if (written > 0) {
      console.log(
        `guards: wrote ${String(written)} correction(s). Run again to confirm.`,
      );
      process.exit(0);
    }
    console.error(
      "guards: nothing here has a single correct answer, so none was written.\n",
    );
  }
  console.error(`guards: ${String(found.length)} violation(s)\n`);
  console.error(format(found));
  const fixable = found.filter((violation) => violation.fix).length;
  if (fixable > 0)
    console.error(
      `\n${String(fixable)} of these can be written by \`npm run guard -- --fix\`.`,
    );
  process.exit(1);
}
