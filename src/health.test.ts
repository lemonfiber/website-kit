import { describe, expect, it } from "vitest";

import type { Declared } from "./guards.ts";
import {
  HEALTH,
  healthFiles,
  healthViolations,
  mirroredFromOrg,
  pinsOrg,
} from "./health.ts";

const at = (...paths: string[]): string[] =>
  paths.map((path) => `${HEALTH}/${path}`);

const mirror = (repo: string, path: string): Declared => ({
  route: `contributing/${path.toLowerCase()}`,
  repo,
  path,
});

const PUBLISHED = at(
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "README.md",
);

const MIRRORS = [
  mirror("org", "CODE_OF_CONDUCT.md"),
  mirror("org", "CONTRIBUTING.md"),
  mirror("org", "SECURITY.md"),
  mirror("org", "SUPPORT.md"),
  mirror("lemonfiber", "README.md"),
];

const messages = (
  paths: readonly string[],
  declared: readonly Declared[],
): string[] => healthViolations(paths, declared).map((one) => one.message);

describe("pinsOrg", () => {
  it("finds the org among the submodules", () => {
    const gitmodules = [
      '[submodule "vendor/brand"]',
      "\tpath = vendor/brand",
      '[submodule "vendor/org"]',
      "\tpath = vendor/org",
      "\turl = https://github.com/lemonfiber/.github",
    ].join("\n");
    expect(pinsOrg(gitmodules)).toBe(true);
  });

  it("finds no org where none is pinned, or only named", () => {
    expect(pinsOrg('[submodule "vendor/brand"]\n\tpath = vendor/brand')).toBe(
      false,
    );
    expect(pinsOrg("\turl = vendor/org\n\tpath")).toBe(false);
    expect(pinsOrg("")).toBe(false);
  });
});

describe("healthFiles", () => {
  it("takes the files GitHub serves and passes over the rest", () => {
    expect(healthFiles(PUBLISHED)).toEqual([
      "CODE_OF_CONDUCT.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "SUPPORT.md",
    ]);
  });

  it("reads the other two places GitHub looks", () => {
    expect(
      healthFiles(at(".github/CONTRIBUTING.md", "docs/SECURITY.md")),
    ).toEqual([".github/CONTRIBUTING.md", "docs/SECURITY.md"]);
  });

  it("passes over a path in another vendored repository", () => {
    expect(healthFiles(["vendor/spec/CONTRIBUTING.md"])).toEqual([]);
  });
});

describe("mirroredFromOrg", () => {
  it("takes the path each mirror of the org renders", () => {
    expect(mirroredFromOrg(MIRRORS)).toEqual([
      "CODE_OF_CONDUCT.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "SUPPORT.md",
    ]);
  });
});

describe("healthViolations", () => {
  it("passes an org whose every health file is rendered here", () => {
    expect(healthViolations(PUBLISHED, MIRRORS)).toEqual([]);
  });

  it("refuses an org tree holding none, rather than reading as clean", () => {
    expect(healthViolations(at("README.md"), MIRRORS)).toEqual([
      {
        where: HEALTH,
        line: null,
        message:
          "no community health file here — the org repository is missing or unreadable",
      },
    ]);
  });

  it("refuses a manifest that renders nothing from the org", () => {
    expect(
      healthViolations(PUBLISHED, [mirror("lemonfiber", "README.md")]),
    ).toEqual([
      {
        where: "mirrors.json",
        line: null,
        message:
          "no mirror renders anything from the org — a rename left this watching nothing",
      },
    ]);
  });

  it("names every health file no page here renders", () => {
    expect(
      messages(PUBLISHED, [
        mirror("org", "CONTRIBUTING.md"),
        mirror("org", "SECURITY.md"),
      ]),
    ).toEqual([
      "the org publishes these and no page here renders them: CODE_OF_CONDUCT.md, SUPPORT.md",
    ]);
  });

  it("names every file rendered from the org that it does not publish", () => {
    expect(
      messages(PUBLISHED, [
        ...MIRRORS,
        mirror("org", "GOVERNANCE.md"),
        mirror("org", "FUNDING.md"),
      ]),
    ).toEqual([
      "this site renders these from the org and it publishes no such file: FUNDING.md, GOVERNANCE.md",
    ]);
  });
});
