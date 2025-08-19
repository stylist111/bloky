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

import * as browser from "webextension-polyfill";

import { CommandName } from "./command-library.types";
import * as commandStorage from "./command-storage";
import { isLanguageSkewed } from "./language-check";

const ipmId = "__ipm_id__";
const oldIpmId = "__old_ipm__";
const language = "__language__";

const mockCommandStorage = {
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
    commandStorage.replaceAll(mockCommandStorage);
  });

  describe("isLanguageSkewed", () => {
    it("should return false if there is no command for the given id", async () => {
      const result = await isLanguageSkewed("no such ipm id");
      expect(result).toBe(false);
    });

    it("should return false if the command has no attributes", async () => {
      const result = await isLanguageSkewed(oldIpmId);
      expect(result).toBe(false);
    });

    it("should return false if the language still matches", async () => {
      jest.spyOn(browser.i18n, "getUILanguage").mockReturnValue(language);

      const result = await isLanguageSkewed(ipmId);
      expect(result).toBe(false);
    });

    it("should return true if the language differs", async () => {
      jest.spyOn(browser.i18n, "getUILanguage").mockReturnValue("new language");

      const result = await isLanguageSkewed(ipmId);
      expect(result).toBe(true);
    });
  });
});
