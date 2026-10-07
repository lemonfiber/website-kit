export interface PinOptions {
    /** The site's checkout. */
    readonly root: string;
    /**
     * Every path the site's own guards read to hold a page to. The mirrors in
     * `mirrors.json` are added to it here.
     */
    readonly guarded: readonly string[];
}
/** Fetch the pinned repositories and refuse a pin left behind past its window. */
export declare function runPins(options: PinOptions): never;
