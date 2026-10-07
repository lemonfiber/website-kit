import { describe, expect, it } from "vitest";

import {
  declaredBranches,
  declaredUrls,
  LOG_FORMAT,
  mirrored,
  moved,
  overdue,
  parseCommits,
  pinnedIn,
  pinnedRevisions,
  report,
  unread,
  watched,
  WINDOW_HOURS,
  WINDOW_SECONDS,
  type Behind,
} from "./pins.ts";

const MODULES = ["vendor/spec", "vendor/lemonfiber", "vendor/lemonfiber/dep"];

const commit = (sha: string, time = 0): Behind["commits"][number] => ({
  sha,
  date: "2026-08-25",
  time,
  subject: `feat: ${sha}`,
});

describe("unread", () => {
  it("names a pinned repository no guarded path sits inside", () => {
    expect(unread(["vendor/spec/README.md"], MODULES)).toEqual([
      "vendor/lemonfiber",
      "vendor/lemonfiber/dep",
    ]);
  });

  it("says nothing where every module is read", () => {
    expect(
      unread(
        ["vendor/spec", "vendor/lemonfiber", "vendor/lemonfiber/dep"],
        MODULES,
      ),
    ).toEqual([]);
  });

  it("names every module where no path is guarded at all", () => {
    expect(unread([], MODULES)).toEqual([
      "vendor/lemonfiber",
      "vendor/lemonfiber/dep",
      "vendor/spec",
    ]);
  });

  it("does not count a module read by a path this repository owns", () => {
    expect(unread(["src/content/docs/api/kinds.md"], ["vendor/spec"])).toEqual([
      "vendor/spec",
    ]);
  });

  /**
   * The state this exists for, in the shape it was found in: the guard reads
   * four of the pinned repositories and is green, and the five it does not read
   * cannot appear in that verdict however far behind they are.
   */
  it("names the repositories a clean run is silent about", () => {
    const modules = [
      "vendor/brand",
      "vendor/homebrew-tap",
      "vendor/lemonfiber",
      "vendor/lemonfiber-web",
      "vendor/org",
      "vendor/sdk-php",
      "vendor/sdk-ts",
      "vendor/spec",
    ];
    const guarded = [
      "vendor/lemonfiber/reference/commands.md",
      "vendor/sdk-ts/src/index.ts",
      "vendor/spec",
    ];

    expect(unread(guarded, modules)).toEqual([
      "vendor/brand",
      "vendor/homebrew-tap",
      "vendor/lemonfiber-web",
      "vendor/org",
      "vendor/sdk-php",
    ]);
  });
});

describe("watched", () => {
  it("puts each path against the module holding it", () => {
    expect(
      watched(["vendor/spec/20-architecture/contracts/web-api.md"], MODULES),
    ).toEqual([
      { module: "vendor/spec", path: "20-architecture/contracts/web-api.md" },
    ]);
  });

  it("reads a module named on its own as its whole tree", () => {
    expect(watched(["vendor/spec"], MODULES)).toEqual([
      { module: "vendor/spec", path: "" },
    ]);
  });

  it("gives a file to the innermost module holding it", () => {
    expect(watched(["vendor/lemonfiber/dep/stack.toml"], MODULES)).toEqual([
      { module: "vendor/lemonfiber/dep", path: "stack.toml" },
    ]);
  });

  it("passes over a path this repository owns", () => {
    expect(
      watched(["mirrors.json", "src/content/docs/api/kinds.md"], MODULES),
    ).toEqual([]);
  });

  it("passes over a vendored path no module holds", () => {
    expect(watched(["vendor/nothing/README.md"], MODULES)).toEqual([]);
  });

  it("orders by path, so a module's sources arrive together", () => {
    expect(
      watched(
        ["vendor/spec/b.md", "vendor/lemonfiber/a.md", "vendor/spec"],
        MODULES,
      ).map((one) => `${one.module}:${one.path}`),
    ).toEqual(["vendor/lemonfiber:a.md", "vendor/spec:", "vendor/spec:b.md"]);
  });
});

describe("pinnedRevisions", () => {
  it("reads the revision and the path git printed", () => {
    const status = [
      " 2875549d2b36c9924807656b253b1b95f2f73e8a vendor/spec (heads/main)",
      "-d0a59a3c0a489a42350a4dd3a1ec827cc622b022 vendor/lemonfiber",
      "not a submodule line",
    ].join("\n");

    expect([...pinnedRevisions(status)]).toEqual([
      ["vendor/spec", "2875549d2b36c9924807656b253b1b95f2f73e8a"],
      ["vendor/lemonfiber", "d0a59a3c0a489a42350a4dd3a1ec827cc622b022"],
    ]);
  });
});

describe("declaredBranches", () => {
  it("maps a module's path to the branch it declares", () => {
    const config = [
      "submodule.spec.path vendor/spec",
      "submodule.spec.url git@example.invalid:spec.git",
      "submodule.spec.branch trunk",
      "submodule.brand.path vendor/brand",
      "nonsense",
    ].join("\n");

    expect([...declaredBranches(config)]).toEqual([
      ["vendor/spec", "trunk"],
      ["vendor/brand", "main"],
    ]);
  });

  it("passes over a module that declares no path", () => {
    expect([...declaredBranches("submodule.spec.branch trunk")]).toEqual([]);
  });
});

describe("declaredUrls", () => {
  it("maps a module's path to the repository it is cloned from", () => {
    const config = [
      "submodule.spec.path vendor/spec",
      "submodule.spec.url http://localhost/lemonfiber/spec.git",
      "submodule.brand.path vendor/brand",
    ].join("\n");

    expect([...declaredUrls(config)]).toEqual([
      ["vendor/spec", "http://localhost/lemonfiber/spec.git"],
    ]);
  });
});

describe("pinnedIn", () => {
  it("reads each gitlink a tree listing holds, and nothing else", () => {
    const sha = "3573c195bde6e8ad3812fdc256ae60f78f267fd3";
    const listing = [
      `160000 commit ${sha}\tvendor/spec`,
      `100644 blob ${sha}\tvendor/README.md`,
      "",
    ].join("\n");

    expect([...pinnedIn(listing)]).toEqual([["vendor/spec", sha]]);
  });
});

describe("moved", () => {
  it("names the modules whose pin differs, in path order", () => {
    const base = new Map([
      ["vendor/spec", "a"],
      ["vendor/brand", "b"],
      ["vendor/lemonfiber", "c"],
    ]);
    const head = new Map([
      ["vendor/spec", "z"],
      ["vendor/brand", "b"],
      ["vendor/lemonfiber", "y"],
    ]);

    expect(moved(base, head)).toEqual(["vendor/lemonfiber", "vendor/spec"]);
  });

  it("names a module the base does not pin at all", () => {
    expect(moved(new Map(), new Map([["vendor/new", "a"]]))).toEqual([
      "vendor/new",
    ]);
  });

  it("names nothing where every pin is the same", () => {
    const pins = new Map([["vendor/spec", "a"]]);
    expect(moved(pins, pins)).toEqual([]);
  });
});

describe("parseCommits", () => {
  it("reads what the log format put in each field", () => {
    expect(
      parseCommits("e6a1eaa\t2026-08-25\t1756108800\tfix(contract): a\tb\n\n"),
    ).toEqual([
      {
        sha: "e6a1eaa",
        date: "2026-08-25",
        time: 1756108800,
        subject: "fix(contract): a\tb",
      },
    ]);
  });

  it("asks git for the four fields it reads, in that order", () => {
    expect(LOG_FORMAT).toBe("--format=%h%x09%cs%x09%ct%x09%s");
  });

  it("passes over a line whose time is not a number", () => {
    expect(parseCommits("e6a1eaa\t2026-08-25\tsoon\tfix: a")).toEqual([]);
  });

  it("finds nothing in an empty log", () => {
    expect(parseCommits("")).toEqual([]);
  });
});

describe("the window", () => {
  it("is a day, in hours and in seconds", () => {
    expect(WINDOW_HOURS).toBe(24);
    expect(WINDOW_SECONDS).toBe(86400);
  });
});

describe("overdue", () => {
  const NOW = 1_000_000;
  const HOUR = 3600;

  it("keeps a commit that has waited longer than the window", () => {
    const behind: Behind[] = [
      {
        module: "vendor/spec",
        pin: "2875549",
        path: "",
        commits: [commit("old", NOW - 2 * HOUR), commit("new", NOW - 60)],
      },
    ];

    expect(overdue(behind, NOW, HOUR)).toEqual([
      { ...behind[0], commits: [commit("old", NOW - 2 * HOUR)] },
    ]);
  });

  it("leaves a commit that has waited exactly the window", () => {
    const behind: Behind[] = [
      {
        module: "vendor/spec",
        pin: "2875549",
        path: "",
        commits: [commit("edge", NOW - HOUR)],
      },
    ];

    expect(overdue(behind, NOW, HOUR)).toEqual([]);
  });

  it("drops a path whose every commit is inside the window", () => {
    const behind: Behind[] = [
      {
        module: "vendor/lemonfiber",
        pin: "d0a59a3",
        path: "reference/commands.md",
        commits: [commit("fresh", NOW - 60)],
      },
      {
        module: "vendor/spec",
        pin: "2875549",
        path: "",
        commits: [commit("stale", NOW - 3 * HOUR)],
      },
    ];

    expect(overdue(behind, NOW, HOUR).map((one) => one.module)).toEqual([
      "vendor/spec",
    ]);
  });
});

describe("report", () => {
  it("heads each module once and names every commit under its path", () => {
    const behind: Behind[] = [
      {
        module: "vendor/lemonfiber",
        pin: "d0a59a3",
        path: "reference/commands.md",
        commits: [commit("b0101f0")],
      },
      {
        module: "vendor/lemonfiber",
        pin: "d0a59a3",
        path: "reference/error-codes.md",
        commits: [commit("77a76fd")],
      },
      {
        module: "vendor/spec",
        pin: "2875549",
        path: "",
        commits: [commit("aaaaaaa")],
      },
    ];

    expect(report(behind)).toBe(
      [
        "vendor/lemonfiber is pinned at d0a59a3",
        "  reference/commands.md",
        "    b0101f0 2026-08-25 feat: b0101f0",
        "  reference/error-codes.md",
        "    77a76fd 2026-08-25 feat: 77a76fd",
        "vendor/spec is pinned at 2875549",
        "  the whole tree",
        "    aaaaaaa 2026-08-25 feat: aaaaaaa",
      ].join("\n"),
    );
  });
});

describe("the trees a mirror renders", () => {
  const manifest = (...entries: unknown[]): string =>
    JSON.stringify({ mirrors: entries });

  it("names a mirrored file inside the repository holding it", () => {
    expect(
      mirrored(manifest({ repo: "lemonfiber", path: "reference/commands.md" })),
    ).toEqual(["vendor/lemonfiber/reference/commands.md"]);
  });

  it("names the whole tree where a mirror takes one", () => {
    expect(mirrored(manifest({ repo: "spec", path: "" }))).toEqual([
      "vendor/spec",
    ]);
  });

  it("names the whole tree where a mirror states no path at all", () => {
    // `path` is optional in the manifest and absent is the same claim as empty:
    // the mirror renders the repository. Read as a path, `undefined` would put
    // the string "undefined" in the middle of one.
    expect(mirrored(manifest({ repo: "org" }))).toEqual(["vendor/org"]);
  });

  it("names each tree once however many routes render it", () => {
    expect(
      mirrored(
        manifest(
          { repo: "org", path: "CONTRIBUTING.md" },
          { repo: "org", path: "CONTRIBUTING.md" },
          { repo: "org", path: "SECURITY.md" },
        ),
      ),
    ).toEqual(["vendor/org/CONTRIBUTING.md", "vendor/org/SECURITY.md"]);
  });

  it("reads nothing out of a manifest it cannot parse", () => {
    expect(mirrored("{ not json")).toEqual([]);
    expect(mirrored(JSON.stringify({}))).toEqual([]);
    expect(mirrored(JSON.stringify({ mirrors: "some" }))).toEqual([]);
  });

  it("passes over an entry naming no repository", () => {
    expect(
      mirrored(manifest({ path: "README.md" }, null, { repo: "" })),
    ).toEqual([]);
  });
});
