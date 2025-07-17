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

import { CommandName, type Command } from "./command-library.types";
import * as commandStorage from "./command-storage";
import { getStartInfo } from "./start-info";

const { fetchCommands, persistCommands } = getStartInfo();

const mockCommandIds = ["command_1", "command_2"];
const mockCommandMap = {
  [mockCommandIds[0]]: {
    version: 1,
    ipm_id: mockCommandIds[0],
    command_name: CommandName.createOnPageDialog,
    expiry: "0",
  },
  [mockCommandIds[1]]: {
    version: 1,
    ipm_id: mockCommandIds[1],
    command_name: CommandName.createTab,
    expiry: "0",
  },
};

describe("command-storage", () => {
  beforeEach(async () => {
    await persistCommands({});
  });

  describe("getAll", () => {
    it("should return an empty object when no commands are stored", () => {
      const storedCommands = commandStorage.getAll();
      expect(storedCommands).toStrictEqual({});
    });

    it("should return a map of all commands that are stored", async () => {
      await persistCommands(mockCommandMap);

      const storedCommands = commandStorage.getAll();
      expect(storedCommands).toStrictEqual(mockCommandMap);
    });
  });

  describe("get", () => {
    it("should return 'null' if no command is stored with the given ID", async () => {
      await persistCommands(mockCommandMap);

      expect(commandStorage.get("invalid_id")).toBe(null);
    });

    it("should return the coressponding command for the given ID", async () => {
      await persistCommands(mockCommandMap);

      let command: Command | null;

      command = commandStorage.get(mockCommandIds[0]);
      expect(command).toStrictEqual(mockCommandMap[mockCommandIds[0]]);

      command = commandStorage.get(mockCommandIds[1]);
      expect(command).toStrictEqual(mockCommandMap[mockCommandIds[1]]);
    });
  });

  describe("getIds", () => {
    it("should return an empty array when no commands are stored", () => {
      expect(commandStorage.getIds()).toStrictEqual([]);
    });

    it("should return a list of command ids when commands are stored", async () => {
      await persistCommands(mockCommandMap);

      expect(commandStorage.getIds()).toStrictEqual(mockCommandIds);
    });
  });

  describe("add", () => {
    it("should store all the commands given", async () => {
      const commands: Command[] = Object.values(mockCommandMap);
      await commandStorage.add(commands);

      const storedCommands = fetchCommands();
      expect(storedCommands).toStrictEqual(mockCommandMap);
    });
  });

  describe("remove", () => {
    it("should remove a command that is stored with the given ID", async () => {
      await persistCommands(mockCommandMap);

      const commandIdToRemove = mockCommandIds[0];
      await commandStorage.remove(commandIdToRemove);

      const storedCommands = fetchCommands();
      expect(Object.keys(storedCommands)).not.toContain(commandIdToRemove);
    });

    it("shouldn't do anything if there's no stored command with the given ID", async () => {
      await persistCommands(mockCommandMap);

      const commandIdToRemove = "invalid_id";
      await commandStorage.remove(commandIdToRemove);

      const storedCommands = fetchCommands();
      expect(storedCommands).toStrictEqual(mockCommandMap);
    });
  });
});
