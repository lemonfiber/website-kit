/**
 * The revision and date of the commit a checkout is sitting on.
 *
 * The program is named by its absolute path: a build resolving `git` through
 * `PATH` runs whichever `git` the environment happens to offer.
 */
export declare function gitLog(directory: string): string;
/** Every path under a directory, recursively, relative to it. */
export declare function listing(directory: string): string[];
/** One file's text. */
export declare function read(path: string): string;
