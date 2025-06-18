/*
 * This file is part of eyeo's Cookie banner detection fragment,
 * Copyright (C) 2025-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";
import { type WebNavigation } from "webextension-polyfill";
// Intentionally importing a content script:
import { setupDetection } from "../content/detection";
import { executeFunction } from "./script-injector";

/**
 * Will try to inject the detection script if the event happened on the top-
 * level frame.
 *
 * @param details The navigation details
 */
export async function injectDetectionScript(
  details: WebNavigation.OnCommittedDetailsType,
): Promise<void> {
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
 * A sync wrapper for our async handler.
 *
 * @param details The navigation details object
 */
export function navigationListener(
  details: WebNavigation.OnCommittedDetailsType,
): void {
  void injectDetectionScript(details);
}

/**
 * Starts the cookie banner detection feature
 */
export function start(): void {
  browser.webNavigation.onCommitted.addListener(navigationListener);
}
