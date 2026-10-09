/**
 * What a page's layout gets wrong at the width it is shown at, read in the page.
 *
 * Two faults, both of which a reader on a phone meets before anything else:
 *
 * - The page is wider than the screen, so it scrolls sideways as a whole. The
 *   elements reaching past the edge are named, leaving out those inside a box
 *   that scrolls on its own, which is where something wide belongs.
 * - A box scrolls sideways and nothing in it can take focus, so a keyboard
 *   cannot scroll it.
 *
 * `probeLayout` runs in the browser: a site's Playwright suite passes it to
 * `page.evaluate`, which sends the function's source and nothing it closes
 * over, so everything it needs is written inside it. `layoutViolations` turns
 * what it read into the messages a test asserts are absent.
 */
/** Read the page's layout. Self-contained, because it runs in the browser. */
export function probeLayout() {
    const page = globalThis;
    const root = page.document.documentElement;
    const body = page.document.body;
    const width = root.clientWidth;
    const scrolls = (element) => /^(auto|scroll)$/.test(page.getComputedStyle(element).overflowX);
    const clips = (element) => /^(auto|scroll|hidden|clip)$/.test(page.getComputedStyle(element).overflowX);
    const named = (element) => {
        const classes = typeof element.className === "string" && element.className.trim() !== ""
            ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
            : "";
        const id = element.id === "" ? "" : `#${element.id}`;
        return `${element.tagName.toLowerCase()}${id}${classes}`;
    };
    const insideClipping = (element) => {
        for (let up = element.parentElement; up; up = up.parentElement)
            if (up !== body && up !== root && clips(up))
                return true;
        return false;
    };
    const focusable = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    const overflowing = [];
    const unreachable = [];
    for (const element of body.querySelectorAll("*")) {
        const style = page.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden")
            continue;
        const box = element.getBoundingClientRect();
        if (box.width > 0 &&
            box.right > width + 1 &&
            style.position !== "fixed" &&
            !insideClipping(element))
            overflowing.push(`${named(element)} reaches ${String(Math.round(box.right))}px`);
        if (scrolls(element) &&
            element.scrollWidth > element.clientWidth + 1 &&
            element.tabIndex < 0 &&
            element.querySelector(focusable) === null)
            unreachable.push(named(element));
    }
    return { width, scrollWidth: root.scrollWidth, overflowing, unreachable };
}
/** How many offending elements a message names before it summarises. */
const NAMED = 5;
const some = (names) => names.length > NAMED
    ? `${names.slice(0, NAMED).join(", ")} and ${String(names.length - NAMED)} more`
    : names.join(", ");
/** What a probe's report says is wrong with `route`, one message per fault. */
export function layoutViolations(route, report) {
    const found = [];
    if (report.scrollWidth > report.width)
        found.push(`${route} at ${String(report.width)}px is ${String(report.scrollWidth)}px wide and scrolls sideways` +
            (report.overflowing.length > 0 ? `: ${some(report.overflowing)}` : ""));
    if (report.unreachable.length > 0)
        found.push(`${route} at ${String(report.width)}px has a box that scrolls sideways and takes no focus: ${some(report.unreachable)}`);
    return found;
}
