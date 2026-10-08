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
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { armArgs, bodyOf, BRANCH, gitDependencies, installSpec, messageOf, nameOf, occupied, sortPulls, titleOf, } from "../src/bump.js";
import { declaredBranches, declaredUrls, DEFAULT_BRANCH, LOG_FORMAT, parseCommits, pinnedIn, } from "../src/pins.js";
// Each binary is named by absolute path and run with `PATH` pinned to the
// system directories, for the reason `run/pins.ts` gives: nothing a step before
// this one prepended to `PATH` can stand in for it.
const SYSTEM_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";
function stopped(detail) {
    console.error(`::error::${detail}`);
    process.exit(1);
}
const reasonOf = (error) => error instanceof Error ? error.message : String(error);
/** The repository and app the environment names, refused where it names none. */
function forgeOf() {
    const repository = process.env["GITHUB_REPOSITORY"] ?? "";
    const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
    const slug = process.env["APP_SLUG"] ?? "";
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
        stopped("GITHUB_REPOSITORY does not name a repository");
    if (owner === "" || !repository.startsWith(`${owner}/`))
        stopped("GITHUB_REPOSITORY_OWNER does not own GITHUB_REPOSITORY");
    if (!/^[\w-]+$/.test(slug))
        stopped("APP_SLUG does not name an app");
    return { repository, owner, slug };
}
function found(candidates, what) {
    const path = candidates.find((one) => existsSync(one));
    if (path === undefined)
        stopped(`no ${what} at ${candidates.join(", ")}`);
    return path;
}
/** A runner for binaries in the checkout, with `PATH` pinned. */
const runnerAt = (root) => (binary, args, input) => {
    const done = spawnSync(binary, args, {
        cwd: root,
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
/** The forge, answering with JSON or refusing with the reason it gave. */
function api(context, method, path, body) {
    const args = [
        "api",
        "--method",
        method,
        `repos/${context.forge.repository}/${path}`,
    ];
    if (body !== undefined)
        args.push("--input", "-");
    const done = context.run(context.gh, args, body === undefined ? undefined : JSON.stringify(body));
    if (!done.ok)
        throw new Error(`${method} ${path}: ${done.err || done.out}`);
    return done.out === "" ? null : JSON.parse(done.out);
}
function field(value, ...keys) {
    let at = value;
    for (const key of keys)
        at = at?.[key];
    if (typeof at !== "string")
        throw new Error(`the forge answered without ${keys.join(".")}`);
    return at;
}
/** The branch's head commit, or nothing where the branch does not exist. */
function branchHead(context, branch) {
    const done = context.run(context.gh, [
        "api",
        `repos/${context.forge.repository}/git/ref/heads/${branch}`,
    ]);
    if (!done.ok) {
        if (done.err.includes("HTTP 404"))
            return null;
        throw new Error(`reading ${branch}: ${done.err}`);
    }
    const sha = field(JSON.parse(done.out), "object", "sha");
    const commit = api(context, "GET", `git/commits/${sha}`);
    const parents = commit.parents ?? [];
    return {
        sha,
        tree: field(commit, "tree", "sha"),
        parent: typeof parents[0]?.sha === "string" ? parents[0].sha : "",
    };
}
/**
 * The open pull requests on a `pins/` branch: the ones this workflow opened,
 * and every other, which it leaves alone and names.
 */
function listPulls(context) {
    const { forge } = context;
    const done = context.run(context.gh, [
        "pr",
        "list",
        "--repo",
        forge.repository,
        "--state",
        "open",
        "--limit",
        "200",
        "--json",
        "number,headRefName,isCrossRepository,headRepositoryOwner,author,autoMergeRequest",
    ]);
    if (!done.ok)
        stopped(`the open pull requests could not be listed: ${done.err}`);
    return sortPulls(JSON.parse(done.out), {
        repository: forge.owner,
        author: `app/${forge.slug}`,
    });
}
/** The files outside `vendor/` that differ from the commit checked out. */
function edited(context) {
    const diff = context.git("diff", "--name-only", "--", ".", ":(exclude)vendor");
    return diff.out === "" ? [] : diff.out.split("\n");
}
/** Every edited file, as it reads now. */
const snapshot = (context) => new Map(edited(context).map((path) => [
    path,
    readFileSync(`${context.root}${path}`, "utf8"),
]));
/**
 * Puts the files back as `held` holds them: a move the guards refuse leaves
 * nothing behind for the next one to be judged with.
 */
function restore(context, held) {
    const fresh = edited(context).filter((path) => !held.has(path));
    if (fresh.length > 0)
        context.git("checkout", "--", ...fresh);
    for (const [path, text] of held)
        writeFileSync(`${context.root}${path}`, text);
}
/** Puts the files back, and the module at its pin. */
function putBack(context, held, module, pin) {
    restore(context, held);
    context.git("-C", module, "checkout", "--quiet", "--detach", pin);
}
/** What each file's mode is in the commit checked out. */
function modeOf(context, path) {
    const staged = context.git("ls-files", "--stage", "--", path);
    return staged.out.split(" ")[0] ?? "100644";
}
/**
 * Writes what is taken to the branch.
 *
 * Says which commit the branch now holds, and whether this run wrote it or
 * found it already there.
 */
function write(context, batch) {
    const tree = field(api(context, "POST", "git/trees", {
        base_tree: context.baseTree,
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
                mode: modeOf(context, path),
                type: "blob",
                content: readFileSync(`${context.root}${path}`, "utf8"),
            })),
        ],
    }), "sha");
    const held = branchHead(context, BRANCH);
    if (held !== null && held.tree === tree && held.parent === context.base)
        return { head: held.sha, changed: false };
    // No author and no committer: the forge fills both in from the token, as the
    // app, and signs the commit, which is what `main`'s signed-commits rule asks.
    const commit = field(api(context, "POST", "git/commits", {
        message: messageOf(batch),
        tree,
        parents: [context.base],
    }), "sha");
    if (held === null)
        api(context, "POST", "git/refs", {
            ref: `refs/heads/${BRANCH}`,
            sha: commit,
        });
    else
        api(context, "PATCH", `git/refs/heads/${BRANCH}`, {
            sha: commit,
            force: true,
        });
    return { head: commit, changed: true };
}
/** Opens the pull request, or retitles the one open, and says its number. */
function openOrRetitle(context, batch, held) {
    const { repository } = context.forge;
    const title = titleOf(batch);
    const body = bodyOf(batch);
    if (held === undefined) {
        const made = context.run(context.gh, [
            "pr",
            "create",
            "--repo",
            repository,
            "--base",
            DEFAULT_BRANCH,
            "--head",
            BRANCH,
            "--title",
            title,
            "--body",
            body,
        ]);
        if (!made.ok)
            throw new Error(`opening the pull request: ${made.err}`);
        return Number(made.out.slice(made.out.lastIndexOf("/") + 1));
    }
    const number = String(held.number);
    const edit = context.run(context.gh, [
        "pr",
        "edit",
        number,
        "--repo",
        repository,
        "--title",
        title,
        "--body",
        body,
    ]);
    if (!edit.ok)
        throw new Error(`retitling #${number}: ${edit.err}`);
    return held.number;
}
/**
 * Opens or retitles the pull request, and sets it to merge itself at the
 * commit this run wrote. A merge armed before a rebuild is armed again, so
 * what merges is always the head the forge was told to expect.
 */
function propose(context, held, batch, written) {
    const { repository } = context.forge;
    const number = openOrRetitle(context, batch, held);
    const armed = held?.armed === true;
    if (armed && !written.changed)
        return number;
    if (armed) {
        const off = context.run(context.gh, [
            "pr",
            "merge",
            String(number),
            "--repo",
            repository,
            "--disable-auto",
        ]);
        if (!off.ok)
            throw new Error(`disarming #${String(number)}: ${off.err}`);
    }
    // Refused by the forge where the branch's head is not the commit written
    // here, so a head somebody moved after the push is never what merges.
    const on = context.run(context.gh, armArgs(number, repository, written.head));
    if (!on.ok)
        throw new Error(`setting #${String(number)} to merge: ${on.err}`);
    return number;
}
/** Install a git dependency at a commit, rewriting the manifest and the lock. */
function install(context, dependency, sha) {
    const done = context.run(process.execPath, [
        context.npm,
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--save-exact",
        installSpec(dependency, sha),
    ]);
    if (!done.ok)
        throw new Error(`${dependency.name} could not be installed at ${sha}`);
}
/** Run the fixer, format what it rewrote, and ask the guards again. */
function judge(context) {
    const [binary, ...args] = context.guard;
    // The fixer exits 0 whether or not something it cannot write remains, so
    // the guards are asked again on what it left.
    context.run(binary, [...args, "--fix"]);
    const touched = edited(context);
    if (touched.length > 0)
        context.run(process.execPath, [context.prettier, "--write", ...touched]);
    return context.run(binary, args);
}
const saying = (judged) => (judged.err || judged.out).split("\n").filter((one) => one !== "");
/** One submodule's move: taken where the guards hold, held where they refuse. */
function takeSubmodule(context, tally, dependencies, pinned, before) {
    const { git } = context;
    const { module, pin, url, upstream } = pinned;
    if (!git("-C", module, "fetch", "--quiet", "origin", upstream).ok)
        throw new Error(`origin ${upstream} could not be fetched`);
    const head = git("-C", module, "rev-parse", "FETCH_HEAD").out;
    if (head === pin) {
        tally.current.push(module);
        return;
    }
    const log = git("-C", module, "log", LOG_FORMAT, `${pin}..${head}`);
    if (!log.ok)
        throw new Error(`${pin}..${head} could not be read`);
    if (!git("-C", module, "checkout", "--quiet", "--detach", head).ok)
        throw new Error(`${head} could not be checked out`);
    tally.moved.push([module, pin]);
    // A package taken from the same repository follows this pin, so the copy
    // installed and the copy rendered are one revision.
    const following = dependencies.filter((one) => one.repo === nameOf(module) && one.sha !== head);
    for (const dependency of following)
        install(context, dependency, head);
    const judged = judge(context);
    const move = {
        kind: "submodule",
        module,
        url,
        from: pin,
        to: head,
        commits: parseCommits(log.out),
    };
    if (judged.ok) {
        tally.takes.push(move);
        return;
    }
    tally.held.push({ ...move, said: saying(judged) });
    putBack(context, before, module, pin);
    for (const dependency of following)
        install(context, dependency, dependency.sha);
}
/** Every submodule whose default branch is ahead of its pin. */
function takeSubmodules(context, tally, dependencies, config) {
    for (const [module, pin] of config.pins) {
        const before = snapshot(context);
        try {
            const url = config.urls.get(module);
            if (url === undefined)
                throw new Error(".gitmodules declares no url for it");
            const upstream = config.branches.get(module) ?? DEFAULT_BRANCH;
            takeSubmodule(context, tally, dependencies, { module, pin, url, upstream }, before);
        }
        catch (error) {
            putBack(context, before, module, pin);
            const reason = reasonOf(error);
            console.error(`::warning::${module}: ${reason}`);
            tally.refused.push(`${module}: ${reason}`);
        }
    }
}
/** One package's move to its repository's default branch, in a scratch clone. */
function takePackage(context, tally, dependency, scratch, before) {
    const { git } = context;
    const url = `https://github.com/${dependency.owner}/${dependency.repo}`;
    if (!git("init", "--quiet", "--bare", scratch).ok)
        throw new Error("a scratch repository could not be made");
    const fetched = git("-C", scratch, "fetch", "--quiet", "--filter=blob:none", url, DEFAULT_BRANCH);
    if (!fetched.ok)
        throw new Error(`${url} could not be fetched`);
    const head = git("-C", scratch, "rev-parse", "FETCH_HEAD").out;
    if (head === dependency.sha) {
        tally.current.push(dependency.name);
        return;
    }
    const log = git("-C", scratch, "log", LOG_FORMAT, `${dependency.sha}..${head}`);
    if (!log.ok)
        throw new Error(`${dependency.sha}..${head} could not be read`);
    install(context, dependency, head);
    const judged = judge(context);
    const move = {
        kind: "package",
        module: dependency.name,
        url,
        from: dependency.sha,
        to: head,
        commits: parseCommits(log.out),
    };
    if (judged.ok) {
        tally.takes.push(move);
        return;
    }
    tally.held.push({ ...move, said: saying(judged) });
    restore(context, before);
    install(context, dependency, dependency.sha);
}
/** Every package no submodule here pins, which follows its default branch. */
function takePackages(context, tally, dependencies, pins) {
    for (const dependency of dependencies) {
        if (pins.has(`vendor/${dependency.repo}`))
            continue;
        const before = snapshot(context);
        const scratch = mkdtempSync(join(tmpdir(), "bump-package-"));
        try {
            takePackage(context, tally, dependency, scratch, before);
        }
        catch (error) {
            restore(context, before);
            const reason = reasonOf(error);
            console.error(`::warning::${dependency.name}: ${reason}`);
            tally.refused.push(`${dependency.name}: ${reason}`);
        }
        finally {
            rmSync(scratch, { recursive: true, force: true });
        }
    }
}
/**
 * Writes and proposes what was taken, or closes the pull request where nothing
 * was, then puts the checkout back. Says what became of the branch.
 */
function settle(context, tally, ours, batch) {
    let outcome = "nothing to take, and no pull request open";
    try {
        if (tally.takes.length > 0) {
            const written = write(context, batch);
            const number = propose(context, ours, batch, written);
            outcome = `${written.changed ? "wrote" : "found as written"} #${String(number)}`;
        }
        else if (ours !== undefined) {
            const number = String(ours.number);
            const shut = context.run(context.gh, [
                "pr",
                "close",
                number,
                "--repo",
                context.forge.repository,
                "--delete-branch",
                "--comment",
                "No pin is left that this workflow can take, so nothing is left for this pull request to carry.",
            ]);
            if (!shut.ok)
                throw new Error(`closing #${number}: ${shut.err}`);
            outcome = `closed #${number}`;
        }
    }
    catch (error) {
        tally.refused.push(`${BRANCH}: ${reasonOf(error)}`);
    }
    finally {
        const changed = edited(context);
        if (changed.length > 0)
            context.git("checkout", "--", ...changed);
        for (const [module, pin] of tally.moved)
            context.git("-C", module, "checkout", "--quiet", "--detach", pin);
    }
    return outcome;
}
/** The run's account, in the log and the step summary. */
function summarise(outcome, tally, foreign) {
    const SUMMARY = process.env["GITHUB_STEP_SUMMARY"];
    const say = (line = "") => {
        console.log(line);
        if (SUMMARY !== undefined)
            appendFileSync(SUMMARY, `${line}\n`);
    };
    const line = (label, names) => {
        say(`- ${label}: ${names.length === 0 ? "none" : names.join(", ")}`);
    };
    say("## The pins, taken");
    say();
    say(`- ${BRANCH}: ${outcome}`);
    line("taken", tally.takes.map((one) => one.module));
    line("held, needing words the fixer cannot write", tally.held.map((one) => one.module));
    line("current", tally.current);
    line("could not be read", tally.refused);
    line("on the prefix and not opened here, left alone", foreign.map((one) => `#${String(one.number)} (${one.branch})`));
}
/** Take every pin that has moved, in the one pull request `bump-pins` keeps. */
export function runBump(options) {
    const root = options.root.endsWith("/") ? options.root : `${options.root}/`;
    const [guardBinary = process.execPath, ...guardArgs] = options.guard;
    const forge = forgeOf();
    const GIT = found(["/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"], "git");
    const GH = found(["/usr/bin/gh", "/usr/local/bin/gh", "/opt/homebrew/bin/gh"], "gh");
    // npm, beside the node running this, which is where an installer puts it.
    const NPM = found([
        join(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
        join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    ], "npm");
    const run = runnerAt(root);
    const git = (...args) => run(GIT, args);
    const base = git("rev-parse", "HEAD");
    const baseTree = git("rev-parse", "HEAD^{tree}");
    const listing = git("ls-tree", "HEAD", "--", "vendor/");
    const config = git("config", "-f", ".gitmodules", "--get-regexp", String.raw `^submodule\.`);
    if (!base.ok || !baseTree.ok || !listing.ok || !config.ok)
        stopped("the checkout could not be read");
    const context = {
        root,
        forge,
        gh: GH,
        npm: NPM,
        prettier: `${root}node_modules/prettier/bin/prettier.cjs`,
        guard: [guardBinary, ...guardArgs],
        run,
        git,
        base: base.out,
        baseTree: baseTree.out,
    };
    const pins = pinnedIn(listing.out);
    const branches = declaredBranches(config.out);
    const urls = declaredUrls(config.out);
    const { own: open, foreign } = listPulls(context);
    if (pins.size === 0)
        stopped("no submodule is pinned in this checkout");
    // Somebody else's pull request is on the branch, and writing it would rewrite
    // their work. Nothing is written, and it is named.
    if (occupied(BRANCH, foreign))
        stopped(`${BRANCH} carries a pull request this workflow did not open`);
    const dependencies = gitDependencies(readFileSync(`${root}package.json`, "utf8"));
    const tally = {
        takes: [],
        held: [],
        current: [],
        refused: [],
        moved: [],
    };
    takeSubmodules(context, tally, dependencies, { pins, urls, branches });
    takePackages(context, tally, dependencies, pins);
    const batch = {
        takes: tally.takes,
        held: tally.held,
        rewritten: edited(context),
        citation: options.citation,
    };
    const outcome = settle(context, tally, open.get(BRANCH), batch);
    summarise(outcome, tally, foreign);
    if (tally.refused.length > 0) {
        console.error(`::error::${String(tally.refused.length)} step(s) failed, so what they name stays where it is with nothing about to move it: ${tally.refused.join("; ")}`);
        process.exit(1);
    }
    process.exit(0);
}
