import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Loader, LoaderContext } from "astro/loaders";

import type { Mirror } from "./mirror.ts";
import {
  byCodePoint,
  crossRoutes,
  mirrorLoader,
  pagesOf,
  pathOf,
  readingOf,
  entriesOf,
} from "./mirror-loader.ts";
import { gitLog, listing, read } from "./mirror-source.ts";

const FORGE = ["https:", "//forge.test/lemonfiber"].join("");

interface Stored {
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly body?: string;
  readonly filePath?: string;
}

/** A loader context that keeps what it was given, and nothing else. */
function recorder(): { context: LoaderContext; stored: Stored[] } {
  const stored: Stored[] = [];
  const context = {
    store: {
      set: (entry: Stored) => {
        stored.push(entry);
      },
    },
    parseData: (props: { data: Record<string, unknown> }) =>
      Promise.resolve(props.data),
    generateDigest: (value: string) => value.slice(0, 8),
    renderMarkdown: (content: string) => Promise.resolve({ html: content }),
  } as unknown as LoaderContext;
  return { context, stored };
}

let root = "";

const tree: Mirror = {
  route: "things",
  repo: "repo",
  path: "docs",
  remote: `${FORGE}/repo`,
  branch: "main",
  label: "the repository",
};

const one: Mirror = {
  route: "front-door.md",
  repo: "repo",
  path: "README.md",
  remote: `${FORGE}/repo`,
  branch: "main",
  label: "the repository",
  title: "The front door",
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "mirror-"));
  const repo = join(root, "vendor", "repo");
  mkdirSync(join(repo, "docs"), { recursive: true });
  writeFileSync(join(repo, "README.md"), "<p>a logo</p>\n\nfront door\n");
  writeFileSync(join(repo, "docs", "README.md"), "# Things\n\nan index\n");
  writeFileSync(
    join(repo, "docs", "one.md"),
    "# One\n\n[two](two.md) and [the door](../README.md)\n",
  );
  writeFileSync(join(repo, "docs", "two.md"), "# Two\n\nthe second\n");
  writeFileSync(join(repo, "docs", "notes.txt"), "not markdown\n");

  const git = (...args: string[]): void => {
    execFileSync("git", ["-C", repo, ...args], { stdio: "ignore" });
  };
  git("init", "--initial-branch", "main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  git("add", ".");
  git("commit", "--no-gpg-sign", "-m", "fixture");

  const content = join(root, "src", "content", "docs");
  mkdirSync(content, { recursive: true });
  symlinkSync("../../../vendor/repo/docs", join(content, "things"));
  symlinkSync("../../../vendor/repo/README.md", join(content, "front-door.md"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("mirror-source", () => {
  it("reads a checkout's revision, its tree and its files", () => {
    const revision = gitLog(join(root, "vendor", "repo"));
    expect(revision.trim().split("\n")).toHaveLength(2);
    expect(listing(join(root, "vendor", "repo", "docs")).sort()).toEqual([
      "README.md",
      "notes.txt",
      "one.md",
      "two.md",
    ]);
    expect(read(join(root, "vendor", "repo", "docs", "two.md"))).toContain(
      "Two",
    );
  });
});

describe("byCodePoint", () => {
  it("orders by code point, so a capital sorts before a lower case", () => {
    expect(byCodePoint("README.md", "one.md")).toBe(-1);
    expect(byCodePoint("one.md", "README.md")).toBe(1);
  });
});

describe("pagesOf and pathOf", () => {
  it("lists a tree's markdown, in order, and finds each file", () => {
    expect(pagesOf(tree, root)).toEqual(["README.md", "one.md", "two.md"]);
    expect(pathOf(tree, root, "one.md")).toBe(
      `${root}/src/content/docs/things/one.md`,
    );
  });

  it("treats a file mirror as one nameless page", () => {
    expect(pagesOf(one, root)).toEqual([""]);
    expect(pathOf(one, root, "")).toBe(
      `${root}/src/content/docs/front-door.md`,
    );
  });
});

describe("crossRoutes", () => {
  it("keys every mirrored file by its address upstream", () => {
    const table = crossRoutes([readingOf(tree, root), readingOf(one, root)]);
    expect(table.get(`${FORGE}/repo|docs/one.md`)).toBe("things/one");
    expect(table.get(`${FORGE}/repo|README.md`)).toBe("front-door");
  });
});

describe("entriesOf", () => {
  it("refuses a page that names itself nowhere", async () => {
    const { context } = recorder();
    const untitled: Mirror = { ...one };
    delete (untitled as { title?: string }).title;
    await expect(
      entriesOf(context, readingOf(untitled, root), root, new Map()),
    ).rejects.toThrow("has no title");
  });
});

describe("mirrorLoader", () => {
  it("stores every page, with its provenance and its links rewritten", async () => {
    const { context, stored } = recorder();
    const loader: Loader = mirrorLoader([tree, one], root);
    await loader.load(context);

    expect(loader.name).toBe("lemonfiber-mirror-loader");
    expect(stored.map((entry) => entry.id)).toEqual([
      "things",
      "things/one",
      "things/two",
      "front-door",
    ]);

    const index = stored[0];
    expect(index?.data["title"]).toBe("Things");
    expect(index?.filePath).toBe("src/content/docs/things/README.md");

    const page = stored[1];
    expect(page?.body).toContain("[two](/things/two/)");
    expect(page?.body).toContain("[the door](/front-door/)");
    expect(page?.data["editUrl"]).toBe(`${FORGE}/repo/edit/main/docs/one.md`);
    expect(page?.data["lastUpdated"]).toBeInstanceOf(Date);

    const provenance = page?.data["mirror"] as {
      source: string;
      label: string;
    };
    expect(provenance.label).toBe("the repository");
    expect(provenance.source).toContain("/blob/");

    const door = stored[3];
    expect(door?.data["title"]).toBe("The front door");
    expect(door?.filePath).toBe("src/content/docs/front-door.md");
  });
});
