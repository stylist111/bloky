/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import {
  onAllowlisting,
  getAllowlistingDomain,
  trustedDomains
} from "./public-api";
import { allowlist } from "../../../adblockpluschrome/lib/allowlisting";
import * as premium from "../../premium/background";
import { FilterOrigin } from "~/filters/shared";

jest.mock("../../../adblockpluschrome/lib/allowlisting", () => ({
  allowlist: jest.fn()
}));

jest.mock("../../premium/background", () => ({
  getPremiumState: jest.fn(() => ({ isActive: false }))
}));

describe("allowlisting/background/public-api", () => {
  describe("getAllowlistingDomain", () => {
    it("should return the root domain for trusted domains", () => {
      for (const domain of trustedDomains) {
        expect(getAllowlistingDomain(`subdomain.${domain}`)).toBe(domain);
        expect(getAllowlistingDomain(domain)).toBe(domain);
      }
    });

    it("returns the hostname without www prefix for trusted domains", () => {
      for (const domain of trustedDomains) {
        expect(getAllowlistingDomain(`www.${domain}`)).toBe(domain);
      }
    });

    it("returns the hostname if it does not match any trusted domain", () => {
      const nonTrustedDomains = [
        "untrustedsite.com",
        "random.org",
        "another-example.net"
      ];
      for (const domain of nonTrustedDomains) {
        expect(getAllowlistingDomain(domain)).toBe(domain);
        expect(getAllowlistingDomain(`subdomain.${domain}`)).toBe(
          `subdomain.${domain}`
        );
      }
    });
  });

  describe("onAllowlisting", () => {
    beforeEach(() => {
      jest
        .spyOn(premium, "getPremiumState")
        .mockReturnValue(Promise.resolve({ isActive: false }));
    });

    it("does not call allowlist if premium is active", async () => {
      jest
        .spyOn(premium, "getPremiumState")
        .mockReturnValueOnce(Promise.resolve({ isActive: true }));

      await onAllowlisting("softonic.com", { expiresAt: 1234567890 });

      expect(allowlist).not.toHaveBeenCalled();
    });

    it("calls allowlist with correct parameters for trusted domains", async () => {
      for (const domain of trustedDomains) {
        const options = { expiresAt: 1234567890 };
        await onAllowlisting(`subdomain.${domain}`, options);

        expect(allowlist).toHaveBeenCalledWith({
          hostname: domain,
          origin: FilterOrigin.web,
          expiresAt: options.expiresAt
        });
      }
    });

    it("calls allowlist with correct parameters for non-trusted domains", async () => {
      const domain = "example.com";
      const options = { expiresAt: 1234567890 };

      await onAllowlisting(`www.${domain}`, options);

      expect(allowlist).toHaveBeenCalledWith({
        hostname: domain,
        origin: FilterOrigin.web,
        expiresAt: options.expiresAt
      });
    });
  });
});
