/**
 * The rules for rendering a tree this repository does not own.
 *
 * Everything here is a pure function over text and paths. Reading the tree and
 * asking git what revision it holds is `mirror-source.ts`; wiring the two into
 * a content collection is `mirror-loader.ts`.
 */
/** A tree or a file under `src/content/docs` that another repository owns. */
export interface Mirror {
    /** Route below `src/content/docs`. A `.md` suffix means a single file. */
    readonly route: string;
    /** Directory under `vendor/`. */
    readonly repo: string;
    /** Path within that directory; empty for its root. */
    readonly path: string;
    /** The repository's web home, without a trailing slash. */
    readonly remote: string;
    /** The default branch the edit link points at. */
    readonly branch: string;
    /** How the site names the repository on a rendered page. */
    readonly label: string;
    /** Top-level names to render; everything else in the tree is ignored. */
    readonly include?: readonly string[];
    /** The file that serves a directory's own route. Defaults to `README`. */
    readonly index?: string;
    /** Title for a page whose source carries no heading to take one from. */
    readonly title?: string;
    /** Titles by path, for tree mirrors whose sources carry no heading. */
    readonly titles?: Readonly<Record<string, string>>;
    /** Where the section sits in the sidebar. */
    readonly order?: number;
}
/** The upstream revision a mirrored page was rendered from. */
export interface Revision {
    readonly sha: string;
    readonly date: string;
}
/** One page, ready for the content store. */
export interface MirroredPage {
    /** The collection id, which is also the route. */
    readonly id: string;
    readonly title: string;
    readonly body: string;
    /** Path within the repository, for the edit link and the provenance stamp. */
    readonly upstream: string;
    readonly repo: string;
}
/** A capture group's text. A group that did not participate contributed none. */
export declare function captured(match: RegExpExecArray, index: number): string;
/** The first segment of a path. */
export declare function head(path: string): string;
/** A link's target and whatever follows it, which is the optional title. */
export declare function untitled(inside: string): [string, string];
/** A file mirror renders one page; a tree mirror renders every page under it. */
export declare function isFile(mirror: Mirror): boolean;
/** The source text with any YAML frontmatter block removed. */
export declare function withoutFrontmatter(source: string): string;
/**
 * The single-line keys of a YAML frontmatter block, as text. A key whose value
 * is on following lines has none here; only `title` is read from this.
 */
export declare function frontmatter(source: string): Record<string, string>;
/**
 * What the page is called: the frontmatter `title`, else the first heading,
 * else what the mirror declared. A page with none of the three is a fault.
 */
export declare function titleOf(source: string, declared?: string): string | null;
/** The body with its first heading removed; the page renders one of its own. */
export declare function withoutLeadingHeading(source: string): string;
/** `a/b/../c` collapsed to `a/c`. A path may not climb above its own root. */
export declare function resolvePath(from: string, target: string): string | null;
/**
 * The route a source file serves under its mirror. A `README` is the index of
 * the directory holding it, which is what makes a section landing page. Routes
 * are lower case: a file name's capitalisation is a repository's business, not
 * a reader's.
 */
export declare function routeOf(mirror: Mirror, relative: string): string;
/**
 * The path a mirrored page's markdown is attributed to while it renders.
 *
 * Nothing reads the file — the bytes are already in hand — but a renderer that
 * is told where a page lives can name it in a report, and the link checker
 * only checks a page it can name.
 */
export declare function attributedPath(id: string): string;
/** Whether a path is rendered at all, given the mirror's `include` list. */
export declare function isIncluded(mirror: Mirror, relative: string): boolean;
/**
 * The body in runs, saying of each whether it is an example.
 *
 * A fenced block is what a reader copies. A link inside one is being *shown*,
 * not offered — rewriting it hands them a hundred-character absolute URL where
 * the example said `../AGENTS.md`, and what they copy no longer demonstrates
 * what it was written to demonstrate.
 *
 * An unclosed fence takes the rest of the document with it, which is what a
 * renderer does with one too.
 */
export declare function runs(body: string): {
    readonly code: boolean;
    readonly text: string;
}[];
/**
 * Rewrite the links of a mirrored page.
 *
 * A relative link to another mirrored page becomes that page's route, whether
 * that page comes from this mirror or from another one. Anything else relative
 * — an image, a manifest, a file nothing renders — becomes a link to the
 * repository that owns it, at the revision the page was rendered from, so it
 * resolves to those bytes rather than to a 404 here.
 */
export declare function rewriteLinks(body: string, mirror: Mirror, revision: Revision, relative: string, routes: ReadonlyMap<string, string>, cross?: ReadonlyMap<string, string>): string;
/**
 * The route this site serves for a link written as an upstream file URL.
 *
 * One repository's prose points at another's files by their address on the
 * forge. Where this site already renders that file, the reader stays here.
 */
export declare function crossRoute(url: string, cross: ReadonlyMap<string, string>): string | null;
/** Where a reader edits the page: the file itself, on the default branch. */
export declare function editUrl(mirror: Mirror, relative: string): string;
/** Where a reader sees exactly the bytes that were rendered. */
export declare function sourceUrl(mirror: Mirror, revision: Revision, relative: string): string;
/** Where a page's source sits in the repository that owns it. */
export declare function upstreamPath(mirror: Mirror, relative: string): string;
/** `2026-08-23T04:20:11+02:00` as `2026-08-23`. */
export declare function dayOf(iso: string): string;
/** The seven leading characters git itself would show. */
export declare function shortSha(sha: string): string;
/** What `git log -1 --format=%H%n%cI` said. */
export declare function parseRevision(output: string): Revision;
/** Every mirrored path, mapped to the route that renders it. */
export declare function routeTable(mirror: Mirror, relatives: readonly string[]): Map<string, string>;
/** The same table, keyed by the address the file has on its own forge. */
export declare function crossTable(mirror: Mirror, relatives: readonly string[]): Map<string, string>;
