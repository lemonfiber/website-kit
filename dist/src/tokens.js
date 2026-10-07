/**
 * The stylesheet against the brand tokens it is drawn with.
 *
 * `src/app.css` defines no colour, radius or step of its own: it renames
 * brand's tokens into what this site calls them, so a value has one home and a
 * gap stays visible. A name it reads that brand does not declare resolves to
 * nothing, and CSS answers that by falling back to the inherited value rather
 * than by failing — the page renders, in the wrong colours, and no build says
 * so.
 *
 * Brand arrives here twice: as the submodule whose `.docs` are rendered at
 * `/develop/brand/`, and as the npm dependency the stylesheet imports. The
 * lockfile guard compares this repository's declaration with what it resolved;
 * it cannot see the submodule, so two pins at different revisions read clean.
 * The two copies are compared here, which is also what makes holding the
 * stylesheet to the vendored copy mean anything.
 *
 * Pure functions over text. Reading the tree is `site.ts`.
 */
import { captured } from "./mirror.js";
/** The tokens the pinned submodule declares. */
export const TOKENS = "vendor/brand/tokens/tokens.css";
/** The tokens the installed package declares, which are the ones that render. */
export const INSTALLED = "node_modules/@lemonfiber/brand/tokens/tokens.css";
/** The stylesheet held to them. */
export const STYLESHEET = "src/app.css";
/** What every brand custom property's name starts with. */
const PREFIX = "--lf-";
/** A character a custom property's name is spelled with. */
const NAME_CHARACTER = /^[a-z0-9-]$/;
/** A character that may stand between a name and its colon. */
const SPACE = /^\s$/;
/** One brand custom property being read, and whether a fallback follows it. */
const READ = /var\(\s*(--lf-[a-z0-9-]+)\s*([,)])/g;
/** A selector that declares a token for every theme. */
const ROOT = ":root";
const at = (where, line, message) => ({ where, line, message });
const listed = (names) => [...new Set(names)].sort((a, b) => a.localeCompare(b)).join(", ");
const lineAt = (text, index) => text.slice(0, index).split("\n").length;
/**
 * The brand token named right before `colon`, or null when none is: the run of
 * name characters ending there, from the first `--lf-` in it on.
 */
function nameBefore(statement, colon) {
    let end = colon;
    while (end > 0 && SPACE.test(statement.charAt(end - 1)))
        end--;
    let start = end;
    while (start > 0 && NAME_CHARACTER.test(statement.charAt(start - 1)))
        start--;
    const run = statement.slice(start, end);
    const prefix = run.indexOf(PREFIX);
    return prefix === -1 || prefix + PREFIX.length === run.length
        ? null
        : run.slice(prefix);
}
/**
 * Each brand token one rule's body declares, with its value: in every
 * statement, the first colon a name stands before, and what follows it.
 *
 * Scanned rather than matched. A pattern for `--lf-name: value` restarts at
 * every `--lf-` in a run of name characters no colon follows, which costs the
 * square of the run's length. Here each colon is visited once, and the name
 * read back from it covers characters no other colon reads.
 */
function declarations(body) {
    const found = [];
    for (const statement of body.split(";")) {
        let colon = statement.indexOf(":");
        while (colon !== -1) {
            const name = nameBefore(statement, colon);
            const value = statement.slice(colon + 1);
            if (name !== null && value !== "") {
                found.push([name, value.trim()]);
                break;
            }
            colon = statement.indexOf(":", colon + 1);
        }
    }
    return found;
}
/** Every brand token a stylesheet declares, and where. */
export function declaredIn(css) {
    const values = new Map();
    const always = new Set();
    const names = new Set();
    // Split rather than matched: a rule is whatever stands before the next `}`,
    // and a pattern for it spends the run of characters in front of every `{`
    // twice over.
    for (const block of css.split("}")) {
        const opened = block.indexOf("{");
        if (opened === -1)
            continue;
        const selector = block.slice(0, opened).trim();
        for (const [name, value] of declarations(block.slice(opened + 1))) {
            values.set(`${name} in ${selector}`, value);
            names.add(name);
            if (selector.includes(ROOT))
                always.add(name);
        }
    }
    return { values, always, names };
}
/** Every place a stylesheet reads a brand token. */
export function readsIn(css) {
    const found = [];
    for (const one of css.matchAll(READ))
        found.push({
            name: captured(one, 1),
            fallback: captured(one, 2) === ",",
            line: lineAt(css, one.index),
        });
    return found;
}
/** What the two copies of brand this repository holds disagree about. */
function copyViolations(vendored, installed) {
    const differs = [];
    for (const [where, value] of vendored.values)
        if (installed.values.get(where) !== value)
            differs.push(where);
    for (const where of installed.values.keys())
        if (!vendored.values.has(where))
            differs.push(where);
    return differs.length === 0
        ? []
        : [
            at(INSTALLED, null, `the submodule and the installed package are not one revision of brand — they disagree about ${listed(differs)}`),
        ];
}
/** What the stylesheet reads that the tokens do not answer. */
function readViolations(brand, css) {
    const reads = readsIn(css);
    if (reads.length === 0)
        return [
            at(STYLESHEET, null, `no brand token is read here — a rename left this watching nothing`),
        ];
    const found = [];
    for (const read of reads) {
        if (!brand.names.has(read.name)) {
            found.push(at(STYLESHEET, read.line, `reads ${read.name}, and ${TOKENS} declares no such token`));
            continue;
        }
        if (!brand.always.has(read.name) && !read.fallback)
            found.push(at(STYLESHEET, read.line, `reads ${read.name} with no fallback, and ${TOKENS} declares it only in a theme`));
        if (brand.always.has(read.name) && read.fallback)
            found.push(at(STYLESHEET, read.line, `gives ${read.name} a fallback, and ${TOKENS} declares it for every theme`));
    }
    return found;
}
/**
 * The stylesheet and the two copies of brand, against each other.
 *
 * An empty set of tokens is a violation rather than a clean run: nothing to
 * compare agrees with everything, and a stylesheet held to no tokens at all is
 * the unchecked stylesheet this replaces.
 */
export function tokenViolations(vendored, installed, css) {
    const pinned = declaredIn(vendored);
    if (pinned.names.size === 0)
        return [
            at(TOKENS, null, "no brand token here — the tokens are missing or unreadable"),
        ];
    const shipped = declaredIn(installed);
    if (shipped.names.size === 0)
        return [
            at(INSTALLED, null, "no brand token here — the package the stylesheet imports is not installed"),
        ];
    return [...copyViolations(pinned, shipped), ...readViolations(pinned, css)];
}
