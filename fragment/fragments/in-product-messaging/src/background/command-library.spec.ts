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
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import {
  executeIPMCommands,
  getContent,
  isCommandExpired,
  setCommandActor,
  start,
} from "./command-library";
import {
  type CommandActor,
  CommandName,
  CommandVersion,
} from "./command-library.types";
import * as commandStorage from "./command-storage";

import { getStartInfo } from "./start-info.mocks";

const assignedCohort = "assigned";
const nonAssignedCohort = "not-assigned";

describe("command-library", () => {
  beforeAll(() => {
    start(getStartInfo());
  });

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
      vi.spyOn(ewe.cohorts, "getAll").mockReturnValue(
        Promise.resolve([assignedCohort]),
      );
      vi.spyOn(ewe.experiments, "getFlag").mockReturnValue(
        Promise.resolve(true),
      );

      commandStorage.replaceAll({
        [commandBase.ipm_id]: commandBase,
      });

      createTabActor = {
        clearCommands: vi.fn(),
        handleCommand: vi.fn(),
        onCommandsProcessed: vi.fn(),
        getBehavior: vi.fn(),
        getContent: vi.fn(),
        // Always validate the command
        isValidCommand: vi.fn().mockReturnValue(true),
      };
      setCommandActor(CommandName.createTab, createTabActor);
    });

    it("initializes properly", async () => {
      const commands = [{ ...commandBase }];
      await executeIPMCommands(commands);
      expect(createTabActor.handleCommand).toHaveBeenCalledWith(
        commandBase.ipm_id,
      );
    });

    it("dismisses commands with older versions", async () => {
      const olderCommand = {
        ...commandBase,
        version: commandBase.version - 1,
      };

      vi.spyOn(commandStorage, "remove").mockImplementation(() => {});
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

      vi.spyOn(commandStorage, "remove").mockImplementation(() => {});
      commandStorage.replaceAll({
        [newerCommand.ipm_id]: newerCommand,
      });

      await executeIPMCommands([newerCommand]);

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
      await executeIPMCommands(commands);
      expect(createTabActor.handleCommand).toHaveBeenCalledWith(
        commandBase.ipm_id,
      );
    });

    it("does not execute non-matching cohort-specific commands", async () => {
      const commands = [
        {
          ...commandBase,
          cohort: nonAssignedCohort,
        },
      ];
      await executeIPMCommands(commands);
      expect(createTabActor.handleCommand).not.toHaveBeenCalled();
    });
  });

  describe("getContent", () => {
    const commandBase = {
      version: 1,
      command_name: CommandName.createOnPageDialog,
      ipm_id: "command_1",
      content: {
        "de-AT": {
          text: "[de-AT] Text",
        },
        de: {
          text: "[de] Text",
        },
        en: {
          text: "[en] Text",
        },
      },
    };
    let createTabActor: CommandActor;

    beforeEach(() => {
      commandStorage.replaceAll({
        [commandBase.ipm_id]: commandBase,
      });

      createTabActor = {
        clearCommands: vi.fn(),
        handleCommand: vi.fn(),
        onCommandsProcessed: vi.fn(),
        getBehavior: vi.fn(),
        getContent: (command, content) => content,
        // Always validate the command
        isValidCommand: vi.fn().mockReturnValue(true),
      };
      setCommandActor(CommandName.createOnPageDialog, createTabActor);
    });

    it("determine content based on user locale", () => {
      vi.spyOn(browser.i18n, "getUILanguage").mockReturnValue("de-AT");

      expect(getContent(commandBase.ipm_id)).toEqual(
        commandBase.content["de-AT"],
      );
    });

    it("determine content based on user language", () => {
      vi.spyOn(browser.i18n, "getUILanguage").mockReturnValue("de-DE");

      expect(getContent(commandBase.ipm_id)).toEqual(commandBase.content.de);
    });

    it("determine content based on default locale", () => {
      vi.spyOn(browser.i18n, "getUILanguage").mockReturnValue("pt-BR");

      expect(getContent(commandBase.ipm_id)).toEqual(commandBase.content.en);
    });
  });
});
