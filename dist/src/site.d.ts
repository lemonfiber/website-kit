import { type Declared, type MirrorState, type SourceFile, type Violation } from "./guards.ts";
/** Where Starlight keeps a site's pages, relative to its root. */
export declare const CONTENT = "src/content/docs";
/** One page of the site's own prose, relative to its root. */
export interface Page {
    readonly path: string;
    readonly text: string;
}
/** What the guards read of a site, handed to the site's own rules. */
export interface Tree {
    readonly root: string;
    /** The site's own code and chrome, outside the content directory. */
    readonly authored: readonly SourceFile[];
    /** The site's own pages: every `.md` and `.mdx` that is not a mirror. */
    readonly pages: readonly Page[];
    /** The mirrors `mirrors.json` declares. */
    readonly declared: readonly Declared[];
    /** What stands at each symlink under the content directory. */
    readonly state: readonly MirrorState[];
    /** One file's text by its path from the root, or nothing where it is absent. */
    readonly text: (path: string) => Promise<string>;
    /** Every file under a directory, by its path from the root. */
    readonly files: (path: string) => Promise<string[]>;
}
/** A tree a rule reads that came back empty: every rule over it passed on nothing. */
export declare const empty: (what: string) => Violation;
/** Read the tree and every rule the kit holds a site to. */
export declare function readTree(root: string): Promise<{
    tree: Tree;
    found: Violation[];
}>;
