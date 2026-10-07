/**
 * Where the site's Playwright config reads the origin to sweep, as its
 * `baseURL`. The port is free when chosen rather than fixed, because a fixed
 * one may already answer with another checkout's preview, which would be swept
 * in this site's place and pass or fail on pages this site does not serve.
 */
export declare const ORIGIN_VARIABLE = "LEMONFIBER_A11Y_ORIGIN";
export interface A11yOptions {
    /** The site's checkout, holding the built site and its Playwright suite. */
    readonly root: string;
}
/** Serve the built site, sweep it with axe, and stop the server. */
export declare function runA11y(options: A11yOptions): Promise<never>;
