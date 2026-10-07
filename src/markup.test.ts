import { describe, expect, it } from "vitest";

import { without } from "./markup.ts";

describe("without", () => {
  it("takes out every match", () => {
    expect(without("a<b>c<d>e", /<[^<>]*>/g)).toBe("ace");
  });

  it("leaves text holding no match alone", () => {
    expect(without("plain text", /<[^<>]*>/g)).toBe("plain text");
  });

  it("takes out what the first pass spelled", () => {
    expect(without("<a<b>c>text", /<[^<>]*>/g)).toBe("text");
  });

  it("takes out a comment the first pass spelled", () => {
    expect(without("<!<!-- -->-- -->text", /<!--[\s\S]*?-->/g)).toBe("text");
  });

  it("puts the replacement in each time", () => {
    expect(without("a<b>c", /<[^<>]*>/g, "\n")).toBe("a\nc");
  });

  it("refuses a pattern that is not global", () => {
    expect(() => without("a<b>c<d>e", /<[^<>]*>/)).toThrow(
      "is not a global pattern",
    );
  });

  it("refuses a replacement that spells its own pattern", () => {
    expect(() => without("ab", /a/g, "aa")).toThrow("never settle");
  });
});
