import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyPolicy,
  DIRECTIVES,
  policyFor,
  sitePolicy,
  withPolicy,
} from "./csp.ts";

const hash = (content: string): string =>
  `'sha256-${createHash("sha256").update(content).digest("base64")}'`;

const PAGE = [
  '<!doctype html><html><head><meta charset="utf-8">',
  "<scripts>not a script</scripts>",
  "<script>one()</script>",
  '<SCRIPT type="module">two()</SCRIPT>',
  "<script>one()</script>",
  '<script src="/a.js"></script>',
  '<script type="application/ld+json">{}</script>',
  "<style>a{color:red}</style>",
  '<style media="print">b{}</style>',
  '</head><body style="--x:1"></body></html>',
].join("");

describe("policyFor", () => {
  it("names the hash of every inline script it runs and every inline style", () => {
    const policy = policyFor(PAGE).split("; ");
    expect(policy.slice(0, DIRECTIVES.length)).toEqual([...DIRECTIVES]);
    expect(policy.slice(DIRECTIVES.length)).toEqual([
      `script-src 'self' 'wasm-unsafe-eval' ${hash("one()")} ${hash("two()")}`,
      `style-src 'self' ${hash("a{color:red}")} ${hash("b{}")}`,
      "style-src-attr 'unsafe-inline'",
    ]);
  });

  it("stops at a block that never closes", () => {
    expect(policyFor("<script>open")).toContain(
      "script-src 'self' 'wasm-unsafe-eval'; ",
    );
    expect(policyFor("<script ")).toContain(
      "script-src 'self' 'wasm-unsafe-eval'; ",
    );
  });

  it("lets a page's script fetch from the origins a site names", () => {
    expect(policyFor("", { connect: ["https://api.example"] })).toContain(
      "connect-src 'self' https://api.example;",
    );
    expect(policyFor("")).toContain("connect-src 'self';");
  });

  it("loads from the site itself and nowhere else", () => {
    const sources = DIRECTIVES.flatMap((one) => one.split(" ").slice(1));
    expect(
      sources.filter((one) => !one.startsWith("'") && one !== "data:"),
    ).toEqual([]);
  });
});

describe("withPolicy", () => {
  it("puts the policy after the charset, ahead of every block", () => {
    const out = withPolicy(PAGE);
    expect(out.indexOf('<meta http-equiv="content-security-policy"')).toBe(
      out.indexOf("<meta charset") + '<meta charset="utf-8">'.length,
    );
  });

  it("replaces a policy already there rather than adding a second", () => {
    const once = withPolicy(PAGE);
    const twice = withPolicy(
      once.replace("content-security-policy", "Content-Security-Policy"),
    );
    expect(twice).toBe(once);
    expect(twice.match(/content-security-policy/gi)).toHaveLength(1);
  });

  it("goes first in a head with no charset, and leaves a page with no head alone", () => {
    expect(withPolicy("<head><script>x</script></head>")).toMatch(
      /^<head><meta http-equiv="content-security-policy" content="[^"]+"><script>/,
    );
    expect(withPolicy("<p>fragment</p>")).toBe("<p>fragment</p>");
  });
});

describe("applyPolicy and sitePolicy", () => {
  let dir = "";
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes every page under the build, and nothing else", async () => {
    dir = await mkdtemp(join(tmpdir(), "csp-"));
    await mkdir(join(dir, "a"));
    await writeFile(join(dir, "index.html"), "<head></head>");
    await writeFile(join(dir, "a", "index.html"), "<head></head>");
    await writeFile(join(dir, "a", "data.json"), "<head></head>");

    expect(await applyPolicy(dir)).toBe(2);
    expect(await readFile(join(dir, "a", "index.html"), "utf8")).toContain(
      "content-security-policy",
    );
    expect(await readFile(join(dir, "a", "data.json"), "utf8")).toBe(
      "<head></head>",
    );

    await writeFile(join(dir, "index.html"), "<head></head>");
    const integration = sitePolicy({ connect: ["https://api.example"] });
    expect(integration.name).toBe("lemonfiber-site-policy");
    await integration.hooks["astro:build:done"]({
      dir: pathToFileURL(`${dir}/`),
    });
    expect(await readFile(join(dir, "index.html"), "utf8")).toContain(
      "connect-src 'self' https://api.example;",
    );
  });
});
