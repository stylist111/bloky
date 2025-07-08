/**
* This file is part of eyeo's browser extension host
 * debug information fragment,
 * Copyright (C) 2025-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { vi } from "vitest";

import { chrome } from "vitest-chrome/lib/index.esm";

// This ID needs to be set in order to make webextension-polyfill believe that it's running in an extension environment
Object.assign(global, { chrome });
chrome.runtime.id = "unit-testing-extension";

const mockStorage = {
  data: {},
  local: {
    get: vi.fn().mockImplementation(async (key) => {
      return Promise.resolve({ [key]: mockStorage.data[key] || 0 });
    }),
    set: vi.fn(async (obj) => {
      Object.assign(mockStorage.data, obj);
    }),
  },
};
chrome.storage = mockStorage;

const defaultAlarmResponse = [
  {
    name: "alarmOne",
    periodInMinutes: 1440,
    scheduledTime: new Date().getTime(),
  },
  {
    name: "alarmTwo",
    periodInMinutes: 2330,
    scheduledTime: new Date().getTime(),
  },
];

chrome.runtime.getURL.mockImplementation((...args) => {
  return new URL("https://www.example.com");
});

chrome.runtime.getManifest.mockImplementation(() => {
  return { short_name: "AdBlock", version: "1.2.3.4", manifest_version: 3 };
});

chrome.alarms.getAll.mockImplementation(() => {
  return Promise.resolve(defaultAlarmResponse);
});

chrome.permissions.getAll.mockImplementation(() => {
  return Promise.resolve({
    permissions: ["alarms", "contextMenus", "devtools", "idle"],
    origins: ["<all_urls>", "http://*/*", "https://*/*"],
  });
});

// We need to require this after we setup vitest-chrome
const browser = require("webextension-polyfill");
Object.assign(global, { browser });
