/**
 * Takes every pin that has moved, in one pull request (a site's `bump-pins.yml`).
 *
 * For each submodule whose default branch is ahead of its pin, it checks the
 * new revision out and lets `npm run guard -- --fix` rewrite the counts a page
 * states. Where the guards then hold, the move is taken; where they still
 * refuse, the module and every file are put back and the move is named as
 * held, with what the guards said. What is taken is written to `pins/all` as
 * one commit made through the forge's API, which the forge signs, and the pull
 * request is opened, or rebuilt on the current `main`, and set to merge itself
 * once every required check passes. Where nothing is left to take, it is
 * closed.
 *
 * What it writes is composed in src/bump.ts.
 */
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  armArgs,
  bodyOf,
  BRANCH,
  gitDependencies,
  installSpec,
  messageOf,
  nameOf,
  occupied,
  sortPulls,
  titleOf,
  type Batch,
  type GitDependency,
  type Held,
  type Listed,
  type Take,
} from "../src/bump.ts";
import {
  declaredBranches,
  declaredUrls,
  DEFAULT_BRANCH,
  LOG_FORMAT,
  parseCommits,
  pinnedIn,
} from "../src/pins.ts";

export interface BumpOptions {
  /** The site's checkout. */
  readonly root: string;
  /** The command that runs the site's guards; `--fix` is added to correct. */
  readonly guard: readonly string[];
  /** The `Spec:` line every commit and pull request it opens carries. */
  readonly citation: string;
}

/** Take every pin that has moved, in the one pull request `bump-pins` keeps. */
export function runBump(options: BumpOptions): never {
  const ROOT = options.root.endsWith("/") ? options.root : `${options.root}/`;
  const [guardBinary = process.execPath, ...guardArgs] = options.guard;

  const SUMMARY = process.env["GITHUB_STEP_SUMMARY"];
  const REPOSITORY = process.env["GITHUB_REPOSITORY"] ?? "";
  const OWNER = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  // The app the token was minted for. The forge gives its pull requests the
  // author `app/<slug>`, and only a pull request with that author is this
  // workflow's to edit, close or merge.
  const SLUG = process.env["APP_SLUG"] ?? "";

  const say = (line = ""): void => {
    console.log(line);
    if (SUMMARY !== undefined) appendFileSync(SUMMARY, `${line}\n`);
  };

  function stopped(detail: string): never {
    console.error(`::error::${detail}`);
    process.exit(1);
  }

  if (!/^[\w.-]+\/[\w.-]+$/.test(REPOSITORY))
    stopped("GITHUB_REPOSITORY does not name a repository");
  if (OWNER === "" || !REPOSITORY.startsWith(`${OWNER}/`))
    stopped("GITHUB_REPOSITORY_OWNER does not own GITHUB_REPOSITORY");
  if (!/^[\w-]+$/.test(SLUG)) stopped("APP_SLUG does not name an app");

  // Each binary is named by absolute path and run with `PATH` pinned to the
  // system directories, for the reason `run/pins.ts` gives: nothing a step
  // before this one prepended to `PATH` can stand in for it.
  const SYSTEM_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";
  const found = (candidates: readonly string[], what: string): string => {
    const path = candidates.find((one) => existsSync(one));
    if (path === undefined) stopped(`no ${what} at ${candidates.join(", ")}`);
    return path;
  };
  const GIT = found(
    ["/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"],
    "git",
  );
  const GH = found(
    ["/usr/bin/gh", "/usr/local/bin/gh", "/opt/homebrew/bin/gh"],
    "gh",
  );
  const PRETTIER = `${ROOT}node_modules/prettier/bin/prettier.cjs`;
  // npm, beside the node running this, which is where an installer puts it.
  const NPM = found(
    [
      join(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
      join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    ],
    "npm",
  );

  interface Ran {
    readonly ok: boolean;
    readonly out: string;
    readonly err: string;
  }

  const run = (
    binary: string,
    args: readonly string[],
    input?: string,
  ): Ran => {
    const done = spawnSync(binary, args, {
      cwd: ROOT,
      encoding: "utf8",
      input,
      maxBuffer: 1 << 26,
      env: { ...process.env, PATH: SYSTEM_PATH },
    });
    return {
      ok: done.status === 0,
      out: done.stdout.trim(),
      err: done.stderr.trim(),
    };
  };

  const git = (...args: string[]): Ran => run(GIT, args);

  /** The forge, answering with JSON or refusing with the reason it gave. */
  const api = (method: string, path: string, body?: unknown): unknown => {
    const args = ["api", "--method", method, `repos/${REPOSITORY}/${path}`];
    if (body !== undefined) args.push("--input", "-");
    const done = run(
      GH,
      args,
      body === undefined ? undefined : JSON.stringify(body),
    );
    if (!done.ok) throw new Error(`${method} ${path}: ${done.err || done.out}`);
    return done.out === "" ? null : (JSON.parse(done.out) as unknown);
  };

  const field = (value: unknown, ...keys: string[]): string => {
    let at = value;
    for (const key of keys) at = (at as Record<string, unknown> | null)?.[key];
    if (typeof at !== "string")
      throw new Error(`the forge answered without ${keys.join(".")}`);
    return at;
  };

  /** The branch's head commit, or nothing where the branch does not exist. */
  const branchHead = (
    branch: string,
  ): { sha: string; tree: string; parent: string } | null => {
    const done = run(GH, [
      "api",
      `repos/${REPOSITORY}/git/ref/heads/${branch}`,
    ]);
    if (!done.ok) {
      if (done.err.includes("HTTP 404")) return null;
      throw new Error(`reading ${branch}: ${done.err}`);
    }
    const sha = field(JSON.parse(done.out), "object", "sha");
    const commit = api("GET", `git/commits/${sha}`);
    const parents = (commit as { parents?: { sha?: unknown }[] }).parents ?? [];
    return {
      sha,
      tree: field(commit, "tree", "sha"),
      parent: typeof parents[0]?.sha === "string" ? parents[0].sha : "",
    };
  };

  /**
   * The open pull requests on a `pins/` branch: the ones this workflow opened,
   * and every other, which it leaves alone and names.
   */
  const listPulls = (): ReturnType<typeof sortPulls> => {
    const done = run(GH, [
      "pr",
      "list",
      "--repo",
      REPOSITORY,
      "--state",
      "open",
      "--limit",
      "200",
      "--json",
      "number,headRefName,isCrossRepository,headRepositoryOwner,author,autoMergeRequest",
    ]);
    if (!done.ok)
      stopped(`the open pull requests could not be listed: ${done.err}`);
    return sortPulls(JSON.parse(done.out) as Listed[], {
      repository: OWNER,
      author: `app/${SLUG}`,
    });
  };

  const base = git("rev-parse", "HEAD");
  const baseTree = git("rev-parse", "HEAD^{tree}");
  const listing = git("ls-tree", "HEAD", "--", "vendor/");
  const config = git(
    "config",
    "-f",
    ".gitmodules",
    "--get-regexp",
    String.raw`^submodule\.`,
  );
  if (!base.ok || !baseTree.ok || !listing.ok || !config.ok)
    stopped("the checkout could not be read");

  const pins = pinnedIn(listing.out);
  const branches = declaredBranches(config.out);
  const urls = declaredUrls(config.out);
  const { own: open, foreign } = listPulls();

  if (pins.size === 0) stopped("no submodule is pinned in this checkout");

  /** The files outside `vendor/` that differ from the commit checked out. */
  const edited = (): string[] => {
    const diff = git("diff", "--name-only", "--", ".", ":(exclude)vendor");
    return diff.out === "" ? [] : diff.out.split("\n");
  };

  /** Every edited file, as it reads now. */
  const snapshot = (): Map<string, string> =>
    new Map(
      edited().map((path) => [path, readFileSync(`${ROOT}${path}`, "utf8")]),
    );

  /**
   * Puts the files back as `held` holds them: a move the guards refuse leaves
   * nothing behind for the next one to be judged with.
   */
  const restore = (held: ReadonlyMap<string, string>): void => {
    const fresh = edited().filter((path) => !held.has(path));
    if (fresh.length > 0) git("checkout", "--", ...fresh);
    for (const [path, text] of held) writeFileSync(`${ROOT}${path}`, text);
  };
  /** Puts the files back, and the module at its pin. */
  const putBack = (
    held: ReadonlyMap<string, string>,
    module: string,
    pin: string,
  ): void => {
    restore(held);
    git("-C", module, "checkout", "--quiet", "--detach", pin);
  };

  /** What each file's mode is in the commit checked out. */
  const modeOf = (path: string): string => {
    const staged = git("ls-files", "--stage", "--", path);
    return staged.out.split(" ")[0] ?? "100644";
  };

  /**
   * Writes what is taken to the branch.
   *
   * Says which commit the branch now holds, and whether this run wrote it or
   * found it already there.
   */
  const write = (batch: Batch): { head: string; changed: boolean } => {
    const tree = field(
      api("POST", "git/trees", {
        base_tree: baseTree.out,
        tree: [
          ...batch.takes
            .filter((one) => one.kind === "submodule")
            .map((one) => ({
              path: one.module,
              mode: "160000",
              type: "commit",
              sha: one.to,
            })),
          ...batch.rewritten.map((path) => ({
            path,
            mode: modeOf(path),
            type: "blob",
            content: readFileSync(`${ROOT}${path}`, "utf8"),
          })),
        ],
      }),
      "sha",
    );

    const held = branchHead(BRANCH);
    if (held !== null && held.tree === tree && held.parent === base.out)
      return { head: held.sha, changed: false };

    // No author and no committer: the forge fills both in from the token, as the
    // app, and signs the commit, which is what `main`'s signed-commits rule asks.
    const commit = field(
      api("POST", "git/commits", {
        message: messageOf(batch),
        tree,
        parents: [base.out],
      }),
      "sha",
    );

    if (held === null)
      api("POST", "git/refs", { ref: `refs/heads/${BRANCH}`, sha: commit });
    else api("PATCH", `git/refs/heads/${BRANCH}`, { sha: commit, force: true });
    return { head: commit, changed: true };
  };

  /**
   * Opens or retitles the pull request, and sets it to merge itself at the
   * commit this run wrote. A merge armed before a rebuild is armed again, so
   * what merges is always the head the forge was told to expect.
   */
  const propose = (
    batch: Batch,
    written: { head: string; changed: boolean },
  ): number => {
    const title = titleOf(batch);
    const body = bodyOf(batch);
    const held = open.get(BRANCH);
    let number: number;

    if (held === undefined) {
      const made = run(GH, [
        "pr",
        "create",
        "--repo",
        REPOSITORY,
        "--base",
        DEFAULT_BRANCH,
        "--head",
        BRANCH,
        "--title",
        title,
        "--body",
        body,
      ]);
      if (!made.ok) throw new Error(`opening the pull request: ${made.err}`);
      number = Number(made.out.slice(made.out.lastIndexOf("/") + 1));
    } else {
      number = held.number;
      const edit = run(GH, [
        "pr",
        "edit",
        String(number),
        "--repo",
        REPOSITORY,
        "--title",
        title,
        "--body",
        body,
      ]);
      if (!edit.ok)
        throw new Error(`retitling #${String(number)}: ${edit.err}`);
    }

    const armed = held?.armed === true;
    if (armed && !written.changed) return number;
    if (armed) {
      const off = run(GH, [
        "pr",
        "merge",
        String(number),
        "--repo",
        REPOSITORY,
        "--disable-auto",
      ]);
      if (!off.ok) throw new Error(`disarming #${String(number)}: ${off.err}`);
    }
    // Refused by the forge where the branch's head is not the commit written
    // here, so a head somebody moved after the push is never what merges.
    const on = run(GH, armArgs(number, REPOSITORY, written.head));
    if (!on.ok)
      throw new Error(`setting #${String(number)} to merge: ${on.err}`);
    return number;
  };

  // Somebody else's pull request is on the branch, and writing it would rewrite
  // their work. Nothing is written, and it is named.
  if (occupied(BRANCH, foreign))
    stopped(`${BRANCH} carries a pull request this workflow did not open`);

  const dependencies = gitDependencies(
    readFileSync(`${ROOT}package.json`, "utf8"),
  );

  /** Install a git dependency at a commit, rewriting the manifest and the lock. */
  const install = (dependency: GitDependency, sha: string): void => {
    const done = run(process.execPath, [
      NPM,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-exact",
      installSpec(dependency, sha),
    ]);
    if (!done.ok)
      throw new Error(`${dependency.name} could not be installed at ${sha}`);
  };

  /** Run the fixer, format what it rewrote, and ask the guards again. */
  const judge = (): Ran => {
    // The fixer exits 0 whether or not something it cannot write remains, so
    // the guards are asked again on what it left.
    run(guardBinary, [...guardArgs, "--fix"]);
    const touched = edited();
    if (touched.length > 0)
      run(process.execPath, [PRETTIER, "--write", ...touched]);
    return run(guardBinary, guardArgs);
  };

  const saying = (judged: Ran): string[] =>
    (judged.err || judged.out).split("\n").filter((one) => one !== "");

  const takes: Take[] = [];
  const held: Held[] = [];
  const current: string[] = [];
  const refused: string[] = [];
  const moved: [string, string][] = [];

  for (const [module, pin] of pins) {
    const url = urls.get(module);
    const upstream = branches.get(module) ?? DEFAULT_BRANCH;
    const before = snapshot();

    try {
      if (url === undefined)
        throw new Error(".gitmodules declares no url for it");
      if (!git("-C", module, "fetch", "--quiet", "origin", upstream).ok)
        throw new Error(`origin ${upstream} could not be fetched`);
      const head = git("-C", module, "rev-parse", "FETCH_HEAD").out;
      if (head === pin) {
        current.push(module);
        continue;
      }

      const log = git("-C", module, "log", LOG_FORMAT, `${pin}..${head}`);
      if (!log.ok) throw new Error(`${pin}..${head} could not be read`);
      if (!git("-C", module, "checkout", "--quiet", "--detach", head).ok)
        throw new Error(`${head} could not be checked out`);
      moved.push([module, pin]);

      // A package taken from the same repository follows this pin, so the copy
      // installed and the copy rendered are one revision.
      const following = dependencies.filter(
        (one) => one.repo === nameOf(module) && one.sha !== head,
      );
      for (const dependency of following) install(dependency, head);
      const judged = judge();

      const move = {
        kind: "submodule" as const,
        module,
        url,
        from: pin,
        to: head,
        commits: parseCommits(log.out),
      };
      if (judged.ok) takes.push(move);
      else {
        held.push({ ...move, said: saying(judged) });
        putBack(before, module, pin);
        for (const dependency of following) install(dependency, dependency.sha);
      }
    } catch (error) {
      putBack(before, module, pin);
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`::warning::${module}: ${reason}`);
      refused.push(`${module}: ${reason}`);
    }
  }

  // A package no submodule here pins follows its repository's default branch.
  for (const dependency of dependencies) {
    if (pins.has(`vendor/${dependency.repo}`)) continue;
    const url = `https://github.com/${dependency.owner}/${dependency.repo}`;
    const before = snapshot();
    const scratch = mkdtempSync(join(tmpdir(), "bump-package-"));
    try {
      if (!git("init", "--quiet", "--bare", scratch).ok)
        throw new Error("a scratch repository could not be made");
      const fetched = git(
        "-C",
        scratch,
        "fetch",
        "--quiet",
        "--filter=blob:none",
        url,
        DEFAULT_BRANCH,
      );
      if (!fetched.ok) throw new Error(`${url} could not be fetched`);
      const head = git("-C", scratch, "rev-parse", "FETCH_HEAD").out;
      if (head === dependency.sha) {
        current.push(dependency.name);
        continue;
      }
      const log = git(
        "-C",
        scratch,
        "log",
        LOG_FORMAT,
        `${dependency.sha}..${head}`,
      );
      if (!log.ok)
        throw new Error(`${dependency.sha}..${head} could not be read`);

      install(dependency, head);
      const judged = judge();
      const move = {
        kind: "package" as const,
        module: dependency.name,
        url,
        from: dependency.sha,
        to: head,
        commits: parseCommits(log.out),
      };
      if (judged.ok) takes.push(move);
      else {
        held.push({ ...move, said: saying(judged) });
        restore(before);
        install(dependency, dependency.sha);
      }
    } catch (error) {
      restore(before);
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`::warning::${dependency.name}: ${reason}`);
      refused.push(`${dependency.name}: ${reason}`);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }

  const batch: Batch = {
    takes,
    held,
    rewritten: edited(),
    citation: options.citation,
  };
  let outcome = "nothing to take, and no pull request open";

  try {
    const ours = open.get(BRANCH);
    if (takes.length > 0) {
      const written = write(batch);
      const number = propose(batch, written);
      outcome = `${written.changed ? "wrote" : "found as written"} #${String(number)}`;
    } else if (ours !== undefined) {
      const shut = run(GH, [
        "pr",
        "close",
        String(ours.number),
        "--repo",
        REPOSITORY,
        "--delete-branch",
        "--comment",
        "No pin is left that this workflow can take, so nothing is left for this pull request to carry.",
      ]);
      if (!shut.ok)
        throw new Error(`closing #${String(ours.number)}: ${shut.err}`);
      outcome = `closed #${String(ours.number)}`;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    refused.push(`${BRANCH}: ${reason}`);
  } finally {
    const changed = edited();
    if (changed.length > 0) git("checkout", "--", ...changed);
    for (const [module, pin] of moved)
      git("-C", module, "checkout", "--quiet", "--detach", pin);
  }

  const line = (label: string, names: readonly string[]): void => {
    say(`- ${label}: ${names.length === 0 ? "none" : names.join(", ")}`);
  };

  say("## The pins, taken");
  say();
  say(`- ${BRANCH}: ${outcome}`);
  line(
    "taken",
    takes.map((one) => one.module),
  );
  line(
    "held, needing words the fixer cannot write",
    held.map((one) => one.module),
  );
  line("current", current);
  line("could not be read", refused);
  line(
    "on the prefix and not opened here, left alone",
    foreign.map((one) => `#${String(one.number)} (${one.branch})`),
  );

  if (refused.length > 0) {
    console.error(
      `::error::${String(refused.length)} step(s) failed, so what they name stays where it is with nothing about to move it: ${refused.join("; ")}`,
    );
    process.exit(1);
  }
  process.exit(0);
}
