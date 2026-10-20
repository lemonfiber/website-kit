/** The class the shared stylesheet hides the word from sight with on a narrow screen. */
export declare const SEARCH_LABEL = "lf-search-label";
/**
 * `html` with every search button in it named by its word. Each button is
 * found by scanning forward for its opening and then its closing, so the
 * work grows with the page and no input makes it backtrack.
 */
export declare function namedByItsLabel(html: string): string;
/** Name the search button in every page under `root`; how many pages held one. */
export declare function nameSearch(root: string): Promise<number>;
/** The Astro integration that names the search button in each built page. */
export declare function searchNamedByItsLabel(): {
    name: string;
    hooks: {
        "astro:build:done": ({ dir }: {
            readonly dir: URL;
        }) => Promise<void>;
    };
};
