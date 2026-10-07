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
export function without(text: string, pattern: RegExp, instead = ""): string {
  if (!pattern.global)
    throw new Error(
      `${String(pattern)} is not a global pattern, so each pass would take ` +
        "one match and leave the rest behind",
    );

  let held = text;
  for (;;) {
    const next = held.replace(pattern, instead);
    if (next === held) return held;
    if (next.length >= held.length)
      throw new Error(
        `${String(pattern)} replaced with ${JSON.stringify(instead)} does not ` +
          "shorten the text, so removing it again would never settle",
      );
    held = next;
  }
}
