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

// IPM tests import browser from "webextension-polyfill" and spy on browser.i18n
// mock functions. Aliasing browser to the vitest-chrome mock causes
// webextension-polyfill to return the mock directly (with spyable functions)
// rather than wrapping it, which would lose the mock function references.
Object.assign(global, { browser: chrome });

// Extend the vitest-chrome mock with IPM-specific API behaviour that the
// ewe SDK and the fragment's source code rely on at runtime
chrome.tabs.query.mockResolvedValue([]);
chrome.runtime.getURL.mockImplementation(
  (path = "") => `chrome-extension://${chrome.runtime.id}/${path}`,
);
Object.assign(chrome.runtime, {
  async getPlatformInfo() {
    return { os: "vitest" };
  },
  getManifest() {
    return {
      manifest_version: 3,
      options_ui: {
        page: "options.html",
      },
    };
  },
});

Object.assign(chrome.storage, {
  local: {
    async get() {
      return {};
    },
    async set() {},
    async remove() {},
  },
});

Object.assign(chrome.management, {
  async getSelf() {
    return { installType: "normal" };
  },
});

Object.assign(chrome.webRequest, {
  ResourceType: {},
});
