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
const lineOf = (site, page) => page.description === undefined || page.description === ""
    ? `- [${page.title}](${site.origin}${page.route})`
    : `- [${page.title}](${site.origin}${page.route}): ${page.description}`;
/** `llms.txt`: the summary, then a section of links per part of the site. */
export function llmsIndex(site, sections) {
    const parts = [`# ${site.name}`, `> ${site.summary}`];
    for (const section of sections) {
        if (section.pages.length === 0)
            continue;
        parts.push(`## ${section.label}`, section.pages.map((page) => lineOf(site, page)).join("\n"));
    }
    return `${parts.join("\n\n")}\n`;
}
/** `llms-full.txt`: every page, its address and its whole text, one after another. */
export function llmsFull(site, pages) {
    const parts = [`# ${site.name}`, `> ${site.summary}`];
    for (const page of pages)
        parts.push(`## ${page.title}\n\n${site.origin}${page.route}\n\n${page.body.trim()}`);
    return `${parts.join("\n\n")}\n`;
}
