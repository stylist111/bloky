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

import {Filter, URLFilter} from "adblockpluscore/lib/filterClasses.js";
import {SpecialSubscription} from "adblockpluscore/lib/subscriptionClasses.js";
import {isSlowFilter} from "adblockpluscore/lib/matcher.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";

import {default as initializer} from "./initializer.js";
import {filterEngine} from "./core.js";
import {EventDispatcher, FilterError} from "./types.js";
import {getFrameInfo} from "./frame-state.js";
import {addFilters, getMetadataForFilter, setMetadataForFilter,
        validateFilter, getDynamicUserFilters,
        removeOrDisableFilters, enableFilters}
  from "./dnr-filters.js";
import {ERROR_DUPLICATE_FILTERS, ERROR_FILTER_NOT_FOUND} from "../errors.js";
import {Prefs} from "./prefs.js";

export function convertFilter(filter) {
  return {
    text: filter.text,
    enabled: typeof filter.disabled == "undefined" ? null : !filter.disabled,
    slow: filter instanceof URLFilter && isSlowFilter(filter),
    type: filter.type,
    thirdParty: filter.thirdParty || null,
    selector: filter.selector || null,
    csp: filter.csp || null
  };
}

function makeFilterListener(dispatch) {
  return filter => dispatch(convertFilter(filter));
}

function makeSubListener(dispatch) {
  return subscription => {
    if (subscription instanceof SpecialSubscription) {
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
   * @property {boolean|null} enabled Indicates whether this filter would
   *                                  be applied. Filters are enabled by
   *                                  default. For comment filters returned
   *                                  value is null.
   * @property {boolean} slow Indicates that this filter is not subject to an
   *                          internal optimization. Filters that are
   *                          considered slow should be avoided. Only URLFilters
   *                          can be slow.
   * @property {string} type The filter {@link https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/jobs/artifacts/0.6.0/file/build/docs/module-filterClasses.Filter.html?job=docs#type|type}
   * @property {boolean|null} thirdParty True when the filter applies to
   *                          third-party, false to first-party, null otherwise.
   * @property {string|null} selector CSS selector for the HTML elements that
   *                                  will be hidden.
   * @property {string|null} csp Content Security Policy to be injected.
   */

  /**
   * Adds multiple filters from texts.
   * @param {[string]} texts The filter rules to be added.
   * @param {?Object} metadata Extra data to associate with a filter.
   * @return {Promise}
   * @throws {FilterError|Error} The first filter to add that either failed
   *   validation (FilterError) or that is not supported by the DNR (Error).
   *   An error will be thrown for duplicated filters.
   */
  async add(texts, metadata) {
    await initializer.start();
    if (browser.declarativeNetRequest) {
      await addFilters(texts, metadata);
      return;
    }

    let filters = [];
    for (let text of texts) {
      let normalized = Filter.normalize(text);
      let filter = Filter.fromText(normalized);
      let error = validateFilter(filter);

      if (error)
        throw error;

      filters.push(filter);
    }

    let {filterStorage} = filterEngine;

    if (!metadata) {
      if (filterStorage.filtersExist(filters).length > 0)
        throw new FilterError(ERROR_DUPLICATE_FILTERS);

      for (let filter of filters)
        await filterStorage.addFilter(filter);
    }
    else {
      try {
        await filterStorage.addFiltersWithMetadata(filters, metadata);
      }
      catch (e) {
        throw new FilterError(e.message);
      }
    }
  },

  /**
   * Set an extra data associated with an added filter.
   * @param {string} text filter text to set metadata for.
   * @param {Object} metadata Extra data to associate with a filter.
   * @returns {Promise<void>} Nothing is done for not added filter.
   * @throws {FilterError} An error will be thrown for not added filter.
   */
  async setMetadata(text, metadata) {
    await initializer.start();
    if (browser.declarativeNetRequest) {
      setMetadataForFilter(text, metadata);
      return;
    }

    let {filterStorage} = filterEngine;

    try {
      await filterStorage.setMetadataForFilter(text, metadata);
    }
    catch (e) {
      if (e.message == ERROR_FILTER_NOT_FOUND) {
        // filter might be added without a metadata first,
        // so we're trying to make it working in a non-surprising way:
        // by removing the existing filter and readding it with a metadata.
        let filter = Filter.fromText(Filter.normalize(text));
        if (filterStorage.filtersExist([filter]).length > 0) {
          await filterStorage.removeFilter(filter);
          await this.add([text], metadata);
          return;
        }
      }
      throw new FilterError(e.message);
    }
  },

  /**
   * Returns an extra data associated with a filter.
   * @param {string} text The filter text to get metadata for.
   * @return {Promise<?Object>}
   */
  async getMetadata(text) {
    await initializer.start();
    if (browser.declarativeNetRequest)
      return getMetadataForFilter(text);

    return await filterEngine.filterStorage.getMetadataForFilter(text);
  },

  /**
   * Returns an array of user filter objects.
   * @return {Promise<Array<Filter>>}
   */
  async getUserFilters() {
    await initializer.start();
    let result = [];

    for (let subscription of filterEngine.filterStorage.subscriptions()) {
      if (subscription instanceof SpecialSubscription) {
        for (let text of subscription.filterText())
          result.push(convertFilter(Filter.fromText(text)));
      }
    }

    if (browser.declarativeNetRequest) {
      for (let [text, details] of (await getDynamicUserFilters()).entries()) {
        if (!result.find(filter => filter.text == text)) {
          let filter = convertFilter(Filter.fromText(text));
          filter.enabled = filter.type == "comment" ? null : details.enabled;

          result.push(filter);
        }
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
   * @param {Array<string>} [options.types=["document"]] The types of filters
   *   to consider. These can be any of "document", "elemhide", "genericblock",
   *   and "generichide".
   * @return {Promise<Array<string>>}
   */
  async getAllowingFilters(tabId, options = {}) {
    await initializer.start();

    let {frameId, types} = {frameId: 0, types: ["document"], ...options};
    let filters = new Set();
    let mask = types.reduce((a, b) => a | contentTypes[b.toUpperCase()], 0);

    for (let frame = getFrameInfo(tabId, frameId); frame;
         frame = frame.parent) {
      let parentHostname = frame.parent && frame.parent.hostname;
      let docDomain = parentHostname || frame.hostname;
      let matches = filterEngine.defaultMatcher.search(
        frame.url, mask, docDomain, frame.sitekey, false, "allowing");

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
   * @return {Promise<bool>}
   */
  async isResourceAllowlisted(url, type, tabId, frameId = 0) {
    await initializer.start();

    let mask = contentTypes[type.toUpperCase()];
    let frame = getFrameInfo(tabId, frameId) || {};
    let matcher = filterEngine.defaultMatcher;

    if (matcher.isAllowlisted(url, mask, frame.hostname, frame.sitekey))
      return true;

    for (; frame; frame = frame.parent) {
      if (!frame.url)
        break;

      let parentHostname = frame.parent && frame.parent.hostname;
      if (matcher.isAllowlisted(frame.url, contentTypes.DOCUMENT,
                                parentHostname, frame.sitekey))
        return true;
    }

    return false;
  },

  /**
   * Enables multiple filters. The filters effects will again be applied.
   * @param {[string]} texts The filter rules to be enabled.
   * @return {Promise}
   */
  async enable(texts) {
    await initializer.start();

    if (browser.declarativeNetRequest) {
      await enableFilters(texts);
      return;
    }

    for (let text of texts) {
      let normalized = Filter.normalize(text);
      filterEngine.filterStorage.filterState.setEnabled(normalized, true);
    }
  },

  /**
   * Disables multiple filters. The filters will no longer have any effect
   * but will be returned by `filters.getUserFilters()`.
   * @param {[string]} texts The filter rules to be disabled.
   * @return {Promise}
   */
  async disable(texts) {
    await initializer.start();

    if (browser.declarativeNetRequest) {
      await removeOrDisableFilters(texts, false);
      return;
    }

    for (let text of texts) {
      let normalized = Filter.normalize(text);
      filterEngine.filterStorage.filterState.setEnabled(normalized, false);
    }
  },

  /**
   * Removes multiple filters. The filters will no longer have any effect
   * and won't be returned by `filters.getUserFilters()`.
   * @param {[string]} texts The filter rules to be removed.
   * @return {Promise}
   */
  async remove(texts) {
    await initializer.start();

    if (browser.declarativeNetRequest) {
      await removeOrDisableFilters(texts, true);
      return;
    }

    for (let text of texts) {
      let normalized = Filter.normalize(text);
      filterEngine.filterStorage.removeFilter(Filter.fromText(normalized));
    }
  },

  /**
   * Validates a list of filters.
   * @param {string} text Filter to be validated
   * @return {null|FilterError}
   */
  validate(text) {
    return validateFilter(Filter.fromText(text));
  },

  /**
   * Emitted when a new filter is added.
   * @event
   * @type {EventDispatcher<Filter>}
   */
  onAdded: new EventDispatcher(dispatch => {
    filterNotifier.on("filter.added", makeFilterListener(dispatch));
    filterNotifier.on("subscription.added", makeSubListener(dispatch));
  }),

  /**
   * Emitted when a filter is either enabled or disabled.
   * The property name "enabled" is provided.
   * @event
   * @type {EventDispatcher<Filter, string>}
   */
  onChanged: new EventDispatcher(dispatch => {
    filterNotifier.on("filterState.enabled", (text, enabled) => {
      dispatch({...convertFilter(Filter.fromText(text)), enabled}, "enabled");
    });
  }),

  /**
   * Emitted when a filter is removed.
   * @event
   * @type {EventDispatcher<Filter>}
   */
  onRemoved: new EventDispatcher(dispatch => {
    filterNotifier.on("filter.removed", makeFilterListener(dispatch));
    filterNotifier.on("subscription.removed", makeSubListener(dispatch));
  }),

  /**
   * Returns an array of MV2 to MV3 migration errors and the related filters.
   * @return {Promise<array<Filter, string>>} The migration errors.
   */
  async getMigrationErrors() {
    await initializer.start();
    return Prefs.migration_filter_errors;
  },

  /**
   * Clears the migration errors.
   * @return {Promise}
   */
  async clearMigrationErrors() {
    await initializer.start();
    Prefs.migration_filter_errors = [];
  }
};
