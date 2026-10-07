import { describe, expect, it } from "vitest";

import {
  addresses,
  addressesIn,
  attributes,
  chrome,
  decoded,
  examples,
  faultOf,
  faults,
  filed,
  held,
  pageOf,
  report,
  target,
  type Address,
  type Checkout,
} from "./links.ts";

const FORGE = ["https:", "//forge.test/lemonfiber"].join("");
const PIN = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "89abcdef0123456789abcdef0123456789abcdef";

const brand: Checkout = {
  remote: `${FORGE}/brand`,
  revision: PIN,
  paths: held("README.md\nAGENTS.md\nassets/logo/mark.svg\n"),
};

const site: Checkout = {
  remote: `${FORGE}/website-docs`,
  revision: null,
  paths: held("src/content/docs/start/install.md\n"),
};

const linked = (url: string): string => `<a href="${url}">go</a>`;

describe("decoded", () => {
  it("undoes the entities a built page carries", () => {
    expect(decoded("a&lt;b&gt;c&quot;d&#39;e&#x27;f&amp;g")).toBe(
      `a<b>c"d'e'f&g`,
    );
  });

  it("undoes an escaped ampersand once, not twice", () => {
    expect(decoded("&amp;lt;")).toBe("&lt;");
  });
});

describe("examples and chrome", () => {
  const page = `<p>before</p><pre class="x"><code>in <b>here</b></code></pre><p>after</p>`;

  it("reads the text of each code example", () => {
    expect(examples(page)).toStrictEqual(["in here"]);
  });

  it("finds none where there is no example", () => {
    expect(examples("<p>plain</p>")).toStrictEqual([]);
  });

  it("leaves the page without its examples", () => {
    expect(chrome(page)).toBe("<p>before</p><p>after</p>");
  });
});

describe("attributes", () => {
  it("reads every address-bearing attribute", () => {
    const page = `<a href="one">x</a><img src="two" srcset="three"><p class="four">y</p>`;
    expect(attributes(page)).toStrictEqual(["one", "two", "three"]);
  });

  it("decodes what it reads", () => {
    expect(attributes(`<a href="a&amp;b">x</a>`)).toStrictEqual(["a&b"]);
  });
});

describe("addressesIn", () => {
  it("stops each address at the first character that ends one", () => {
    const text = `<a href="${FORGE}/brand/one">, ${FORGE}/brand/two`;
    expect(addressesIn(text, `${FORGE}/brand`)).toStrictEqual([
      `${FORGE}/brand/one`,
      `${FORGE}/brand/two`,
    ]);
  });

  it("finds none where the home never appears", () => {
    expect(addressesIn("nothing here", `${FORGE}/brand`)).toStrictEqual([]);
  });

  it("does not take one repository's home for another's prefix", () => {
    expect(
      addressesIn(`${FORGE}/brand-tokens/README.md`, `${FORGE}/brand`),
    ).toStrictEqual([]);
  });
});

describe("target", () => {
  it("takes a blob address apart", () => {
    expect(
      target(`${FORGE}/brand/blob/${PIN}/a/b.md`, `${FORGE}/brand`),
    ).toStrictEqual({ kind: "blob", ref: PIN, path: "a/b.md" });
  });

  it("ignores an address into another repository", () => {
    expect(
      target(`${FORGE}/other/blob/${PIN}/a.md`, `${FORGE}/brand`),
    ).toBeNull();
  });

  it("ignores the repository's own home page", () => {
    expect(target(`${FORGE}/brand/releases`, `${FORGE}/brand`)).toBeNull();
  });

  it("ignores a part of the forge that is not a file", () => {
    expect(
      target(`${FORGE}/brand/releases/tag/v1`, `${FORGE}/brand`),
    ).toBeNull();
  });

  it("ignores a reference with no path after it", () => {
    expect(target(`${FORGE}/brand/blob/${PIN}`, `${FORGE}/brand`)).toBeNull();
  });
});

describe("filed", () => {
  it("takes the path as written", () => {
    expect(filed("a/b.md")).toBe("a/b.md");
  });

  it("cuts a query or a fragment off", () => {
    expect(filed("a/b.md#top")).toBe("a/b.md");
    expect(filed("a/b.md?plain=1")).toBe("a/b.md");
  });

  it("drops a trailing slash", () => {
    expect(filed("a/b/")).toBe("a/b");
  });

  it("undoes a percent escape", () => {
    expect(filed("a/b%20c.md")).toBe("a/b c.md");
  });

  it("refuses an escape that is not one", () => {
    expect(filed("a/b%zz.md")).toBeNull();
  });
});

describe("faultOf", () => {
  it("passes an address the revision holds", () => {
    expect(
      faultOf(brand, { kind: "blob", ref: PIN, path: "AGENTS.md" }),
    ).toBeNull();
  });

  it("passes an address at the repository root", () => {
    expect(faultOf(brand, { kind: "tree", ref: PIN, path: "" })).toBeNull();
  });

  it("passes a directory the revision holds", () => {
    expect(
      faultOf(brand, { kind: "tree", ref: PIN, path: "assets/logo" }),
    ).toBeNull();
  });

  it("refuses a path the revision does not hold", () => {
    expect(
      faultOf(brand, { kind: "blob", ref: PIN, path: "README.md/AGENTS.md" }),
    ).toBe(`no README.md/AGENTS.md in that repository at ${PIN}`);
  });

  it("refuses a revision this build does not render", () => {
    expect(
      faultOf(brand, { kind: "blob", ref: OTHER, path: "AGENTS.md" }),
    ).toBe(`stamped ${OTHER}, which is not the revision this build renders`);
  });

  it("refuses a path that cannot be unescaped", () => {
    expect(faultOf(brand, { kind: "blob", ref: PIN, path: "%zz" })).toBe(
      "the path is not a valid escape sequence",
    );
  });

  it("checks a branch address against the paths it has", () => {
    expect(
      faultOf(site, {
        kind: "edit",
        ref: "main",
        path: "src/content/docs/start/install.md",
      }),
    ).toBeNull();
    expect(faultOf(site, { kind: "edit", ref: "main", path: "gone.md" })).toBe(
      "no gone.md in that repository at main",
    );
  });
});

describe("addresses", () => {
  it("finds one in a link and one in an example, and tells them apart", () => {
    const page = [
      linked(`${FORGE}/brand/blob/${PIN}/AGENTS.md`),
      `<pre><code>${FORGE}/brand/blob/${PIN}/README.md</code></pre>`,
      linked(`${FORGE}/brand/releases`),
      linked("/start/install/"),
    ].join("");

    expect(addresses(page, [brand, site])).toStrictEqual([
      {
        url: `${FORGE}/brand/blob/${PIN}/AGENTS.md`,
        checkout: brand,
        target: { kind: "blob", ref: PIN, path: "AGENTS.md" },
        shown: false,
      },
      {
        url: `${FORGE}/brand/blob/${PIN}/README.md`,
        checkout: brand,
        target: { kind: "blob", ref: PIN, path: "README.md" },
        shown: true,
      },
    ]);
  });
});

describe("faults", () => {
  const shown = (url: string, ref: string): Address => ({
    url,
    checkout: brand,
    target: { kind: "blob", ref, path: "README.md" },
    shown: true,
  });

  it("refuses an address rewritten into an example", () => {
    expect(faults("/develop/repos/brand/", [shown("one", PIN)])).toStrictEqual([
      {
        page: "/develop/repos/brand/",
        url: "one",
        why: "a rewritten address inside a code example",
      },
    ]);
  });

  it("leaves an example that names a revision of its own", () => {
    expect(faults("/x/", [shown("two", OTHER)])).toStrictEqual([]);
  });

  it("reports what a followable address gets wrong, and nothing else", () => {
    const bad: Address = {
      url: "three",
      checkout: brand,
      target: { kind: "blob", ref: PIN, path: "README.md/AGENTS.md" },
      shown: false,
    };
    const good: Address = {
      url: "four",
      checkout: brand,
      target: { kind: "blob", ref: PIN, path: "AGENTS.md" },
      shown: false,
    };
    expect(faults("/x/", [bad, good])).toStrictEqual([
      {
        page: "/x/",
        url: "three",
        why: `no README.md/AGENTS.md in that repository at ${PIN}`,
      },
    ]);
  });
});

describe("held", () => {
  it("holds every file and every directory above one", () => {
    expect([...held("a/b/c.md\n\nd.md\n")].sort()).toStrictEqual([
      "a",
      "a/b",
      "a/b/c.md",
      "d.md",
    ]);
  });
});

describe("pageOf", () => {
  it("names a directory index by its route", () => {
    expect(pageOf("develop/repos/brand/index.html")).toBe(
      "/develop/repos/brand/",
    );
  });

  it("names a page that is not an index by its file", () => {
    expect(pageOf("404.html")).toBe("/404");
  });
});

describe("report", () => {
  it("gives each fault its page, its address and its reason", () => {
    expect(report([{ page: "/x/", url: "u", why: "w" }])).toBe(
      "  /x/\n    u\n    w",
    );
  });
});
