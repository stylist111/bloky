/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import { CreationMethod, type NewTab } from "./middleware";

/**
 * A list of `NewTab`s to run tests with. IDs are the array index.
 */
export const newTabRequests: NewTab[] = [
  /*
   * NewTabs to test priority, highest priority first. The last two have the same priority.
   */
  {
    // 0
    behavior: {
      priority: 5,
      target: "",
      method: CreationMethod.force
    },
    ipmId: "a"
  },
  {
    // 1
    behavior: {
      priority: 2,
      target: "",
      method: CreationMethod.force
    },
    ipmId: "b"
  },
  {
    // 2
    behavior: {
      priority: 2,
      target: "",
      method: CreationMethod.default
    },
    ipmId: "c"
  },
  {
    // 3
    behavior: {
      priority: 1,
      target: "",
      method: CreationMethod.default
    },
    ipmId: "d"
  },
  {
    // 4
    behavior: {
      priority: 1,
      target: "",
      method: CreationMethod.default
    },
    ipmId: "e"
  },
  {
    // 5
    behavior: {
      priority: 1,
      target: "",
      method: CreationMethod.default
    },
    ipmId: "e"
  }
];
