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
export function without(text, pattern, instead = "") {
    if (!pattern.global)
        throw new Error(`${String(pattern)} is not a global pattern, so each pass would take ` +
            "one match and leave the rest behind");
    let held = text;
    for (;;) {
        const next = held.replace(pattern, instead);
        if (next === held)
            return held;
        if (next.length >= held.length)
            throw new Error(`${String(pattern)} replaced with ${JSON.stringify(instead)} does not ` +
                "shorten the text, so removing it again would never settle");
        held = next;
    }
}
/** Where `open` next stands from `from` on with `admits` taking what follows it, or -1. */
function opening(text, open, from, admits) {
    let at = text.indexOf(open, from);
    while (at !== -1 && !admits(text.charAt(at + open.length)))
        at = text.indexOf(open, at + 1);
    return at;
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
export function runs(text, pairs, admits = () => true) {
    const found = [];
    const pending = pairs.map(([open, close]) => ({
        open,
        close,
        at: opening(text, open, 0, admits),
    }));
    let from = 0;
    for (;;) {
        let next;
        for (const pair of pending) {
            if (pair.at !== -1 && pair.at < from)
                pair.at = opening(text, pair.open, from, admits);
            if (pair.at !== -1 && (next === undefined || pair.at < next.at))
                next = pair;
        }
        if (next === undefined)
            return found;
        const closing = text.indexOf(next.close, next.at + next.open.length);
        if (closing === -1) {
            next.at = -1;
            continue;
        }
        from = closing + next.close.length;
        found.push({ start: next.at, end: from });
    }
}
/** `text` with each of `found` replaced by `instead`, in one pass. */
export function cut(text, found, instead = "") {
    let kept = "";
    let from = 0;
    for (const { start, end } of found) {
        kept += text.slice(from, start) + instead;
        from = end;
    }
    return kept + text.slice(from);
}
/**
 * `text` with every delimited run taken out, repeated until none is left, for
 * the reason `without` repeats: a removal joins what stood either side of it.
 * Each pass that finds a run shortens the text, so the passes end.
 */
export function withoutRuns(text, pairs) {
    let held = text;
    for (;;) {
        const found = runs(held, pairs);
        if (found.length === 0)
            return held;
        held = cut(held, found);
    }
}
