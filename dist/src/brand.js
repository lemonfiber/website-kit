/**
 * Brand's logo mark, as a Starlight site's `logo` option takes it.
 *
 * The mark sits beside the site's title rather than replacing it. It is drawn
 * on a transparent ground, so one file serves both themes' navigation bars. The
 * path is brand's package export, which Starlight hands to Vite unchanged, so
 * the file resolves from the site's own `node_modules`.
 */
/** The mark, on either theme's ground. */
export const BRAND_LOGO = {
    src: "@lemonfiber/brand/logo/mark-primary.svg",
    replacesTitle: false,
};
