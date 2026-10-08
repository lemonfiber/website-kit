/**
 * The stylesheet against the brand tokens it is drawn with.
 *
 * `src/app.css` defines no colour, radius or step of its own: it renames
 * brand's tokens into what this site calls them, so a value has one home and a
 * gap stays visible. A name it reads that brand does not declare resolves to
 * nothing, and CSS answers that by falling back to the inherited value rather
 * than by failing — the page renders, in the wrong colours, and no build says
 * so.
 *
 * Brand arrives here twice: as the submodule whose `.docs` are rendered at
 * `/develop/brand/`, and as the npm dependency the stylesheet imports. The
 * lockfile guard compares this repository's declaration with what it resolved;
 * it cannot see the submodule, so two pins at different revisions read clean.
 * The two copies are compared here, which is also what makes holding the
 * stylesheet to the vendored copy mean anything.
 *
 * Pure functions over text. Reading the tree is `site.ts`.
 */
import type { Violation } from "./guards.ts";
/** The tokens the pinned submodule declares. */
export declare const TOKENS = "vendor/brand/tokens/tokens.css";
/** The tokens the installed package declares, which are the ones that render. */
export declare const INSTALLED = "node_modules/@lemonfiber/brand/tokens/tokens.css";
/** The stylesheet held to them. */
export declare const STYLESHEET = "src/app.css";
/** What a stylesheet declares about the brand's tokens. */
export interface Declared {
    /** Each token's value, under the selector declaring it. */
    readonly values: ReadonlyMap<string, string>;
    /** The names declared at `:root`, which resolve whatever the theme. */
    readonly always: ReadonlySet<string>;
    /** Every name declared, wherever it was declared. */
    readonly names: ReadonlySet<string>;
}
/** One place a stylesheet reads a brand token. */
export interface Read {
    readonly name: string;
    /** Whether the read supplies a value for brand not declaring the name. */
    readonly fallback: boolean;
    readonly line: number;
}
/** Every brand token a stylesheet declares, and where. */
export declare function declaredIn(css: string): Declared;
/** Every place a stylesheet reads a brand token. */
export declare function readsIn(css: string): Read[];
/**
 * The stylesheet and the two copies of brand, against each other.
 *
 * An empty set of tokens is a violation rather than a clean run: nothing to
 * compare agrees with everything, and a stylesheet held to no tokens at all is
 * the unchecked stylesheet this replaces.
 */
export declare function tokenViolations(vendored: string, installed: string, css: string): Violation[];
