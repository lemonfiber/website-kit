import { describe, expect, it } from "vitest";

import {
  provenanceIndex,
  repositoryOf,
  routeOfEntry,
  type Rendered,
} from "./provenance.ts";

const OWN = { repository: "forge/site", revision: "own-sha" };

describe("routeOfEntry", () => {
  it("serves the index at the root and every other entry under its id", () => {
    expect(routeOfEntry("index")).toBe("/");
    expect(routeOfEntry("api/kinds")).toBe("/api/kinds/");
  });
});

describe("repositoryOf", () => {
  it("reads the address npm's manifest names, either way it is written", () => {
    expect(
      repositoryOf(
        JSON.stringify({
          repository: { type: "git", url: "git+forge/site.git" },
        }),
      ),
    ).toBe("forge/site");
    expect(repositoryOf(JSON.stringify({ repository: "forge/site" }))).toBe(
      "forge/site",
    );
  });

  it("gives nothing where the manifest names no repository", () => {
    expect(repositoryOf("{}")).toBeNull();
    expect(repositoryOf("null")).toBeNull();
    expect(
      repositoryOf(JSON.stringify({ repository: { url: "" } })),
    ).toBeNull();
    expect(repositoryOf("not json")).toBeNull();
  });
});

describe("provenanceIndex", () => {
  it("names the owner, path and revision of every route, in route order", () => {
    const entries: Rendered[] = [
      {
        id: "spec/overview",
        filePath: "src/content/docs/spec/overview.md",
        data: {
          mirror: {
            repo: "spec",
            label: "forge/spec",
            remote: "forge/spec",
            path: "00-overview/README.md",
            revision: "spec-sha",
            date: "2026-10-08",
            source: "forge/spec/blob/spec-sha/00-overview/README.md",
          },
        },
      },
      { id: "index", filePath: "src/content/docs/index.mdx", data: {} },
      { id: "api", data: {} },
    ];

    expect(provenanceIndex(entries, OWN)).toEqual({
      "/": {
        repository: "forge/site",
        path: "src/content/docs/index.mdx",
        revision: "own-sha",
      },
      "/api/": { repository: "forge/site", path: "", revision: "own-sha" },
      "/spec/overview/": {
        repository: "forge/spec",
        path: "00-overview/README.md",
        revision: "spec-sha",
      },
    });
    expect(Object.keys(provenanceIndex(entries, OWN))).toEqual([
      "/",
      "/api/",
      "/spec/overview/",
    ]);
  });
});
