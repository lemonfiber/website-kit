import { describe, expect, it } from "vitest";

import {
  chromeProse,
  collisionViolations,
  fileViolations,
  format,
  LINE_CAP,
  mirrorViolations,
  routeOf,
  type Declared,
  type MirrorState,
} from "./guards.ts";

const file = (path: string, text: string) => ({ path, text });

/** Fixtures are assembled, never written out, so the guards do not flag them. */
const dash = (...parts: string[]) => parts.join("-");
const SUPPRESS = dash("eslint", "disable");
const ORIGIN = ["https:", "//cdn.example.com/x.js"].join("");
const messages = (found: { message: string }[]) => found.map((v) => v.message);

describe("fileViolations", () => {
  it("passes a file that breaks nothing", () => {
    expect(
      fileViolations(file("src/lib/a.ts", "export const a = 1;\n")),
    ).toEqual([]);
  });

  it("catches an external origin", () => {
    const found = fileViolations(
      file("src/lib/a.ts", `const u = "${ORIGIN}";`),
    );
    expect(messages(found)).toContain("external origin");
    expect(found[0]?.line).toBe(1);
  });

  it("allows loopback origins", () => {
    expect(
      fileViolations(
        file("src/lib/a.ts", 'const u = "http://127.0.0.1:8080";'),
      ),
    ).toEqual([]);
    expect(
      fileViolations(
        file("src/lib/a.ts", 'const u = "http://localhost:3000";'),
      ),
    ).toEqual([]);
  });

  it("allows an external origin inside a comment", () => {
    expect(fileViolations(file("src/lib/a.ts", `// see ${ORIGIN}`))).toEqual(
      [],
    );
  });

  it("catches a lint suppression", () => {
    const found = fileViolations(
      file("src/lib/a.ts", `// ${SUPPRESS}-next-line\n`),
    );
    expect(messages(found)).toContain("lint suppression");
  });

  it("catches every TypeScript escape hatch", () => {
    for (const hatch of [
      dash("@ts", "ignore"),
      dash("@ts", "expect", "error"),
      dash("@ts", "nocheck"),
    ]) {
      const found = fileViolations(file("src/lib/a.ts", `// ${hatch}`));
      expect(messages(found)).toContain("TypeScript escape hatch");
    }
  });

  it("catches reasoning in a comment", () => {
    for (const opener of [
      "// because it is faster",
      "* we chose this",
      "# the reason is clear",
      "<!-- note that this differs -->",
    ]) {
      const found = fileViolations(file("src/lib/a.ts", opener));
      expect(
        found.some((v) => v.message.startsWith("reasoning in a comment")),
      ).toBe(true);
    }
  });

  it("catches a file over the line cap", () => {
    const found = fileViolations(
      file("src/lib/a.ts", "x\n".repeat(LINE_CAP + 1)),
    );
    expect(found.some((v) => v.message.includes("cap is"))).toBe(true);
    expect(found[0]?.line).toBeNull();
  });

  it("exempts a test file from the line cap", () => {
    expect(
      fileViolations(file("src/lib/a.test.ts", "x\n".repeat(LINE_CAP + 1))),
    ).toEqual([]);
  });

  it("catches prose in chrome and reports where", () => {
    const found = fileViolations(
      file(
        "src/components/A.astro",
        "---\nconst x = 1;\n---\n<p>Hello there reader</p>",
      ),
    );
    expect(found.some((v) => v.message.startsWith("prose in the chrome"))).toBe(
      true,
    );
  });

  it("does not treat a non-astro file as chrome", () => {
    expect(fileViolations(file("src/lib/a.ts", "const s = 1;"))).toEqual([]);
  });
});

describe("chromeProse", () => {
  it("ignores markup, comments, styles and expressions", () => {
    expect(
      chromeProse("---\ntitle\n---\n<div><!-- a comment here --></div>"),
    ).toEqual([]);
    expect(chromeProse("<style>body { color: red }</style>")).toEqual([]);
    expect(chromeProse("<script>const a = 1;</script>")).toEqual([]);
    expect(chromeProse("<p>{m.title()}</p>")).toEqual([]);
  });

  it("ignores a single word", () => {
    expect(chromeProse("<p>Hello</p>")).toEqual([]);
  });

  it("finds a real sentence", () => {
    expect(chromeProse("<p>Two words</p>")).toEqual(["Two words"]);
  });
});

describe("mirrorViolations", () => {
  const declared: Declared[] = [
    {
      route: "develop/architecture",
      repo: "lemonfiber",
      path: ".docs/architecture",
    },
  ];
  const good: MirrorState = {
    route: "develop/architecture",
    isSymlink: true,
    exists: true,
    resolvesTo: "vendor/lemonfiber/.docs/architecture",
  };

  it("passes a correctly wired mirror", () => {
    expect(mirrorViolations(declared, [good])).toEqual([]);
  });

  it("passes when nothing is declared and nothing is present", () => {
    expect(mirrorViolations([], [])).toEqual([]);
  });

  it("catches a declared mirror that is missing", () => {
    expect(messages(mirrorViolations(declared, []))).toContain(
      "declared mirror is missing",
    );
    expect(
      messages(mirrorViolations(declared, [{ ...good, exists: false }])),
    ).toContain("declared mirror is missing");
  });

  it("catches a real directory where a mirror belongs", () => {
    const found = mirrorViolations(declared, [{ ...good, isSymlink: false }]);
    expect(found[0]?.message).toBe(
      "a mirror must be a symlink, not a copy — it belongs upstream",
    );
  });

  it("catches a symlink that does not resolve", () => {
    expect(
      messages(mirrorViolations(declared, [{ ...good, resolvesTo: null }])),
    ).toContain("mirror symlink does not resolve");
  });

  it("resolves a mirror of a whole repository to the repository", () => {
    const whole: Declared[] = [{ route: "spec", repo: "spec", path: "" }];
    expect(
      mirrorViolations(whole, [
        {
          route: "spec",
          isSymlink: true,
          exists: true,
          resolvesTo: "vendor/spec",
        },
      ]),
    ).toEqual([]);
  });

  it("catches a mirror pointing somewhere unexpected", () => {
    const found = mirrorViolations(declared, [
      { ...good, resolvesTo: "vendor/other/.docs" },
    ]);
    expect(found[0]?.message).toContain(
      "expected vendor/lemonfiber/.docs/architecture",
    );
  });

  it("catches an undeclared mirror", () => {
    const found = mirrorViolations([], [good]);
    expect(found[0]?.message).toBe(
      "undeclared mirror — declare it in the mirror manifest",
    );
    expect(found[0]?.where).toBe("src/content/docs/develop/architecture");
  });
});

describe("routeOf", () => {
  it("strips the extension", () => {
    expect(routeOf("start/install.md")).toBe("start/install");
    expect(routeOf("start/install.mdx")).toBe("start/install");
  });
  it("collapses an index file onto its directory", () => {
    expect(routeOf("start/index.md")).toBe("start");
    expect(routeOf("index.md")).toBe("");
  });
});

describe("collisionViolations", () => {
  const declared: Declared[] = [
    {
      route: "develop/architecture",
      repo: "lemonfiber",
      path: ".docs/architecture",
    },
  ];

  it("allows an owned page elsewhere", () => {
    expect(collisionViolations(["start/install"], declared)).toEqual([]);
  });

  it("allows a landing page at a tree mirror's own root", () => {
    expect(collisionViolations(["develop/architecture"], declared)).toEqual([]);
  });

  it("catches an owned page beneath a mirrored route", () => {
    const found = collisionViolations(["develop/architecture/ports"], declared);
    expect(found[0]?.message).toContain("one home per fact");
  });

  it("catches an owned page at a file mirror's route", () => {
    const file: Declared[] = [
      { route: "commands/every-command.md", repo: "lemonfiber", path: "x.md" },
    ];
    expect(collisionViolations(["commands/every-command"], file)).toHaveLength(
      1,
    );
    expect(collisionViolations(["commands/index"], file)).toEqual([]);
  });

  it("does not catch a route that merely shares a prefix", () => {
    expect(
      collisionViolations(["develop/architecture-notes"], declared),
    ).toEqual([]);
  });
});

describe("format", () => {
  it("renders a line number when there is one", () => {
    expect(format([{ where: "a.ts", line: 3, message: "bad" }])).toBe(
      "  a.ts:3  bad",
    );
  });
  it("omits the line number when there is none", () => {
    expect(format([{ where: "a.ts", line: null, message: "bad" }])).toBe(
      "  a.ts  bad",
    );
  });
});
