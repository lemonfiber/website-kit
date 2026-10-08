/**
 * The org's community health files, against the pages this site renders.
 *
 * `lemonfiber/.github` holds the files GitHub serves on behalf of every
 * repository in the org that defines none of its own, and a site that pins it
 * as `vendor/org` is where a reader meets them. Each arrives as a mirror: a
 * symlink into `vendor/org`, declared in `mirrors.json`. A site that does not
 * pin the org renders none of them and is held to nothing here.
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
export declare const HEALTH = "vendor/org";
/**
 * Whether `.gitmodules` pins the org at `vendor/org`, which is what puts a site
 * under these rules. Read line by line: a submodule's `path = …` names where it
 * sits.
 */
export declare function pinsOrg(gitmodules: string): boolean;
/**
 * Every community health file the org publishes, by its path in that tree.
 *
 * `paths` is every path under `vendor/org`, repository-relative.
 */
export declare function healthFiles(paths: readonly string[]): string[];
/** The path inside the org each mirror of it renders. */
export declare function mirroredFromOrg(declared: readonly Declared[]): string[];
/**
 * What the org publishes and what this site renders, against each other.
 *
 * An org tree holding no health file at all is a violation rather than a clean
 * run: two empty sets agree about everything, so a submodule that failed to
 * check out would report the contributing section as complete.
 */
export declare function healthViolations(paths: readonly string[], declared: readonly Declared[]): Violation[];
