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

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import * as context from "./context";
import { addExperimentsSearchParams, createSafeOriginUrl } from "./url";
import { ExperimentSearchParameterKeys } from "./url.types";

describe("url", () => {
  describe("createSafeOriginUrl", () => {
    const defaultOrigin = "https://origin.com";
    const safeOrigins = [defaultOrigin, "https://origin2.com"];

    beforeEach(() => {
      jest.spyOn(context.prefs, "get").mockImplementation((preference) => {
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

  describe("addExperimentsSearchParams", () => {
    const experiments = "__exp__";
    const revision = "__rev__";
    beforeEach(() => {
      jest
        .spyOn(context, "getExperiments")
        .mockImplementation(async () => experiments);
      jest
        .spyOn(ewe.experiments, "getRevisionId")
        .mockImplementation(async () => revision);
    });

    it("should return a string if a valid URL is given", async () => {
      const result = await addExperimentsSearchParams("http://example.com");
      expect(typeof result).toBe("string");
    });

    it("should return null if an invalid URL is given", async () => {
      const result = await addExperimentsSearchParams("__invalid_url__");
      expect(result).toBe(null);
    });

    it("should add the correct params", async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const result = (await addExperimentsSearchParams("http://example.com"))!;
      console.log(result);
      expect(result).toContain(
        `${ExperimentSearchParameterKeys.revision}=${revision}`,
      );
      expect(result).toContain(
        `${ExperimentSearchParameterKeys.variants}=${experiments}`,
      );
    });

    it("should keep path, query params, matrix params and fragment identifiers", async () => {
      const path = "http://example.com/level1;name=foo/level2;name=bar/?";
      const query = "query=1";
      const fragment = "#fragment1";
      const url = `${path}${query}${fragment}`;
      const result = (await addExperimentsSearchParams(url)) ?? "";

      expect(result.startsWith(path)).toBe(true);
      expect(result.endsWith(fragment)).toBe(true);
      expect(result).toContain(query);
    });
  });
});
