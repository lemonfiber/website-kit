/** The class the shared stylesheet hides the word from sight with on a narrow screen. */
export declare const SEARCH_LABEL = "lf-search-label";
/** `html` with every search button in it named by its word. */
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
