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

import { walk } from "./tree.ts";

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
] as const;

/** What a site adds to the policy. */
export interface PolicyOptions {
  /** Origins a page's script may fetch from, beyond the site itself. */
  readonly connect?: readonly string[];
}

/** The fixed directives, with a site's extra fetch origins added. */
const directives = (options: PolicyOptions): string[] =>
  DIRECTIVES.map((one) =>
    one.startsWith("connect-src ")
      ? [one, ...(options.connect ?? [])].join(" ")
      : one,
  );

/** One inline block of a page: its opening tag's attributes and its content. */
interface Block {
  readonly attributes: string;
  readonly content: string;
}

/** Every `<tag>…</tag>` in `html`, scanned rather than matched. */
function blocks(html: string, tag: string): Block[] {
  const lower = html.toLowerCase();
  const open = `<${tag}`;
  const close = `</${tag}>`;
  const found: Block[] = [];
  let at = lower.indexOf(open);
  while (at !== -1) {
    const after = lower.charAt(at + open.length);
    if (after !== ">" && !/\s/.test(after)) {
      at = lower.indexOf(open, at + open.length);
      continue;
    }
    const end = lower.indexOf(">", at);
    const closing = end === -1 ? -1 : lower.indexOf(close, end);
    if (closing === -1) break;
    found.push({
      attributes: html.slice(at + open.length, end),
      content: html.slice(end + 1, closing),
    });
    at = lower.indexOf(open, closing + close.length);
  }
  return found;
}

/** A block's content as a CSP source expression. */
const hashOf = (content: string): string =>
  `'sha256-${createHash("sha256").update(content).digest("base64")}'`;

/** A script the browser runs, as opposed to one loaded from a file or a data block. */
const runsInline = (block: Block): boolean =>
  !/\bsrc\s*=/i.test(block.attributes) &&
  !/\btype\s*=\s*["']?[^"'\s>]*json/i.test(block.attributes);

/** The policy for one page, naming the hash of each inline block it holds. */
export function policyFor(html: string, options: PolicyOptions = {}): string {
  const scripts = blocks(html, "script").filter(runsInline);
  const styles = blocks(html, "style");
  const hashes = (found: Block[]): string[] => [
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
const EXISTING = /<meta\s+http-equiv=["']?content-security-policy["']?[^>]*>/gi;

/** Where the policy goes: after the charset, or else first in the head. */
const CHARSET = /<meta\s+charset=[^>]*>/i;
const HEAD = /<head(?:\s[^>]*)?>/i;

/**
 * `html` with its policy as the first thing its head declares after the
 * charset, ahead of every block the policy governs. A page with no head is
 * returned as it is.
 */
export function withPolicy(html: string, options: PolicyOptions = {}): string {
  const bare = html.replace(EXISTING, "");
  const anchor = CHARSET.exec(bare) ?? HEAD.exec(bare);
  if (anchor === null) return html;
  const end = anchor.index + anchor[0].length;
  const meta = `<meta http-equiv="content-security-policy" content="${policyFor(bare, options)}">`;
  return `${bare.slice(0, end)}${meta}${bare.slice(end)}`;
}

/** Write the policy into every page under `root`; how many pages it wrote. */
export async function applyPolicy(
  root: string,
  options: PolicyOptions = {},
): Promise<number> {
  const pages = (await walk(root)).files.filter((path) =>
    path.endsWith(".html"),
  );
  await Promise.all(
    pages.map(async (path) => {
      await writeFile(path, withPolicy(await readFile(path, "utf8"), options));
    }),
  );
  return pages.length;
}

/** The Astro integration that writes each built page's policy. */
export function sitePolicy(options: PolicyOptions = {}) {
  return {
    name: "lemonfiber-site-policy",
    hooks: {
      "astro:build:done": async ({ dir }: { readonly dir: URL }) => {
        await applyPolicy(fileURLToPath(dir), options);
      },
    },
  };
}
