import { describe, expect, it } from "vitest";

import { BRAND_LOGO } from "./brand.ts";

describe("BRAND_LOGO", () => {
  it("names brand's mark for both grounds, beside the site's title", () => {
    expect(BRAND_LOGO).toEqual({
      src: "@lemonfiber/brand/logo/mark-primary.svg",
      replacesTitle: false,
    });
  });
});
