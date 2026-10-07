import { describe, expect, it } from "vitest";

import {
  declaredIn,
  INSTALLED,
  readsIn,
  STYLESHEET,
  TOKENS,
  tokenViolations,
} from "./tokens.ts";

const BRAND = [
  ":root {",
  "  --lf-color-ink: #17160F;",
  "  --lf-color-lemon: #F0C419;",
  "  --lf-radius-sm: 3px;",
  "}",
  "",
  '[data-lf-theme="ink"] {',
  "  --lf-color-text: #FBF7EA;",
  "}",
].join("\n");

const CSS = [
  ":root {",
  "  --ink: var(--lf-color-ink);",
  "  --lemon: var(--lf-color-lemon);",
  "  --text: var(--lf-color-text, var(--lf-color-ink));",
  "  --r-sm: var(--lf-radius-sm);",
  "}",
].join("\n");

const violations = (css: string, brand = BRAND, installed = brand): string[] =>
  tokenViolations(brand, installed, css).map(
    (one) => `${one.where}:${String(one.line)} ${one.message}`,
  );

describe("declaredIn", () => {
  it("takes every token, and which of them a theme alone declares", () => {
    const found = declaredIn(BRAND);

    expect([...found.names]).toEqual([
      "--lf-color-ink",
      "--lf-color-lemon",
      "--lf-radius-sm",
      "--lf-color-text",
    ]);
    expect(found.always.has("--lf-color-text")).toBe(false);
    expect(found.values.get("--lf-color-ink in :root")).toBe("#17160F");
  });

  it("finds nothing in a stylesheet declaring no brand token", () => {
    expect(declaredIn("body { color: red; }").names.size).toBe(0);
  });
});

describe("readsIn", () => {
  it("says which reads supply a fallback, and where each one is", () => {
    expect(readsIn(CSS)).toEqual([
      { name: "--lf-color-ink", fallback: false, line: 2 },
      { name: "--lf-color-lemon", fallback: false, line: 3 },
      { name: "--lf-color-text", fallback: true, line: 4 },
      { name: "--lf-color-ink", fallback: false, line: 4 },
      { name: "--lf-radius-sm", fallback: false, line: 5 },
    ]);
  });
});

describe("tokenViolations", () => {
  it("passes a stylesheet reading only what brand declares", () => {
    expect(violations(CSS)).toEqual([]);
  });

  it("refuses tokens that are not there, rather than reading as clean", () => {
    expect(violations(CSS, "body { color: red; }")).toEqual([
      `${TOKENS}:null no brand token here — the tokens are missing or unreadable`,
    ]);
  });

  it("refuses an installed package carrying no tokens", () => {
    expect(violations(CSS, BRAND, "body { color: red; }")).toEqual([
      `${INSTALLED}:null no brand token here — the package the stylesheet imports is not installed`,
    ]);
  });

  it("refuses two copies of brand that are not one revision", () => {
    expect(violations(CSS, BRAND, BRAND.replace("#F0C419", "#F0C41A"))).toEqual(
      [
        `${INSTALLED}:null the submodule and the installed package are not one revision of brand — they disagree about --lf-color-lemon in :root`,
      ],
    );
  });

  it("names every token the two copies disagree about, in order", () => {
    const installed = BRAND.replace(
      "  --lf-radius-sm: 3px;\n",
      "  --lf-radius-md: 4px;\n",
    );

    expect(violations(CSS, BRAND, installed)).toEqual([
      `${INSTALLED}:null the submodule and the installed package are not one revision of brand — they disagree about --lf-radius-md in :root, --lf-radius-sm in :root`,
    ]);
  });

  it("refuses a stylesheet reading a token brand does not declare", () => {
    expect(
      violations(CSS.replace("--lf-color-lemon", "--lf-color-lime")),
    ).toEqual([
      `${STYLESHEET}:3 reads --lf-color-lime, and ${TOKENS} declares no such token`,
    ]);
  });

  it("refuses a theme-only token read with no fallback", () => {
    expect(
      violations(
        CSS.replace(
          "var(--lf-color-text, var(--lf-color-ink))",
          "var(--lf-color-text)",
        ),
      ),
    ).toEqual([
      `${STYLESHEET}:4 reads --lf-color-text with no fallback, and ${TOKENS} declares it only in a theme`,
    ]);
  });

  it("refuses a fallback for a token every theme declares", () => {
    expect(
      violations(
        CSS.replace("var(--lf-color-lemon)", "var(--lf-color-lemon, gold)"),
      ),
    ).toEqual([
      `${STYLESHEET}:3 gives --lf-color-lemon a fallback, and ${TOKENS} declares it for every theme`,
    ]);
  });

  it("refuses a stylesheet that reads no brand token at all", () => {
    expect(violations("body { color: red; }")).toEqual([
      `${STYLESHEET}:null no brand token is read here — a rename left this watching nothing`,
    ]);
  });
});
