/**
 * The pinned sources a guard reads, and what a pin has not taken.
 *
 * A recount is only as true as the tree it recounts. A site's guards each name
 * a file inside a submodule and hold the site's prose to it; a pin sitting
 * before a commit that touched one of those files leaves the guard green and
 * the page wrong. A site's `pins.yml` asks how long a pin has been behind,
 * which is a different question with a different answer: a pin two days behind
 * is inside every window and still enough.
 *
 * `bump-pins.yml` takes every pin that has moved, by pull request, so a commit
 * a pin has not taken is normally one that pull request is carrying. What makes
 * one a fault is that it has waited longer than that takes: `overdue` keeps the
 * commits older than the window, and those are what `sources` refuses on.
 *
 * Everything here is a pure function over text. Reading the checkout and its
 * remotes is `run/pins.ts`.
 */
/** The branch a submodule that declares none of its own is read against. */
export declare const DEFAULT_BRANCH = "main";
/** What `parseCommits` reads: short hash, date, committer time, subject. */
export declare const LOG_FORMAT = "--format=%h%x09%cs%x09%ct%x09%s";
/**
 * How long a commit may wait on its branch before a pin not having taken it
 * refuses pull requests (Q-R68). `bump-pins` runs every three hours, which
 * leaves it eight runs to carry one.
 */
export declare const WINDOW_HOURS = 24;
/** `WINDOW_HOURS`, in the seconds a committer time is counted in. */
export declare const WINDOW_SECONDS: number;
/** A pinned repository, and a path inside it that a guard reads. */
export interface Watched {
    /** Where the submodule sits in this repository, such as `vendor/spec`. */
    readonly module: string;
    /** The path within it. Empty where the whole tree is the source. */
    readonly path: string;
}
/** A commit a pin has not taken. */
export interface Commit {
    readonly sha: string;
    readonly date: string;
    /**
     * When it reached the branch, in seconds since the epoch: the committer time,
     * which a squash merge sets to the moment of the merge.
     */
    readonly time: number;
    readonly subject: string;
}
/** One watched path, and the commits touching it that its pin has not taken. */
export interface Behind extends Watched {
    /** The revision the module is held at, as the notice names it. */
    readonly pin: string;
    readonly commits: readonly Commit[];
}
/**
 * Every tree a mirror renders, as a path inside the repository holding it.
 *
 * A guard reads a source to hold a site's *own* prose to it. A mirror has no
 * prose of its own — the upstream file is the page — so no guard names one, and
 * the guarded paths a site passes hold none of them. That is most of what a
 * site publishes, and a pin behind on a mirrored file serves a page as it stood
 * before.
 *
 * `mirrors.json` already names each one. Read from there rather than listed
 * again, so a mirror added tomorrow is watched the day it is declared.
 */
export declare function mirrored(manifest: string): string[];
/**
 * Each guarded path against the submodule holding it, in path order.
 *
 * The longest declared module wins, so a submodule nested inside another owns
 * the files under it. A path no module holds is this repository's own.
 */
export declare function watched(paths: readonly string[], modules: readonly string[]): Watched[];
/**
 * The pinned repositories no guard reads a path inside.
 *
 * `watched` answers which paths are read; this answers what that leaves out,
 * which is the half a reader cannot infer from a clean run. A repository no
 * guard reads a path inside contributes nothing to the comparison and so can
 * never appear in it — the run then says every pin has taken every commit
 * touching a guarded source, which is true, and reads as an account of all of
 * them.
 *
 * Named rather than counted, because "four of nine" invites the reader to guess
 * which five, and which five it is decides whether the silence matters.
 */
export declare function unread(paths: readonly string[], modules: readonly string[]): string[];
/**
 * The revision each submodule is pinned to, by the path it sits at.
 *
 * What `git submodule status` prints.
 */
export declare function pinnedRevisions(status: string): Map<string, string>;
/**
 * The revision each submodule is pinned to in a commit, by the path it sits at.
 *
 * What `git ls-tree <revision> -- vendor/` prints. Where `pinnedRevisions` reads
 * the checkout, this reads any commit the checkout holds, which is how a pull
 * request's pins are told apart from the ones on the branch it targets.
 */
export declare function pinnedIn(tree: string): Map<string, string>;
/**
 * The modules whose pin differs between two commits, in path order.
 *
 * A pull request that moves a pin is a catch-up, and refusing it for a pin it
 * does not touch would hold back the cure for the very drift being refused —
 * so such a pull request is judged on the modules it moves and no others.
 */
export declare function moved(base: ReadonlyMap<string, string>, head: ReadonlyMap<string, string>): string[];
/**
 * The default branch each submodule declares, by the path it sits at.
 *
 * A module that declares none is read against `DEFAULT_BRANCH`.
 */
export declare function declaredBranches(config: string): Map<string, string>;
/** The repository each submodule is cloned from, by the path it sits at. */
export declare function declaredUrls(config: string): Map<string, string>;
/** The commits `git log` in `LOG_FORMAT` named. */
export declare function parseCommits(output: string): Commit[];
/**
 * The commits that have waited longer than the window, by watched path.
 *
 * A commit inside the window is one the automatic bump has had no time to
 * take yet. A path left with none is dropped, so what comes back is exactly
 * what the check refuses on, in the order it was given.
 */
export declare function overdue(behind: readonly Behind[], now: number, allowed: number): Behind[];
/**
 * The notice, naming every commit a pin has not taken.
 *
 * Named rather than counted: how far a pin is behind overall says nothing
 * about this site, since most of what a repository commits touches nothing a
 * guard here reads. One heading per module, so the entries arrive grouped by
 * module, which is the order `watched` returns them in.
 */
export declare function report(behind: readonly Behind[]): string;
