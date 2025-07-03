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

import * as commandLibraryTypes from "./command-library.types";
import { getSupportedCommandsData } from "./data-collection";

jest.mock("./command-library.types");

// We need to type cast the module into an object with writeable properties,
// so we can use different values for different tests.
const mockCommandLibraryTypes = commandLibraryTypes as {
  CommandName: Record<string, string>;
  CommandVersion: Record<string, number>;
};

describe("data-collection", () => {
  describe("getSupportedCommandsData", () => {
    it("should return an empty list when the extension doesn't support any IPM command", () => {
      mockCommandLibraryTypes.CommandName = {};
      mockCommandLibraryTypes.CommandVersion = {};

      expect(getSupportedCommandsData()).toStrictEqual([]);
    });

    it("should return a list of commands data objects when the extension supports IPM commands", () => {
      mockCommandLibraryTypes.CommandName = {
        commandTypeA: "command_type_A",
        commandTypeB: "command_type_B",
      };
      mockCommandLibraryTypes.CommandVersion = {
        command_type_A: 1,
        command_type_B: 2,
      };

      expect(getSupportedCommandsData()).toStrictEqual([
        { name: "command_type_A", version: 1 },
        { name: "command_type_B", version: 2 },
      ]);
    });
  });
});
