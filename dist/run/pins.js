/** Fetches the pinned repositories and applies the rules in src/pins.ts. */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { declaredBranches, DEFAULT_BRANCH, LOG_FORMAT, mirrored, overdue, moved, parseCommits, pinnedIn, pinnedRevisions, report, unread, watched, WINDOW_HOURS, WINDOW_SECONDS, } from "../src/pins.js";
const hours = String(WINDOW_HOURS);
/** An account written to the log and, on a runner, to the step summary. */
function account() {
    // What the run page shows above the log, so the verdict and what it asks of
    // the reader are read together.
    const SUMMARY = process.env["GITHUB_STEP_SUMMARY"];
    const say = (line = "") => {
        console.log(line);
        if (SUMMARY !== undefined)
            appendFileSync(SUMMARY, `${line}\n`);
    };
    const fenced = (lines) => {
        say("```");
        for (const one of lines)
            say(one);
        say("```");
    };
    // It never reached a comparison, so it has nothing to say about any pin, and
    // a comparison that did not happen is not a clean one: it refuses rather than
    // passes over what it could not read.
    const stopped = (heading, detail) => {
        say(`## ${heading}`);
        say();
        say("This run did not get as far as a comparison, so nothing here is a pin");
        say("that has gone behind: it could not read what it reads.");
        say();
        fenced([detail]);
        console.error(`::error::${detail}`);
        process.exit(1);
    };
    return { say, fenced, stopped };
}
/**
 * Git, by absolute path and with `PATH` pinned to the system directories.
 *
 * A command named on its own is whichever one `PATH` reaches first, and `PATH`
 * on a runner is what the steps before this one prepended to it. Both ends are
 * closed here: the binary is named by absolute path, so nothing on `PATH` can
 * stand in for it, and `PATH` is then pinned, so nothing git resolves for itself
 * can be substituted either. These are the three places a package manager
 * installs git.
 */
function gitAt(root, told) {
    const CANDIDATES = [
        "/usr/bin/git",
        "/usr/local/bin/git",
        "/opt/homebrew/bin/git",
    ];
    const SYSTEM_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";
    const GIT = CANDIDATES.find((path) => existsSync(path));
    if (GIT === undefined)
        told.stopped("Git could not be found", `no git at ${CANDIDATES.join(", ")}`);
    return (...args) => {
        const done = spawnSync(GIT, args, {
            cwd: root,
            encoding: "utf8",
            maxBuffer: 1 << 26,
            env: { ...process.env, PATH: SYSTEM_PATH },
        });
        return { ok: done.status === 0, out: done.stdout.trim() };
    };
}
/**
 * Every watched path's commits its pin has not taken. A fetch that failed
 * leaves a remote-tracking ref that is itself behind, and the comparison would
 * come back clean off it, so it is named rather than compared.
 */
function compare(git, reads, pinned, branches) {
    const found = { behind: [], unreadable: [], fetched: new Set() };
    for (const read of reads) {
        const pin = pinned.get(read.module) ?? "";
        const branch = branches.get(read.module) ?? DEFAULT_BRANCH;
        if (!found.fetched.has(read.module)) {
            found.fetched.add(read.module);
            if (!git("-C", read.module, "fetch", "--quiet", "origin").ok)
                found.unreadable.push(`${read.module}: origin could not be fetched`);
        }
        const range = `${pin}..origin/${branch}`;
        const args = ["-C", read.module, "log", LOG_FORMAT, range];
        if (read.path !== "")
            args.push("--", read.path);
        const log = git(...args);
        if (!log.ok) {
            found.unreadable.push(`${read.module}: ${range} could not be read`);
            continue;
        }
        const commits = parseCommits(log.out);
        if (commits.length > 0)
            found.behind.push({ ...read, pin: pin.slice(0, 7), commits });
    }
    return found;
}
/** The verdict's heading and the paragraph under it. */
function headline(told, late, found) {
    const { say } = told;
    if (late.length > 0) {
        say("## A pin has gone behind on a source this site renders");
        say();
        say("These commits touched a file a page here renders or a guard reads,");
        say(`and have waited longer than ${hours} hours on their branch, which is`);
        say("longer than `bump-pins` takes to carry them. Until each is taken, this");
        say("check refuses every pull request here (Q-R68).");
    }
    else if (found.unreadable.length > 0) {
        say("## A pinned repository could not be compared with its default branch");
        say();
        say("This is not a pin that has gone behind: the comparison did not happen,");
        say("so what that pin has taken is unknown rather than current.");
    }
    else if (found.behind.length > 0) {
        say("## Every commit a pin has not taken is inside the window");
        say();
        say("Each one below touched a source this site renders, and has waited less");
        say(`than ${hours} hours. \`bump-pins\` carries it in a pull request of its own.`);
    }
    else {
        say("## Every pin has taken every commit touching a source this site renders");
    }
}
/** What the run read, and what it says nothing about. */
function scope(told, scanned, moving, blind) {
    const { say, fenced } = told;
    say();
    say(scanned);
    if (moving.length > 0) {
        say();
        say("This pull request moves a pin, so it is judged on the modules it moves:");
        say();
        fenced(moving);
    }
    // These repositories hold no path a page or a guard here reads, so no commit
    // in them can ever appear above — the verdict is about the ones that are
    // read, and without this it reads as an account of all of them.
    if (blind.length > 0) {
        say();
        say("No page or guard here reads a path inside these, so this check says");
        say("nothing about them either way:");
        say();
        fenced(blind);
    }
}
/** The commits behind, and how to take the ones past the window. */
function findings(told, late, found) {
    const { say, fenced } = told;
    if (late.length > 0) {
        say();
        say(`Waiting longer than ${hours} hours:`);
        say();
        fenced(report(late).split("\n"));
        say();
        say("To catch up, merge the `pins/all` pull request `bump-pins` keeps open.");
        say("Where it names a module above as held, the guards name what the pages");
        say("need: take the pin in a pull request that also writes it, with");
        say("`git submodule update --remote <module>`, then `npm run guard -- --fix`");
        say("and the rest by hand.");
        console.error(`::error::a pin has not taken commits that have waited longer than ${hours} hours on a source this site renders — merge the pins/all pull request, or take the pin with \`git submodule update --remote <module>\` and \`npm run guard -- --fix\``);
    }
    else if (found.behind.length > 0) {
        say();
        say("Inside the window:");
        say();
        fenced(report(found.behind).split("\n"));
    }
    if (found.unreadable.length > 0) {
        say();
        say("Could not be compared:");
        say();
        fenced(found.unreadable);
        console.error("::error::a pinned repository could not be compared with its default branch, so what it holds is unknown rather than current");
    }
}
/** Fetch the pinned repositories and refuse a pin left behind past its window. */
export function runPins(options) {
    const ROOT = options.root.endsWith("/") ? options.root : `${options.root}/`;
    const told = account();
    const git = gitAt(ROOT, told);
    const status = git("submodule", "status");
    if (!status.ok)
        told.stopped("The submodules could not be read", "git submodule status failed");
    const pinned = pinnedRevisions(status.out);
    const branches = declaredBranches(git("config", "-f", ".gitmodules", "--get-regexp", String.raw `^submodule\.`)
        .out);
    // The guards' own sources, and every tree a mirror renders. The second list is
    // most of this site: a mirrored page is the upstream file, so no guard names it
    // and the guarded paths alone know nothing about any of them.
    const mirrors = readFileSync(`${ROOT}mirrors.json`, "utf8");
    const paths = [...options.guarded, ...mirrored(mirrors)];
    const everything = watched(paths, [...pinned.keys()]);
    // A pull request names the commit it targets. One that moves a pin is a
    // catch-up, and is judged on the modules it moves rather than refused for a
    // pin it does not touch.
    const BASE = process.env["BASE_SHA"] ?? "";
    const pinsAt = (revision) => {
        const listed = git("ls-tree", revision, "--", "vendor/");
        if (!listed.ok)
            told.stopped("The pins could not be read", `${revision} is not in the checkout`);
        return pinnedIn(listed.out);
    };
    const moving = BASE === "" ? [] : moved(pinsAt(BASE), pinsAt("HEAD"));
    const reads = moving.length === 0
        ? everything
        : everything.filter((one) => moving.includes(one.module));
    // A guard whose source resolves to no pinned repository is a guard this check
    // is not watching, and an empty list would read as a clean run.
    if (everything.length === 0)
        told.stopped("No guarded source sits in a pinned repository", "every guarded path resolved outside vendor/, so nothing was compared");
    const found = compare(git, reads, pinned, branches);
    const blind = unread(paths, [...pinned.keys()]);
    const late = overdue(found.behind, Math.floor(Date.now() / 1000), WINDOW_SECONDS);
    const scanned = `${String(reads.length)} watched paths, in ${String(found.fetched.size)} of ${String(pinned.size)} pinned repositories.`;
    headline(told, late, found);
    scope(told, scanned, moving, blind);
    findings(told, late, found);
    process.exit(late.length + found.unreadable.length === 0 ? 0 : 1);
}
