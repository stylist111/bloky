import { describe, it, expect } from "vitest";
import { getIntegrationName } from "~/shared/helpers";
import { adblockName, adblockPlusName } from "~/shared/constants";

describe("getIntegrationName", () => {
  it("returns adblockName for 'AdBlock'", () => {
    expect(getIntegrationName("AdBlock")).toBe(adblockName);
  });

  it("returns adblockPlusName for 'Adblock Plus'", () => {
    expect(getIntegrationName("Adblock Plus")).toBe(adblockPlusName);
  });

  it("throws for invalid extension name", () => {
    expect(() => getIntegrationName("Unknown")).toThrow(
      "Invalid extension name",
    );
  });
});
