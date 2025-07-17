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
import {
  executeIPMCommands,
  isCommandExpired,
  setCommandActor,
} from "./command-library";
import {
  type CommandActor,
  CommandName,
  CommandVersion,
} from "./command-library.types";
import * as commandStorage from "./command-storage";

describe("command-library", () => {
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

  describe("executeIPMCommands", () => {
    const commandBase = {
      version: CommandVersion[CommandName.createTab],
      command_name: CommandName.createTab,
      ipm_id: "command_1",
      expiry: "2050-01-16",
    };

    let createTabActor: CommandActor;

    beforeEach(() => {
      jest
        .spyOn(ewe.experiments, "getFlag")
        .mockReturnValue(Promise.resolve(true));

      createTabActor = {
        clearCommands: jest.fn(),
        handleCommand: jest.fn(),
        onCommandsProcessed: jest.fn(),
        getBehavior: jest.fn(),
        getContent: jest.fn(),
        // Always validate the command
        isValidCommand: jest.fn().mockReturnValue(true),
      };
      setCommandActor(CommandName.createTab, createTabActor);
    });

    it("initializes properly", async () => {
      const commands = [{ ...commandBase }];
      await executeIPMCommands(commands, true);
      expect(createTabActor.handleCommand).toHaveBeenCalledWith(
        commandBase.ipm_id,
        true,
      );
    });

    it("executes properly after ping", async () => {
      const commands = [{ ...commandBase }];
      await executeIPMCommands(commands);
      expect(createTabActor.handleCommand).toHaveBeenCalledWith(
        commandBase.ipm_id,
        false,
      );
    });

    it("dismisses commands with outdated versions on initialization", async () => {
      const outdatedCommand = {
        ...commandBase,
        version: commandBase.version - 1,
      };

      jest.spyOn(commandStorage, "remove").mockImplementation();

      await executeIPMCommands([outdatedCommand], true);
      expect(commandStorage.remove).toHaveBeenCalledWith(
        outdatedCommand.ipm_id,
      );
    });
  });
});
