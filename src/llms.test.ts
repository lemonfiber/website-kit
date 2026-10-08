import { describe, expect, it } from "vitest";

import { llmsFull, llmsIndex } from "./llms.ts";

const SITE = { name: "lemonfiber", summary: "Run it.", origin: "site.test" };

describe("llmsIndex", () => {
  it("lists each part's pages under its heading, with what each says of itself", () => {
    expect(
      llmsIndex(SITE, [
        {
          label: "Use",
          pages: [
            { route: "/start/", title: "Start", description: "Begin here." },
            { route: "/fix/", title: "Fix" },
            { route: "/run/", title: "Run", description: "" },
          ],
        },
        { label: "Empty", pages: [] },
      ]),
    ).toBe(
      [
        "# lemonfiber",
        "",
        "> Run it.",
        "",
        "## Use",
        "",
        "- [Start](site.test/start/): Begin here.",
        "- [Fix](site.test/fix/)",
        "- [Run](site.test/run/)",
        "",
      ].join("\n"),
    );
  });
});

describe("llmsFull", () => {
  it("sets out every page in full, under its title and address", () => {
    expect(
      llmsFull(SITE, [
        { route: "/start/", title: "Start", body: "\nText.\n\n" },
      ]),
    ).toBe(
      [
        "# lemonfiber",
        "",
        "> Run it.",
        "",
        "## Start",
        "",
        "site.test/start/",
        "",
        "Text.",
        "",
      ].join("\n"),
    );
  });
});
