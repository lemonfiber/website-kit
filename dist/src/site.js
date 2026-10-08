/**
 * A site, read the way the guards read it, and every rule the kit holds it to.
 *
 * `readTree` hands back the tree a site's own rules read from, and what the
 * kit's rules found in it. Reporting and exiting is `run/guards.ts`.
 */
import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { collisionViolations, fileViolations, mirrorViolations, routeOf, } from "./guards.js";
import { HEALTH, healthViolations } from "./health.js";
import { lockViolations } from "./lockfile.js";
import { INSTALLED, STYLESHEET, TOKENS, tokenViolations } from "./tokens.js";
import { mirrorStates, relativeTo, textOf, walk } from "./tree.js";
/** Where Starlight keeps a site's pages, relative to its root. */
export const CONTENT = "src/content/docs";
/** Directories whose files a generator writes, and no rule is held to. */
const GENERATED = [`${sep}paraglide${sep}`, `${sep}generated${sep}`];
/** A tree a rule reads that came back empty: every rule over it passed on nothing. */
export const empty = (what) => ({
    where: what,
    line: null,
    message: "holds nothing, so every rule over it passed on nothing",
});
/** Read the tree and every rule the kit holds a site to. */
export async function readTree(root) {
    const content = join(root, CONTENT);
    const code = await walk(join(root, "src"));
    const scripts = await walk(join(root, "scripts"));
    const paths = [...code.files, ...scripts.files].filter((path) => !GENERATED.some((dir) => path.includes(dir)));
    const own = paths.filter((path) => !path.startsWith(content + sep));
    const prose = paths.filter((path) => path.startsWith(content + sep) && /\.(md|mdx)$/.test(path));
    const authored = await Promise.all(own.map(async (path) => ({
        path: relativeTo(root, path),
        text: await readFile(path, "utf8"),
    })));
    const pages = await Promise.all(prose.map(async (path) => ({
        path: relativeTo(root, path),
        text: await readFile(path, "utf8"),
    })));
    const manifest = JSON.parse(await textOf(join(root, "mirrors.json")));
    const declared = manifest.mirrors;
    const state = await mirrorStates(root, CONTENT, code.links);
    const text = (path) => textOf(join(root, path));
    const files = async (path) => (await walk(join(root, path))).files.map((one) => relativeTo(root, one));
    const owned = prose.map((path) => routeOf(relative(content, path).split(sep).join("/")));
    const found = [
        ...authored.flatMap((file) => fileViolations(file)),
        ...mirrorViolations(declared, state),
        ...collisionViolations(owned, declared),
        ...healthViolations(await files(HEALTH), declared),
        ...tokenViolations(await text(TOKENS), await text(INSTALLED), await text(STYLESHEET)),
        ...lockViolations(await text("package.json"), await text("package-lock.json")),
    ];
    if (authored.length === 0)
        found.push(empty("src"));
    if (pages.length === 0)
        found.push(empty(CONTENT));
    return {
        tree: { root, authored, pages, declared, state, text, files },
        found,
    };
}
