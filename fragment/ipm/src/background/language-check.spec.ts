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

import * as eventRecording from "./event-recording";
import { CommandName, type Command } from "./command-library.types";
import { checkLanguage } from "./language-check";
import * as browser from "webextension-polyfill";
import { prefs } from "./context";

const ipmId = "__ipm_id__";
const oldIpmId = "__old_ipm__";
const language = "__language__";

const mockCommandStorage: Record<string, Command> = {
  [oldIpmId]: {
    version: 1,
    command_name: CommandName.createTab,
    ipm_id: ipmId,
    expiry: "",
  },
  [ipmId]: {
    version: 1,
    command_name: CommandName.createOnPageDialog,
    ipm_id: ipmId,
    expiry: "",
    attributes: {
      language,
      received: 0,
    },
  },
};

describe("language-check", () => {
  beforeEach(() => {
    jest.spyOn(eventRecording, "recordEvent").mockImplementation();
    jest.spyOn(prefs, "get").mockReturnValue(mockCommandStorage);
  });

  describe("checkLanguage", () => {
    it("should not do anything if there is no command for the given id", async () => {
      await checkLanguage("no such ipm id");
      expect(eventRecording.recordEvent).not.toHaveBeenCalled();
    });

    it("should not do anything if the command has no attributes", async () => {
      await checkLanguage(oldIpmId);
      expect(eventRecording.recordEvent).not.toHaveBeenCalled();
    });

    it("should not do anything if the language still matches", async () => {
      jest.spyOn(browser.i18n, "getUILanguage").mockReturnValue(language);

      await checkLanguage(ipmId);
      expect(eventRecording.recordEvent).not.toHaveBeenCalled();
    });

    it("should record an event if the language differs", async () => {
      jest.spyOn(browser.i18n, "getUILanguage").mockReturnValue("new language");

      await checkLanguage(ipmId);
      expect(eventRecording.recordEvent).toHaveBeenCalledWith(
        ipmId,
        CommandName.createOnPageDialog,
        "language_skew",
      );
    });
  });
});
