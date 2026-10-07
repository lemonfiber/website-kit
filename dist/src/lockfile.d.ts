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
/** The revision named at the end of a spec, where it names one. */
export declare function revisionIn(spec: string): string | null;
/** Two revisions agree when one is the other, abbreviated or in full. */
export declare const sameRevision: (one: string, other: string) => boolean;
/** Every dependency `package.json` pins to an exact revision. */
export declare function pinnedDependencies(manifest: string): Map<string, string>;
/** The revision `package-lock.json` records for each dependency it resolved. */
export declare function resolvedRevisions(lock: string): Map<string, string>;
/**
 * What the declaration and the lockfile disagree about.
 *
 * A manifest that pins nothing is a violation rather than a clean run: a
 * renamed field would leave this comparing two empty sets, which agree about
 * everything.
 */
export declare function lockViolations(manifest: string, lock: string): Violation[];
