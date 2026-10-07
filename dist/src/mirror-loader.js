/**
 * The content loader that puts mirrored prose into Starlight's collection.
 *
 * It reads through the symlink at each declared route, so the bytes it renders
 * are the submodule's own, at the revision this repository pins. Every page it
 * stores carries the revision it came from and an edit link into the repository
 * that owns it.
 *
 * Mirrors are read in two passes. The first learns every route every mirror
 * will serve; the second renders, so a link from one repository's prose into
 * another's can land on this site rather than leaving it.
 */
import { pathToFileURL } from "node:url";
import { attributedPath, crossTable, editUrl, isFile, isIncluded, parseRevision, rewriteLinks, routeOf, routeTable, sourceUrl, titleOf, withoutLeadingHeading, } from "./mirror.js";
import { gitLog, listing, read } from "./mirror-source.js";
const CONTENT = "src/content/docs";
/**
 * Sorted the way the paths read, not the way a locale would order them. A
 * directory listing holds each path once, so there is no equal pair to order.
 */
export const byCodePoint = (a, b) => (a < b ? -1 : 1);
/** The paths a mirror renders, relative to the mirror's own root. */
export function pagesOf(mirror, root) {
    if (isFile(mirror))
        return [""];
    return listing(`${root}/${CONTENT}/${mirror.route}`)
        .map((entry) => entry.replaceAll("\\", "/"))
        .filter((entry) => isIncluded(mirror, entry))
        .sort(byCodePoint);
}
/** Where a page is filed, relative to the repository root. */
export function fileOf(mirror, relative) {
    const base = `${CONTENT}/${mirror.route}`;
    return isFile(mirror) ? base : `${base}/${relative}`;
}
/** Where a page's bytes are, through the symlink that declares the mirror. */
export function pathOf(mirror, root, relative) {
    return `${root}/${fileOf(mirror, relative)}`;
}
/** What this repository pins, and what that revision holds. */
export function readingOf(mirror, root) {
    return {
        mirror,
        revision: parseRevision(gitLog(`${root}/vendor/${mirror.repo}`)),
        relatives: pagesOf(mirror, root),
    };
}
/** Every mirrored file, keyed by its address on its own forge. */
export function crossRoutes(readings) {
    const table = new Map();
    for (const reading of readings)
        for (const [key, route] of crossTable(reading.mirror, reading.relatives))
            table.set(key, route);
    return table;
}
const missing = (mirror, relative) => new Error(`mirror ${mirror.route}: ${relative} has no title, and none is declared for it`);
/**
 * Every page one mirror renders, ready for the store, in the order its files
 * are listed.
 *
 * Rendered all at once and returned rather than stored as each finishes, so the
 * store receives them in the order they were listed whichever finished first.
 */
export async function entriesOf(context, reading, root, cross) {
    const { mirror, revision, relatives } = reading;
    const routes = routeTable(mirror, relatives);
    return Promise.all(relatives.map(async (relative) => {
        const source = read(pathOf(mirror, root, relative));
        const declared = isFile(mirror)
            ? mirror.title
            : mirror.titles?.[relative];
        const title = titleOf(source, declared);
        if (title === null)
            throw missing(mirror, relative);
        const id = routeOf(mirror, relative);
        const body = rewriteLinks(withoutLeadingHeading(source), mirror, revision, relative, routes, cross);
        const provenance = {
            repo: mirror.repo,
            label: mirror.label,
            revision: revision.sha,
            date: revision.date,
            source: sourceUrl(mirror, revision, relative),
        };
        const data = await context.parseData({
            id,
            data: {
                title,
                editUrl: editUrl(mirror, relative),
                lastUpdated: new Date(revision.date),
                mirror: provenance,
            },
        });
        return {
            id,
            data,
            body,
            filePath: fileOf(mirror, relative),
            digest: context.generateDigest(`${revision.sha}:${source}`),
            rendered: await context.renderMarkdown(body, {
                fileURL: pathToFileURL(`${root}/${attributedPath(id)}`),
            }),
        };
    }));
}
/** The loader itself: every declared mirror, in the order they are declared. */
export function mirrorLoader(mirrors, root) {
    return {
        name: "lemonfiber-mirror-loader",
        load: async (context) => {
            const readings = mirrors.map((mirror) => readingOf(mirror, root));
            const cross = crossRoutes(readings);
            const entries = await Promise.all(readings.map((reading) => entriesOf(context, reading, root, cross)));
            for (const entry of entries.flat())
                context.store.set(entry);
        },
    };
}
