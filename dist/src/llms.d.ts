/**
 * A site's `llms.txt` and `llms-full.txt`: the index of its pages a machine reads
 * on somebody's behalf, and the same pages in full.
 *
 * Generated from the pages' own frontmatter on every build, so the index names
 * exactly the pages the site serves and says of each what the page says of
 * itself. The format is the one llmstxt.org sets out: a heading, a one-line
 * summary as a quotation, then a section of links per part of the site.
 *
 * Pure functions over the pages. The site's endpoint reads its collection.
 */
/** The site, as the index introduces it. */
export interface Site {
    readonly name: string;
    readonly summary: string;
    /** The site's address, with no trailing slash. */
    readonly origin: string;
}
/** One page, as the index lists it. */
export interface Listed {
    readonly route: string;
    readonly title: string;
    readonly description?: string | undefined;
}
/** One part of the site and the pages under it, in the order they are listed. */
export interface Section {
    readonly label: string;
    readonly pages: readonly Listed[];
}
/** One page in full. */
export interface Whole extends Listed {
    readonly body: string;
}
/** `llms.txt`: the summary, then a section of links per part of the site. */
export declare function llmsIndex(site: Site, sections: readonly Section[]): string;
/** `llms-full.txt`: every page, its address and its whole text, one after another. */
export declare function llmsFull(site: Site, pages: readonly Whole[]): string;
