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

const assignedCohort = "assigned";
const nonAssignedCohort = "not-assigned";

describe("command-library", () => {
  beforeEach(() => {
    commandStorage.replaceAll({});
  });

  afterAll(() => {
    commandStorage.replaceAll({});
  });

  describe("isCommandExpired", () => {
    const commandBase = {
      version: 1,
      command_name: CommandName.createOnPageDialog,
      ipm_id: "command_1",
    };

    it("should return true if command is not in storage", () => {
      expect(isCommandExpired(commandBase)).toBe(true);
    });

    it("should return false if command is in storage", () => {
      commandStorage.replaceAll({
        [commandBase.ipm_id]: commandBase,
      });

      expect(isCommandExpired(commandBase)).toBe(false);
    });
  });

  describe("executeIPMCommands", () => {
    const commandBase = {
      version: CommandVersion[CommandName.createTab],
      command_name: CommandName.createTab,
      ipm_id: "command_1",
    };
    let createTabActor: CommandActor;

    beforeEach(() => {
      jest
        .spyOn(ewe.cohorts, "getAll")
        .mockReturnValue(Promise.resolve([assignedCohort]));
      jest
        .spyOn(ewe.experiments, "getFlag")
        .mockReturnValue(Promise.resolve(true));

      commandStorage.replaceAll({
        [commandBase.ipm_id]: commandBase,
      });

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

    it("dismisses commands with older versions", async () => {
      const olderCommand = {
        ...commandBase,
        version: commandBase.version - 1,
      };

      jest.spyOn(commandStorage, "remove").mockImplementation();
      commandStorage.replaceAll({
        [olderCommand.ipm_id]: olderCommand,
      });

      await executeIPMCommands([olderCommand], true);

      expect(commandStorage.remove).toHaveBeenCalledWith(olderCommand.ipm_id);
      expect(commandStorage.get(olderCommand.ipm_id)).toEqual(olderCommand);
    });

    it("keeps commands with newer versions", async () => {
      const newerCommand = {
        ...commandBase,
        version: commandBase.version + 1,
      };

      jest.spyOn(commandStorage, "remove").mockImplementation();
      commandStorage.replaceAll({
        [newerCommand.ipm_id]: newerCommand,
      });

      await executeIPMCommands([newerCommand], true);

      expect(commandStorage.remove).not.toHaveBeenCalled();
      expect(commandStorage.get(newerCommand.ipm_id)).toEqual(newerCommand);
    });

    it("executes matching cohort-specific commands", async () => {
      const commands = [
        {
          ...commandBase,
          cohort: assignedCohort,
        },
      ];
      await executeIPMCommands(commands, true);
      expect(createTabActor.handleCommand).toHaveBeenCalledWith(
        commandBase.ipm_id,
        true,
      );
    });

    it("does not execute non-matching cohort-specific commands", async () => {
      const commands = [
        {
          ...commandBase,
          cohort: nonAssignedCohort,
        },
      ];
      await executeIPMCommands(commands, true);
      expect(createTabActor.handleCommand).not.toHaveBeenCalled();
    });
  });
});
