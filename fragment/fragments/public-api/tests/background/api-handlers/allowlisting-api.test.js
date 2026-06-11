/**
 * This file is part of eyeo's Public API fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { allowlistWebsite } from "~/background/api-handlers/allowlisting-api.js";

// Import the modules to be mocked so we can access their spied functions
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import * as url from "@eyeo/webext-ad-filtering-solution/adblockpluscore/lib/url.js";

// Mock url utils
vi.mock(
  "@eyeo/webext-ad-filtering-solution/adblockpluscore/lib/url.js",
  () => ({
    getBaseDomain: vi.fn(),
    domainSuffixes: vi.fn(),
  }),
);

describe("allowlistWebsite", () => {
  const MOCKED_NOW = 1700000000000; // A fixed timestamp for Date.now()
  const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCKED_NOW);

    // Clear mocks on the imported module functions
    ewe.filters.add.mockClear();
    url.getBaseDomain.mockClear();
    url.domainSuffixes.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockContext = (tabUrl) => ({
    sender: {
      tab: {
        url: tabUrl,
      },
    },
  });

  it("should allowlist the current hostname by default", async () => {
    const context = mockContext("https://www.example.com/page");
    const result = await allowlistWebsite.call(context, {});

    expect(ewe.filters.add).toHaveBeenCalledOnce();
    expect(ewe.filters.add).toHaveBeenCalledWith(
      ["@@||www.example.com^$document"],
      {
        origin: "web",
        created: MOCKED_NOW,
      },
    );
    expect(result).toEqual({
      origin: "web",
      created: MOCKED_NOW,
      status: true,
    });
  });

  it("should allowlist with a valid expiresAt", async () => {
    const context = mockContext("https://www.example.com/page");
    const expiresAt = MOCKED_NOW + 5 * MILLIS_IN_DAY;
    const result = await allowlistWebsite.call(context, { expiresAt });

    expect(ewe.filters.add).toHaveBeenCalledOnce();
    expect(ewe.filters.add).toHaveBeenCalledWith(
      ["@@||www.example.com^$document"],
      {
        origin: "web",
        created: MOCKED_NOW,
        expiresAt,
      },
    );
    expect(result).toEqual({
      origin: "web",
      created: MOCKED_NOW,
      expiresAt,
      status: true,
    });
  });

  it("should throw if expiresAt is not an integer", async () => {
    const context = mockContext("https://www.example.com/page");
    const expiresAt = "not-an-integer"; // Invalid value
    await expect(allowlistWebsite.call(context, { expiresAt })).rejects.toThrow(
      "Expiration must be an integer.",
    );
  });

  it("should throw if expiresAt is less than 1 day from now", async () => {
    const context = mockContext("https://www.example.com/page");
    const expiresAt = MOCKED_NOW + (24 * 60 * 60 * 1000) / 2; // 0.5 days from now
    await expect(allowlistWebsite.call(context, { expiresAt })).rejects.toThrow(
      "Expiration must be between 1 and 365 days from now.",
    );
  });

  it("should throw if expiresAt is more than 365 days from now", async () => {
    const context = mockContext("https://www.example.com/page");
    const expiresAt = MOCKED_NOW + 370 * 24 * 60 * 60 * 1000; // 370 days from now
    await expect(allowlistWebsite.call(context, { expiresAt })).rejects.toThrow(
      "Expiration must be between 1 and 365 days from now.",
    );
  });

  it("should allowlist with a valid partialDomain", async () => {
    const hostname = "sub.long.example.com";
    const partialDomain = "example.com";
    const context = mockContext(`https://${hostname}/`);

    url.getBaseDomain.mockReturnValue("example.com");
    url.domainSuffixes.mockReturnValue([
      "sub.long.example.com",
      "long.example.com",
      "example.com",
      "com",
    ]);

    const result = await allowlistWebsite.call(context, { partialDomain });

    expect(url.getBaseDomain).toHaveBeenCalledWith(hostname);
    expect(url.domainSuffixes).toHaveBeenCalledWith(hostname);
    expect(ewe.filters.add).toHaveBeenCalledOnce();
    expect(ewe.filters.add).toHaveBeenCalledWith(
      [`@@||${partialDomain}^$document`],
      {
        origin: "web",
        created: MOCKED_NOW,
      },
    );
    expect(result).toEqual({
      origin: "web",
      created: MOCKED_NOW,
      status: true,
    });
  });

  it("should allowlist with a valid partialDomain (hostname itself)", async () => {
    const hostname = "www.example.com";
    const partialDomain = "www.example.com";
    const context = mockContext(`https://${hostname}/`);

    url.getBaseDomain.mockReturnValue("example.com");
    url.domainSuffixes.mockReturnValue([
      "www.example.com",
      "example.com",
      "com",
    ]);

    const result = await allowlistWebsite.call(context, { partialDomain });
    expect(ewe.filters.add).toHaveBeenCalledWith(
      [`@@||${partialDomain}^$document`],
      {
        origin: "web",
        created: MOCKED_NOW,
      },
    );
    expect(result).toEqual({
      origin: "web",
      created: MOCKED_NOW,
      status: true,
    });
  });

  it("should allowlist with a valid partialDomain and expiresAt", async () => {
    const hostname = "sub.example.com";
    const partialDomain = "example.com";
    const context = mockContext(`https://${hostname}/`);
    const expiresAt = MOCKED_NOW + 10 * MILLIS_IN_DAY;

    url.getBaseDomain.mockReturnValue("example.com");
    url.domainSuffixes.mockReturnValue([
      "sub.example.com",
      "example.com",
      "com",
    ]);

    const result = await allowlistWebsite.call(context, {
      partialDomain,
      expiresAt,
    });

    expect(ewe.filters.add).toHaveBeenCalledOnce();
    expect(ewe.filters.add).toHaveBeenCalledWith(
      [`@@||${partialDomain}^$document`],
      {
        origin: "web",
        created: MOCKED_NOW,
        expiresAt,
      },
    );
    expect(result).toEqual({
      origin: "web",
      created: MOCKED_NOW,
      expiresAt,
      status: true,
    });
  });

  it("should throw if partialDomain is not a string", async () => {
    const context = mockContext("https://www.example.com/");
    await expect(
      allowlistWebsite.call(context, { partialDomain: 123 }),
    ).rejects.toThrow("Partial domain must be a string");
  });

  it("should throw if partialDomain is invalid (not a suffix)", async () => {
    const hostname = "www.example.com";
    const partialDomain = "another.net";
    const context = mockContext(`https://${hostname}/`);

    url.getBaseDomain.mockReturnValue("example.com");
    url.domainSuffixes.mockReturnValue([
      "www.example.com",
      "example.com",
      "com",
    ]);

    await expect(
      allowlistWebsite.call(context, { partialDomain }),
    ).rejects.toThrow("Invalid partial domain.");
    expect(url.getBaseDomain).toHaveBeenCalledWith(hostname);
    expect(url.domainSuffixes).toHaveBeenCalledWith(hostname);
  });

  it("should throw if partialDomain is less specific than base domain (e.g., 'com')", async () => {
    const hostname = "www.example.com";
    const partialDomain = "com";
    const context = mockContext(`https://${hostname}/`);

    url.getBaseDomain.mockReturnValue("example.com");
    url.domainSuffixes.mockReturnValue([
      "www.example.com",
      "example.com",
      "com",
    ]);

    await expect(
      allowlistWebsite.call(context, { partialDomain }),
    ).rejects.toThrow("Invalid partial domain.");
  });
});
