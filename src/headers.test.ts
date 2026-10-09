import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  HEADERS,
  HEADERS_FILE,
  headersFile,
  headersViolations,
  writeHeaders,
} from "./headers.ts";

describe("headersFile", () => {
  it("sends every header on every page, and keeps the host's addresses out of search", () => {
    const text = headersFile();
    expect(text.startsWith("/*\n")).toBe(true);
    for (const [name, value] of Object.entries(HEADERS))
      expect(text).toContain(`\n  ${name}: ${value}\n`);
    expect(text).toContain(
      "https://:worker.:subdomain.workers.dev/*\n  X-Robots-Tag: noindex\n",
    );
    expect(text.endsWith("\n")).toBe(true);
  });

  it("says who may frame a page, which a meta policy cannot", () => {
    expect(HEADERS["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
    expect(HEADERS["X-Frame-Options"]).toBe("DENY");
  });
});

describe("headersViolations", () => {
  it("passes the file the kit writes", () => {
    expect(headersViolations(headersFile())).toEqual([]);
  });

  it("names a missing file, a missing header and a changed one", () => {
    expect(headersViolations(null)).toEqual([
      `no ${HEADERS_FILE} file in the build`,
    ]);
    const changed = headersFile()
      .replace("  X-Frame-Options: DENY\n", "")
      .replace("max-age=31536000; includeSubDomains", "max-age=60");
    expect(headersViolations(changed)).toEqual([
      `${HEADERS_FILE} sends Strict-Transport-Security: max-age=60, where every page carries max-age=31536000; includeSubDomains`,
      `${HEADERS_FILE} sends no X-Frame-Options`,
    ]);
  });

  it("reads only the rule for every page, and a file with none sends nothing", () => {
    const elsewhere = "/docs/*\n  X-Frame-Options: DENY\n  not a header\n";
    expect(headersViolations(elsewhere)).toHaveLength(
      Object.keys(HEADERS).length,
    );
  });
});

describe("writeHeaders", () => {
  let dir = "";
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes the file at the root of the build", async () => {
    dir = await mkdtemp(join(tmpdir(), "headers-"));
    await writeHeaders(dir);
    expect(await readFile(join(dir, HEADERS_FILE), "utf8")).toBe(headersFile());
  });
});
