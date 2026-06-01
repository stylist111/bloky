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

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { port } from "../../../../adblockplusui/adblockpluschrome/lib/messaging/port.js";

interface AddFilterMessage {
  text: string;
}

/**
 * Initializes filter-related testing functionality.
 *
 * Test-only port handler that adds a user filter with no metadata,
 * reproducing the legacy state where older versions of the extension
 * could persist custom filters without attaching metadata.
 */
export function start(): void {
  port.on("testing.addFilter", async (message: AddFilterMessage) => {
    await ewe.filters.add([message.text]);
  });
}
