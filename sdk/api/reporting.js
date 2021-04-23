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

import {getFrameInfo} from "./frame-state.js";
import {contentTypes} from "../../adblockpluscore/lib/contentTypes.js";
import {EventDispatcher} from "./types.js";
import {setLogFunction} from "./diagnostics.js";

export default {
  /**
   * Emitted when any filter is matched.
   * @event
   * @param {object|null} details Either null in a non-request context
   *                              or a details object from either
   *                              {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeRequest#details|webRequest.onBeforeRequest}
   *                              or {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onHeadersReceived#details|webRequest.onHeadersReceived}
   *                              from the web extensions API.
   * @param {string} filter The text value of the filter matched.
   * @type {EventDispatcher.<{details: object, filter: string}>}
   */
  onFilterMatch: new EventDispatcher(
    setLogFunction,
    () =>
    {
      setLogFunction(null);
    }
  ),

  /**
   * Returns whether or not a tab/frame is allowlisted.
   * @param {number} tabId The id of the tab to check.
   * @param {number} [frameId] The id of the frame to check.
   * @return {boolean}
   */
  isAllowlisted(tabId, frameId = 0)
  {
    let frameInfo = getFrameInfo(tabId, frameId);
    return (frameInfo.allowlisted & contentTypes.DOCUMENT) != 0;
  }
};
