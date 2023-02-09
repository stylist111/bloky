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

import {analytics} from "adblockpluscore/lib/analytics.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";

import {BlockableEventDispatcher} from "./diagnostics.js";
import {resourceTypes} from "./request-filter.js";
import {onSubscribeLinkClicked} from "./subscribe-links.js";

let contentTypesMap = new Map();

for (let item of resourceTypes) {
  let contentTypeObject = Object.keys(contentTypes).find(key =>
    contentTypes[key] === item[1]
  );

  contentTypesMap.set(item[0].toLowerCase(), contentTypeObject.toLowerCase());
}

export default {
  /**
   * Returns the version of the first ever downloaded resource.
   * @return {string}
   * @see {@link https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/jobs/artifacts/0.6.0/file/build/docs/module-analytics-Analytics.html?job=docs#getFirstVersion|Adblock Plus core analytics documentation}
   * @external
   */
  getFirstVersion: analytics.getFirstVersion,

  /**
  * @typedef {Object} FilterMatchInfo
  * @property {string|null} docDomain The hostname of the document that caused
  *   the request. This will be null for "main_frame" requests since those
  *   create the top-level document in the first place.
  * @property {?string} rewrittenUrl The name of the internal resource to which
  *   to rewrite the URL.
  * @property {?boolean} specificOnly Whether selectors from generic filters
  *   should be included.
  * @property {string} method The method used to match this filter. This can be
  *   the string "request", "header", "csp", "popup", "elemhide", "snippet",
  *   "allowing", or "unmatched".
  * @property {?string} allowingReason When the type in request details is
  *   undefined, this contains the reason why the request/frame got
  *   allowlisted. That is either "document", "elemhide", "genericblock",
  *   "generichide", or "extensionInitiated". "extensionInitiated" refers to any
  *   web requests initiated by a browser extension rather than a web page
  *   (those requests are not blockable).
  */

  /**
   * Emitted when any blockable item is matched.
   *
   * This includes both filters being applied on a document level and web
   * requests. Multiple events may be emitted for a document, one for each
   * filter being applied to the document. There will generally only be one
   * event emitted for each web request. The exception to this is CSP filters,
   * where multiple CSP filters may be applied to a request at the same time,
   * and an event will be emitted for each filter applied.
   * @event
   * @param {object|{frameId: number, tabId: number, url: string}} request
   *   Either
   *   the {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeRequest#details|onBeforeRequest details}
   *   object or the {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onHeadersReceived#details|onHeadersReceived details}
   *   object from the web extensions API, or an object with the properties
   *   `frameId`, `tabId` and `url`.
   * @param {?Filter} filter The filter that matched, if any.
   * @param {FilterMatchInfo} matchInfo Extra information that might be
   *                                    relevant depending on the context.
   * @type {BlockableEventDispatcher<{request: object,
   *                                   filter: Filter,
   *                                   matchInfo: FilterMatchInfo}>}
   */
  onBlockableItem: new BlockableEventDispatcher(),

  /**
   * Returns a mapping between resourceTypes and contentTypes.
   * @return {Map<string, string>}
   */
  contentTypesMap,

  /**
   * Emitted when a subscribe link is clicked on a web page.
   *
   * A subscribe link has a URL pointing to `https://subscribe.adblockplus.org/`
   * or starting with `abp:subscribe` (deprecated), followed by a query string
   * with a `location` parameter, and optionally a `title` parameter. Subscribe
   * links can only be used on certain trusted domains (including `localhost`).
   * @example
   * <a href="https://subscribe.adblockplus.org?location=http%3A%2F%2Flocalhost%2Flist.txt&title=Example">Example</a>
   * <a href="abp:subscribe?location=location=http%3A%2F%2Flocalhost%2Flist.txt&title=Example">Example (deprecated)</a>
   * @event
   * @param {string} url The subscription URL from the subscribe link
   *                     `location`'s parameter.
   * @param {string} title The subscription title from the subscribe link
   *                       `title`'s parameter.
   * @type {EventDispatcher<{url: string, title: string}>}
   */
  onSubscribeLinkClicked
};
