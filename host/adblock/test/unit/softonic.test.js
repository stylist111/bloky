import { vi, describe, it, expect, beforeEach } from "vitest";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import {
  onAllowlisting,
  trustedDomains,
  getAllowlistingDomain,
} from "../../adblock-betafish/allowlisting";

vi.mock("webextension-polyfill", () => ({
  runtime: {
    onInstalled: { addListener: vi.fn() },
  },
}));

vi.mock("../../adblock-betafish/picreplacement/check", () => ({
  License: {
    isActiveLicense: vi.fn(() => false),
    ready: vi.fn(() => Promise.resolve()),
    licenseNotifier: {
      on: vi.fn(),
    },
  },
}));

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  filters: {
    add: vi.fn(() => Promise.resolve()),
  },
  allowlisting: {
    setAuthorizedKeys: vi.fn(),
    setAllowlistingCallback: vi.fn(),
    onUnauthorized: { addListener: vi.fn() },
  },
}));

vi.mock("~/alias/prefs", () => ({
  Prefs: {
    get: vi.fn().mockReturnValue([]),
    untilLoaded: Promise.resolve(),
  },
}));

// Constant for the allowlisted filter regex pattern
const allowlistingFilterPattern = /^@@\|\|.*\$document$/;

describe("Trusted domains allowlisting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(trustedDomains)("adds correct filters for the trusted domain: %s", async (domain) => {
    await onAllowlisting(`subdomain.${domain}`);

    expect(ewe.filters.add).toHaveBeenCalledTimes(1);
    const [allowlistingFilter] = ewe.filters.add.mock.calls[0];

    expect(allowlistingFilter[0]).toMatch(allowlistingFilterPattern);
    const allowlistedDomain = allowlistingFilter[0].slice(4, allowlistingFilter[0].length - 10);
    expect(allowlistedDomain).toBe(getAllowlistingDomain(allowlistedDomain));
  });

  const nonTrustedDomains = ["untrustedsite.com", "random.org", "another-example.net"];

  it.each(nonTrustedDomains)("allowlists subdomain for non-trusted domain: %s", async (domain) => {
    await onAllowlisting(`subdomain.${domain}`);

    expect(ewe.filters.add).toHaveBeenCalledTimes(1);
    const [allowlistingFilter] = ewe.filters.add.mock.calls[0];

    expect(allowlistingFilter[0]).toMatch(allowlistingFilterPattern);
    const allowlistedDomain = allowlistingFilter[0].slice(4, allowlistingFilter[0].length - 10);
    expect(allowlistedDomain).toMatch(/^subdomain\./);
  });

  const allDomains = [...trustedDomains, "untrustedsite.com", "random.org", "another-example.net"];
  const allDomainsWithWWW = allDomains.map((domain) => `www.${domain}`);

  it.each(allDomainsWithWWW)("removes www prefix for domain: %s", async (domain) => {
    await onAllowlisting(domain);

    expect(ewe.filters.add).toHaveBeenCalledTimes(1);
    const [allowlistingFilter] = ewe.filters.add.mock.calls[0];

    expect(allowlistingFilter[0]).toMatch(allowlistingFilterPattern);
    const allowlistedDomain = allowlistingFilter[0].slice(4, allowlistingFilter[0].length - 10);
    expect(allowlistedDomain).toBe(getAllowlistingDomain(allowlistedDomain));
  });
});
