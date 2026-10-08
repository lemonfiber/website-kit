export interface LinkOptions {
    /** The site's checkout, holding the built site under `dist/`. */
    readonly root: string;
}
/** Read the built site and refuse an address into a pinned repository that does not hold. */
export declare function runLinks(options: LinkOptions): Promise<never>;
