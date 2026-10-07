export interface BumpOptions {
    /** The site's checkout. */
    readonly root: string;
    /** The command that runs the site's guards; `--fix` is added to correct. */
    readonly guard: readonly string[];
    /** The `Spec:` line every commit and pull request it opens carries. */
    readonly citation: string;
}
/** Take every pin that has moved, in the one pull request `bump-pins` keeps. */
export declare function runBump(options: BumpOptions): never;
