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

/* For ESLint: List any global identifiers used in this file below */

import { commandStats, commandStorageKey } from "~/ipm/background/command-library.types";

import { eventStorageKey } from "~/ipm/background/data-collection.types";

const IPM_CONSTANTS = [
  /* IPM values */
  commandStats,
  commandStorageKey,
  eventStorageKey,

  /* OPD values */
  "onpage_dialog_command_stats",
  "onpage_dialog_timing_configurations",
];

const NO_DATA = "no data";

const PING_COUNT_STORAGE_KEY = "total_pings";

export { IPM_CONSTANTS, NO_DATA, PING_COUNT_STORAGE_KEY };
