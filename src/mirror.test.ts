import { describe, expect, it } from "vitest";

import {
  attributedPath,
  captured,
  crossRoute,
  crossTable,
  dayOf,
  editUrl,
  frontmatter,
  isFile,
  isIncluded,
  head,
  parseRevision,
  resolvePath,
  rewriteLinks,
  routeOf,
  routeTable,
  shortSha,
  sourceUrl,
  titleOf,
  untitled,
  withoutFrontmatter,
  withoutLeadingHeading,
  type Mirror,
  type Revision,
} from "./mirror.ts";

const FORGE = ["https:", "//forge.test/lemonfiber"].join("");

const tree: Mirror = {
  route: "spec",
  repo: "spec",
  path: "",
  remote: `${FORGE}/spec`,
  branch: "main",
  label: "lemonfiber/spec",
};

const nested: Mirror = {
  ...tree,
  route: "develop/architecture",
  repo: "lemonfiber",
  path: ".docs/architecture",
  remote: `${FORGE}/lemonfiber`,
  index: "00-index",
};

const one: Mirror = {
  ...tree,
  route: "develop/repos/sdk-ts.md",
  repo: "sdk-ts",
  path: "README.md",
  remote: `${FORGE}/sdk-ts`,
  title: "The TypeScript client",
};

const revision: Revision = {
  sha: "abcdef1234567890",
  date: "2026-08-23T04:20:11+02:00",
};

describe("captured and head", () => {
  it("gives a group that did not participate no text", () => {
    const match = /a(b)?(c)/.exec("ac");
    expect(match).not.toBeNull();
    if (match === null) return;
    expect(captured(match, 1)).toBe("");
    expect(captured(match, 2)).toBe("c");
  });

  it("takes the first segment of a path, or the whole of one", () => {
    expect(head("a/b/c")).toBe("a");
    expect(head("a")).toBe("a");
  });
});

describe("isFile", () => {
  it("separates a single file from a tree", () => {
    expect(isFile(one)).toBe(true);
    expect(isFile(tree)).toBe(false);
  });
});

describe("frontmatter", () => {
  it("finds nothing where there is no block", () => {
    expect(frontmatter("# Title\n")).toEqual({});
  });

  it("reads single-line keys and passes over the rest", () => {
    const source = `---\nid: B1\ntitle: "Forms"\nrelates:\n  - B2\n---\n\nbody\n`;
    expect(frontmatter(source)).toEqual({ id: "B1", title: "Forms" });
  });
});

describe("withoutFrontmatter", () => {
  it("removes the block and leaves the body", () => {
    expect(withoutFrontmatter("---\ntitle: A\n---\nbody\n")).toBe("body\n");
    expect(withoutFrontmatter("body\n")).toBe("body\n");
  });
});

describe("titleOf", () => {
  it("prefers the frontmatter title", () => {
    expect(titleOf("---\ntitle: Forms\n---\n\n# B1 — Forms\n")).toBe("Forms");
  });

  it("falls through an empty frontmatter title to the heading", () => {
    expect(titleOf('---\ntitle: ""\n---\n\n# Heading\n')).toBe("Heading");
  });

  it("takes the first heading, without its markup", () => {
    expect(titleOf("# Repo: `spec`\n\nbody")).toBe("Repo: spec");
  });

  it("falls back to what the mirror declared", () => {
    expect(titleOf("<p>logo</p>\n", "Declared")).toBe("Declared");
  });

  it("reports a page that names itself nowhere", () => {
    expect(titleOf("<p>logo</p>\n")).toBeNull();
  });
});

describe("withoutLeadingHeading", () => {
  it("removes the first heading", () => {
    expect(withoutLeadingHeading("# Title\n\nbody\n")).toBe("body\n");
  });

  it("leaves a body that has none", () => {
    expect(withoutLeadingHeading("body\n")).toBe("body\n");
  });
});

describe("resolvePath", () => {
  it("resolves a sibling", () => {
    expect(resolvePath("a/b", "c.md")).toBe("a/b/c.md");
  });

  it("ignores empty and current segments", () => {
    expect(resolvePath("", "./a//b.md")).toBe("a/b.md");
  });

  it("climbs", () => {
    expect(resolvePath("a/b", "../c.md")).toBe("a/c.md");
  });

  it("refuses to climb above the root", () => {
    expect(resolvePath("a", "../../x.md")).toBeNull();
  });
});

describe("routeOf", () => {
  it("gives a file mirror its declared route", () => {
    expect(routeOf(one, "")).toBe("develop/repos/sdk-ts");
  });

  it("collapses a README onto its directory", () => {
    expect(routeOf(tree, "30-repos/README.md")).toBe("spec/30-repos");
    expect(routeOf(tree, "README.md")).toBe("spec");
  });

  it("honours a declared index name", () => {
    expect(routeOf(nested, "00-index.md")).toBe("develop/architecture");
  });

  it("keeps a nested path", () => {
    expect(routeOf(tree, "00-overview/vision.md")).toBe(
      "spec/00-overview/vision",
    );
  });
});

describe("isIncluded", () => {
  it("renders markdown only", () => {
    expect(isIncluded(tree, "10-functional/index.json")).toBe(false);
  });

  it("renders everything when nothing is listed", () => {
    expect(isIncluded(nested, "dispatch.md")).toBe(true);
  });

  it("matches a listed directory or an exact file", () => {
    const some: Mirror = { ...tree, include: ["00-overview", "README.md"] };
    expect(isIncluded(some, "00-overview/vision.md")).toBe(true);
    expect(isIncluded(some, "README.md")).toBe(true);
    expect(isIncluded(some, "40-quality/tooling.md")).toBe(false);
  });
});

describe("untitled", () => {
  it("separates a target from the title beside it", () => {
    expect(untitled("a.md")).toEqual(["a.md", ""]);
    expect(untitled('a.md "A title"')).toEqual(["a.md", ' "A title"']);
  });
});

describe("crossRoute", () => {
  const cross = new Map([
    [`${FORGE}/spec|00-overview/vision.md`, "spec/00-overview/vision"],
  ]);

  it("ignores an address that is not an upstream file", () => {
    expect(crossRoute(`${FORGE}/spec`, cross)).toBeNull();
  });

  it("ignores a file this site does not render", () => {
    expect(crossRoute(`${FORGE}/spec/blob/main/AGENTS.md`, cross)).toBeNull();
  });

  it("brings a known file home, with its fragment", () => {
    expect(
      crossRoute(`${FORGE}/spec/blob/main/00-overview/vision.md`, cross),
    ).toBe("/spec/00-overview/vision/");
    expect(
      crossRoute(`${FORGE}/spec/blob/main/00-overview/vision.md#p1`, cross),
    ).toBe("/spec/00-overview/vision/#p1");
  });

  it("resolves a directory through its README", () => {
    const dirs = new Map([
      [`${FORGE}/spec|30-repos/README.md`, "spec/30-repos"],
    ]);
    expect(crossRoute(`${FORGE}/spec/tree/main/30-repos/`, dirs)).toBe(
      "/spec/30-repos/",
    );
  });
});

describe("rewriteLinks", () => {
  const routes = new Map([
    ["00-overview/vision.md", "spec/00-overview/vision"],
    ["30-repos/README.md", "spec/30-repos"],
  ]);
  const elsewhere = new Map([[`${FORGE}/spec|AGENTS.md`, "meta/agents"]]);
  const at = (body: string, from = "00-overview/roadmap.md"): string =>
    rewriteLinks(body, tree, revision, from, routes);

  it("leaves a link inside a fenced example exactly as it was written", () => {
    const body = [
      "See [a](AGENTS.md).",
      "",
      "```md",
      "[a](AGENTS.md)",
      "```",
    ].join("\n");

    const written = rewriteLinks(body, one, revision, "", new Map());

    // The prose link is rewritten; the one being demonstrated is not.
    expect(written).toContain(`See [a](${FORGE}/`);
    expect(written).toContain("```md\n[a](AGENTS.md)\n```");
  });

  it("takes the rest of the document with an unclosed fence, as a renderer does", () => {
    const body = ["```", "[a](AGENTS.md)"].join("\n");

    expect(rewriteLinks(body, one, revision, "", new Map())).toBe(body);
  });

  it("sends a link out of a mirrored file from beside it, not through it", () => {
    // `one` mirrors a single README, so its `path` is the file itself. Resolving
    // a sibling against it produced `README.md/AGENTS.md`, which 404s upstream.
    const written = rewriteLinks(
      "[a](AGENTS.md)",
      one,
      revision,
      "",
      new Map(),
    );

    expect(written).toContain("/AGENTS.md)");
    expect(written).not.toContain("README.md/");
  });

  it("routes a page's own README link through the directory it indexes", () => {
    const dirs = new Map([["30-repos/README.md", "spec/30-repos"]]);
    expect(rewriteLinks("[a](30-repos/)", tree, revision, "x.md", dirs)).toBe(
      "[a](/spec/30-repos/)",
    );
  });

  it("leaves a link with no target alone, and keeps a title", () => {
    expect(at("[a]()")).toBe("[a]()");
    expect(at('[a](vision.md "Vision")')).toBe(
      '[a](/spec/00-overview/vision/ "Vision")',
    );
  });

  it("keeps an anchor and an unknown absolute link", () => {
    expect(at("[a](#here)")).toBe("[a](#here)");
    expect(at(`[a](${FORGE}/other)`)).toBe(`[a](${FORGE}/other)`);
  });

  it("brings an absolute link to a mirrored file home", () => {
    const cross = new Map([
      [`${FORGE}/spec|00-overview/vision.md`, "spec/00-overview/vision"],
    ]);
    expect(
      rewriteLinks(
        `[a](${FORGE}/spec/blob/main/00-overview/vision.md)`,
        tree,
        revision,
        "x.md",
        routes,
        cross,
      ),
    ).toBe("[a](/spec/00-overview/vision/)");
  });

  it("routes a relative link to a mirrored page, keeping its fragment", () => {
    expect(at("[a](vision.md#p1)")).toBe("[a](/spec/00-overview/vision/#p1)");
  });

  it("routes a directory link through its README", () => {
    expect(at("[a](../30-repos/)")).toBe("[a](/spec/30-repos/)");
  });

  it("sends an unrendered file upstream, at the pinned revision", () => {
    expect(at("[a](index.json)")).toBe(
      `[a](${FORGE}/spec/blob/${revision.sha}/00-overview/index.json)`,
    );
  });

  it("sends an image upstream as raw bytes", () => {
    expect(at("![a](logo.svg)")).toBe(
      `![a](${FORGE}/spec/raw/${revision.sha}/00-overview/logo.svg)`,
    );
  });

  it("keeps a target that climbs out of the repository", () => {
    expect(at("[a](../../outside.md)", "a.md")).toBe(
      `[a](${FORGE}/spec/blob/${revision.sha}/../../outside.md)`,
    );
  });

  it("finds a file another mirror of the same repository renders", () => {
    expect(
      rewriteLinks(
        "[a](../AGENTS.md)",
        tree,
        revision,
        "docs/a.md",
        routes,
        elsewhere,
      ),
    ).toBe("[a](/meta/agents/)");
  });

  it("rewrites the attributes of raw HTML", () => {
    expect(at('<img src="logo.svg">')).toBe(
      `<img src="${FORGE}/spec/raw/${revision.sha}/00-overview/logo.svg">`,
    );
    expect(at('<a href="vision.md">x</a>')).toBe(
      '<a href="/spec/00-overview/vision/">x</a>',
    );
    expect(at('<a href="index.json">x</a>')).toBe(
      `<a href="${FORGE}/spec/blob/${revision.sha}/00-overview/index.json">x</a>`,
    );
  });

  it("leaves an unknown absolute attribute and brings a known one home", () => {
    const cross = new Map([
      [`${FORGE}/spec|00-overview/vision.md`, "spec/00-overview/vision"],
    ]);
    const html = `<a href="${FORGE}/spec/blob/main/00-overview/vision.md">x</a>`;
    expect(rewriteLinks(html, tree, revision, "x.md", routes, cross)).toBe(
      '<a href="/spec/00-overview/vision/">x</a>',
    );
    expect(at(`<a href="${FORGE}/elsewhere">x</a>`)).toBe(
      `<a href="${FORGE}/elsewhere">x</a>`,
    );
  });
});

describe("editUrl", () => {
  it("points at the file on the default branch", () => {
    expect(editUrl(tree, "00-overview/vision.md")).toBe(
      `${FORGE}/spec/edit/main/00-overview/vision.md`,
    );
    expect(editUrl(one, "")).toBe(`${FORGE}/sdk-ts/edit/main/README.md`);
  });
});

describe("sourceUrl", () => {
  it("points at the exact bytes that were rendered", () => {
    expect(sourceUrl(tree, revision, "00-overview/vision.md")).toBe(
      `${FORGE}/spec/blob/${revision.sha}/00-overview/vision.md`,
    );
    expect(sourceUrl(one, revision, "")).toBe(
      `${FORGE}/sdk-ts/blob/${revision.sha}/README.md`,
    );
  });
});

describe("attributedPath", () => {
  it("names the page a renderer is rendering", () => {
    expect(attributedPath("spec/00-overview/vision")).toBe(
      "src/content/docs/spec/00-overview/vision.md",
    );
    expect(attributedPath("")).toBe("src/content/docs/index.md");
  });
});

describe("dayOf and shortSha", () => {
  it("reduce a revision to what a reader needs", () => {
    expect(dayOf(revision.date)).toBe("2026-08-23");
    expect(dayOf("2026-08-23")).toBe("2026-08-23");
    expect(shortSha(revision.sha)).toBe("abcdef1");
  });
});

describe("parseRevision", () => {
  it("reads what git printed", () => {
    expect(parseRevision("abc\n2026-08-23T04:20:11+02:00\n")).toEqual({
      sha: "abc",
      date: "2026-08-23T04:20:11+02:00",
    });
  });

  it("survives output that says less than it should", () => {
    expect(parseRevision("")).toEqual({ sha: "", date: "" });
  });
});

describe("routeTable and crossTable", () => {
  it("key the same routes by path and by upstream address", () => {
    expect([...routeTable(nested, ["dispatch.md"])]).toEqual([
      ["dispatch.md", "develop/architecture/dispatch"],
    ]);
    expect([...crossTable(nested, ["dispatch.md"])]).toEqual([
      [
        `${FORGE}/lemonfiber|.docs/architecture/dispatch.md`,
        "develop/architecture/dispatch",
      ],
    ]);
  });
});
