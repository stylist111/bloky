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

import { getStartInfo } from "./start-info";
import { getIPMPingCount, sendPing } from "./telemetry";
import { pingCountPrefsKey } from "./telemetry.types";

describe("telemetry", () => {
  beforeEach(() => {
    const prefsData: Record<string, any> = {
      ipm_commands: {},
      ipm_server_url: "https://example.com",
      premium_license: {
        lv: 1,
        status: "expired",
        encodedData: "foo",
        signature: "bar",
      },
    };

    const { prefs } = getStartInfo();
    jest.spyOn(prefs, "get").mockImplementation((key) => prefsData[key]);
    jest.spyOn(prefs, "set").mockImplementation(async (key, value) => {
      prefsData[key] = value;
    });

    jest.spyOn(global, "fetch").mockImplementation(
      jest.fn(async () => {
        return await Promise.resolve({
          ok: true,
          text: async () => "",
          json: async () => ({}),
        });
      }) as jest.Mock,
    );
  });

  describe("getIPMPingCount", () => {
    it("should query Prefs.get with the correct storage key", async () => {
      const { prefs } = getStartInfo();
      jest.spyOn(prefs, "get");
      await getIPMPingCount();
      expect(prefs.get).toHaveBeenCalledTimes(1);
      expect(prefs.get).toHaveBeenCalledWith(pingCountPrefsKey);
    });

    it("should forward the number that Prefs.get returns", async () => {
      const { prefs } = getStartInfo();
      const value = 4;
      jest.spyOn(prefs, "get").mockReturnValue(value);
      const result = await getIPMPingCount();
      expect(prefs.get).toHaveBeenCalledTimes(1);
      expect(result).toBe(value);
    });
  });

  describe("sendPing", () => {
    it("fetches IPM data when Prefs.data_collection_opt_out is false", async () => {
      const startInfo = getStartInfo();
      jest.spyOn(startInfo, "isOptedOut").mockResolvedValue(false);
      await sendPing();
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.anything(),
      );
    });

    it("does not fetch IPM data when Prefs.data_collection_opt_out is true", async () => {
      const startInfo = getStartInfo();
      jest.spyOn(startInfo, "isOptedOut").mockResolvedValue(true);
      await sendPing();
      expect(global.fetch).toHaveBeenCalledTimes(0);
    });
  });
});
