import { describe, expect, it } from "vitest";

import { BRAND_LOGO } from "./brand.ts";

describe("BRAND_LOGO", () => {
  it("names brand's mark for each ground, beside the site's title", () => {
    expect(BRAND_LOGO).toEqual({
      light: "@lemonfiber/brand/logo/mark-primary.svg",
      dark: "@lemonfiber/brand/logo/mark-primary-on-ink.svg",
      replacesTitle: false,
    });
  });
});
