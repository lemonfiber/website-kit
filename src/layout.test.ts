import { afterEach, describe, expect, it } from "vitest";

import { layoutViolations, probeLayout, type LayoutReport } from "./layout.ts";

interface Fake {
  tagName: string;
  id: string;
  className: unknown;
  parentElement: Fake | null;
  scrollWidth: number;
  clientWidth: number;
  tabIndex: number;
  right: number;
  width: number;
  style: Partial<
    Record<"overflowX" | "position" | "visibility" | "display", string>
  >;
  focusableInside: boolean;
}

const element = (parts: Partial<Fake>): Fake => ({
  tagName: "DIV",
  id: "",
  className: "",
  parentElement: null,
  scrollWidth: 100,
  clientWidth: 100,
  tabIndex: -1,
  right: 100,
  width: 100,
  style: {},
  focusableInside: false,
  ...parts,
});

const install = (
  rootWidth: number,
  rootScroll: number,
  elements: Fake[],
  body: Fake,
  root: Fake,
): void => {
  root.clientWidth = rootWidth;
  root.scrollWidth = rootScroll;
  const asProbed = (fake: Fake) => ({
    ...fake,
    getBoundingClientRect: () => ({ right: fake.right, width: fake.width }),
    querySelector: () => (fake.focusableInside ? {} : null),
  });
  const probedBody = Object.assign(body, asProbed(body), {
    querySelectorAll: () =>
      elements.map((one) => Object.assign(one, asProbed(one))),
  });
  Object.assign(globalThis, {
    document: { documentElement: root, body: probedBody },
    getComputedStyle: (one: Fake) => ({
      overflowX: "visible",
      position: "static",
      visibility: "visible",
      display: "block",
      ...one.style,
    }),
  });
};

afterEach(() => {
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "getComputedStyle");
});

describe("probeLayout", () => {
  it("names what reaches past the edge, outside any box that clips", () => {
    const root = element({ tagName: "HTML" });
    const body = element({
      tagName: "BODY",
      parentElement: root,
      style: { overflowX: "hidden" },
    });
    const wide = element({
      tagName: "H2",
      id: "x",
      className: "a b c",
      parentElement: body,
      right: 527.4,
    });
    const scroller = element({
      className: "lf-table",
      parentElement: body,
      style: { overflowX: "auto" },
      scrollWidth: 600,
      clientWidth: 375,
      tabIndex: 0,
    });
    const inScroller = element({
      tagName: "TD",
      parentElement: scroller,
      right: 600,
    });
    const clipped = element({
      parentElement: element({
        parentElement: body,
        style: { overflowX: "clip" },
      }),
      right: 900,
    });
    const fixed = element({ right: 500, style: { position: "fixed" } });
    const hidden = element({ right: 500, style: { visibility: "hidden" } });
    const gone = element({ right: 500, style: { display: "none" } });
    const empty = element({ right: 500, width: 0 });
    const spaced = element({ tagName: "P", className: "   ", right: 376 });
    const odd = element({
      tagName: "svg",
      className: { baseVal: "" },
      right: 377,
    });
    install(
      375,
      527,
      [
        wide,
        scroller,
        inScroller,
        clipped,
        fixed,
        hidden,
        gone,
        empty,
        spaced,
        odd,
      ],
      body,
      root,
    );

    expect(probeLayout()).toEqual({
      width: 375,
      scrollWidth: 527,
      overflowing: ["h2#x.a.b reaches 527px", "svg reaches 377px"],
      unreachable: [],
    });
  });

  it("names a box that scrolls sideways and holds nothing focusable", () => {
    const root = element({ tagName: "HTML" });
    const body = element({ tagName: "BODY", parentElement: root });
    const bare = element({
      tagName: "TABLE",
      style: { overflowX: "auto" },
      scrollWidth: 700,
      clientWidth: 375,
    });
    const focusable = element({
      style: { overflowX: "scroll" },
      scrollWidth: 700,
      clientWidth: 375,
      tabIndex: 0,
    });
    const holding = element({
      style: { overflowX: "auto" },
      scrollWidth: 700,
      clientWidth: 375,
      focusableInside: true,
    });
    const fits = element({
      style: { overflowX: "auto" },
      scrollWidth: 376,
      clientWidth: 375,
    });
    const hides = element({
      style: { overflowX: "hidden" },
      scrollWidth: 700,
      clientWidth: 375,
    });
    install(375, 375, [bare, focusable, holding, fits, hides], body, root);

    expect(probeLayout().unreachable).toEqual(["table"]);
  });
});

describe("layoutViolations", () => {
  const report = (parts: Partial<LayoutReport>): LayoutReport => ({
    width: 375,
    scrollWidth: 375,
    overflowing: [],
    unreachable: [],
    ...parts,
  });

  it("passes a page that fits and whose scrolling boxes take focus", () => {
    expect(layoutViolations("/", report({}))).toEqual([]);
  });

  it("names the page's width and what reaches past the edge", () => {
    expect(
      layoutViolations(
        "/a/",
        report({ scrollWidth: 527, overflowing: ["h2 reaches 527px"] }),
      ),
    ).toEqual([
      "/a/ at 375px is 527px wide and scrolls sideways: h2 reaches 527px",
    ]);
    expect(layoutViolations("/a/", report({ scrollWidth: 400 }))).toEqual([
      "/a/ at 375px is 400px wide and scrolls sideways",
    ]);
  });

  it("names the boxes the keyboard cannot scroll, five and then a count", () => {
    const seven = ["a", "b", "c", "d", "e", "f", "g"];
    expect(layoutViolations("/b/", report({ unreachable: seven }))).toEqual([
      "/b/ at 375px has a box that scrolls sideways and takes no focus: a, b, c, d, e and 2 more",
    ]);
    expect(
      layoutViolations("/b/", report({ unreachable: seven.slice(0, 5) })),
    ).toEqual([
      "/b/ at 375px has a box that scrolls sideways and takes no focus: a, b, c, d, e",
    ]);
    expect(layoutViolations("/b/", report({ unreachable: ["table"] }))).toEqual(
      [
        "/b/ at 375px has a box that scrolls sideways and takes no focus: table",
      ],
    );
  });
});
