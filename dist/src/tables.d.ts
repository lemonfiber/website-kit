/**
 * Every Markdown table as a region the keyboard can reach and scroll.
 *
 * A table wider than the page scrolls sideways inside its own box. A box that
 * scrolls and holds nothing focusable cannot be scrolled from the keyboard at
 * all, which axe reports as `scrollable-region-focusable`. So each table is
 * wrapped in a `div` that takes focus, is announced as a region, and is named
 * by the heading the table sits under, or by the site's own word for a table
 * where no heading stands above it.
 *
 * A hast plugin for Astro's Markdown processor, Sätteri, which visits elements
 * in document order and puts what a visit returns in the visited node's place.
 * It is typed here by its shape, so the kit takes no dependency on the
 * processor.
 */
/** The class the shared stylesheet gives the region. */
export declare const TABLE_REGION = "lf-table";
export interface TableOptions {
    /** What a table is named where no heading with an id stands above it. */
    readonly label: string;
}
/** The parts of a hast element the plugin reads and writes. */
export interface Element {
    readonly type: "element";
    readonly tagName: string;
    readonly properties?: Readonly<Record<string, unknown>>;
    readonly children: readonly unknown[];
}
/** The plugin, as Sätteri's `hastPlugins` takes one. */
export interface TablePlugin {
    readonly name: string;
    readonly element: {
        readonly filter: string[];
        readonly visit: (node: Element) => Element | undefined;
    };
}
/**
 * The plugin's factory. Sätteri calls it once per document, so the heading a
 * table is named by never carries over from one page to the next.
 */
export declare function scrollableTables(options: TableOptions): () => TablePlugin;
