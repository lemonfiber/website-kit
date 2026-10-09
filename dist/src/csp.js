/**
 * The Content-Security-Policy every page of a built site carries.
 *
 * Everything a page loads comes from the site itself. An inline script or
 * stylesheet runs only if the policy names its hash, so the policy is written
 * per page, after the build, from the page's own inline blocks: Starlight and
 * a site's head add inline scripts that Astro's own policy does not hash, and
 * reading the finished page covers every one of them whoever wrote it.
 *
 * Two allowances beyond `'self'` and those hashes:
 *
 * - `'wasm-unsafe-eval'` lets the search index compile its WebAssembly. It
 *   allows compiling WebAssembly and nothing else; JavaScript `eval` stays off.
 * - `style-src-attr 'unsafe-inline'`: Starlight and its code blocks set custom
 *   properties through `style="…"`, which no hash can cover. A style attribute
 *   cannot run code.
 *
 * The policy is a `<meta>` element, because a static host sets no headers. A
 * meta policy cannot carry `frame-ancestors`, `report-uri` or `sandbox`; those
 * belong in a response header.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { writeHeaders } from "./headers.js";
import { walk } from "./tree.js";
/** The directives every page carries, whatever its inline blocks. */
export const DIRECTIVES = [
    "default-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
];
/** The fixed directives, with a site's extra fetch origins added. */
const directives = (options) => DIRECTIVES.map((one) => one.startsWith("connect-src ")
    ? [one, ...(options.connect ?? [])].join(" ")
    : one);
/**
 * Where the next `<tag` in `lower` from `from` opens that element, or -1. A
 * longer name that starts the same, such as `<scripts` or `<header`, is passed.
 */
function openingAt(lower, tag, from) {
    const open = `<${tag}`;
    let at = lower.indexOf(open, from);
    while (at !== -1) {
        const after = lower.charAt(at + open.length);
        if (after === ">" || /\s/.test(after))
            return at;
        at = lower.indexOf(open, at + open.length);
    }
    return -1;
}
/** Every opening `<tag …>` in `html`, scanned rather than matched. */
function tags(html, tag) {
    const lower = html.toLowerCase();
    const found = [];
    let at = openingAt(lower, tag, 0);
    while (at !== -1) {
        const close = lower.indexOf(">", at);
        if (close === -1)
            break;
        found.push({
            start: at,
            end: close + 1,
            attributes: html.slice(at + tag.length + 1, close),
        });
        at = openingAt(lower, tag, close + 1);
    }
    return found;
}
/** Every `<tag>…</tag>` in `html`, scanned rather than matched. */
function blocks(html, tag) {
    const lower = html.toLowerCase();
    const close = `</${tag}>`;
    const found = [];
    let at = openingAt(lower, tag, 0);
    while (at !== -1) {
        const end = lower.indexOf(">", at);
        const closing = end === -1 ? -1 : lower.indexOf(close, end);
        if (closing === -1)
            break;
        found.push({
            attributes: html.slice(at + tag.length + 1, end),
            content: html.slice(end + 1, closing),
        });
        at = openingAt(lower, tag, closing + close.length);
    }
    return found;
}
/** A block's content as a CSP source expression. */
const hashOf = (content) => `'sha256-${createHash("sha256").update(content).digest("base64")}'`;
/** A script the browser runs, as opposed to one loaded from a file or a data block. */
const runsInline = (block) => !/\bsrc\s*=/i.test(block.attributes) &&
    !/\btype\s*=\s*["']?[^"'\s>]*json/i.test(block.attributes);
/** The policy for one page, naming the hash of each inline block it holds. */
export function policyFor(html, options = {}) {
    const scripts = blocks(html, "script").filter(runsInline);
    const styles = blocks(html, "style");
    const hashes = (found) => [
        ...new Set(found.map((one) => hashOf(one.content))),
    ];
    return [
        ...directives(options),
        ["script-src 'self' 'wasm-unsafe-eval'", ...hashes(scripts)].join(" "),
        ["style-src 'self'", ...hashes(styles)].join(" "),
        "style-src-attr 'unsafe-inline'",
    ].join("; ");
}
/** A policy element already in a page, written by Astro or by an earlier pass. */
const IS_POLICY = /^\s+http-equiv=["']?content-security-policy\b/i;
/** The charset's element, which the policy follows. */
const IS_CHARSET = /^\s+charset=/i;
/** `html` without the policy elements it already holds. */
function withoutPolicy(html) {
    let bare = "";
    let from = 0;
    for (const one of tags(html, "meta")) {
        if (!IS_POLICY.test(one.attributes))
            continue;
        bare += html.slice(from, one.start);
        from = one.end;
    }
    return bare + html.slice(from);
}
/**
 * `html` with its policy as the first thing its head declares after the
 * charset, ahead of every block the policy governs. A page with no head is
 * returned as it is.
 */
export function withPolicy(html, options = {}) {
    const bare = withoutPolicy(html);
    const anchor = tags(bare, "meta").find((one) => IS_CHARSET.test(one.attributes)) ??
        tags(bare, "head")[0];
    if (anchor === undefined)
        return html;
    const { end } = anchor;
    const meta = `<meta http-equiv="content-security-policy" content="${policyFor(bare, options)}">`;
    return `${bare.slice(0, end)}${meta}${bare.slice(end)}`;
}
/** Write the policy into every page under `root`; how many pages it wrote. */
export async function applyPolicy(root, options = {}) {
    const pages = (await walk(root)).files.filter((path) => path.endsWith(".html"));
    await Promise.all(pages.map(async (path) => {
        await writeFile(path, withPolicy(await readFile(path, "utf8"), options));
    }));
    return pages.length;
}
/**
 * The Astro integration that writes each built page's policy, and the
 * `_headers` file the host sends with every page. A build served under a
 * sub-path, such as a site's `/next/`, is not the root the host reads that
 * file from, so it is written only for a build at `/`.
 */
export function sitePolicy(options = {}) {
    let atRoot = true;
    return {
        name: "lemonfiber-site-policy",
        hooks: {
            "astro:config:done": ({ config, }) => {
                atRoot = config.base.replace(/\/+$/, "") === "";
            },
            "astro:build:done": async ({ dir }) => {
                const root = fileURLToPath(dir);
                await applyPolicy(root, options);
                if (atRoot)
                    await writeHeaders(root);
            },
        },
    };
}
