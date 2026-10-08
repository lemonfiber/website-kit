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
export const TABLE_REGION = "lf-table";
const HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"];
/**
 * The plugin's factory. Sätteri calls it once per document, so the heading a
 * table is named by never carries over from one page to the next.
 */
export function scrollableTables(options) {
    return () => {
        let heading = null;
        return {
            name: "lemonfiber-scrollable-tables",
            element: {
                filter: [...HEADINGS, "table"],
                visit(node) {
                    if (node.tagName !== "table") {
                        const id = node.properties?.["id"];
                        if (typeof id === "string" && id !== "")
                            heading = id;
                        return undefined;
                    }
                    return {
                        type: "element",
                        tagName: "div",
                        properties: {
                            class: TABLE_REGION,
                            role: "region",
                            tabindex: "0",
                            ...(heading === null
                                ? { "aria-label": options.label }
                                : { "aria-labelledby": heading }),
                        },
                        children: [node],
                    };
                },
            },
        };
    };
}
