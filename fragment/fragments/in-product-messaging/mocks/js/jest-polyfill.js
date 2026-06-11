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

"use strict";

/**
 * This file is extending the browser object created by jest-webextension-mock.
 */

// jest-webextension-mock doesn't set the extension ID, but it needs to be set
// in order to make webextension-polyfill believe that it's running in an
// extension environment
browser.runtime.id = "unit-testing-extension";

// jest-webextension-mock misses a few webext APIs that are used in our
// codebase, so we add them during the jest setup

Object.assign(browser.tabs, {
  onRemoved: {
    addListener() {},
    removeListener() {},
    hasListener() {},
  },
});

Object.assign(browser.runtime, {
  getPlatformInfo() {
    return new Promise((resolve) => {
      resolve({ os: "jest" });
    });
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

Object.assign(browser, {
  management: {
    getSelf() {
      return new Promise((resolve) => {
        resolve({
          installType: "normal",
        });
      });
    },
  },
});

Object.assign(browser, {
  webRequest: {
    onBeforeRequest() {},
    ResourceType: {},
  },
});

Object.assign(browser, {
  action: browser.browserAction,
});

// The storage mocks in jest-webextension-mock all use jest.fn to define their
// mocked in-memory storage area. Unfortunately, if our jest.config.cjs has
// `resetMocks: true`, then that function implementation is thrown away and all
// functions return undefined. This works around the problem by providing a
// storage area that just returns the right types.
Object.assign(browser, {
  storage: {
    local: {
      get() {
        return Promise.resolve({});
      },
      set() {
        return Promise.resolve();
      },
      remove() {
        return Promise.resolve();
      },
    },
  },
});
