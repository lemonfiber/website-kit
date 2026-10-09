/**
 * The response headers a site's host sends with every page.
 *
 * A built page carries its own Content-Security-Policy as a `<meta>` element
 * (`csp.ts`), and a meta policy cannot say who may frame the page, nor can a
 * page set transport or isolation headers on itself. The host sends those,
 * read from a `_headers` file at the root of what it serves, so they are
 * written with the build and travel with it rather than living in a setting
 * on the host's dashboard.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
/** The file the host reads its header rules from, at the root of the build. */
export const HEADERS_FILE = "_headers";
/** What every response carries, by header. */
export const HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": [
        "accelerometer=()",
        "autoplay=()",
        "browsing-topics=()",
        "camera=()",
        "display-capture=()",
        "geolocation=()",
        "gyroscope=()",
        "magnetometer=()",
        "microphone=()",
        "midi=()",
        "payment=()",
        "publickey-credentials-get=()",
        "screen-wake-lock=()",
        "serial=()",
        "usb=()",
        "xr-spatial-tracking=()",
    ].join(", "),
    "Content-Security-Policy": "frame-ancestors 'none'",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
};
/**
 * The host's own addresses for a site, which serve the same build before and
 * beside its domain, and which no search engine should list.
 */
const HOST_ADDRESSES = "https://:worker.:subdomain.workers.dev/*";
const rule = (pattern, headers) => [
    pattern,
    ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`),
].join("\n");
/** The `_headers` file every site's build carries. */
export const headersFile = () => `${[
    rule("/*", HEADERS),
    rule(HOST_ADDRESSES, { "X-Robots-Tag": "noindex" }),
].join("\n\n")}\n`;
/**
 * What a built `_headers` file lacks of the headers every page carries: each
 * header missing from its `/*` rule, or set there to another value. A missing
 * file is one violation rather than none.
 */
export function headersViolations(text) {
    if (text === null)
        return [`no ${HEADERS_FILE} file in the build`];
    const block = text.split(/\n\s*\n/).find((one) => one.startsWith("/*\n"));
    const set = new Map((block ?? "")
        .split("\n")
        .slice(1)
        .map((line) => line.trim())
        .filter((line) => line.includes(": "))
        .map((line) => {
        const at = line.indexOf(": ");
        return [line.slice(0, at), line.slice(at + 2)];
    }));
    return Object.entries(HEADERS).flatMap(([name, value]) => {
        const got = set.get(name);
        if (got === undefined)
            return [`${HEADERS_FILE} sends no ${name}`];
        return got === value
            ? []
            : [
                `${HEADERS_FILE} sends ${name}: ${got}, where every page carries ${value}`,
            ];
    });
}
/** Write the `_headers` file at the root of a build. */
export async function writeHeaders(root) {
    await writeFile(join(root, HEADERS_FILE), headersFile());
}
