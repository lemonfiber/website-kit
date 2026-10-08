import { describe, expect, it } from "vitest";

import {
  BRANCH,
  BRANCH_PREFIX,
  LISTED,
  NAMED,
  SAID,
  armArgs,
  bodyOf,
  comparisonOf,
  gitDependencies,
  installSpec,
  messageOf,
  nameOf,
  occupied,
  sortPulls,
  titleOf,
  type Batch,
  type Held,
  type Listed,
  type Take,
} from "./bump.ts";

const FROM = "3573c195bde6e8ad3812fdc256ae60f78f267fd3";
const TO = "f738351b7f1e272f1a9724b56f3a3662873a96f0";

const CITATION = "Spec: REPO-R46, Q-R68";

const commit = (sha: string): Take["commits"][number] => ({
  sha,
  date: "2026-10-06",
  time: 0,
  subject: `docs: ${sha} (closes #1)`,
});

const take = (over: Partial<Take> = {}): Take => ({
  kind: "submodule",
  module: "vendor/spec",
  url: "http://localhost/lemonfiber/spec.git",
  from: FROM,
  to: TO,
  commits: [commit("f738351")],
  ...over,
});

const held = (over: Partial<Held> = {}): Held => ({
  ...take({ module: "vendor/lemonfiber" }),
  url: "http://localhost/lemonfiber/lemonfiber.git",
  said: [
    "guards: 1 violation(s)",
    "  kinds.md  has these and the page does not: alert",
  ],
  ...over,
});

const batch = (over: Partial<Batch> = {}): Batch => ({
  takes: [take()],
  held: [],
  rewritten: [],
  citation: CITATION,
  ...over,
});

describe("where the pins' pull request lives", () => {
  it("names a module by the repository it holds", () => {
    expect(nameOf("vendor/lemonfiber-media-stack")).toBe(
      "lemonfiber-media-stack",
    );
  });

  it("opens one pull request, from one branch on the prefix", () => {
    expect(BRANCH).toBe(`${BRANCH_PREFIX}all`);
  });

  it("points at the forge's comparison of the two revisions", () => {
    expect(comparisonOf(take())).toBe(
      `http://localhost/lemonfiber/spec/compare/${FROM}...${TO}`,
    );
  });

  it("reads a url declared without the .git suffix the same way", () => {
    expect(
      comparisonOf(take({ url: "http://localhost/lemonfiber/spec" })),
    ).toBe(`http://localhost/lemonfiber/spec/compare/${FROM}...${TO}`);
  });
});

describe("the title", () => {
  const named = (...modules: string[]): string =>
    titleOf(batch({ takes: modules.map((module) => take({ module })) }));

  it("names one pin", () => {
    expect(named("vendor/spec")).toBe("docs(pins): take spec");
  });

  it("names two with an and", () => {
    expect(named("vendor/spec", "vendor/brand")).toBe(
      "docs(pins): take spec and brand",
    );
  });

  it("names as many as it names, in reading order", () => {
    const modules = Array.from(
      { length: NAMED },
      (_, index) => `vendor/r${String(index)}`,
    );
    expect(named(...modules)).toBe("docs(pins): take r0, r1 and r2");
  });

  it("counts them past that", () => {
    const modules = Array.from(
      { length: NAMED + 1 },
      (_, index) => `vendor/r${String(index)}`,
    );
    expect(named(...modules)).toBe(
      `docs(pins): take ${String(NAMED + 1)} pins`,
    );
  });
});

describe("the commit message", () => {
  it("names each move, its comparison and the citation", () => {
    expect(messageOf(batch())).toBe(
      [
        "docs(pins): take spec",
        "",
        "vendor/spec 3573c19..f738351, 1 commit",
        `http://localhost/lemonfiber/spec/compare/${FROM}...${TO}`,
        "",
        "`npm run guard -- --fix` rewrote nothing.",
        "",
        CITATION,
        "",
      ].join("\n"),
    );
  });

  it("lists every file the fixer rewrote", () => {
    const message = messageOf(
      batch({
        takes: [take({ commits: [commit("a"), commit("b")] })],
        rewritten: ["README.md", "src/content/docs/spec.mdx"],
      }),
    );

    expect(message).toContain("2 commits");
    expect(message).toContain(
      "`npm run guard -- --fix` rewrote:\n\n  README.md\n  src/content/docs/spec.mdx\n",
    );
  });

  it("carries no subject another repository wrote, and no held pin", () => {
    const message = messageOf(batch({ held: [held()] }));
    expect(message).not.toContain("closes #1");
    expect(message).not.toContain("vendor/lemonfiber");
  });
});

describe("the pull request body", () => {
  it("names each commit inside a fenced block", () => {
    const body = bodyOf(batch());

    expect(body).toContain(
      "```text\nf738351 2026-10-06 docs: f738351 (closes #1)\n```",
    );
    expect(body).not.toContain("more, on the comparison");
  });

  it("points at the comparison for what it does not list", () => {
    const commits = Array.from({ length: LISTED + 3 }, (_, index) =>
      commit(String(index)),
    );
    const body = bodyOf(batch({ takes: [take({ commits })] }));

    expect(body).toContain(`${String(LISTED - 1)} 2026-10-06`);
    expect(body).not.toContain(`\n${String(LISTED)} 2026-10-06`);
    expect(body).toContain("And 3 more, on the comparison.");
    expect(body).toContain(`[${String(LISTED + 3)} commits](`);
  });

  it("says nothing of held pins where none is held", () => {
    expect(bodyOf(batch())).not.toContain("leaves them where they are");
  });

  it("names a held pin with what the guards said, fenced", () => {
    const body = bodyOf(batch({ held: [held()] }));
    expect(body).toContain("**`vendor/lemonfiber`** stays at `3573c19`");
    expect(body).toContain(
      "```text\nguards: 1 violation(s)\n  kinds.md  has these and the page does not: alert\n```",
    );
    expect(body).toContain("`git submodule update --remote <module>`");
    expect(body).not.toContain("more lines");
  });

  it("cuts what the guards said short where it runs long", () => {
    const said = Array.from(
      { length: SAID + 2 },
      (_, index) => `line ${String(index)}`,
    );
    const body = bodyOf(batch({ held: [held({ said })] }));
    expect(body).toContain(`line ${String(SAID - 1)}\n`);
    expect(body).not.toContain(`line ${String(SAID)}\n`);
    expect(body).toContain("And 2 more lines.");
  });

  it("ends on the citation", () => {
    expect(bodyOf(batch()).endsWith(CITATION)).toBe(true);
  });
});

describe("which pull requests are bump-pins' own", () => {
  const OWNER = {
    repository: "lemonfiber",
    author: "app/lemonfiber-release-train",
  };
  const listed = (over: Partial<Listed> = {}): Listed => ({
    number: 1,
    headRefName: "pins/spec",
    isCrossRepository: false,
    headRepositoryOwner: { login: "lemonfiber" },
    author: { login: "app/lemonfiber-release-train" },
    autoMergeRequest: null,
    ...over,
  });

  it("takes one the app opened from a branch here", () => {
    const { own, foreign } = sortPulls(
      [listed({ autoMergeRequest: { enabledAt: "now" } })],
      OWNER,
    );

    expect([...own]).toEqual([["pins/spec", { number: 1, armed: true }]]);
    expect(foreign).toEqual([]);
  });

  it("leaves a fork's pull request on the prefix alone", () => {
    const { own, foreign } = sortPulls(
      [
        listed({
          number: 7,
          isCrossRepository: true,
          headRepositoryOwner: { login: "somebody" },
        }),
      ],
      OWNER,
    );

    expect(own.size).toBe(0);
    expect(foreign).toEqual([{ number: 7, branch: "pins/spec", here: false }]);
  });

  it("leaves a fork that claims to be cross-repository by owner alone", () => {
    const { own } = sortPulls(
      [listed({ headRepositoryOwner: { login: "somebody" } })],
      OWNER,
    );
    expect(own.size).toBe(0);
  });

  it("leaves a person's pull request on a branch here alone", () => {
    const { own, foreign } = sortPulls(
      [listed({ number: 8, author: { login: "lessevv" } })],
      OWNER,
    );

    expect(own.size).toBe(0);
    expect(foreign).toEqual([{ number: 8, branch: "pins/spec", here: true }]);
  });

  it("leaves one with no author or head owner alone", () => {
    const { own } = sortPulls(
      [listed({ author: null }), listed({ headRepositoryOwner: null })],
      OWNER,
    );
    expect(own.size).toBe(0);
  });

  it("passes over a pull request off the prefix", () => {
    const { own, foreign } = sortPulls(
      [listed({ headRefName: "docs/something", author: { login: "x" } })],
      OWNER,
    );
    expect(own.size).toBe(0);
    expect(foreign).toEqual([]);
  });
});

describe("a branch somebody else's pull request is on", () => {
  it("is occupied by a pull request from this repository", () => {
    expect(
      occupied("pins/spec", [{ number: 8, branch: "pins/spec", here: true }]),
    ).toBe(true);
  });

  it("is not occupied by a fork's pull request of the same name", () => {
    expect(
      occupied("pins/spec", [{ number: 7, branch: "pins/spec", here: false }]),
    ).toBe(false);
  });

  it("is not occupied by one on another branch on the prefix", () => {
    expect(
      occupied("pins/spec", [{ number: 8, branch: "pins/brand", here: true }]),
    ).toBe(false);
  });
});

describe("setting a pull request to merge itself", () => {
  it("holds the merge to the commit this run wrote", () => {
    expect(armArgs(12, "lemonfiber/site", TO)).toEqual([
      "pr",
      "merge",
      "12",
      "--repo",
      "lemonfiber/site",
      "--auto",
      "--squash",
      "--match-head-commit",
      TO,
    ]);
  });
});

describe("the dependencies a site takes by commit", () => {
  const SHA = "21b8d507bf5a394f24fedc08f10a954abc3e2549";
  const KIT = "a542489404d4cfee7d0ae6d8220f804675fd9f7b";

  it("names each one taken from the forge at a commit, in name order", () => {
    const manifest = JSON.stringify({
      dependencies: {
        "@lemonfiber/website-kit": `github:lemonfiber/website-kit#${KIT}`,
      },
      devDependencies: {
        "@lemonfiber/brand": `github:lemonfiber/brand#${SHA}`,
        prettier: "^3.9.9",
        floating: "github:somebody/floating",
        short: "github:somebody/short#abc1234",
        odd: 3,
      },
    });
    expect(gitDependencies(manifest)).toEqual([
      {
        name: "@lemonfiber/brand",
        owner: "lemonfiber",
        repo: "brand",
        sha: SHA,
      },
      {
        name: "@lemonfiber/website-kit",
        owner: "lemonfiber",
        repo: "website-kit",
        sha: KIT,
      },
    ]);
  });

  it("reads nothing out of a manifest it cannot parse or that lists none", () => {
    expect(gitDependencies("{")).toEqual([]);
    expect(gitDependencies("null")).toEqual([]);
    expect(gitDependencies(JSON.stringify({ dependencies: "x" }))).toEqual([]);
  });

  it("tells npm to take one at the commit named", () => {
    expect(
      installSpec(
        {
          name: "@lemonfiber/brand",
          owner: "lemonfiber",
          repo: "brand",
          sha: SHA,
        },
        KIT,
      ),
    ).toBe(`@lemonfiber/brand@github:lemonfiber/brand#${KIT}`);
  });

  it("names a package move by the package, and links its comparison", () => {
    const move = take({
      kind: "package",
      module: "@lemonfiber/website-kit",
      url: "http://localhost/lemonfiber/website-kit",
    });
    expect(titleOf(batch({ takes: [move] }))).toBe(
      "docs(pins): take website-kit",
    );
    expect(bodyOf(batch({ takes: [move] }))).toContain(
      "**`@lemonfiber/website-kit`** from `3573c19` to `f738351`",
    );
  });
});
