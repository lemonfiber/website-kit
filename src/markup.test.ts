import { describe, expect, it } from "vitest";

import { cut, runs, without, withoutRuns } from "./markup.ts";

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

describe("runs", () => {
  it("closes each opening at the nearest closing after it", () => {
    expect(runs("a<!--b-->c<!--d-->", [["<!--", "-->"]])).toStrictEqual([
      { start: 1, end: 9 },
      { start: 10, end: 18 },
    ]);
  });

  it("takes the earliest opening of any pair, and only its own closing ends it", () => {
    const pairs = [
      ["<style", "</style>"],
      ["<script", "</script>"],
    ] as const;

    expect(
      runs("<script></style></script><style></style>", pairs),
    ).toStrictEqual([
      { start: 0, end: 25 },
      { start: 25, end: 40 },
    ]);
  });

  it("does not look for a closing inside the opening", () => {
    expect(runs("<!-->", [["<!--", "-->"]])).toStrictEqual([]);
  });

  it("drops a pair that no closing follows, and goes on with the others", () => {
    const pairs = [
      ["(", ")"],
      ["[", "]"],
    ] as const;

    expect(runs("( [x] [y]", pairs)).toStrictEqual([
      { start: 2, end: 5 },
      { start: 6, end: 9 },
    ]);
  });

  it("skips an opening the following character does not admit", () => {
    expect(
      runs("<prefix></pre><pre></pre>", [["<pre", "</pre>"]], (c) => c === ">"),
    ).toStrictEqual([{ start: 14, end: 25 }]);
  });

  it("finds nothing with no pairs to look for", () => {
    expect(runs("anything", [])).toStrictEqual([]);
  });
});

describe("cut", () => {
  it("puts the replacement where each run stood", () => {
    expect(
      cut(
        "a(b)c(d)e",
        [
          { start: 1, end: 4 },
          { start: 5, end: 8 },
        ],
        "-",
      ),
    ).toBe("a-c-e");
  });

  it("leaves text with no runs alone", () => {
    expect(cut("abc", [])).toBe("abc");
  });
});

describe("withoutRuns", () => {
  it("takes out a run the first pass spelled", () => {
    expect(withoutRuns("<!--<!-- -->-->x", [["<!--", "-->"]])).toBe("-->x");
    expect(
      withoutRuns("<scr<script></script>ipt>a</script>b", [
        ["<script", "</script>"],
      ]),
    ).toBe("b");
  });

  it("leaves text holding no run alone", () => {
    expect(withoutRuns("plain", [["<!--", "-->"]])).toBe("plain");
  });
});
