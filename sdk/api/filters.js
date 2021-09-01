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

import {filterStorage} from "adblockpluscore/lib/filterStorage.js";
import {Filter, isActiveFilter, InvalidFilter, URLFilter}
  from "adblockpluscore/lib/filterClasses.js";
import {isValidHostname} from "adblockpluscore/lib/url.js";
import {SpecialSubscription}
  from "adblockpluscore/lib/subscriptionClasses.js";
import {isSlowFilter} from "adblockpluscore/lib/matcher.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {filterState} from "adblockpluscore/lib/filterState.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";

import {EventDispatcher, FilterError} from "./types.js";
import {getFrameInfo} from "./frame-state.js";

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

function validateFilter(filter)
{
  if (filter instanceof InvalidFilter)
    return new FilterError("invalid_filter", filter.reason, filter.option);

  if (isActiveFilter(filter) && filter.domains)
  {
    for (let domain of filter.domains.keys())
    {
      if (domain && !isValidHostname(domain))
        return new FilterError("invalid_domain", domain);
    }
  }

  return null;
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
   * Adds a filter from text.
   * @param {string} text The filter rule to be added.
   * @throws {FilterError}
   * @return {undefined}
   */
  add(text)
  {
    let normalized = Filter.normalize(text);
    let filter = Filter.fromText(normalized);
    let error = validateFilter(filter);

    if (error)
      throw error;

    filterStorage.addFilter(filter);
  },

  /**
   * Returns an array of filter objects that have been added to subscriptions.
   * @return {Array.<Filter>}
   */
  getAll()
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

    return result;
  },

  /**
   * Returns allowlisted filters for a specific document.
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
    let filters = [];
    let {frameId, types} = {frameId: 0, types: ["document"], ...options};
    let frameInfo = getFrameInfo(tabId, frameId);

    if (frameInfo && frameInfo.allowingFilters)
    {
      let mask = types.reduce((a, b) => a | contentTypes[b.toUpperCase()], 0);
      for (let filter of frameInfo.allowingFilters)
      {
        if ((filter.contentType & mask) != 0)
          filters.push(filter.text);
      }
    }

    return filters;
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
   * Removes a filter. The filter will no longer have any effect
   * and won't be returned by `filters.getAll()`
   * @param {string} text The filter rule to be removed.
   */
  remove(text)
  {
    let normalized = Filter.normalize(text);
    filterStorage.removeFilter(Filter.fromText(normalized));
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
   * @event
   * @type {EventDispatcher.<Filter>}
   */
  onChanged: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("filterState.enabled", (text, enabled) =>
    {
      dispatch({...convertFilter(Filter.fromText(text)), enabled});
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
