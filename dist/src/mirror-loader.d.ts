import type { Loader, LoaderContext } from "astro/loaders";
import { z } from "astro/zod";
import { type Mirror, type Revision } from "./mirror.ts";
/** What the site knows about where a mirrored page came from. */
export interface Provenance {
    readonly repo: string;
    readonly label: string;
    /** The repository that owns the page, as its address on the forge. */
    readonly remote: string;
    /** Where the page's source sits in that repository. */
    readonly path: string;
    readonly revision: string;
    readonly date: string;
    readonly source: string;
}
/**
 * The schema a site's content collection declares `mirror` with, so that a field
 * the loader stamps is one the collection keeps rather than strips.
 */
export declare const provenanceSchema: z.ZodOptional<z.ZodObject<{
    repo: z.ZodString;
    label: z.ZodString;
    remote: z.ZodString;
    path: z.ZodString;
    revision: z.ZodString;
    date: z.ZodString;
    source: z.ZodString;
}, z.core.$strip>>;
/** One mirror, resolved against the checkout. */
export interface Reading {
    readonly mirror: Mirror;
    readonly revision: Revision;
    readonly relatives: readonly string[];
}
/**
 * Sorted the way the paths read, not the way a locale would order them. A
 * directory listing holds each path once, so there is no equal pair to order.
 */
export declare const byCodePoint: (a: string, b: string) => number;
/** The paths a mirror renders, relative to the mirror's own root. */
export declare function pagesOf(mirror: Mirror, root: string): string[];
/** Where a page is filed, relative to the repository root. */
export declare function fileOf(mirror: Mirror, relative: string): string;
/** Where a page's bytes are, through the symlink that declares the mirror. */
export declare function pathOf(mirror: Mirror, root: string, relative: string): string;
/** What this repository pins, and what that revision holds. */
export declare function readingOf(mirror: Mirror, root: string): Reading;
/** Every mirrored file, keyed by its address on its own forge. */
export declare function crossRoutes(readings: readonly Reading[]): Map<string, string>;
/** One page as the content store keeps it. */
type Entry = Parameters<LoaderContext["store"]["set"]>[0];
/**
 * Every page one mirror renders, ready for the store, in the order its files
 * are listed.
 *
 * Rendered all at once and returned rather than stored as each finishes, so the
 * store receives them in the order they were listed whichever finished first.
 */
export declare function entriesOf(context: LoaderContext, reading: Reading, root: string, cross: ReadonlyMap<string, string>): Promise<Entry[]>;
/** The loader itself: every declared mirror, in the order they are declared. */
export declare function mirrorLoader(mirrors: readonly Mirror[], root: string): Loader;
export {};
