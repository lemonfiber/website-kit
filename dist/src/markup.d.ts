/**
 * Taking markup out of text, so that what is left holds none of it.
 *
 * A single `replace` is one pass over the string, and a removal joins whatever
 * sat either side of it. The join can spell a fresh match: `<!--<!-- -->-->`
 * leaves `<!-- -->` behind, and `<scr<script>ipt>` leaves `<script>`. A
 * function that promises the markup is gone has to keep going until it is.
 */
/**
 * `text` with every match of `pattern` replaced, repeated until nothing changes.
 *
 * Two conditions make the repetition safe to state, and both are refused rather
 * than assumed. `pattern` must be global, or a pass would take one match and
 * leave the rest. And each pass must shorten the text, which bounds the loop by
 * the length of what it was given; a replacement that spells its own pattern
 * would otherwise never settle, and a check that does not return is a check
 * nobody reads a verdict from.
 */
export declare function without(text: string, pattern: RegExp, instead?: string): string;
/** An opening and the closing that ends it, such as `<!--` and `-->`. */
export type Delimiters = readonly [open: string, close: string];
/** Where one delimited run stands: from its opening to just past its closing. */
export interface Run {
    readonly start: number;
    readonly end: number;
}
/**
 * Every delimited run in `text`, in order: the earliest opening of any pair,
 * closed by the nearest closing of that pair after it. `admits` is shown the
 * character after an opening and decides whether it counts, so that `<pre`
 * opens `<pre>` but not `<prefix>`.
 *
 * Found by `indexOf` rather than by a lazy pattern. `<pre[\s\S]*?</pre>`
 * restarts its search for a closing at every opening, and a text of openings
 * that no closing follows costs the square of its length. Here a pair whose
 * opening finds no closing is dropped, since none of its later openings can
 * find one either, and each pair's next opening is looked for once per run.
 */
export declare function runs(text: string, pairs: readonly Delimiters[], admits?: (after: string) => boolean): Run[];
/** `text` with each of `found` replaced by `instead`, in one pass. */
export declare function cut(text: string, found: readonly Run[], instead?: string): string;
/**
 * `text` with every delimited run taken out, repeated until none is left, for
 * the reason `without` repeats: a removal joins what stood either side of it.
 * Each pass that finds a run shortens the text, so the passes end.
 */
export declare function withoutRuns(text: string, pairs: readonly Delimiters[]): string;
