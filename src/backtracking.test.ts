/**
 * The parsers read prose other repositories own, so what they cost has to
 * follow the length of that prose rather than its shape. Each input below is
 * one a pattern here once read in quadratic time; a linear pass over any of
 * them costs a fraction of a millisecond.
 */
import { describe, expect, it } from "vitest";

import { chromeProse } from "./guards.ts";
import { chrome, examples } from "./links.ts";
import { declaredIn } from "./tokens.ts";
import { rewriteLinks, type Mirror, type Revision } from "./mirror.ts";

const BUDGET_MS = 500;
const LENGTH = 30_000;

/** Fixtures are assembled, never written out, so the guards do not flag them. */
const FORGE = ["https:", "//forge.test/lemonfiber"].join("");

const mirror: Mirror = {
  route: "spec",
  repo: "spec",
  path: "",
  remote: `${FORGE}/spec`,
  branch: "main",
  label: "lemonfiber/spec",
};

const revision: Revision = {
  sha: "abcdef1234567890",
  date: "2026-08-23T04:20:11+02:00",
};

/** What one read of a body costs, in milliseconds. */
const took = (read: () => unknown): number => {
  const started = performance.now();
  read();
  return performance.now() - started;
};

const written = (body: string): number =>
  took(() =>
    rewriteLinks(body, mirror, revision, "00-overview/roadmap.md", new Map()),
  );

describe("a parse of prose this repository does not own", () => {
  it("strips a run of unclosed tags in step with its length", () => {
    expect(took(() => chromeProse("<".repeat(LENGTH)))).toBeLessThan(BUDGET_MS);
  });

  it("rewrites a run of unclosed link texts in step with its length", () => {
    expect(written("[".repeat(LENGTH))).toBeLessThan(BUDGET_MS);
  });

  it("rewrites a run of unclosed destinations in step with its length", () => {
    expect(written("[](".repeat(LENGTH))).toBeLessThan(BUDGET_MS);
  });

  it("strips a run of unclosed comments and styles in step with its length", () => {
    expect(took(() => chromeProse("<!--".repeat(LENGTH)))).toBeLessThan(
      BUDGET_MS,
    );
    expect(took(() => chromeProse("<style".repeat(LENGTH)))).toBeLessThan(
      BUDGET_MS,
    );
  });

  it("reads a run of unclosed code examples in step with its length", () => {
    const page = "<pre\t".repeat(LENGTH);

    expect(took(() => examples(page))).toBeLessThan(BUDGET_MS);
    expect(took(() => chrome(page))).toBeLessThan(BUDGET_MS);
  });

  it("reads a run of undeclared token names in step with its length", () => {
    expect(
      took(() => declaredIn(`:root{${"--lf-".repeat(LENGTH)}}`)),
    ).toBeLessThan(BUDGET_MS);
  });
});
