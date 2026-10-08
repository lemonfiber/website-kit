import { describe, expect, it } from "vitest";

import { scrollableTables, TABLE_REGION, type Element } from "./tables.ts";

const el = (
  tagName: string,
  properties?: Record<string, unknown>,
): Element => ({
  type: "element",
  tagName,
  ...(properties === undefined ? {} : { properties }),
  children: [],
});

describe("scrollableTables", () => {
  it("visits headings and tables, in a plugin of its own name", () => {
    const plugin = scrollableTables({ label: "A table" })();
    expect(plugin.name).toBe("lemonfiber-scrollable-tables");
    expect(plugin.element.filter).toEqual([
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "table",
    ]);
  });

  it("wraps a table in a focusable region named by the last heading with an id", () => {
    const visit = scrollableTables({ label: "A table" })().element.visit;
    const first = el("table");
    expect(visit(first)).toEqual({
      type: "element",
      tagName: "div",
      properties: {
        class: TABLE_REGION,
        role: "region",
        tabindex: "0",
        "aria-label": "A table",
      },
      children: [first],
    });

    expect(visit(el("h2", { id: "codes" }))).toBeUndefined();
    expect(visit(el("h3", { id: "" }))).toBeUndefined();
    expect(visit(el("h3"))).toBeUndefined();
    expect(visit(el("h4", { id: 4 }))).toBeUndefined();
    expect(visit(el("table"))?.properties).toEqual({
      class: TABLE_REGION,
      role: "region",
      tabindex: "0",
      "aria-labelledby": "codes",
    });
  });

  it("starts each document with no heading", () => {
    const factory = scrollableTables({ label: "A table" });
    factory().element.visit(el("h2", { id: "codes" }));
    expect(
      factory().element.visit(el("table"))?.properties?.["aria-label"],
    ).toBe("A table");
  });
});
