import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CONTENT, empty, readTree } from "./site.ts";
import { INSTALLED, STYLESHEET, TOKENS } from "./tokens.ts";

const SHA = "21b8d507bf5a394f24fedc08f10a954abc3e2549";
const BRAND = ":root {\n  --lf-color-ink: #17160F;\n}\n";

const roots: string[] = [];

/** A site on disk, built from the files named, each relative to its root. */
function site(
  files: Record<string, string>,
  links: Record<string, string> = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "kit-site-"));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  for (const [path, target] of Object.entries(links)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    symlinkSync(target, join(root, path));
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

/** Everything a clean site carries: a page, a mirror, the brand twice and a pinned lock. */
const clean = (): Record<string, string> => ({
  "mirrors.json": JSON.stringify({
    mirrors: [
      { route: "things", repo: "repo", path: "docs" },
      { route: "conduct.md", repo: "org", path: "CODE_OF_CONDUCT.md" },
    ],
  }),
  [`${CONTENT}/index.mdx`]: "A page of the site's own.",
  "src/lib/thing.ts": "export const thing = 1;\n",
  "scripts/run.ts": "export {};\n",
  "src/paraglide/messages.js": "generated, and not held to any rule",
  "vendor/repo/docs/a.md": "# A\n",
  "vendor/org/CODE_OF_CONDUCT.md": "# Conduct\n",
  [TOKENS]: BRAND,
  [INSTALLED]: BRAND,
  [STYLESHEET]: ":root { --ink: var(--lf-color-ink); }\n",
  "package.json": JSON.stringify({
    dependencies: { "@lemonfiber/brand": `github:lemonfiber/brand#${SHA}` },
  }),
  "package-lock.json": JSON.stringify({
    packages: {
      "node_modules/@lemonfiber/brand": {
        resolved: `git+ssh://git@github.com/lemonfiber/brand.git#${SHA}`,
      },
    },
  }),
});

const mirrored = {
  [`${CONTENT}/things`]: "../../../vendor/repo/docs",
  [`${CONTENT}/conduct.md`]: "../../../vendor/org/CODE_OF_CONDUCT.md",
};

describe("readTree", () => {
  it("finds nothing wrong with a site that keeps every rule", async () => {
    const { tree, found } = await readTree(site(clean(), mirrored));
    expect(found).toEqual([]);
    expect(tree.authored.map((one) => one.path).sort()).toEqual([
      "scripts/run.ts",
      "src/app.css",
      "src/lib/thing.ts",
    ]);
    expect(tree.pages.map((one) => one.path)).toEqual([`${CONTENT}/index.mdx`]);
    expect(tree.state.map((one) => one.resolvesTo).sort()).toEqual([
      "vendor/org/CODE_OF_CONDUCT.md",
      "vendor/repo/docs",
    ]);
    expect(await tree.text("vendor/repo/docs/a.md")).toBe("# A\n");
    expect(await tree.files("vendor/repo")).toEqual(["vendor/repo/docs/a.md"]);
  });

  it("refuses a tree with no code and no pages, which every rule would pass", async () => {
    const gone = new Set([
      `${CONTENT}/index.mdx`,
      "src/lib/thing.ts",
      "scripts/run.ts",
      STYLESHEET,
    ]);
    const files = Object.fromEntries(
      Object.entries(clean()).filter(([path]) => !gone.has(path)),
    );
    const { found } = await readTree(site(files, mirrored));
    expect(found.slice(-2)).toEqual([empty("src"), empty(CONTENT)]);
  });

  it("holds the site's own code, its mirrors and its pages to the rules", async () => {
    const files = {
      ...clean(),
      "src/lib/thing.ts": "// @ts-ignore\nexport const thing = 1;\n",
      [`${CONTENT}/conduct/index.md`]: "a page where a mirror serves",
    };
    const { found } = await readTree(site(files, mirrored));
    expect(found.map((one) => one.message)).toEqual([
      "TypeScript escape hatch",
      "slug collides with the org mirror — one home per fact",
    ]);
  });

  it("names a symlink the manifest does not declare", async () => {
    const files = clean();
    files["mirrors.json"] = JSON.stringify({
      mirrors: [
        { route: "conduct.md", repo: "org", path: "CODE_OF_CONDUCT.md" },
      ],
    });
    const { found } = await readTree(site(files, mirrored));
    expect(found.map((one) => one.message)).toEqual([
      "undeclared mirror — declare it in the mirror manifest",
    ]);
  });
});
