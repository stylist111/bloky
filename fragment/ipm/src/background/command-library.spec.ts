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

import {
  commandStorageKey,
  getStoredCommandIds,
  isCommandExpired,
} from "./command-library";
import { CommandName } from "./command-library.types";
import { prefs } from "./context";

describe("command-library", () => {
  describe("getStoredCommandIds", () => {
    let prefsObj: Record<string, any>;

    beforeEach(() => {
      const prefsGetMock = jest.spyOn(prefs, "get");
      prefsGetMock.mockImplementation((key) => prefsObj[key]);
    });

    it("should return an empty array when no commands are stored", () => {
      prefsObj = {
        [commandStorageKey]: {},
      };

      expect(getStoredCommandIds()).toStrictEqual([]);
    });

    it("should return a list of command ids when commands are stored", () => {
      const commandIds = ["command_1", "command_2"];
      prefsObj = {
        [commandStorageKey]: {
          [commandIds[0]]: {
            version: 1,
            ipm_id: commandIds[0],
            command_name: "mock-command",
            expiry: 0,
          },
          [commandIds[1]]: {
            version: 1,
            ipm_id: commandIds[1],
            command_name: "mock-command",
            expiry: 0,
          },
        },
      };

      expect(getStoredCommandIds()).toStrictEqual(commandIds);
    });
  });

  describe("isCommandExpired", () => {
    const commandBase = {
      version: 1,
      command_name: CommandName.createOnPageDialog,
      ipm_id: "command_1",
    };

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("1996-01-15T12:00:00Z"));
    });
    afterEach(() => {
      jest.setSystemTime();
      jest.useRealTimers();
    });
    it("should return true when expiry date doesn't have a valid shape", () => {
      expect(isCommandExpired({ ...commandBase, expiry: "" })).toBe(true);
      expect(
        isCommandExpired({ ...commandBase, expiry: "1996-January-16" }),
      ).toBe(true);
    });
    it("should return true when expiry date is not a real date", () => {
      expect(isCommandExpired({ ...commandBase, expiry: "1996-01-32" })).toBe(
        true,
      );
    });
    it("should return true when expiry date is in the past", () => {
      expect(isCommandExpired({ ...commandBase, expiry: "1996-01-14" })).toBe(
        true,
      );
    });
    it("should return true when expiry date is the same as current date", () => {
      expect(isCommandExpired({ ...commandBase, expiry: "1996-01-15" })).toBe(
        true,
      );
    });
    it("should return false when expiry date is in the future", () => {
      expect(isCommandExpired({ ...commandBase, expiry: "1996-01-16" })).toBe(
        false,
      );
    });
  });
});
