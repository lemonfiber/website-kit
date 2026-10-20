import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  namedByItsLabel,
  nameSearch,
  SEARCH_LABEL,
  searchNamedByItsLabel,
} from "./search.ts";

const ICON = `<svg aria-hidden="true" class="astro-b5kgnn7o astro-hkc32dio" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="--sl-icon-size: 1em;"><path d="M21.71 20.29Z"/></svg>`;

const RENDERED = `<button data-open-modal disabled aria-label="Search" aria-keyshortcuts="Control+K" class="astro-b5kgnn7o">${ICON}<span class="sl-hidden md:sl-block astro-b5kgnn7o" aria-hidden="true">Search</span><kbd class="sl-hidden md:sl-flex astro-b5kgnn7o" style="display: none;"><kbd class="astro-b5kgnn7o">Ctrl</kbd><kbd class="astro-b5kgnn7o">K</kbd></kbd></button>`;

const NAMED = `<button data-open-modal disabled aria-keyshortcuts="Control+K" class="astro-b5kgnn7o">${ICON}<span class="${SEARCH_LABEL} astro-b5kgnn7o">Search</span><kbd class="sl-hidden md:sl-flex astro-b5kgnn7o" style="display: none;" aria-hidden="true"><kbd class="astro-b5kgnn7o">Ctrl</kbd><kbd class="astro-b5kgnn7o">K</kbd></kbd></button>`;

const DIALOG = `<dialog style="padding:0" aria-label="Search" class="astro-b5kgnn7o">`;

const SCRIPT = `<script>const openBtn = document.querySelector('button[data-open-modal]');</script>`;

const page = (button: string): string =>
  `<header>${button}${DIALOG}</header>${SCRIPT}`;

describe("namedByItsLabel", () => {
  it("names the button by the word it shows and keeps the shortcut out of the name", () => {
    expect(namedByItsLabel(page(RENDERED))).toBe(page(NAMED));
  });

  it("leaves a button whose attribute only starts with the same name alone", () => {
    const other = `<button data-open-modal-other>Open</button>`;
    expect(namedByItsLabel(page(RENDERED) + other)).toBe(page(NAMED) + other);
  });

  it("fails on a search button that is never closed", () => {
    expect(() => namedByItsLabel(RENDERED.replace("</button>", ""))).toThrow(
      "never closed",
    );
  });

  it("reads a page of unclosed openings in time that grows with the page", () => {
    const hostile = `${"<button data-open-modal\t".repeat(50_000)}</button>`;
    const started = performance.now();
    expect(() => namedByItsLabel(hostile)).toThrow();
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("leaves a page with no search button as it is", () => {
    expect(namedByItsLabel(`${DIALOG}${SCRIPT}`)).toBe(`${DIALOG}${SCRIPT}`);
  });

  it("refuses a button it has named already, which Starlight never renders", () => {
    expect(() => namedByItsLabel(page(NAMED))).toThrow(
      "Starlight's search button no longer matches",
    );
  });

  it.each([
    ["the label", RENDERED.replace(` aria-label="Search"`, "")],
    [
      "the hidden word",
      RENDERED.replace(` aria-hidden="true">Search`, ">Search"),
    ],
    ["the shortcut", RENDERED.replace(`style="display: none;"`, "")],
  ])("fails where Starlight no longer renders %s this way", (_, button) => {
    expect(() => namedByItsLabel(page(button))).toThrow(
      "read it again before it ships",
    );
  });
});

describe("nameSearch and searchNamedByItsLabel", () => {
  let dir = "";
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("names the button in every page under the build, and touches nothing else", async () => {
    dir = await mkdtemp(join(tmpdir(), "search-"));
    await mkdir(join(dir, "a"));
    await writeFile(join(dir, "index.html"), page(RENDERED));
    await writeFile(join(dir, "a", "index.html"), page(RENDERED));
    await writeFile(join(dir, "404.html"), DIALOG);
    await writeFile(join(dir, "a", "data.json"), RENDERED);

    expect(await nameSearch(dir)).toBe(2);
    expect(await readFile(join(dir, "a", "index.html"), "utf8")).toBe(
      page(NAMED),
    );
    expect(await readFile(join(dir, "404.html"), "utf8")).toBe(DIALOG);
    expect(await readFile(join(dir, "a", "data.json"), "utf8")).toBe(RENDERED);

    await writeFile(join(dir, "index.html"), page(RENDERED));
    await writeFile(join(dir, "a", "index.html"), page(RENDERED));
    const integration = searchNamedByItsLabel();
    expect(integration.name).toBe("lemonfiber-search-named-by-its-label");
    await integration.hooks["astro:build:done"]({
      dir: pathToFileURL(`${dir}/`),
    });
    expect(await readFile(join(dir, "index.html"), "utf8")).toBe(page(NAMED));
  });
});
