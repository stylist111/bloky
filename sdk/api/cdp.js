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

import browser from "./browser.js";

import {Prefs} from "./prefs.js";
import {domainSuffixes} from "adblockpluscore/lib/url.js";
import {isFeatureEnabled} from "adblockpluscore/lib/features.js";
import {matchesWildcards, hasWildcard} from "adblockpluscore/lib/url.js";
import {getFrameInfo} from "./frame-state.js";
import {BlockableEventDispatcher} from "./diagnostics.js";
import {PersistentState} from "./persistence.js";
import {trace, debug} from "./debugging.js";

const FEATURE_FLAG = "cdp";

/**
 * "Page view" event type
 * @ignore
 */
export const EVENT_PAGE_VIEW = "page_view";

/**
 * "Session started" event type
 * @ignore
 */
export const EVENT_SESSION_START = "session_start";

/**
 * "Resource blocked" event type
 * @ignore
 */
export const EVENT_BLOCKING = "blocking";

// Map<String(event type), Map<String(domain), Array<Number>(event timestamp)>>
let events = new Map([
  [EVENT_PAGE_VIEW, new PersistentState("ewe:cdp-page-view", browser.storage.local)],
  [EVENT_SESSION_START, new PersistentState("ewe:cdp-session", browser.storage.local)],
  [EVENT_BLOCKING, new PersistentState("ewe:cdp-blocking", browser.storage.local)]
]);

// Map<String(domain), Number(last user activity timestamp)>
let activity = new PersistentState("ewe:cdp-activity", browser.storage.local);

// Map<Listener, Object (filter options)>
let listeners = new Map();

/**
 * The CdpEventDispatcher class allows users to listen to CDP events.
 * @hideconstructor
 */
export class CdpEventDispatcher {
  /**
  * @typedef {Object} CdpEventOptions
  * @param {string} [eventType]
  *   The optional filter for event types. Skip for all the event types.
  *   The supported event types are "page_view", "session_start" and "blocking".
  * @param {string} [domain]
  *   The optional filter for SLD or domain with wildcard.
  *   The domain or wildcard must be listed in `Prefs.cdp_domains`.
  *   Skip for all the domains.
  */

  /**
   * Attaches a listener function to a event. This listener will be called
   * when the CDP event is emitted if the feature is ON and user did not
   * opt out (`Prefs.cdp_user_opted_out`).
   * @param {function} listener The user defined function that will be called
   *                            once the specified event is emitted.
   * @param {CdpEventOptions} filterOptions The filtering conditions to apply
   *                                        when the event is emitted.
   * @example
   * // Logs all event types on all the tracked domains
   * EWE.reporting.onCdpItem.addListener(console.log);
   * @example
   * // Log all "session_start" items on "webext.com"
   * EWE.reporting.onCdpItem.addListener(
   *   console.log,
   *   {eventType: "session_start", domain: "webext.com"}
   * );
   */
  addListener(listener, filterOptions = {}) {
    listeners.set(listener, filterOptions);
  }

  removeListener(listener) {
    listeners.delete(listener);
  }
}

function getTrackedDomain(domain) {
  // exact match first!
  // (subdomains count as matched to top-level domain)
  for (const suffix of domainSuffixes(domain)) {
    if (Prefs.cdp_domains.includes(suffix)) {
      return suffix;
    }
  }

  // wildcard match
  for (const exactDomainOrWildcard of Prefs.cdp_domains) {
    if (hasWildcard(exactDomainOrWildcard) &&
      matchesWildcards(domain, exactDomainOrWildcard)) {
      return exactDomainOrWildcard;
    }
  }

  return null;
}

function emitEvent(eventType, domain, timeStamp) {
  for (const [listener, filterOptions] of listeners) {
    if (filterOptions.eventType && filterOptions.eventType != eventType) {
      continue;
    }

    if (filterOptions.domain && filterOptions.domain != domain) {
      continue;
    }

    listener({eventType, domain, timeStamp});
  }
}

async function count(eventType, domain, timeStamp) {
  trace({eventType, domain, timeStamp});

  const state = events.get(eventType);
  let timestamps = state.getState()[domain];
  if (!timestamps) {
    timestamps = [];
    state.getState()[domain] = timestamps;
  }
  timestamps.push(timeStamp);
  await state.save();

  emitEvent(eventType, domain, timeStamp);
}

async function onBlockableItem({request}) {
  if (!isFeatureEnabled(FEATURE_FLAG) || Prefs.cdp_user_opted_out) {
    return;
  }

  let {hostname} = new URL(request.url);
  hostname = getTrackedDomain(hostname);
  if (!hostname) {
    return;
  }

  await count(EVENT_BLOCKING, hostname, request.timeStamp);
}

/**
 * Wait for all the savings to be finished
 * @ignore
 */
export async function _awaitSavingComplete() {
  for (const state of events.values()) {
    await state.awaitSavingComplete();
  }
  await activity.awaitSavingComplete();
}

/**
 * Return the events
 * @param {string} eventType The type of event (see EVENT_...)
 * @param {string} domain The domain to get events for
 * @returns {Array<Number>} Event timestamps for the event type and domain
 * @ignore
 */
export function getData(eventType, domain) {
  trace({eventType, domain});

  if (!isFeatureEnabled(FEATURE_FLAG)) {
    return [];
  }

  const timestamps = events.get(eventType).getState()[domain] || [];
  debug("Got " + timestamps.length + " events");
  return timestamps;
}

/**
 * @ignore
 */
export async function clearActivity() {
  trace({});

  activity.clearState();
  await activity.save();
}

/**
 * Delete all the events (of type)
 * @param {string?} eventType The optional type of event (see EVENT_...)
 * @param {string?} domain The optional domain to clear the events
 * @param {Number?} timeStamp The optional timestamp to remove the event,
 *                            that happened earlier than timestamp.
 * @returns {Promise}
 * @ignore
 */
export async function clearData(eventType, domain, timeStamp) {
  trace({eventType, domain, timeStamp});

  if (!isFeatureEnabled(FEATURE_FLAG)) {
    return;
  }

  const eventTypes = eventType ? [eventType] : [...events.keys()];
  for (const eachEventType of eventTypes) {
    const state = events.get(eachEventType);
    if (!domain && !timeStamp) {
      state.clearState();
    }
    else {
      const domains = domain ? [domain] : [...state.keys()];
      for (const eachDomain of domains) {
        if (timeStamp) {
          let timeStamps = state.getState()[eachDomain];
          if (timeStamps) {
            timeStamps = timeStamps.filter(
              eactTimestamp => eactTimestamp >= timeStamp);
            state.getState()[domain] = timeStamps;
          }
        }
        else {
          delete state.getState()[domain];
        }
      }
    }
    await state.save();
  }
}

let startupPromise;

function onCommitted(details) {
  if (!isFeatureEnabled(FEATURE_FLAG) || Prefs.cdp_user_opted_out) {
    return;
  }

  const {tabId, frameId, timeStamp} = details;
  const frameInfo = getFrameInfo(tabId, frameId);
  if (!frameInfo) {
    return;
  }

  let {hostname} = new URL(frameInfo.url);
  hostname = getTrackedDomain(hostname);
  if (!hostname) {
    return;
  }

  const newSession = isNewSession(hostname);
  // mark first as awaiting might take some time
  // and another onCommited call can happen in between
  markActive(tabId, frameId);
  count(EVENT_PAGE_VIEW, hostname, timeStamp);
  if (newSession) {
    count(EVENT_SESSION_START, hostname, timeStamp);
  }
}

function isNewSession(domainOrDomainWildcard) {
  trace({domainOrDomainWildcard});

  const lastActivity = activity.getState()[domainOrDomainWildcard];
  if (!lastActivity) {
    // new navigation to domain, new session
    debug(`New session for ${domainOrDomainWildcard}`);
    return true;
  }

  const actuallyPassed = Date.now() - lastActivity;
  if (actuallyPassed > Prefs.cdp_session_expiration_interval) {
    // session expired
    debug(`Session expired for ${domainOrDomainWildcard}`);
    return true;
  }

  // pending session
  debug(`Pending session for ${domainOrDomainWildcard}`);
  return false;
}

function onHistoryStateUpdated(details) {
  if (!isFeatureEnabled(FEATURE_FLAG) || Prefs.cdp_user_opted_out) {
    return;
  }

  const {tabId, frameId} = details;
  const frameInfo = getFrameInfo(tabId, frameId);
  if (!frameInfo) {
    return;
  }

  let {hostname} = new URL(frameInfo.url);
  hostname = getTrackedDomain(hostname);
  if (!hostname) {
    return;
  }

  const newSession = isNewSession(hostname);
  count(EVENT_PAGE_VIEW, hostname, details.timeStamp);
  // we don't mark frame as active here as it's not user action
  if (newSession) {
    count(EVENT_SESSION_START, hostname, details.timeStamp);
  }
}

/**
 * Remember the last user activity time stamp
 * @param {Number} tabId Tab id
 * @param {Number} frameId Frame id
 * @ignore
 */
export async function markActive(tabId, frameId) {
  trace({tabId, frameId});

  const frameInfo = getFrameInfo(tabId, frameId);
  if (!frameInfo) {
    return;
  }

  let {hostname} = new URL(frameInfo.url);
  hostname = getTrackedDomain(hostname);
  if (!hostname) {
    return;
  }

  activity.getState()[hostname] = Date.now();

  await activity.save();
}

/**
 * Checks whether tab domain is tracked for CDP events
 * @param {Number} tabId Tab id
 * @param {Number} frameId Frame id
 * @returns {boolean} Whether the tab domain is tracked for CDP events
 * @ignore
 */
export function shouldNotifyActive(tabId, frameId) {
  trace({tabId, frameId});

  if (!isFeatureEnabled(FEATURE_FLAG) || Prefs.cdp_user_opted_out) {
    return false;
  }

  let frameInfo = getFrameInfo(tabId, frameId);
  if (!frameInfo) {
    return false;
  }

  let {hostname} = new URL(frameInfo.url);
  hostname = getTrackedDomain(hostname);
  return hostname != null;
}

async function loadEvents() {
  for (const state of events.values()) {
    await state.load();
  }
}

/**
 * @ignore
 */
export async function start() {
  if (!startupPromise) {
    startupPromise = (async() => {
      // assuming `Prefs` are initialized and loaded as
      // we use "user opted out" and "domains" settings

      new BlockableEventDispatcher().addListener(onBlockableItem, {
        filterType: "blocking"
      });

      browser.webNavigation.onCommitted.addListener(onCommitted);
      browser.webNavigation.onHistoryStateUpdated.addListener(
        onHistoryStateUpdated);

      await loadEvents();
      await activity.load();
    })();
  }

  return startupPromise;
}

export default {
  /**
   * Emitted when any CDP event happened.
   * @event
   * @param {string} eventType Event type
   *                           ("page_view", "session_start", "blocking")
   * @param {domain} domain SLD or domain with wildcard
   * @param {FilterMatchInfo} timestamp Event timestamp
   * @type {CdpEventDispatcher<{eventType: string,
   *                           domain: string,
   *                           timeStamp: Number}>}
   */
  onCdpItem: new CdpEventDispatcher(),

  /**
   * Opt-out from CDP. Default is `true` (used opted out)
   * @param {boolean} value Pass `true` to opt-out
   */
  async setOptOut(value) {
    Prefs.cdp_user_opted_out = value;
  },

  /**
   * Check whether user is opted out from CDP
   * @returns {boolean} Returns `true` is user opted out from CDP
   */
  async isOptOut() {
    return Prefs.cdp_user_opted_out;
  }
};

