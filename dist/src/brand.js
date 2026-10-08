/**
 * Brand's logo mark, as a Starlight site's `logo` option takes it.
 *
 * The mark sits beside the site's title rather than replacing it, so the header
 * reads as brand's horizontal lockup. Each theme gets the mark drawn for its
 * ground. The paths are brand's package exports, which Starlight hands to Vite
 * unchanged, so the files resolve from the site's own `node_modules`.
 */
/** The mark on paper, and the mark on ink. */
export const BRAND_LOGO = {
    light: "@lemonfiber/brand/logo/mark-primary.svg",
    dark: "@lemonfiber/brand/logo/mark-primary-on-ink.svg",
    replacesTitle: false,
};
