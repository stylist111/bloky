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

import browser from "webextension-polyfill";

import {filterStorage} from "adblockpluscore/lib/filterStorage.js";
import {Filter, URLFilter} from "adblockpluscore/lib/filterClasses.js";
import {SpecialSubscription}
  from "adblockpluscore/lib/subscriptionClasses.js";
import {isSlowFilter} from "adblockpluscore/lib/matcher.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {filterState} from "adblockpluscore/lib/filterState.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {defaultMatcher as matcher} from "adblockpluscore/lib/matcher.js";

import {EventDispatcher} from "./types.js";
import {getFrameInfo} from "./frame-state.js";
import {addFilters, removeFilters, validateFilter, getDynamicFilterTexts}
  from "./dnr-filters.js";

export function convertFilter(filter)
{
  return {
    text: filter.text,
    enabled: !filter.disabled,
    slow: filter instanceof URLFilter && isSlowFilter(filter),
    type: filter.type,
    thirdParty: filter.thirdParty,
    selector: filter.selector || null,
    csp: filter.csp
  };
}

function makeFilterListener(dispatch)
{
  return filter => dispatch(convertFilter(filter));
}

function makeSubListener(dispatch)
{
  return subscription =>
  {
    if (subscription instanceof SpecialSubscription)
    {
      for (let text of subscription.filterText())
        dispatch(convertFilter(Filter.fromText(text)));
    }
  };
}

export default {
  /**
   * Represents a single filter rule and its state.
   * @typedef {Object} Filter
   * @property {string} text A {@link https://help.eyeo.com/adblockplus/how-to-write-filters|filter}
   *                         rule that specifies what content
   *                         to block or to allow. Used to identify a filter.
   * @property {boolean} enabled Indicates whether this filter would
   *                             be applied. Filters are enabled by default.
   * @property {boolean} slow Indicates that this filter is not subject to an
   *                          internal optimization. Filters that are
   *                          considered slow should be avoided. Only URLFilters
   *                          can be slow.
   * @property {string} type The filter {@link https://eyeo.gitlab.io/adblockplus/abc/adblockpluscore/next/docs/module-filterClasses.Filter.html#type|type}
   * @property {boolean|null} thirdParty True when the filter applies to
   *                          third-party, false to first-party, null otherwise.
   * @property {string|null} selector CSS selector for the HTML elements that
   *                                  will be hidden.
   * @property {string|null} csp Content Security Policy to be injected.
   */

  /**
   * Adds multiple filters from texts.
   * @param {[string]} texts The filter rules to be added.
   * @throws {FilterError|Error} The first filter to add that either failed
   *   validation (FilterError) or that is not supported by the DNR (Error).
   */
  async add(texts)
  {
    if (browser.declarativeNetRequest)
    {
      await addFilters(texts);
      return;
    }

    let filters = [];
    for (let text of texts)
    {
      let normalized = Filter.normalize(text);
      let filter = Filter.fromText(normalized);
      let error = validateFilter(filter);

      if (error)
        throw error;

      filters.push(filter);
    }

    for (let filter of filters)
      filterStorage.addFilter(filter);
  },

  /**
   * Returns an array of user filter objects.
   * @return {Array.<Filter>}
   */
  async getUserFilters()
  {
    let result = [];

    for (let subscription of filterStorage.subscriptions())
    {
      if (subscription instanceof SpecialSubscription)
      {
        for (let text of subscription.filterText())
          result.push(convertFilter(Filter.fromText(text)));
      }
    }

    if (browser.declarativeNetRequest)
    {
      for (let text of await getDynamicFilterTexts())
      {
        if (!result.find(filter => filter.text == text))
          result.push(convertFilter(Filter.fromText(text)));
      }
    }

    return result;
  },

  /**
   * Returns the allowing filters that will be effective
   * when the given document will be reloaded.
   * @param {number} tabId The id of the tab to lookup.
   * @param {Object} [options]
   * @param {number} [options.frameId=0] The id of the frame to lookup.
   * @param {Array.<string>} [options.types=["document"]]
   *                         The types of filters to consider.
   *                         These can be any of "document", "elemhide",
   *                         "genericblock", and "generichide".
   * @return {Array.<string>}
   */
  getAllowingFilters(tabId, options = {})
  {
    let {frameId, types} = {frameId: 0, types: ["document"], ...options};
    let filters = new Set();
    let mask = types.reduce((a, b) => a | contentTypes[b.toUpperCase()], 0);

    for (let frame = getFrameInfo(tabId, frameId); frame; frame = frame.parent)
    {
      let parentHostname = frame.parent && frame.parent.hostname;
      let matches = matcher.search(frame.url, mask, parentHostname,
                                   frame.sitekey, false, "allowing");

      for (let filter of matches.allowing)
        filters.add(filter.text);
    }

    return Array.from(filters);
  },

  /**
   * Returns whether a particular resource is allowlisted.
   * @param {string} url The resource's url.
   * @param {string} type The resource's content type. Can be one of
   *   "background", "csp", "document", "dtd", "elemhide", "font",
   *   "genericblock", "generichide", "header", "image", "media", "object",
   *   "other", "ping", "popup", "script", "stylesheet", "subdocument",
   *   "webrtc", "websocket", "xbl", "xmlhttprequest".
   * @param {number} tabId The id of resource's tab.
   * @param {number} frameId=0 The id of the resource's frame.
   * @return {bool}
   */
  isResourceAllowlisted(url, type, tabId, frameId = 0)
  {
    let {hostname, sitekey} = getFrameInfo(tabId, frameId) || {};
    let mask = contentTypes[type.toUpperCase()];

    return matcher.isAllowlisted(url, mask, hostname, sitekey);
  },

  /**
   * Enables a previously disabled filter. Has no effect otherwise.
   * @param {string} text The filter rule to be enabled.
   */
  enable(text)
  {
    let normalized = Filter.normalize(text);
    filterState.setEnabled(normalized, true);
  },

  /**
   * Disables a filter so that it doesn't have any
   * effect until it gets enabled again.
   * @param {string} text The filter rule to be disabled.
   */
  disable(text)
  {
    let normalized = Filter.normalize(text);
    filterState.setEnabled(normalized, false);
  },

  /**
   * Removes multiple filters. The filters will no longer have any effect
   * and won't be returned by `filters.getUserFilters()`.
   * @param {[string]} texts The filter rules to be removed.
   */
  async remove(texts)
  {
    if (browser.declarativeNetRequest)
    {
      await removeFilters(texts);
      return;
    }

    for (let text of texts)
    {
      let normalized = Filter.normalize(text);
      filterStorage.removeFilter(Filter.fromText(normalized));
    }
  },

  /**
   * Validates a list of filters.
   * @param {string} text Filter to be validated
   * @return {null|FilterError}
   */
  validate(text)
  {
    return validateFilter(Filter.fromText(text));
  },

  /**
   * Emitted when a new filter is added.
   * @event
   * @type {EventDispatcher.<Filter>}
   */
  onAdded: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("filter.added", makeFilterListener(dispatch));
    filterNotifier.on("subscription.added", makeSubListener(dispatch));
  }),

  /**
   * Emitted when a filter is either enabled or disabled.
   * The property name "enabled" is provided.
   *
   * @event
   * @type {EventDispatcher.<Filter, string>}
   */
  onChanged: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("filterState.enabled", (text, enabled) =>
    {
      dispatch({...convertFilter(Filter.fromText(text)), enabled}, "enabled");
    });
  }),

  /**
   * Emitted when a filter is removed.
   * @event
   * @type {EventDispatcher.<Filter>}
   */
  onRemoved: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("filter.removed", makeFilterListener(dispatch));
    filterNotifier.on("subscription.removed", makeSubListener(dispatch));
  })
};
