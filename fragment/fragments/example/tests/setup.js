/**
 * This file is part of eyeo's YouTube ad wall detection fragment,
 * Copyright (C) 2024-present eyeo GmbH

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

const mockStorage = {
  data: {},
  local: {
    get: vi.fn(async (key) => ({ [key]: mockStorage.data[key] || 0 })),
    set: vi.fn(async (obj) => {
      Object.assign(mockStorage.data, obj);
    }),
  },
};

const browser = {
  storage: mockStorage,
  runtime: {
    // This ID needs to be set in order to make webextension-polyfill believe that it's running in an extension environment
    id: "unit-testing-extension",
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
};

Object.assign(global, {
  chrome: browser,
  browser,
});
