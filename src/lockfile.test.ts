import { describe, expect, it } from "vitest";

import {
  lockViolations,
  pinnedDependencies,
  resolvedRevisions,
  revisionIn,
  sameRevision,
} from "./lockfile.ts";

const SHA = "21b8d507bf5a394f24fedc08f10a954abc3e2549";
const OTHER = "a542489404d4cfee7d0ae6d8220f804675fd9f7b";

const manifest = (spec: string): string =>
  JSON.stringify({
    dependencies: { "@lemonfiber/brand": spec },
    devDependencies: { prettier: "^3.9.6" },
  });

const lock = (resolved: string): string =>
  JSON.stringify({
    packages: {
      "": { dependencies: { "@lemonfiber/brand": `github:x#${SHA}` } },
      "node_modules/@lemonfiber/brand": { resolved },
      "node_modules/prettier": { resolved: "registry:prettier-3.9.6.tgz" },
    },
  });

describe("revisionIn", () => {
  it("takes the revision a spec ends with", () => {
    expect(revisionIn(`github:lemonfiber/brand#${SHA}`)).toBe(SHA);
  });

  it("finds none where a spec names a range", () => {
    expect(revisionIn("^3.9.6")).toBeNull();
  });
});

describe("sameRevision", () => {
  it("accepts a full revision against the abbreviation of itself", () => {
    expect(sameRevision(SHA, SHA.slice(0, 7))).toBe(true);
    expect(sameRevision(SHA.slice(0, 7), SHA)).toBe(true);
  });

  it("refuses two different revisions", () => {
    expect(sameRevision(SHA, OTHER)).toBe(false);
  });
});

describe("pinnedDependencies", () => {
  it("takes only the dependencies naming an exact revision", () => {
    expect([...pinnedDependencies(manifest(`github:l/brand#${SHA}`))]).toEqual([
      ["@lemonfiber/brand", SHA],
    ]);
  });

  it("finds none in a manifest that cannot be read", () => {
    expect([...pinnedDependencies("{ not json")]).toEqual([]);
  });
});

describe("resolvedRevisions", () => {
  it("takes the revision each installed package resolved to", () => {
    expect([
      ...resolvedRevisions(lock(`git+ssh://x/brand.git#${SHA}`)),
    ]).toEqual([["@lemonfiber/brand", SHA]]);
  });
});

describe("lockViolations", () => {
  it("passes a lockfile naming the revision its declaration names", () => {
    expect(
      lockViolations(
        manifest(`github:l/brand#${SHA}`),
        lock(`git+ssh://x/brand.git#${SHA}`),
      ),
    ).toEqual([]);
  });

  it("refuses a lockfile naming a different revision", () => {
    expect(
      lockViolations(
        manifest(`github:l/brand#${OTHER}`),
        lock(`git+ssh://x/brand.git#${SHA}`),
      ),
    ).toEqual([
      {
        where: "package-lock.json",
        line: null,
        message: `@lemonfiber/brand is declared at ${OTHER} and the lockfile resolved ${SHA}`,
      },
    ]);
  });

  it("refuses a pinned dependency the lockfile resolves nothing for", () => {
    expect(
      lockViolations(manifest(`github:l/brand#${SHA}`), '{"packages":{}}'),
    ).toEqual([
      {
        where: "package-lock.json",
        line: null,
        message: `@lemonfiber/brand is declared at ${SHA} and nothing resolves it`,
      },
    ]);
  });

  it("refuses a manifest that pins nothing, rather than reading as clean", () => {
    expect(lockViolations("{}", lock(`git+ssh://x/brand.git#${SHA}`))).toEqual([
      {
        where: "package.json",
        line: null,
        message:
          "no dependency names an exact revision — a rename left this watching nothing",
      },
    ]);
  });
});
