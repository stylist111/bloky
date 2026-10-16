/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* global global */

import { vi } from "vitest";

const mockStorage = {
  data: {},
  local: {
    get: vi.fn(async (key) => ({ [key]: mockStorage.data[key] })),
    set: vi.fn(async (obj) => {
      Object.assign(mockStorage.data, obj);
    }),
  },
};

global.browser = {
  storage: mockStorage,
};

// Legacy background-page global, still referenced at module load time by
// vendored adblockplusui code (e.g. tab-session.js registers its listeners
// as soon as it's imported).
global.ext = {
  pages: {
    onCommitted: { addListener: vi.fn() },
    onLoading: { addListener: vi.fn() },
    onLoaded: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  addTrustedMessageTypes: vi.fn(),
};
