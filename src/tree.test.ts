import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { mirrorStates, relativeTo, repair, textOf, walk } from "./tree.ts";

let root = "";

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "kit-tree-"));
  mkdirSync(join(root, "vendor", "repo", "docs"), { recursive: true });
  writeFileSync(join(root, "vendor", "repo", "docs", "a.md"), "# A\n");
  mkdirSync(join(root, "src", "content", "docs", "deep"), { recursive: true });
  writeFileSync(join(root, "src", "content", "docs", "index.mdx"), "home");
  writeFileSync(join(root, "src", "content", "docs", "deep", "page.md"), "x");
  symlinkSync(
    "../../../vendor/repo/docs",
    join(root, "src", "content", "docs", "things"),
  );
  symlinkSync(
    "../../../vendor/repo/gone.md",
    join(root, "src", "content", "docs", "gone.md"),
  );
  symlinkSync("../vendor/repo/docs", join(root, "src", "elsewhere"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("walk", () => {
  it("finds every file, and the symlinks without following them", async () => {
    const found = await walk(join(root, "src"));
    expect(found.files.map((one) => relativeTo(root, one)).sort()).toEqual([
      "src/content/docs/deep/page.md",
      "src/content/docs/index.mdx",
    ]);
    expect(found.links.map((one) => relativeTo(root, one)).sort()).toEqual([
      "src/content/docs/gone.md",
      "src/content/docs/things",
      "src/elsewhere",
    ]);
  });

  it("finds nothing in a directory that is not there", async () => {
    expect(await walk(join(root, "nowhere"))).toEqual({ files: [], links: [] });
  });
});

describe("mirrorStates", () => {
  it("says where each symlink under the content directory resolves", async () => {
    const { links } = await walk(join(root, "src"));
    const states = await mirrorStates(root, "src/content/docs", links);
    expect([...states].sort((a, b) => a.route.localeCompare(b.route))).toEqual([
      { route: "gone.md", isSymlink: true, exists: true, resolvesTo: null },
      {
        route: "things",
        isSymlink: true,
        exists: true,
        resolvesTo: "vendor/repo/docs",
      },
    ]);
  });
});

describe("textOf", () => {
  it("reads a file", async () => {
    expect(
      await textOf(join(root, "src", "content", "docs", "index.mdx")),
    ).toBe("home");
  });

  it("reads nothing where there is no file", async () => {
    expect(await textOf(join(root, "absent.md"))).toBe("");
  });
});

describe("repair", () => {
  it("writes each correction, last first, and counts them", async () => {
    writeFileSync(join(root, "count.md"), "Two of three and two again.");
    const written = await repair(root, [
      {
        where: "count.md",
        line: 1,
        message: "says Two",
        fix: { path: "count.md", start: 0, end: 3, replacement: "Four" },
      },
      {
        where: "count.md",
        line: 1,
        message: "says two",
        fix: { path: "count.md", start: 17, end: 20, replacement: "four" },
      },
      { where: "count.md", line: 1, message: "no single answer" },
    ]);
    expect(written).toBe(2);
    expect(readFileSync(join(root, "count.md"), "utf8")).toBe(
      "Four of three and four again.",
    );
  });

  it("writes nothing where nothing has a single answer", async () => {
    expect(
      await repair(root, [{ where: "x", line: null, message: "nothing" }]),
    ).toBe(0);
  });
});
