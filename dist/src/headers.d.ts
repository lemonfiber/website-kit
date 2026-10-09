/** The file the host reads its header rules from, at the root of the build. */
export declare const HEADERS_FILE = "_headers";
/** What every response carries, by header. */
export declare const HEADERS: Readonly<Record<string, string>>;
/** The `_headers` file every site's build carries. */
export declare const headersFile: () => string;
/**
 * What a built `_headers` file lacks of the headers every page carries: each
 * header missing from its `/*` rule, or set there to another value. A missing
 * file is one violation rather than none.
 */
export declare function headersViolations(text: string | null): string[];
/** Write the `_headers` file at the root of a build. */
export declare function writeHeaders(root: string): Promise<void>;
