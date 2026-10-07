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
/** HTML text as a reader sees it. `&amp;` is undone last, never twice. */
export declare function decoded(text: string): string;
/** The text of each rendered code example, with its markup taken out. */
export declare function examples(html: string): string[];
/** The page without its code examples: the markup that carries real links. */
export declare function chrome(html: string): string;
/** Every `href`, `src` and `srcset` value in the markup. */
export declare function attributes(html: string): string[];
/**
 * Every address in a run of text that points at one repository's web home.
 *
 * A `srcset` holds several, and a code example holds them as words rather than
 * as attributes, so both are read the same way.
 */
export declare function addressesIn(text: string, remote: string): string[];
/** A forge address taken apart, or null when it reaches for nothing. */
export declare function target(url: string, remote: string): Target | null;
/**
 * The path an address names, as a file name: query and fragment cut off, any
 * trailing slash removed, percent escapes undone. Null when the escapes are
 * malformed, which is an address no browser will resolve either.
 */
export declare function filed(path: string): string | null;
/** What is wrong with one address into a checkout, if anything. */
export declare function faultOf(checkout: Checkout, aim: Target): string | null;
/** Every address on a page that points into a checkout this build read. */
export declare function addresses(html: string, checkouts: readonly Checkout[]): Address[];
/**
 * The faults among a page's addresses.
 *
 * An address a reader can follow has to resolve. An address inside a code
 * example is a different fault: the example is meant to demonstrate a link,
 * and a rewritten one no longer demonstrates what it was written for. A pinned
 * revision is how such an address is recognised, since it is a revision only
 * this build knows.
 */
export declare function faults(page: string, found: readonly Address[]): Fault[];
/** Every path in a git listing, and every directory above one. */
export declare function held(listing: string): Set<string>;
/** The route a built file serves: `a/b/index.html` is `/a/b/`. */
export declare function pageOf(path: string): string;
/** The faults, one address per stanza, in the order they were found. */
export declare function report(found: readonly Fault[]): string;
