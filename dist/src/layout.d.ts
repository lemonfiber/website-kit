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
/** What the probe read. */
export interface LayoutReport {
    /** The width the page is laid out in. */
    readonly width: number;
    /** How wide the page's content is. */
    readonly scrollWidth: number;
    /** The elements reaching past the right edge outside any scrolling box. */
    readonly overflowing: readonly string[];
    /** The boxes that scroll sideways and hold nothing the keyboard can reach. */
    readonly unreachable: readonly string[];
}
/** Read the page's layout. Self-contained, because it runs in the browser. */
export declare function probeLayout(): LayoutReport;
/** What a probe's report says is wrong with `route`, one message per fault. */
export declare function layoutViolations(route: string, report: LayoutReport): string[];
