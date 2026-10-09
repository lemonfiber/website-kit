/** The directives every page carries, whatever its inline blocks. */
export declare const DIRECTIVES: readonly ["default-src 'self'", "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "media-src 'self'", "worker-src 'self'", "manifest-src 'self'", "object-src 'none'", "frame-src 'none'", "base-uri 'self'", "form-action 'self'", "upgrade-insecure-requests"];
/** What a site adds to the policy. */
export interface PolicyOptions {
    /** Origins a page's script may fetch from, beyond the site itself. */
    readonly connect?: readonly string[];
}
/** The policy for one page, naming the hash of each inline block it holds. */
export declare function policyFor(html: string, options?: PolicyOptions): string;
/**
 * `html` with its policy as the first thing its head declares after the
 * charset, ahead of every block the policy governs. A page with no head is
 * returned as it is.
 */
export declare function withPolicy(html: string, options?: PolicyOptions): string;
/** Write the policy into every page under `root`; how many pages it wrote. */
export declare function applyPolicy(root: string, options?: PolicyOptions): Promise<number>;
/**
 * The Astro integration that writes each built page's policy, and the
 * `_headers` file the host sends with every page. A build served under a
 * sub-path, such as a site's `/next/`, is not the root the host reads that
 * file from, so it is written only for a build at `/`.
 */
export declare function sitePolicy(options?: PolicyOptions): {
    name: string;
    hooks: {
        "astro:config:done": ({ config, }: {
            readonly config: {
                readonly base: string;
            };
        }) => void;
        "astro:build:done": ({ dir }: {
            readonly dir: URL;
        }) => Promise<void>;
    };
};
