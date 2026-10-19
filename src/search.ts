/**
 * Starlight's search button, named by the word it shows.
 *
 * Starlight names the button with an `aria-label` and shows the same word
 * beside the shortcut that opens it. axe's `label-content-name-mismatch`
 * (WCAG 2.5.3, label in name) reads the shortcut as visible text too, and
 * finds it missing from the label. So the label goes, the word the button
 * shows becomes its name, and the shortcut is kept out of the name: it is
 * announced through `aria-keyshortcuts` already.
 *
 * Starlight hides the word on a narrow screen and leaves the icon alone,
 * which would leave the button nameless there; the word is hidden only from
 * sight instead, by the class the shared stylesheet gives it.
 *
 * Astro compiles a component before any plugin sees its template, so the
 * button is rewritten in each built page. A page whose button no longer reads
 * as written here fails the build, rather than shipping it unnamed or
 * misnamed.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { walk } from "./tree.ts";

/** The class the shared stylesheet hides the word from sight with on a narrow screen. */
export const SEARCH_LABEL = "lf-search-label";

const BUTTON = /<button data-open-modal[\s>][\s\S]*?<\/button>/g;

/** Each part of the button as Starlight renders it, and what it becomes. */
const REWRITES: readonly (readonly [RegExp, string])[] = [
  [/^(<button[^>]*?) aria-label="[^"]*"/, "$1"],
  [
    /<span class="sl-hidden md:sl-block((?: [^"]*)?)" aria-hidden="true">/,
    `<span class="${SEARCH_LABEL}$1">`,
  ],
  [
    /<kbd class="sl-hidden md:sl-flex((?: [^"]*)?)" style="display: none;">/,
    `<kbd class="sl-hidden md:sl-flex$1" style="display: none;" aria-hidden="true">`,
  ],
];

/** One search button, named by its word. */
function named(button: string): string {
  let rewritten = button;
  for (const [written, becomes] of REWRITES) {
    if (!written.test(rewritten)) {
      throw new Error(
        `Starlight's search button no longer matches ${String(written)}; read it again before it ships`,
      );
    }
    rewritten = rewritten.replace(written, becomes);
  }
  return rewritten;
}

/** `html` with every search button in it named by its word. */
export function namedByItsLabel(html: string): string {
  return html.replace(BUTTON, named);
}

/** Name the search button in every page under `root`; how many pages held one. */
export async function nameSearch(root: string): Promise<number> {
  const pages = (await walk(root)).files.filter((path) =>
    path.endsWith(".html"),
  );
  const held = await Promise.all(
    pages.map(async (path) => {
      const html = await readFile(path, "utf8");
      const rewritten = namedByItsLabel(html);
      if (rewritten === html) return false;
      await writeFile(path, rewritten);
      return true;
    }),
  );
  return held.filter(Boolean).length;
}

/** The Astro integration that names the search button in each built page. */
export function searchNamedByItsLabel() {
  return {
    name: "lemonfiber-search-named-by-its-label",
    hooks: {
      "astro:build:done": async ({ dir }: { readonly dir: URL }) => {
        await nameSearch(fileURLToPath(dir));
      },
    },
  };
}
