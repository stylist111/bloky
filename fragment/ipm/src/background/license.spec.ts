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

import { prefs } from "./context";
import { doesLicenseStateMatch } from "./license";

jest.mock("./context", () => {
  const prefsData: Record<string, any> = {
    premium_license: {
      lv: 1,
      code: "",
      status: "expired",
    },
  };

  return {
    prefs: {
      get: (key: string) => {
        return prefsData[key];
      },
      set: (key: string, value: any) => {
        prefsData[key] = value;
      },
      untilLoaded: null,
    },
    licensing: {
      isLicenseValid() {
        return prefsData.premium_license.status === "active";
      },
    },
  };
});

describe("license", () => {
  describe("doesLicenseStateMatch", () => {
    it("should wait for license changes made in Prefs initialization", async () => {
      // activating the Premium license in a deferred asynchronous way
      prefs.untilLoaded = new Promise((resolve) => {
        setTimeout(() => {
          void prefs.set("premium_license", {
            lv: 1,
            code: "",
            status: "active",
          });
          resolve();
        }, 0);
      });

      expect(await doesLicenseStateMatch({ licenseStateList: "premium" })).toBe(
        true,
      );
    });
  });
});
