import type { MirrorState, Violation } from "./guards.ts";
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
export declare function walk(dir: string): Promise<Walked>;
/** A path relative to the root, with forward slashes whatever the platform. */
export declare const relativeTo: (root: string, path: string) => string;
/**
 * What stands at each symlink under the content directory, as a mirror route.
 *
 * A symlink that resolves nowhere is reported as resolving to nothing rather
 * than dropped, so the mirror rule names it. Where it resolves is said against
 * the root's own real path, which a temporary or linked checkout differs from.
 */
export declare function mirrorStates(root: string, content: string, links: readonly string[]): Promise<MirrorState[]>;
/** One file's text, or nothing where it is not there to read. */
export declare function textOf(path: string): Promise<string>;
/**
 * Write the corrections that have exactly one right answer, and say how many.
 *
 * Applied last-first within each file so an earlier edit does not move a later
 * one's span. A page may state the same count twice, and one pass corrects each
 * occurrence the rule matched on that read, so the caller reads again after.
 */
export declare function repair(root: string, violations: readonly Violation[]): Promise<number>;
