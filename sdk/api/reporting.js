/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {analytics} from "adblockpluscore/lib/analytics.js";

import {EventDispatcher} from "./types.js";
import {setLogFunction} from "./diagnostics.js";

export default {
  /**
   * Returns the version of the first ever downloaded resource.
   * @return {string}
   * @see {@link https://eyeo.gitlab.io/adblockplus/adblockpluscore/master/docs/module-analytics-Analytics.html#getFirstVersion|Adblock Plus core analytics documentation}
   * @external
   */
  getFirstVersion: analytics.getFirstVersion,

  /**
  * @typedef {Object} FilterMatchInfo
  * @property {string|undefined} docDomain The domain name of the document that
  *                                        loads the URL.
  * @property {string|undefined} rewrittenUrl The name of the internal resource
  *                                           to which to rewrite the URL.
  * @property {boolean|undefined} specificOnly Whether selectors from generic
  *                                           filters should be included.
  */

  /**
   * Emitted when any filter is matched.
   * @event
   * @param {object|{frameId: number, tabId: number, url: string}} details
   *   Either
   *   the {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeRequest#details|onBeforeRequest details}
   *   object or the {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onHeadersReceived#details|onHeadersReceived details}
   *   object from the web extensions API, or an object with the properties
   *   `frameId`, `tabId` and `url` (for snippet filters `url` is undefined).
   * @param {Filter} filter The filter that matched.
   * @param {FilterMatchInfo} info Extra information that might be
   *                    relevant depending on the context.
   * @type {EventDispatcher.<{details: object,
   *                          filter: Filter,
   *                          info: FilterMatchInfo}>}
   */
  onFilterMatch: new EventDispatcher(
    setLogFunction,
    () =>
    {
      setLogFunction(null);
    }
  ),

  /**
   * The contentTypes object.
   * @see {@link https://eyeo.gitlab.io/adblockplus/adblockpluscore/master/docs/module-contentTypes.html#.contentTypes|Adblock Plus core content types documentation}
   * @external
   */
  contentTypes
};
