/**
 * This file is part of eyeo's Public API fragment,
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

// Mock the @eyeo/webext-ad-filtering-solution module
vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  filters: {
    add: vi.fn(),
    getAllowingFilters: vi.fn(),
    getMetadata: vi.fn(),
  },
  experiments: {
    getFlags: vi.fn(),
    getAssignments: vi.fn(),
  },
  subscriptions: {
    hasAcceptableAdsEnabled: vi.fn(),
  },
}));

const manifest = {
  short_name: "Adblock Plus",
  version: "1.0.0",
};

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      getManifest: vi.fn(() => manifest),
    },
    scripting: {
      ExecutionWorld: { MAIN: "MAIN" },
      executeScript: vi.fn(),
    },
    tabs: {
      executeScript: vi.fn(),
    },
  },
}));

globalThis.manifest = manifest;
