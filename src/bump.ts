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
export const BRANCH_PREFIX = "pins/";

/** The branch `bump-pins` writes its one pull request from. */
export const BRANCH = `${BRANCH_PREFIX}all`;

/**
 * How many commits a pull request body names for one pin before it points at
 * the comparison instead. A pin weeks behind would otherwise arrive as a wall,
 * and the comparison has the whole of it.
 */
export const LISTED = 20;

/** How many lines of what the guards said a held pin carries in the body. */
export const SAID = 20;

/** How many pins a title names before it counts them instead. */
export const NAMED = 3;

const SHORT = 7;
const GIT_SUFFIX = /\.git$/;

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

/** `github:<owner>/<repo>#<commit>`, the way a site takes a package by commit. */
const BY_COMMIT = /^github:([\w.-]+)\/([\w.-]+)#([0-9a-f]{40})$/;

/** Every dependency `package.json` takes from the forge at an exact commit. */
export function gitDependencies(manifest: string): GitDependency[] {
  let read: unknown;
  try {
    read = JSON.parse(manifest);
  } catch {
    return [];
  }
  const found: GitDependency[] = [];
  for (const field of ["dependencies", "devDependencies"]) {
    const listed = (read as Record<string, unknown> | null)?.[field];
    if (typeof listed !== "object" || listed === null) continue;
    for (const [name, spec] of Object.entries(listed)) {
      const one = typeof spec === "string" ? BY_COMMIT.exec(spec) : null;
      if (one === null) continue;
      const [, owner = "", repo = "", sha = ""] = one;
      found.push({ name, owner, repo, sha });
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/** What `npm install` is told to take a git dependency at a commit. */
export const installSpec = (dependency: GitDependency, sha: string): string =>
  `${dependency.name}@github:${dependency.owner}/${dependency.repo}#${sha}`;

/** The repository's own name, which is the last part of where it sits. */
export function nameOf(module: string): string {
  return module.slice(module.lastIndexOf("/") + 1);
}

/** Where the forge shows every commit a move takes. */
export function comparisonOf(move: Move): string {
  return `${move.url.replace(GIT_SUFFIX, "")}/compare/${move.from}...${move.to}`;
}

/** Names in reading order: `a`, `a and b`, `a, b and c`. */
function listed(names: readonly string[]): string {
  const last = names.at(-1);
  if (names.length <= 1 || last === undefined) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${last}`;
}

/** The pull request's title, which is also the commit's subject. */
export function titleOf(batch: Batch): string {
  const names = batch.takes.map((one) => nameOf(one.module));
  const said =
    names.length > NAMED ? `${String(names.length)} pins` : listed(names);
  return `docs(pins): take ${said}`;
}

const counted = (commits: readonly Commit[]): string =>
  commits.length === 1 ? "1 commit" : `${String(commits.length)} commits`;

const moved = (move: Move): string =>
  `${move.module} ${move.from.slice(0, SHORT)}..${move.to.slice(0, SHORT)}, ${counted(move.commits)}`;

const rewrites = (batch: Batch): string[] =>
  batch.rewritten.length === 0
    ? ["`npm run guard -- --fix` rewrote nothing."]
    : [
        "`npm run guard -- --fix` rewrote:",
        "",
        ...batch.rewritten.map((path) => `  ${path}`),
      ];

/**
 * The commit message.
 *
 * It names each move and points at its comparison rather than listing the
 * commits: a subject written in another repository is text this one did not
 * write, and a commit message is where a closing keyword in it would act.
 */
export function messageOf(batch: Batch): string {
  return [
    titleOf(batch),
    "",
    ...batch.takes.flatMap((one) => [moved(one), comparisonOf(one)]),
    "",
    ...rewrites(batch),
    "",
    batch.citation,
    "",
  ].join("\n");
}

/** One taken pin in the body, its commits fenced. */
function taken(take: Take): string[] {
  const shown = take.commits.slice(0, LISTED);
  const rest = take.commits.length - shown.length;
  return [
    `**\`${take.module}\`** from \`${take.from.slice(0, SHORT)}\` to \`${take.to.slice(0, SHORT)}\`: [${counted(take.commits)}](${comparisonOf(take)}).`,
    "",
    "```text",
    ...shown.map((one) => `${one.sha} ${one.date} ${one.subject}`),
    "```",
    ...(rest > 0 ? ["", `And ${String(rest)} more, on the comparison.`] : []),
    "",
  ];
}

/** One held pin in the body, with what the guards said, fenced. */
function kept(held: Held): string[] {
  const shown = held.said.slice(0, SAID);
  const rest = held.said.length - shown.length;
  return [
    `**\`${held.module}\`** stays at \`${held.from.slice(0, SHORT)}\`; taking \`${held.to.slice(0, SHORT)}\` ([${counted(held.commits)}](${comparisonOf(held)})) leaves the guards saying:`,
    "",
    "```text",
    ...shown,
    "```",
    ...(rest > 0 ? ["", `And ${String(rest)} more lines.`] : []),
    "",
  ];
}

/**
 * The pull request body.
 *
 * Commits and guard output are named inside fenced blocks, where the forge
 * neither links a reference nor acts on a keyword another repository wrote.
 */
export function bodyOf(batch: Batch): string {
  return [
    "`bump-pins` takes every pin whose move the guards hold once `npm run guard -- --fix` has run.",
    "",
    ...batch.takes.flatMap(taken),
    ...rewrites(batch),
    "",
    ...(batch.held.length === 0
      ? []
      : [
          "These need words the fixer cannot write, so this pull request leaves them where they are. Take one in a pull request that also writes them, with `git submodule update --remote <module>` (or `npm install <package>@github:<owner>/<repo>#<commit>`) and `npm run guard -- --fix`, then the rest by hand:",
          "",
          ...batch.held.flatMap(kept),
        ]),
    "It merges itself once every required check passes. The branch is rebuilt",
    "from `main` on every run, so a commit pushed to it does not last.",
    "",
    batch.citation,
  ].join("\n");
}

/** One open pull request as `gh pr list --json` describes it. */
export interface Listed {
  readonly number: number;
  readonly headRefName: string;
  readonly isCrossRepository: boolean;
  readonly headRepositoryOwner: { readonly login: string } | null;
  readonly author: { readonly login: string } | null;
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
export function sortPulls(
  listed: readonly Listed[],
  owner: Owner,
): { own: Map<string, Own>; foreign: Foreign[] } {
  const own = new Map<string, Own>();
  const foreign: Foreign[] = [];
  for (const one of listed) {
    if (!one.headRefName.startsWith(BRANCH_PREFIX)) continue;
    const here =
      !one.isCrossRepository &&
      one.headRepositoryOwner?.login === owner.repository;
    if (here && one.author?.login === owner.author)
      own.set(one.headRefName, {
        number: one.number,
        armed: one.autoMergeRequest !== null,
      });
    else foreign.push({ number: one.number, branch: one.headRefName, here });
  }
  return { own, foreign };
}

/**
 * Whether the branch carries somebody else's pull request.
 *
 * Writing the branch would rewrite their work, so nothing is written.
 * A fork's pull request does not count: its branch is in the fork.
 */
export function occupied(branch: string, foreign: readonly Foreign[]): boolean {
  return foreign.some((one) => one.here && one.branch === branch);
}

/**
 * What sets a pull request to merge itself, held to the commit this run wrote.
 *
 * The forge refuses where the branch's head is any other commit, so a head
 * somebody moved after the push is never what merges.
 */
export function armArgs(
  number: number,
  repository: string,
  head: string,
): string[] {
  return [
    "pr",
    "merge",
    String(number),
    "--repo",
    repository,
    "--auto",
    "--squash",
    "--match-head-commit",
    head,
  ];
}
