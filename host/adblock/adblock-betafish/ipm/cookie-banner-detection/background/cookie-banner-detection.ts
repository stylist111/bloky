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

import browser, { type WebNavigation } from "webextension-polyfill";
import { setupDetection } from "../content/detection";
import { executeFunction } from "./script-injector";

/**
 * Will try to inject the detection script if the event happened on the top-
 * level frame.
 *
 * @param details The navigation details
 */
async function injectDetectionScript(details: WebNavigation.OnCommittedDetailsType): Promise<void> {
  const { tabId, frameId } = details;
  // Only inject in the tab's top-level browsing context, not
  // in a nested <iframe>.
  if (details.frameId !== 0) {
    return;
  }

  try {
    await executeFunction(tabId, frameId, setupDetection);
  } catch (_) {
    // Can't recover from this.
  }
}

/**
 * Starts the cookie banner detection feature
 */
export function start(): void {
  browser.webNavigation.onCommitted.addListener((details) => {
    void injectDetectionScript(details);
  });
}
