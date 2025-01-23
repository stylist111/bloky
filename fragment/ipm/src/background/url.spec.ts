/*
 * This file is part of eyeo's In Product Messaging (IPM) fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { createSafeOriginUrl } from "./url";
import { prefs } from "./context";

describe("url", () => {
  describe("createSafeOriginUrl", () => {
    const defaultOrigin = "https://origin.com";
    const safeOrigins = [defaultOrigin, "https://origin2.com"];

    beforeEach(() => {
      jest.spyOn(prefs, "get").mockImplementation((preference) => {
        switch (preference) {
          case "ipm_default_origin":
            return defaultOrigin;
          case "ipm_safe_origins":
            return safeOrigins;
        }
      });
    });

    it("should return null for unknown origins", () => {
      const unknownOrigin = "https://example.com";
      const url = createSafeOriginUrl(unknownOrigin);
      expect(url).toBe(null);
    });

    it("should not return null for known origins", () => {
      for (const origin of safeOrigins) {
        const url = createSafeOriginUrl(origin);
        expect(url).not.toBe(null);
      }
    });

    it("should prepend the default origin for relative links", () => {
      const link = "/foo";
      const url = createSafeOriginUrl(link);
      expect(url).toBe(`${defaultOrigin}${link}`);
    });

    it("should keep the given origin for absolute links", () => {
      const link = `${safeOrigins[1]}/foo`;
      const url = createSafeOriginUrl(link);
      expect(url).toBe(link);
    });

    it("should keep path, query params, matrix params and fragment identifiers", () => {
      for (const origin of safeOrigins) {
        const link = `${origin}/level1;name=foo/level2;name=bar/?query=1#fragment1`;
        const url = createSafeOriginUrl(link);
        expect(url).toBe(link);
      }
    });
  });
});
