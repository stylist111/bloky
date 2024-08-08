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

import {parseURL} from "adblockpluscore/lib/url.js";
import {Filter, URLFilter} from "adblockpluscore/lib/filterClasses.js";
import {SpecialSubscription} from "adblockpluscore/lib/subscriptionClasses.js";
import {isSlowFilter} from "adblockpluscore/lib/matcher.js";
import {filterNotifier} from "adblockpluscore/lib/filterNotifier.js";
import {contentTypes} from "adblockpluscore/lib/contentTypes.js";
import {MILLIS_IN_HOUR} from "adblockpluscore/lib/time.js";

import {default as initializer} from "./initializer.js";
import {filterEngine} from "./core.js";
import {EventDispatcher, FilterError} from "./types.js";
import {getFrameInfo, isTopLevelFrameId} from "./frame-state.js";
import {addFilters, getMetadataForFilter, setMetadataForFilter,
        validateFilter, getDynamicUserFilters,
        removeOrDisableFilters, enableFilters}
  from "./dnr-filters.js";
import {ERROR_FILTER_NOT_FOUND} from "../errors.js";
import {Prefs} from "./prefs.js";
import {Scheduler} from "./scheduler.js";

/**
 * @ignore
 * @param {*} filter Filter object
 * @returns {*} Plain filter object
 */
export function convertFilter(filter) {
  return {
    text: filter.text,
    enabled: typeof filter.disabled == "undefined" ? null : !filter.disabled,
    slow: filter instanceof URLFilter && isSlowFilter(filter),
    type: filter.type,
    thirdParty: filter.thirdParty != null ? filter.thirdParty : null,
    selector: filter.selector || null,
    csp: filter.csp || null,
    remove: filter.remove || void 0,
    css: filter.css || void 0
  };
}

function makeFilterListener(dispatch) {
  return filter => dispatch(convertFilter(filter));
}

function makeSubListener(dispatch) {
  return subscription => {
    if (subscription instanceof SpecialSubscription) {
      for (let text of subscription.filterText()) {
        dispatch(convertFilter(Filter.fromText(text)));
      }
    }
  };
}

async function disable(texts) {
  if (!Array.isArray(texts)) {
    texts = [texts];
  }

  if (browser.declarativeNetRequest) {
    await removeOrDisableFilters(texts, false);
    return;
  }

  for (let text of texts) {
    let normalized = Filter.normalize(text);
    filterEngine.filterStorage.filterState.setEnabled(normalized, false);
  }
}

/**
 * @ignore
 */
export const disableFilter = disable;

let onChanged = new EventDispatcher(dispatch => {
  filterNotifier.on("filterState.enabled", (text, enabled) => {
    dispatch({...convertFilter(Filter.fromText(text)), enabled}, "enabled");
  });

  filterNotifier.on("subscription.metadata", (subscription, value, oldValue) => {
    for (let filter of subscription.filterText()) {
      dispatch({
        ...convertFilter(Filter.fromText(filter)),
        metadata: value, oldMetadata: oldValue
      }, "metadata");
    }
  });
});

/**
 * @ignore
 */
export let onChangedFilter = onChanged;

/**
 * @namespace filters
 */
const namespace = {
  /**
   * Represents a single filter rule and its state.
   * @typedef {Object} Filter
   * @property {string} text A {@link https://help.adblockplus.org/hc/en-us/articles/360062733293|filter}
   *   rule that specifies what content to block or to allow. Used to identify
   *   a filter.
   * @property {boolean|null} enabled Indicates whether this filter would be
   *   applied. Filters are enabled by default. For comment filters returned
   *   value is null.
   * @property {boolean} slow Indicates that this filter is not subject to an
   *   internal optimization. Filters that are considered slow should be
   *   avoided. Only URLFilters can be slow.
   * @property {string} type The filter {@link https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/jobs/artifacts/0.6.0/file/build/docs/module-filterClasses.Filter.html?job=docs#type|type}
   * @property {boolean|null} thirdParty True when the filter applies to
   *   third-party, false to first-party, null otherwise.
   * @property {string|null} selector CSS selector for the HTML elements that
   *   will be hidden.
   * @property {string|null} csp Content Security Policy to be injected.
   * @property {boolean?} remove For element hiding emulation filters, true if
   *   the filter will remove elements from the DOM rather hiding them.
   * @property {Object?} css For element hiding emulation filters. These are
   *   the key-value pairs for the css properties to apply to the matched
   *   element.
   */

  /**
   * Represents the results of calling the `add` function.
   * @typedef {Object} FilterAddResult
   * @property {Array<string>} added The filter texts that were added.
   * @property {Array<string>} exists The filter texts that already exist. They
   *   have not been added, and their metadata has not been updated.
   */

  /**
   * Adds one or multiple filters from texts. Filters which have been previously
   * added are skipped without updating their metadata.
   *
   * If the metadata should be updated for a filter which already exists, this
   * can be achieved by calling `setMetadata`. To see which filters have not had
   * their metadata updated, see the `exists` property on the result of this
   * function call.
   *
   * @param {string|[string]} texts The filter rules to be added.
   * @param {?Object} metadata Extra data to associate with a filter.
   * @param {Number} [metadata.expiresAt] The timestamp when the filter should
   *   expire.
   * @param {Number} [metadata.autoExtendMs] The number of milliseconds to
   *   extend the filter's expiry when the user navigated to a URL that matches
   *   the filter. This parameter is used together with `expiresAt` and when the
   *   user navigates to a URL that matches this filter and is not expired,
   *   the `expiresAt` value will be updated to `Date.now() + autoExtendMs`.
   *
   *   _**Note:** This only applies to document allowlisting filters._
   *
   * @return {Promise<FilterAddResult>} A report of which filters were added,
   *   and which were not added because they already exist.
   * @throws {FilterError|Error} The first filter to add that either failed
   *   validation (FilterError) or that is not supported by the DNR (Error).
   *   If the reason is "filter_invalid_wildcard" that means filter either has
   *   more than 1 `*` or `*` is placed in an unsupported place.
   * @memberof filters
   */
  async add(texts, metadata) {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }

    if (browser.declarativeNetRequest) {
      const result = await addFilters(texts, metadata);
      updateSchedulerIfNeeded(metadata);
      return result;
    }

    let {filterStorage} = filterEngine;

    let added = [];
    let exists = [];

    let filters = [];
    for (let text of texts) {
      if (added.includes(text) || exists.includes(text)) {
        // Duplicates within the texts passed into this function don't get
        // duplicated in the returned value.
        continue;
      }

      let normalized = Filter.normalize(text);
      let filter = Filter.fromText(normalized);
      let error = validateFilter(filter);

      if (error) {
        throw error;
      }

      if (filterStorage.filterExists(filter)) {
        exists.push(text);
      }
      else {
        filters.push(filter);
        added.push(text);
      }
    }

    if (!metadata) {
      for (let filter of filters) {
        await filterStorage.addFilter(filter);
      }
    }
    else {
      try {
        await filterStorage.addFiltersWithMetadata(filters, metadata);
        updateSchedulerIfNeeded(metadata);
      }
      catch (e) {
        throw new FilterError(e.message);
      }
    }

    return {
      added,
      exists
    };
  },

  /**
   * Set an extra data associated with an added filter.
   * @param {string} text filter text to set metadata for.
   * @param {Object} metadata Extra data to associate with a filter.
   * @returns {Promise<void>} Nothing is done for not added filter.
   * @throws {FilterError} An error will be thrown for not added filter.
   * @memberof filters
   */
  async setMetadata(text, metadata) {
    if (browser.declarativeNetRequest) {
      setMetadataForFilter(text, metadata);
      updateSchedulerIfNeeded(metadata);
      return;
    }

    let {filterStorage} = filterEngine;

    try {
      await filterStorage.setMetadataForFilter(text, metadata);
      updateSchedulerIfNeeded(metadata);
    }
    catch (e) {
      if (e.message == ERROR_FILTER_NOT_FOUND) {
        // filter might be added without a metadata first,
        // so we're trying to make it working in a non-surprising way:
        // by removing the existing filter and readding it with a metadata.
        let filter = Filter.fromText(Filter.normalize(text));
        if (filterStorage.filterExists(filter)) {
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
   * @memberof filters
   */
  async getMetadata(text) {
    if (browser.declarativeNetRequest) {
      return getMetadataForFilter(text);
    }

    return await filterEngine.filterStorage.getMetadataForFilter(text);
  },

  /**
   * Returns an array of user filter objects.
   * @return {Promise<Array<Filter>>}
   * @memberof filters
   */
  async getUserFilters() {
    let result = [];

    for (let subscription of filterEngine.filterStorage.subscriptions()) {
      if (subscription instanceof SpecialSubscription) {
        for (let text of subscription.filterText()) {
          result.push(convertFilter(Filter.fromText(text)));
        }
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
   * @memberof filters
   */
  async getAllowingFilters(tabId, options = {}) {
    let {frameId, types} = {frameId: 0, types: ["document"], ...options};
    let filters = new Set();
    let mask = types.reduce((a, b) => a | contentTypes[b.toUpperCase()], 0);

    for (let frame = getFrameInfo(tabId, frameId); frame;
         frame = frame.parent) {
      let parentHostname = frame.parent && frame.parent.hostname;
      let docDomain = parentHostname || frame.hostname;
      let matches = filterEngine.defaultMatcher.search(
        frame.url, mask, docDomain, frame.sitekey, false, "allowing");

      for (let filter of matches.allowing) {
        filters.add(filter.text);
      }
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
   *   "webbundle", "webrtc", "websocket", "xbl", "xmlhttprequest".
   * @param {number} tabId The id of resource's tab.
   * @param {number} frameId=0 The id of the resource's frame.
   * @return {Promise<bool>}
   * @memberof filters
   */
  async isResourceAllowlisted(url, type, tabId, frameId = 0) {
    let mask = contentTypes[type.toUpperCase()];
    let frame = getFrameInfo(tabId, frameId) || {};
    let matcher = filterEngine.defaultMatcher;

    // The docDomain for a frame is the hostname of the parent frame
    // (the loader). For top-level frames we use the current URL's hostname.
    let docDomain = frame.hostname || parseURL(url).hostname;
    if (matcher.isAllowlisted(url, mask, docDomain, frame.sitekey)) {
      return true;
    }

    for (; frame; frame = frame.parent) {
      if (!frame.url) {
        break;
      }

      let parentHostname = frame.parent && frame.parent.hostname;
      docDomain = parentHostname || frame.hostname;
      if (matcher.isAllowlisted(frame.url, contentTypes.DOCUMENT,
                                docDomain, frame.sitekey)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Enables one or multiple filters. The filters effects
   * will again be applied.
   * @param {string|[string]} texts The filter rules to be enabled.
   * @return {Promise}
   * @memberof filters
   */
  async enable(texts) {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }

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
   * Disables one or multiple filters. The filters will no longer have
   * any effect but will be returned by `filters.getUserFilters()`.
   * @param {string|[string]} texts The filter rules to be disabled.
   * @return {Promise}
   * @memberof filters
   */
  disable,

  /**
   * Removes one or multiple filters. The filters will no longer have
   * any effect and won't be returned by `filters.getUserFilters()`.
   * @param {string|[string]} texts The filter rules to be removed.
   * @return {Promise}
   * @memberof filters
   */
  async remove(texts) {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }

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
   * Validates a filter.
   * @param {string} text Filter to be validated
   * @return {null|FilterError}
   * @memberof filters
   */
  validate(text) {
    let normalized = Filter.normalize(text);
    let filter = Filter.fromText(normalized);
    return validateFilter(filter);
  },

  /**
   * Removes unnecessary whitespaces from filter text, will only return null if
   * the input parameter is null.
   * @param {string} text Filter text to be normalized
   * @return {string} Normalized filter text
   * @memberof filters
   */
  normalize(text) {
    return Filter.normalize(text);
  },

  /**
   * Emitted when a new filter is added.
   * @event
   * @type {EventDispatcher<Filter>}
   * @memberof filters
   */
  onAdded: new EventDispatcher(dispatch => {
    filterNotifier.on("filter.added", makeFilterListener(dispatch));
    filterNotifier.on("subscription.added", makeSubListener(dispatch));
  }),

  /**
   * Emitted when a filter is either enabled or disabled.
   * The property name "enabled" or
   * "metadata" and optionally "oldMetadata" is provided.
   * @event
   * @type {EventDispatcher<Filter, string>}
   * @memberof filters
   */
  onChanged,

  /**
   * Emitted when a filter is removed.
   * @event
   * @type {EventDispatcher<Filter>}
   * @memberof filters
   */
  onRemoved: new EventDispatcher(dispatch => {
    filterNotifier.on("filter.removed", makeFilterListener(dispatch));
    filterNotifier.on("subscription.removed", makeSubListener(dispatch));
  }),

  /**
   * Returns an array of MV2 to MV3 migration errors and the related filters.
   * @return {Promise<array<Filter, string>>} The migration errors.
   * @memberof filters
   */
  async getMigrationErrors() {
    return Prefs.migration_filter_errors;
  },

  /**
   * Clears the migration errors.
   * @return {Promise}
   * @memberof filters
   */
  async clearMigrationErrors() {
    Prefs.migration_filter_errors = [];
  }
};

export default namespace;


async function removeExpiredFilters() {
  try {
    // Retrieve the list of user filters
    const filters = await namespace.getUserFilters();
    const now = Date.now();

    const filtersToRemove = [];
    // Iterate over each filter to check for expiration
    for (const filter of filters) {
      const metadata = await namespace.getMetadata(filter.text) || {};
      const {expiresAt} = metadata;

      // If the filter is expired, add it to the list of filters to remove
      if (expiresAt && now > expiresAt) {
        filtersToRemove.push(filter.text);
      }
    }

    // Remove all expired filters
    await namespace.remove(filtersToRemove);
  }
  catch (e) {
    console.error("Error while removing expired filters:", e);
  }
}


async function onCompleted(details) {
  await initializer.start();

  const {frameId, tabId} = details;

  // Only proceed if the navigation is in the main frame
  if (!isTopLevelFrameId(frameId)) {
    return;
  }

  try {
    // Retrieve the list of user filters
    const filters = await namespace.getAllowingFilters(tabId);
    const now = Date.now();

    // Iterate over each filter to check if its expiry should be extended
    for (const filterText of filters) {
      const metadata = await namespace.getMetadata(filterText) || {};
      const {expiresAt, autoExtendMs} = metadata;

      // If the filter is set to auto-extend, and it is not expired,
      // extend its expiration date
      const isExtendableFilter = autoExtendMs && expiresAt;
      if (isExtendableFilter && now < expiresAt) {
        await namespace.setMetadata(filterText, {
          ...metadata,
          expiresAt: now + autoExtendMs
        });
      }
    }
  }
  catch (e) {
    console.error("Error while extending expiry for filters:", e);
  }
}

let scheduler;

/**
 * Checks if the scheduler is running and updates the next timestamp if needed.
 *
 * @param {?Object} metadata Extra data to associate with a filter.
 * @param {Number} [metadata.expiresAt] The timestamp when the filter should
 *   expire.
 */
function updateSchedulerIfNeeded(metadata) {
  if (scheduler && metadata && metadata.expiresAt) {
    scheduler.checkNow();
  }
}

/**
 * Starts listening for navigation events to remove expired filters
 * or renew the expiry of filters that are set to auto-extend.
 * @ignore
 */
export function start() {
  if (scheduler) {
    return;
  }
  // Listen for navigation events to extend the expiry of filters
  browser.webNavigation.onCompleted.addListener(onCompleted);

  // initialize the scheduler to remove expired filters
  scheduler = new Scheduler({
    interval: 0,
    listener: () => removeExpiredFilters(),
    async getNextTimestamp() {
      await initializer.start();

      const filters = await namespace.getUserFilters();
      let nextTimestamp = Date.now() + MILLIS_IN_HOUR; // 1h from now

      for (const filter of filters) {
        const metadata = await namespace.getMetadata(filter.text) || {};
        const {expiresAt} = metadata;

        if (expiresAt && expiresAt < nextTimestamp) {
          nextTimestamp = expiresAt;
        }
      }

      return nextTimestamp;
    }
  });
}
