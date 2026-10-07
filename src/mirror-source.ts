/**
 * The three things reading a mirror needs from outside this process.
 *
 * Each is a single call with no branch of its own, so every decision about
 * what to read and what to do with it stays in `mirror.ts`, where it is a
 * function of its arguments.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const GIT = "/usr/bin/git";

/**
 * The revision and date of the commit a checkout is sitting on.
 *
 * The program is named by its absolute path: a build resolving `git` through
 * `PATH` runs whichever `git` the environment happens to offer.
 */
export function gitLog(directory: string): string {
  return execFileSync(GIT, ["-C", directory, "log", "-1", "--format=%H%n%cI"], {
    encoding: "utf8",
    // Captured rather than inherited: what git says about a directory it
    // cannot read belongs to whoever called this, not to the console.
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Every path under a directory, recursively, relative to it. */
export function listing(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" });
}

/** One file's text. */
export function read(path: string): string {
  return readFileSync(path, "utf8");
}
