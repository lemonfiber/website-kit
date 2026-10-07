/**
 * What `bump-pins` writes when it takes the pins.
 *
 * One pull request carries every pin whose move the guards hold once
 * `npm run guard -- --fix` has rewritten what it can. A pin whose move needs
 * words the fixer cannot write is left where it is and named, with what the
 * guards said, so it holds back no other pin. The branch, the title, the
 * commit message and the pull request body are each a function of what is
 * taken and what is held. Reading the checkout and talking to the forge is
 * `run/bump.ts`.
 */
import type { Commit } from "./pins.ts";
/** The prefix every branch on which a pin is taken starts with. */
export declare const BRANCH_PREFIX = "pins/";
/** The branch `bump-pins` writes its one pull request from. */
export declare const BRANCH = "pins/all";
/**
 * How many commits a pull request body names for one pin before it points at
 * the comparison instead. A pin weeks behind would otherwise arrive as a wall,
 * and the comparison has the whole of it.
 */
export declare const LISTED = 20;
/** How many lines of what the guards said a held pin carries in the body. */
export declare const SAID = 20;
/** How many pins a title names before it counts them instead. */
export declare const NAMED = 3;
/**
 * What a pin is: a submodule's gitlink, or a git dependency in `package.json`
 * taken at an exact commit.
 */
export type Kind = "submodule" | "package";
/** One pin that moved upstream. */
export interface Move {
    readonly kind: Kind;
    /**
     * Where the submodule sits, such as `vendor/spec`, or the package's name,
     * such as `@lemonfiber/website-kit`.
     */
    readonly module: string;
    /** The repository it is cloned from, as `.gitmodules` declares it. */
    readonly url: string;
    readonly from: string;
    readonly to: string;
    /** What `to` holds that `from` does not, newest first. */
    readonly commits: readonly Commit[];
}
/** A move the guards held to once the fixer had run, so it is taken. */
export type Take = Move;
/** A move the guards still refuse once the fixer has run, so it is left. */
export interface Held extends Move {
    /** What the guards said, a line each. */
    readonly said: readonly string[];
}
/** What one run takes and leaves. */
export interface Batch {
    readonly takes: readonly Take[];
    readonly held: readonly Held[];
    /** The files `npm run guard -- --fix` rewrote for the moves taken. */
    readonly rewritten: readonly string[];
    /** The `Spec:` line the commit and the pull request carry. */
    readonly citation: string;
}
/** A dependency `package.json` takes from a forge at an exact commit. */
export interface GitDependency {
    /** The package's name, such as `@lemonfiber/brand`. */
    readonly name: string;
    /** The repository's owner on the forge. */
    readonly owner: string;
    /** The repository's name, which a submodule of it sits under in `vendor/`. */
    readonly repo: string;
    readonly sha: string;
}
/** Every dependency `package.json` takes from the forge at an exact commit. */
export declare function gitDependencies(manifest: string): GitDependency[];
/** What `npm install` is told to take a git dependency at a commit. */
export declare const installSpec: (dependency: GitDependency, sha: string) => string;
/** The repository's own name, which is the last part of where it sits. */
export declare function nameOf(module: string): string;
/** Where the forge shows every commit a move takes. */
export declare function comparisonOf(move: Move): string;
/** The pull request's title, which is also the commit's subject. */
export declare function titleOf(batch: Batch): string;
/**
 * The commit message.
 *
 * It names each move and points at its comparison rather than listing the
 * commits: a subject written in another repository is text this one did not
 * write, and a commit message is where a closing keyword in it would act.
 */
export declare function messageOf(batch: Batch): string;
/**
 * The pull request body.
 *
 * Commits and guard output are named inside fenced blocks, where the forge
 * neither links a reference nor acts on a keyword another repository wrote.
 */
export declare function bodyOf(batch: Batch): string;
/** One open pull request as `gh pr list --json` describes it. */
export interface Listed {
    readonly number: number;
    readonly headRefName: string;
    readonly isCrossRepository: boolean;
    readonly headRepositoryOwner: {
        readonly login: string;
    } | null;
    readonly author: {
        readonly login: string;
    } | null;
    readonly autoMergeRequest: unknown;
}
/** A pull request `bump-pins` opened, and may therefore edit, close and merge. */
export interface Own {
    readonly number: number;
    readonly armed: boolean;
}
/** A pull request on a `pins/` branch that `bump-pins` did not open. */
export interface Foreign {
    readonly number: number;
    readonly branch: string;
    /** Whether its branch is in this repository, where a write would land on it. */
    readonly here: boolean;
}
/** Who may have opened a pull request `bump-pins` acts on. */
export interface Owner {
    /** The account that owns this repository. */
    readonly repository: string;
    /** The login the forge gives the app's pull requests, such as `app/<slug>`. */
    readonly author: string;
}
/**
 * The open pull requests on a `pins/` branch, split into the ones `bump-pins`
 * opened and every other.
 *
 * A branch name is something anybody can choose, a fork included, so it says
 * nothing about who opened the pull request. One is taken as this workflow's
 * own only where its branch is in this repository and the app opened it;
 * everything else on the prefix is left alone and named.
 */
export declare function sortPulls(listed: readonly Listed[], owner: Owner): {
    own: Map<string, Own>;
    foreign: Foreign[];
};
/**
 * Whether the branch carries somebody else's pull request.
 *
 * Writing the branch would rewrite their work, so nothing is written.
 * A fork's pull request does not count: its branch is in the fork.
 */
export declare function occupied(branch: string, foreign: readonly Foreign[]): boolean;
/**
 * What sets a pull request to merge itself, held to the commit this run wrote.
 *
 * The forge refuses where the branch's head is any other commit, so a head
 * somebody moved after the push is never what merges.
 */
export declare function armArgs(number: number, repository: string, head: string): string[];
