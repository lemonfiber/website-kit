export interface A11yOptions {
    /** The site's checkout, holding the built site and its Playwright suite. */
    readonly root: string;
}
/** Serve the built site, sweep it with axe, and stop the server. */
export declare function runA11y(options: A11yOptions): Promise<never>;
