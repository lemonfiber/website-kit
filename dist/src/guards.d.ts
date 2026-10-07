/** The structural rules, as pure functions over a described tree. */
import type { Mirror } from "./mirror.ts";
export interface Violation {
    readonly where: string;
    readonly line: number | null;
    readonly message: string;
    /**
     * How to correct it, where the correction has exactly one right answer.
     *
     * Only a violation whose fix is computable carries one. A transcribed count is:
     * the true number is known, its spelled form is already produced for the message,
     * and the span it replaces is a single token inside a sentence nothing else
     * touches. A missing page or a broken link has no such answer and carries none.
     */
    readonly fix?: Fix;
}
/** A replacement for one span of one file. */
export interface Fix {
    readonly path: string;
    readonly start: number;
    readonly end: number;
    readonly replacement: string;
}
export interface SourceFile {
    /** Path relative to the repository root. */
    readonly path: string;
    readonly text: string;
}
/** What a mirror has to say about itself for the tree to be checkable. */
export type Declared = Pick<Mirror, "route" | "repo" | "path">;
/** What the filesystem actually holds at a declared mirror's route. */
export interface MirrorState {
    readonly route: string;
    readonly isSymlink: boolean;
    readonly exists: boolean;
    /** Realpath relative to the repository root, or null when unresolvable. */
    readonly resolvesTo: string | null;
}
export declare const LINE_CAP = 550;
/** The prose a reader sees in a chrome template, one chunk per text run. */
export declare function chromeProse(source: string): string[];
/** The line-by-line and whole-file rules for one authored file. */
export declare function fileViolations(file: SourceFile): Violation[];
/**
 * A mirror renders content another repository owns. Its route must be a
 * symlink into `vendor/`; a real directory there is a second copy of a fact
 * that already has a home.
 */
export declare function mirrorViolations(declared: readonly Declared[], state: readonly MirrorState[]): Violation[];
/** The route a content file serves, relative to `src/content/docs`. */
export declare function routeOf(relativePath: string): string;
/**
 * A page this repository owns must not claim a route a mirror already serves.
 *
 * A tree mirror's own root is the exception: nothing upstream renders there,
 * and a section of the site with no way in is worse than one landing page.
 */
export declare function collisionViolations(ownedRoutes: readonly string[], declared: readonly Declared[]): Violation[];
export declare function format(found: readonly Violation[]): string;
