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

import ServerMessages from "~/servermessages";
import { getMatchingDomain } from "./domains";

/**
 * Records metrics related to a Blockthrough Acceptable Ads detection event.
 *
 * @param details - The details of the event, including our conclusion on if
 * this is an Acceptable Ads Page View.
 */
async function handleBTAADetectionEvent(details: ewe.BtaaDetectionDetails): Promise<void> {
  const domain = await getMatchingDomain(details.siteId);
  if (!domain) {
    return;
  }

  let packedDetails = 0;
  packedDetails |= details.isAAPV ? 1 : 0;
  packedDetails <<= 1;
  packedDetails |= details.ab ? 1 : 0;
  packedDetails <<= 1;
  packedDetails |= details.acceptable ? 1 : 0;

  ServerMessages.recordAnonymousMessage("btaa_detection", "stats", null, {
    misc_text: domain,
    sid: details.sessionId,
    var: packedDetails,
  });
}

/**
 * Initializes functionality to record Blockthrough Acceptable Ads detection events.
 */
export function start(): void {
  ewe.cdp.onBTAADetectionEvent.addListener(handleBTAADetectionEvent);
}
