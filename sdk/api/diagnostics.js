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

import {Filter, ElemHideFilter} from "adblockpluscore/lib/filterClasses.js";
import {parseURL} from "adblockpluscore/lib/url.js";
import browser from "./browser.js";
import {filterEngine} from "./core.js";
import {convertFilter} from "./filters.js";
import {BLANK_PAGE_URL} from "./frame-state.js";

let listeners = [];
let filterTextToEvents = new Map();
let defaultOptions = {includeElementHiding: false,
                      includeUnmatched: false,
                      filterType: "blocking",
                      tabId: null};

/**
 * The BlockableEventDispatcher class allows users to listen to
 * filters and requests.
 * @hideconstructor
 */
export class BlockableEventDispatcher {
  /**
  * @typedef {Object} BlockableEventOptions
  * @param {boolean} [includeElementHiding=false]
  *   Whether or not element hiding filters accounting for dynamic DOM changes
  *   should also be emitted. This event is emitted after the page has been
  *   fully loaded, and the element hiding filters have been applied. The
  *   expected delay between the filter being applied and the event being
  *   emitted is around two seconds.
  *   Note that this will enable element hiding tracing, which degrades
  *   performance and should only be used to enable ad-hoc diagnostics.
  * @param {boolean} [includeUnmatched=false] Whether or not unmatched requests
  *   should also be emitted. This event is generally emitted after a request is
  *   fully completed. Note that blockable item events may refer to either
  *   requests or documents. Unmatched events only refer to requests. This has
  *   the potentially confusing implication that there may be allowing document
  *   events (eg a $genericblock allowing filter being activated for a document)
  *   as well as an unmatched event for the request that actually loaded the
  *   HTML of the document.
  * @param {string} [filterType="blocking"]
  *   The type of filters to emit. Can be "blocking", "allowing", or "all".
  * @param {Number} [tabId=null]
  *   The tab to filter events for. Element hiding tracing will be limited to
  *   this tab (if `includeElementHiding` is set). If set to `null` events for
  *   all tabs will be considered, and are subject to element hiding tracing
  *   (if `includeElementHiding` is set) which will degrade performance.
  */

  /**
   * Attaches a listener function to an event. This listener will be called
   * when the Blockable event is emitted.
   * @param {function} listener The user defined function that will be called
   *                            once the specified event is emitted.
   * @param {BlockableEventOptions} options The filtering conditions to apply
   *                                        when the event is emitted.
   * @example
   * // Logs all blocked requests
   * EWE.reporting.onBlockableItem.addListener(console.log);
   * @example
   * // Log all blockable items of a specific tab for debugging purposes
   * EWE.reporting.onBlockableItem.addListener(
   *   console.log,
   *   {includeElementHiding: true,
   *    includeUnmatched: true,
   *    filterType: "all", tabId}
   * );
   */
  addListener(listener, options) {
    listeners.push({listener, options: {...defaultOptions, ...options}});
  }

  /**
   * Removes the added function. This means the listener will no
   * longer be called by the emitted event.
   * @param {function} listener The user defined function to be removed.
   * @param {Object} options The filtering conditions to apply when
   *                         the event is emitted.
   */
  removeListener(listener, options) {
    let {includeElementHiding, includeUnmatched,
         filterType, tabId} = {...defaultOptions, ...options};

    let index = listeners.findIndex(obj =>
      obj.listener == listener &&
      obj.options.includeElementHiding == includeElementHiding &&
      obj.options.includeUnmatched == includeUnmatched &&
      obj.options.filterType == filterType &&
      obj.options.tabId == tabId
    );

    if (index != -1)
      listeners.splice(index, 1);
  }
}

export function getMatchedFilterEvents(filterText) {
  return filterTextToEvents.get(filterText);
}

export function clearMatchedFilterEvents(tabId) {
  if (tabId) {
    for (let events of filterTextToEvents.values())
      events = events.filter(event => event.details.tabId != tabId);
  }
  else {
    filterTextToEvents.clear();
  }
}

function logFilterEvent(details, filter, matchInfo) {
  if (!filter)
    return;

  // DNR rule (filter text) can match multiple times,
  // so saving all the events to find the according one later.
  let events = filterTextToEvents.get(filter.text);
  if (!events)
    events = [];

  events.push({details, matchInfo});

  // Assuming the DNR matched rules order corresponds to
  // filter engine matched filters events order,
  // so let's keep it ready (sorted) for mapping.
  events.sort((a, b) => a.details.timeStamp - b.details.timeStamp);
  filterTextToEvents.set(filter.text, events);
}

export function logItem(request, filter, matchInfo = {}) {
  // Even in MV3 we have to emit all the log events
  // that don't have an upcoming corresponding DNR rule match
  if (!browser.declarativeNetRequest ||
      matchInfo.method == "elemhide" ||
      matchInfo.method == "snippet" ||
      matchInfo.method == "popup" ||
      matchInfo.method == "unmatched" ||
      matchInfo.allowingReason == "elemhide" ||
      matchInfo.allowingReason == "generichide" ||
      matchInfo.allowingReason == "extensionInitiated" ||
     (request.type == "main_frame" && matchInfo.method != "csp"))
    emitLogItem(request, filter, matchInfo);
  else
    logFilterEvent(request, filter, matchInfo);
}

export function emitLogItem(request, filter, matchInfo = {}) {
  for (let {listener, options} of listeners) {
    let {includeElementHiding, includeUnmatched, filterType, tabId} = options;

    if (tabId != null && tabId != request.tabId)
      continue;

    if (filter) {
      if (!includeElementHiding && (filter.type == "elemhide" ||
                                    filter.type == "elemhideexception" ||
                                    filter.type == "elemhideemulation"))
        continue;

      if (filterType != "all" &&
          filterType == "allowing" != (filter.type == "allowing" ||
                                       filter.type == "elemhideexception"))
        continue;
    }

    if (!includeUnmatched && !filter)
      continue;

    listener({request, filter: filter && convertFilter(filter), matchInfo});
  }
}

export function logHiddenElements(selectors, filters, sender) {
  let request = {
    tabId: sender.tab.id,
    frameId: sender.frameId,
    url: sender.url || BLANK_PAGE_URL
  };
  let {hostname} = parseURL(request.url);
  let matchInfo = {
    docDomain: hostname,
    method: "elemhide"
  };

  if (selectors.length > 0) {
    for (let subscription of filterEngine.filterStorage.subscriptions()) {
      if (subscription.disabled)
        continue;

      for (let text of subscription.filterText()) {
        let filter = Filter.fromText(text);

        if (filter instanceof ElemHideFilter &&
            selectors.includes(filter.selector) &&
            filter.isActiveOnDomain(hostname))
          logItem(request, filter, matchInfo);
      }
    }
  }

  for (let text of filters)
    logItem(request, Filter.fromText(text), matchInfo);
}

export let forceEnableTracing = false;

// We might want to avoid racing between subscribing listener for element
// hiding events and "content-filter.js" `applyContentFilters()` that uses
// `tracingEnabled` here to detect whether we need to trace the selectors:
// if page loading is fast enough to happen before listener is subscribed,
// we don't track the selectors and don't emit elemhide log events,
// which makes the elemhiding log events-related tests flaky and
// failing time to time.

export function setForceEnableTracing(enabled) {
  forceEnableTracing = enabled;
}

export function tracingEnabled(tabId) {
  return forceEnableTracing ||
    listeners.some(({options}) =>
      options.includeElementHiding &&
      (options.tabId == null || options.tabId == tabId)
    );
}
