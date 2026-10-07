/**
 * The rules for the addresses a built page carries out of this site.
 *
 * Starlight's validator resolves internal links against the route table, so a
 * link that stays here is already checked when the build finishes. Nothing
 * checked the ones that leave, and on this site most of them are generated: a
 * relative link in another repository's prose is rewritten to that repository's
 * file at the revision this site pins, and the address that comes out is a
 * claim about bytes the checkout already holds. These functions read the claim
 * back off the built page and test it against those bytes.
 *
 * Everything here is a pure function over built HTML and a description of the
 * checkouts. Walking `dist/` and asking git what each checkout holds is
 * `run/links.ts`.
 */

import { without } from "./markup.ts";

/** A repository this build rendered from, and the paths its revision holds. */
export interface Checkout {
  /** The repository's web home, without a trailing slash. */
  readonly remote: string;
  /** The revision the site pins, or null where the site pins nothing. */
  readonly revision: string | null;
  /** Every path that revision holds, and every directory above one. */
  readonly paths: ReadonlySet<string>;
}

/** A forge address taken apart: what it reaches for, at which revision. */
export interface Target {
  /** `blob`, `raw`, `edit` or `tree`. */
  readonly kind: string;
  /** The revision or branch the address names. */
  readonly ref: string;
  /** The path within the repository, as written. */
  readonly path: string;
}

/** One address on a page that points into a checkout this build read. */
export interface Address {
  readonly url: string;
  /** The checkout that can answer for it. */
  readonly checkout: Checkout;
  readonly target: Target;
  /** Whether it is shown inside a code example rather than offered as a link. */
  readonly shown: boolean;
}

/** An address that does not resolve, and what is wrong with it. */
export interface Fault {
  /** The page as a reader reaches it. */
  readonly page: string;
  readonly url: string;
  readonly why: string;
}

const PRE = /<pre[\s>][\s\S]*?<\/pre>/g;
const TAG = /<[^<>]*>/g;
const ATTRIBUTE = /\s(?:href|src|srcset)="([^"]*)"/g;
const PINNED = /^[0-9a-f]{40}$/;
const QUERY = /[?#]/;
const PAGE = /(?:index)?\.html$/;
const KINDS = new Set(["blob", "raw", "edit", "tree"]);

/** Where an address written in running text ends. */
const ENDS = new Set([
  " ",
  "\t",
  "\n",
  "\r",
  '"',
  "'",
  "<",
  ">",
  ")",
  "]",
  "`",
  "\\",
  ",",
]);

/** HTML text as a reader sees it. `&amp;` is undone last, never twice. */
export function decoded(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

/** The text of each rendered code example, with its markup taken out. */
export function examples(html: string): string[] {
  const found: string[] = [];
  html.replace(PRE, (block: string): string => {
    found.push(decoded(without(block, TAG)));
    return "";
  });
  return found;
}

/** The page without its code examples: the markup that carries real links. */
export function chrome(html: string): string {
  return html.replace(PRE, "");
}

/** Every `href`, `src` and `srcset` value in the markup. */
export function attributes(html: string): string[] {
  const found: string[] = [];
  html.replace(ATTRIBUTE, (whole: string, value: string): string => {
    found.push(decoded(value));
    return whole;
  });
  return found;
}

/**
 * Every address in a run of text that points at one repository's web home.
 *
 * A `srcset` holds several, and a code example holds them as words rather than
 * as attributes, so both are read the same way.
 */
export function addressesIn(text: string, remote: string): string[] {
  const home = `${remote}/`;
  const found: string[] = [];
  let at = text.indexOf(home);
  while (at !== -1) {
    let end = at + home.length;
    while (end < text.length && !ENDS.has(text.charAt(end))) end++;
    found.push(text.slice(at, end));
    at = text.indexOf(home, end);
  }
  return found;
}

/** A forge address taken apart, or null when it reaches for nothing. */
export function target(url: string, remote: string): Target | null {
  const home = `${remote}/`;
  if (!url.startsWith(home)) return null;
  const rest = url.slice(home.length);

  const afterKind = rest.indexOf("/");
  if (afterKind === -1) return null;
  const kind = rest.slice(0, afterKind);
  if (!KINDS.has(kind)) return null;

  const named = rest.slice(afterKind + 1);
  const afterRef = named.indexOf("/");
  if (afterRef === -1) return null;
  return {
    kind,
    ref: named.slice(0, afterRef),
    path: named.slice(afterRef + 1),
  };
}

/**
 * The path an address names, as a file name: query and fragment cut off, any
 * trailing slash removed, percent escapes undone. Null when the escapes are
 * malformed, which is an address no browser will resolve either.
 */
export function filed(path: string): string | null {
  const at = path.search(QUERY);
  let bare = at === -1 ? path : path.slice(0, at);
  while (bare.endsWith("/")) bare = bare.slice(0, -1);
  try {
    return decodeURIComponent(bare);
  } catch {
    return null;
  }
}

/** What is wrong with one address into a checkout, if anything. */
export function faultOf(checkout: Checkout, aim: Target): string | null {
  const path = filed(aim.path);
  if (path === null) return "the path is not a valid escape sequence";
  if (
    checkout.revision !== null &&
    PINNED.test(aim.ref) &&
    aim.ref !== checkout.revision
  )
    return `stamped ${aim.ref}, which is not the revision this build renders`;
  if (path !== "" && !checkout.paths.has(path))
    return `no ${path} in that repository at ${aim.ref}`;
  return null;
}

/** Every address on a page that points into a checkout this build read. */
export function addresses(
  html: string,
  checkouts: readonly Checkout[],
): Address[] {
  const found: Address[] = [];
  const gather = (text: string, shown: boolean): void => {
    for (const checkout of checkouts)
      for (const url of addressesIn(text, checkout.remote)) {
        const aim = target(url, checkout.remote);
        if (aim !== null) found.push({ url, checkout, target: aim, shown });
      }
  };

  for (const value of attributes(chrome(html))) gather(value, false);
  for (const text of examples(html)) gather(text, true);
  return found;
}

/**
 * The faults among a page's addresses.
 *
 * An address a reader can follow has to resolve. An address inside a code
 * example is a different fault: the example is meant to demonstrate a link,
 * and a rewritten one no longer demonstrates what it was written for. A pinned
 * revision is how such an address is recognised, since it is a revision only
 * this build knows.
 */
export function faults(page: string, found: readonly Address[]): Fault[] {
  const out: Fault[] = [];

  for (const address of found) {
    if (address.shown) {
      if (address.target.ref === address.checkout.revision)
        out.push({
          page,
          url: address.url,
          why: "a rewritten address inside a code example",
        });
      continue;
    }

    const why = faultOf(address.checkout, address.target);
    if (why !== null) out.push({ page, url: address.url, why });
  }
  return out;
}

/** Every path in a git listing, and every directory above one. */
export function held(listing: string): Set<string> {
  const paths = new Set<string>();
  for (const line of listing.split("\n")) {
    const path = line.trim();
    if (path === "") continue;
    paths.add(path);
    let at = path.indexOf("/");
    while (at !== -1) {
      paths.add(path.slice(0, at));
      at = path.indexOf("/", at + 1);
    }
  }
  return paths;
}

/** The route a built file serves: `a/b/index.html` is `/a/b/`. */
export function pageOf(path: string): string {
  return `/${path.replace(PAGE, "")}`;
}

/** The faults, one address per stanza, in the order they were found. */
export function report(found: readonly Fault[]): string {
  return found
    .map((fault) => `  ${fault.page}\n    ${fault.url}\n    ${fault.why}`)
    .join("\n");
}
