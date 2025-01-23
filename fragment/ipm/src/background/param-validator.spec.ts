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

import { LicenseState } from "./data-collection.types";
import {
  isNotEmpty,
  isNumeric,
  isSafeUrl,
  isValidLicenseStateList,
  isValidDomainList,
  isValidDate,
  isEmptyOrPositiveNumber,
} from "./param-validator";
import { prefs } from "./context";

describe("param-validator", () => {
  describe("isNumeric", () => {
    it("returns true for numbers", () => {
      expect(isNumeric(1)).toBe(true);
      expect(isNumeric(1.12321)).toBe(true);
      expect(isNumeric(-34)).toBe(true);
      expect(isNumeric(-34.2133213)).toBe(true);
      expect(isNumeric(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(isNumeric(Number.MIN_SAFE_INTEGER)).toBe(true);
      expect(isNumeric(Number.MAX_VALUE)).toBe(true);
      expect(isNumeric(Number.MIN_VALUE)).toBe(true);
    });

    it("returns false for non number types", () => {
      expect(isNumeric("foo")).toBe(false);
      expect(isNumeric({})).toBe(false);
      expect(isNumeric([])).toBe(false);
      expect(isNumeric(new Map())).toBe(false);
      expect(isNumeric(new Set())).toBe(false);
      expect(isNumeric(NaN)).toBe(false);
      expect(isNumeric(undefined)).toBe(false);
      expect(isNumeric(null)).toBe(false);
    });
  });

  describe("isNotEmpty", () => {
    it("returns false for a non string argument", () => {
      expect(isNotEmpty(undefined)).toBe(false);
      expect(isNotEmpty(null)).toBe(false);
      expect(isNotEmpty(1)).toBe(false);
      expect(isNotEmpty(new Map())).toBe(false);
      expect(isNotEmpty({})).toBe(false);
      expect(isNotEmpty([])).toBe(false);
    });

    it("returns false for an empty string", () => {
      expect(isNotEmpty("")).toBe(false);
    });

    it("returns true for non empty string", () => {
      expect(isNotEmpty(" ")).toBe(true);
      expect(isNotEmpty("\u200b")).toBe(true);
      expect(isNotEmpty("\0")).toBe(true);
      expect(isNotEmpty("test")).toBe(true);
    });
  });

  describe("isValidLicenseStateList", () => {
    it("returns true for falsy arguments", () => {
      expect(isValidLicenseStateList(null)).toBe(true);
      expect(isValidLicenseStateList(undefined)).toBe(true);
      expect(isValidLicenseStateList(0)).toBe(true);
      expect(isValidLicenseStateList("")).toBe(true);
    });

    it("returns false for any non string truthy argument", () => {
      expect(isValidLicenseStateList(1)).toBe(false);
      expect(isValidLicenseStateList(new Map())).toBe(false);
      expect(isValidLicenseStateList([])).toBe(false);
      expect(isValidLicenseStateList({})).toBe(false);
    });

    it("returns true if it receives a comma separated list of valid LicenseState", () => {
      const { active, inactive } = LicenseState;

      expect(isValidLicenseStateList(`${active},${inactive}`)).toBe(true);
      expect(isValidLicenseStateList(`${active},${active},${inactive}`)).toBe(
        true,
      );
      expect(isValidLicenseStateList(`${inactive}`)).toBe(true);
    });

    it("returns false if it receives a comma separated list of invalid LicenseState", () => {
      const { active, inactive } = LicenseState;

      expect(isValidLicenseStateList(`${active},${inactive},foo`)).toBe(false);
      expect(isValidLicenseStateList(`foo,bar,${active}`)).toBe(false);
      expect(isValidLicenseStateList(`hi`)).toBe(false);
      expect(isValidLicenseStateList(`,${active},`)).toBe(false);
      expect(isValidLicenseStateList(`,,,`)).toBe(false);
    });
  });

  describe("isSafeUrl", () => {
    it("returns false when passed a non string argument", () => {
      expect(isSafeUrl(undefined)).toBe(false);
      expect(isSafeUrl(null)).toBe(false);
      expect(isSafeUrl([])).toBe(false);
      expect(isSafeUrl({})).toBe(false);
      expect(isSafeUrl(1)).toBe(false);
      expect(isSafeUrl(new Map())).toBe(false);
    });

    it("returns true if the url is a an 'IPM safe' url", async () => {
      const prefsGetMock = jest.spyOn(prefs, "get");
      prefsGetMock.mockReturnValue("https://adblock.org");
      const ipmSafeOrigin = prefs.get("ipm_safe_origin");

      expect(isSafeUrl(`${ipmSafeOrigin}/en/welcome`)).toBe(true);
      expect(isSafeUrl(`${ipmSafeOrigin}/fr/foo/bar`)).toBe(true);
      expect(isSafeUrl(`${ipmSafeOrigin}`)).toBe(true);
      expect(isSafeUrl(`${ipmSafeOrigin}?tracking=isBad&not=cool#indeed`)).toBe(
        true,
      );
    });

    it("returns false if the url is not an 'IPM safe' url", () => {
      const prefsGetMock = jest.spyOn(prefs, "get");
      prefsGetMock.mockReturnValue("https://adblock.org");

      expect(isSafeUrl(`https://welcome.adblock.org`)).toBe(false);
      expect(isSafeUrl(`https://google.com`)).toBe(false);
    });
  });

  describe("isValidDomainList", () => {
    it("returns true for falsy arguments", () => {
      expect(isValidDomainList(null)).toBe(true);
      expect(isValidDomainList(undefined)).toBe(true);
      expect(isValidDomainList(0)).toBe(true);
      expect(isValidDomainList("")).toBe(true);
    });

    it("returns false for any non string truthy argument", () => {
      expect(isValidDomainList(1)).toBe(false);
      expect(isValidDomainList(new Map())).toBe(false);
      expect(isValidDomainList([])).toBe(false);
      expect(isValidDomainList({})).toBe(false);
    });

    it("returns true for a comma separated list of valid domains", () => {
      expect(isValidDomainList(`example.com,~mail.example.com`)).toBe(true);
      expect(isValidDomainList(`adblock.org,welcome.adblock.org`)).toBe(true);
      expect(isValidDomainList(`adblock.org`)).toBe(true);
      expect(isValidDomainList(`foo.bar,thisTld.doesNotExist`)).toBe(true);
      expect(isValidDomainList(`the,lazy,fox`)).toBe(true);
    });

    it("returns false for a comma separated list of invalid domains", () => {
      expect(isValidDomainList(`http://example.com`)).toBe(false);
      expect(isValidDomainList(`foo.bar, thisTld.doesNotExist`)).toBe(false);
    });
  });

  describe("isValidDate", () => {
    it("should return false for falsy dates", () => {
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
      expect(isValidDate("")).toBe(false);
    });
    it("should return false for incorrect date types", () => {
      expect(isValidDate(1996)).toBe(false);
      expect(isValidDate(new Date("1996-01-16"))).toBe(false);
      expect(isValidDate(["1996-01-16"])).toBe(false);
    });
    it("should return false for incorrect date shape", () => {
      expect(isValidDate("1996-January-16")).toBe(false);
    });
    it("should return false for non-real date", () => {
      expect(isValidDate("1996-01-32")).toBe(false);
    });
    it("should return true for valid date", () => {
      expect(isValidDate("1996-01-16")).toBe(true);
    });
  });

  describe("isEmptyOrPositiveNumber", () => {
    it("returns true if passed `undefined`", () => {
      expect(isEmptyOrPositiveNumber(undefined)).toBe(true);
    });

    it("returns true if passed a positive number", () => {
      expect(isEmptyOrPositiveNumber(5)).toBe(true);
      expect(isEmptyOrPositiveNumber(56465464654654)).toBe(true);
      expect(isEmptyOrPositiveNumber(Infinity)).toBe(true);
    });

    it("returns false if passed 0", () => {
      expect(isEmptyOrPositiveNumber(0)).toBe(false);
    });

    it("returns false if passed a negative number", () => {
      expect(isEmptyOrPositiveNumber(-2)).toBe(false);
      expect(isEmptyOrPositiveNumber(-2456578547)).toBe(false);
    });

    it("returns false for any non number argument", () => {
      expect(isEmptyOrPositiveNumber(new Map())).toBe(false);
      expect(isEmptyOrPositiveNumber([])).toBe(false);
      expect(isEmptyOrPositiveNumber({})).toBe(false);
    });
  });
});
