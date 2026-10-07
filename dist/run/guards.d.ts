/**
 * The guards every site runs, and the place a site adds its own.
 *
 * A site's `scripts/guards.ts` calls `runGuards` with its root and, where it has
 * rules of its own, a function that reads what it needs from the tree handed to
 * it and returns what it found. Everything reports the same way, writes the
 * corrections that have one right answer under `--fix`, and exits.
 */
import { type Violation } from "../src/guards.ts";
import { type Tree } from "../src/site.ts";
export interface Site {
    /** The site's checkout. */
    readonly root: string;
    /** The rules only this site keeps. */
    readonly checks?: (tree: Tree) => Promise<Violation[]>;
}
/** Run every guard, and the site's own, then report, correct and exit. */
export declare function runGuards(site: Site): Promise<never>;
