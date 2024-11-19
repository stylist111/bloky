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

import {Prefs, CDP_OPTED_IN, CDP_OPTED_OUT,
        CDP_OPTED_IN_BY_USER, CDP_OPTED_OUT_BY_USER}
  from "./prefs.js";
import {getFrameInfo, TOP_LEVEL_FRAME_ID} from "./frame-state.js";
import {BlockableEventDispatcher} from "./diagnostics.js";
import {PersistentState} from "./persistence.js";

import {trace, debug, warn, error} from "./debugging.js";
import {isFirefox} from "./info.js";
import {MaxLengthMetricsDict} from "./domains-trimming.js";
import {isFeatureEnabled} from "adblockpluscore/lib/features.js";
import {isHttpOrHttps, stripQuery} from "adblockpluscore/lib/url.js";
import {OnlySupportedDomainsProcessor, SpecialDomainsProcessor}
  from "./cdp-processor.js";

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

const CDP_PHASE3_FEATURE_FLAG = "cdpPhase3";
const DEBUG_CDP_FEATURE_FLAG = "debugCdp";
const DEBOUNCE_INTERVAL = 5000;

// CDP events and pages user activity loading delay (for testing)
let _loadDelay = 0;

let deferredEvents = [];

// incapsulates domain to site grouping logics
let processor;

let logMessages = new PersistentState("ewe:cdp_log", browser.storage.local);
logMessages.doDebounce();
logMessages.setDebounceInterval(DEBOUNCE_INTERVAL);

/**
 * Put a message into CDP log
 * @param {string} message Message to log
 * @ignore
 */
export function log(message) {
  debug(message);

  if (!isFeatureEnabled(DEBUG_CDP_FEATURE_FLAG)) {
    return;
  }

  const tsMessage = `${Date.now()}:${message}`;
  const state = logMessages.getState();
  if (!state.messages) {
    state.messages = [];
  }
  state.messages.push(tsMessage);

  // We can collect too much data in between the CDP aggregate pings
  // (EXT-588)
  const CDP_LOG_LIMIT = 10000;
  if (state.messages.length > CDP_LOG_LIMIT) {
    state.messages.splice(0, state.messages.length - CDP_LOG_LIMIT);
  }
  logMessages.save();
}

/**
 * Returns an array of CDP log messages
 * @returns {Array<string>}
 * @ignore
 */
export function getLog() {
  return logMessages.getState().messages;
}

/**
 * Set log messages for testing
 * @param {Array<string>} messages Log messages
 * @ignore
 */
export function setLog(messages) {
  logMessages.getState().messages = messages;
}

/**
 * Clear the CDP log
 * @ignore
 */
export function clearLog() {
  logMessages.clearState();
  logMessages.save();
}

function isPhase3() {
  return isFeatureEnabled(CDP_PHASE3_FEATURE_FLAG);
}

/**
 * @param {Number} millis Number of milliseconds to delay data loading
 * @ignore
 */
export function setLoadDelay(millis) {
  _loadDelay = millis;
}

/**
 * @param {Object} config Custom CDP config used for testing
 * @ignore
 */
export function _setConfig(config) {
  processor.setConfig(config);
}

/**
 * Restore the default CDP configuration
 * @ignore
 */
export function _restoreConfig() {
  if (processor) {
    processor.restoreConfig();
  }
}

// Map<String(event type), Map<String(siteId), Array<Number>(event timestamp)>>
let events;

function initializeEvents() {
  events = new Map([
    [EVENT_PAGE_VIEW, new PersistentState("ewe:cdp-page-view", browser.storage.local)],
    [EVENT_SESSION_START, new PersistentState("ewe:cdp-session", browser.storage.local)],
    [EVENT_BLOCKING, new PersistentState("ewe:cdp-blocking", browser.storage.local)]
  ]);
  for (const state of events.values()) {
    state.doDebounce();
  }
}

initializeEvents();

// Map<String(domain), Number(last user activity timestamp)>
let activity;

function initializeActivity() {
  activity = new PersistentState("ewe:cdp-activity", browser.storage.local);
  activity.doDebounce();
}

initializeActivity();

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
  * @param {string?} [siteId]
  *   The optional filter for siteIds.
  *   Skip for all the siteIds.
  */

  /**
   * Attaches a listener function to a event. This listener will be called
   * when the CDP event is emitted if the feature is ON and user did not
   * opt out (`Prefs.cdp_opt_in_out`).
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
   *   {eventType: "session_start", siteId: "webext.com"}
   * );
   */
  addListener(listener, filterOptions = {}) {
    listeners.set(listener, filterOptions);
  }

  removeListener(listener) {
    listeners.delete(listener);
  }
}

async function emitEvent(eventType, siteId, timeStamp) {
  for (const [listener, filterOptions] of listeners) {
    if (filterOptions.eventType && filterOptions.eventType != eventType) {
      continue;
    }

    if (filterOptions.siteId && filterOptions.siteId != siteId) {
      continue;
    }

    await listener({eventType, siteId, timeStamp});
  }
}

async function count(eventType, siteId, timeStamp) {
  trace({eventType, siteId, timeStamp});
  log(`count(${eventType}, ${siteId}, ${timeStamp})`);

  const state = events.get(eventType);
  if (isPhase3()) {
    let counter = toCounter(state.getState()[siteId]);
    state.getState()[siteId] = counter + 1;
  }
  else {
    let timestamps = state.getState()[siteId];
    if (!timestamps) {
      timestamps = [];
      state.getState()[siteId] = timestamps;
    }
    timestamps.push(timeStamp);
    log(`events count: ${timestamps.length}`);
  }

  if (isStateLoaded()) {
    await state.save();
  }

  await emitEvent(eventType, siteId, timeStamp);
}

async function onBlockableItem({request}) {
  if (isOptedOut()) {
    return;
  }

  const siteId = processor.getSiteId(
    new URL(request.url).hostname);
  if (!siteId) {
    return;
  }

  await count(EVENT_BLOCKING, siteId, Date.now());
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
 * Set the events. This is for use in testing, in real use the data is set by
 * listening to events.
 * @param {string} eventType The type of event (see EVENT_...)
 * @param {string} domain The domain to get events for
 * @param {Number|Array<Number>} counterOrTimestamps Events counter (Number)
 * on Phase 3 or event timestamps (Array<Number>) on Phase 2
 * @ignore
 */
export async function setData(eventType, domain, counterOrTimestamps) {
  trace({eventType, domain});

  const state = events.get(eventType);
  state.getState()[domain] = counterOrTimestamps;
  await state.save();
}

/**
 * Return the events
 * @param {string} eventType The type of event (see EVENT_...)
 * @param {string} siteId The domain to get events for
 * @returns {Number|Array<Number>} Events counter (Number) on Phase 3 or
 *                                 event timestamps on Phase 2
 * @ignore
 */
export function getData(eventType, siteId) {
  trace({eventType, siteId});
  log(`getData(${eventType}, ${siteId})`);

  if (isPhase3()) {
    let counter = toCounter(events.get(eventType).getState()[siteId]);
    debug("counter=" + counter);
    return counter;
  }

  const timestamps = events.get(eventType).getState()[siteId] || [];
  log(`Got ${timestamps.length} events for ${siteId}`);
  return timestamps;
}

/**
 * @ignore
 */
export async function clearActivity() {
  trace({});
  log("clearActivity");

  activity.clearState();
  await activity.save();
}

/**
 * @ignore
 */
export async function clearExpiredActivity() {
  trace({});

  let state = activity.getState();
  let saveNeeded = false;

  for (const domain of Object.keys(state)) {
    const lastActivity = state[domain];
    const actuallyPassed = Date.now() - lastActivity;
    if (actuallyPassed > Prefs.cdp_session_expiration_interval) {
      // session expired
      debug(() => `Remove expired session for ${domain}`);
      delete state[domain];
      saveNeeded = true;
    }
  }

  if (saveNeeded) {
    await activity.save();
  }
}

/**
 * Delete all the events (of type)
 * @param {string?} eventType The optional type of event (see EVENT_...)
 * @param {string?} siteId The optional siteId to clear the events
 * @param {Number?} timeStamp The optional timestamp to remove the event,
 *                            that happened earlier than timestamp on Phase 2.

 * @returns {Promise}
 * @ignore
 */
export async function clearData(eventType, siteId, timeStamp) {
  trace({eventType, siteId, timeStamp});
  log(`clearData(${eventType}, ${siteId}, ${timeStamp})`);

  if (isPhase3()) {
    // Timestamps are not supported on Phase 3
    timeStamp = null;
  }

  const eventTypes = eventType ? [eventType] : [...events.keys()];
  for (const eachEventType of eventTypes) {
    const state = events.get(eachEventType);
    if (!siteId && !timeStamp) {
      state.clearState();
    }
    else {
      const siteIds = siteId ? [siteId] : [...state.keys()];
      for (const eachSiteId of siteIds) {
        if (timeStamp) {
          let timeStamps = state.getState()[eachSiteId];
          if (timeStamps) {
            timeStamps = timeStamps.filter(
              eactTimestamp => eactTimestamp >= timeStamp);
            state.getState()[siteId] = timeStamps;
          }
        }
        else {
          delete state.getState()[eachSiteId];
        }
      }
    }
    await state.save();
  }
}

let startupPromise;

function handleBrowserEvent(details, doMarkActive) {
  trace(details);

  if (isOptedOut()) {
    return;
  }

  if (!isStateLoaded()) {
    warn(() => `Deferring browser event: ${JSON.stringify(details)}`);
    deferredEvents.push({details, doMarkActive});
    return;
  }

  if (details.frameId != TOP_LEVEL_FRAME_ID) {
    // Counting only outer-most frames
    return;
  }

  let url;
  try {
    url = new URL(details.url);
  }
  catch (e) {
    error(e.message);
    return;
  }
  if (!isHttpOrHttps(url)) {
    warn(`Ignore ${stripQuery(details.url)}`);
    return;
  }

  const siteId = processor.getSiteId(url.hostname);
  if (!siteId) {
    return;
  }

  log(`handleBrowserEvent() url*=${stripQuery(details.url)}, hostname=${url.hostname}, siteId=${siteId}`);

  const newSession = isNewSession(siteId);
  const timeStamp = Date.now();
  count(EVENT_PAGE_VIEW, siteId, timeStamp);
  if (doMarkActive) {
    markActiveForSiteId(siteId);
  }
  if (newSession) {
    count(EVENT_SESSION_START, siteId, timeStamp);
  }

  return siteId;
}

function onBeforeNavigate(details) {
  handleBrowserEvent(details, true);
}

function isNewSession(siteId) {
  trace({siteId});

  const lastActivity = activity.getState()[siteId];
  if (!lastActivity) {
    // new navigation to site, new session
    log(`New session for ${siteId}`);
    return true;
  }

  const actuallyPassed = Date.now() - lastActivity;
  if (actuallyPassed > Prefs.cdp_session_expiration_interval) {
    // session expired
    log(`Session expired for ${siteId} (lastActive=${lastActivity}, actuallyPassed=${actuallyPassed})`);
    return true;
  }

  // pending session
  log(`Pending session for ${siteId} (lastActive=${lastActivity}, actuallyPassed=${actuallyPassed})`);
  return false;
}

function isOptedOut() {
  return Prefs.cdp_opt_in_out == CDP_OPTED_OUT ||
         Prefs.cdp_opt_in_out == CDP_OPTED_OUT_BY_USER;
}

function onHistoryStateUpdated(details) {
  handleBrowserEvent(details, false);
}

async function markActiveForSiteId(siteId) {
  const now = Date.now();
  activity.getState()[siteId] = now;
  log(`markActiveForSiteId siteId=${siteId}, now=${now}`);
  await activity.save();
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

  const siteId = processor.getSiteId(frameInfo.hostname);
  log(`markActive() hostname=${frameInfo.hostname}, siteId=${siteId}`);
  if (!siteId) {
    return;
  }

  const timeStamp = Date.now();
  const newSession = isNewSession(siteId);
  await markActiveForSiteId(siteId);
  if (newSession) {
    count(EVENT_PAGE_VIEW, siteId, timeStamp);
    count(EVENT_SESSION_START, siteId, timeStamp);
  }
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

  if (isOptedOut()) {
    return false;
  }

  let frameInfo = getFrameInfo(tabId, frameId);
  if (!frameInfo) {
    return false;
  }

  return processor.shouldProcess(new URL(frameInfo.url));
}

async function loadEvents() {
  for (const state of events.values()) {
    await state.load();
  }
}

function isStateLoaded() {
  for (const state of events.values()) {
    if (!state.loaded) {
      return false;
    }
  }
  return true;
}

function handleDeferredEvents() {
  if (deferredEvents.length > 0) {
    for (const eachEvent of deferredEvents) {
      handleBrowserEvent(eachEvent.details, eachEvent.doMarkActive);
    }
    warn(`Processed ${deferredEvents.length} deferred events`);
    deferredEvents = [];
  }
}

/**
 * @ignore
 */
export function stop() {
  if (!startupPromise) {
    return;
  }

  startupPromise = null;

  new BlockableEventDispatcher().removeListener(onBlockableItem, {
    filterType: "blocking"
  });

  browser.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
  browser.webNavigation.onHistoryStateUpdated.removeListener(
    onHistoryStateUpdated);

  initializeEvents();
  initializeActivity();
}

// event type to backend metric token mapping
const EVENT_TYPE_TO_METRIC = new Map([
  [EVENT_SESSION_START, "sessions_count"],
  [EVENT_PAGE_VIEW, "pageviews_count"]
]);

/**
 * Format the "domain_stats" property with domains trimming
 *
 * @param {Array<String>} metrics Event types (the default value is sessions)
 * @param {Number} limit Payload length limit (the default value is 90Kb)
 * @returns {string} Formatted and trimmed "domain_stats" object
 * @ignore
 */
export function getDomainStats(
  metrics = [
    EVENT_TYPE_TO_METRIC.get(EVENT_SESSION_START)
  ],
  limit = 90 * 1024) {
  const domains = new Set();

  // collect all the domains from required metrics events
  for (const [eventType, state] of events) {
    const metric = EVENT_TYPE_TO_METRIC.get(eventType);

    // report exactly the metrics needed from backend
    if (!metrics.includes(metric)) {
      continue;
    }

    for (const domain of Object.keys(state.getState())) {
      domains.add(domain);
    }
  }

  function getSessions(domain) {
    return toCounter(events.get(EVENT_SESSION_START).getState()[domain]);
  }

  // EVENT_SESSION_START is the most important metric
  const sortedDomains = Array.from(domains).sort((domain1, domain2) =>
    getSessions(domain2) - getSessions(domain1));

  // No JSON indentation to prefer more data instead of readability
  const dict = new MaxLengthMetricsDict(limit, metrics, null);

  for (const domain of sortedDomains) {
    for (const [eventType, state] of events) {
      const metric = EVENT_TYPE_TO_METRIC.get(eventType);

      // report exactly the metrics needed from backend
      if (!metrics.includes(metric)) {
        continue;
      }

      const arrayOrCounter = state.getState()[domain];
      dict.addMetric(domain, metric, toCounter(arrayOrCounter));
    }
  }

  return dict.serialize();
}

function toCounter(numberOrArray) {
  if (numberOrArray) {
    // In Phase 2 we saved an array of events (timestamps).
    // In Phase 3 we start tracking all the domains, so now
    // we save just a counter to reduce data amount to save.
    return Array.isArray(numberOrArray) ? numberOrArray.length : numberOrArray;
  }
  return 0;
}

/**
 * @ignore
 */
export async function start() {
  if (!startupPromise) {
    startupPromise = (async() => {
      processor = isPhase3() ?
        new SpecialDomainsProcessor() :
        new OnlySupportedDomainsProcessor();

      // assuming `Prefs` are initialized and loaded as
      // we use "user opted out" and "domains" settings

      // CDP must be disabled for Firefox by default
      // and enabled on other browsers. Also we can't override
      // the value if it was set by user intentionally.
      if (isFirefox() && Prefs.cdp_opt_in_out == CDP_OPTED_IN) {
        Prefs.cdp_opt_in_out = CDP_OPTED_OUT;
      }

      new BlockableEventDispatcher().addListener(onBlockableItem, {
        filterType: "blocking"
      });

      browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
      browser.webNavigation.onHistoryStateUpdated.addListener(
        onHistoryStateUpdated);

      async function loadData() {
        await loadEvents();
        await activity.load();
        if (isFeatureEnabled(DEBUG_CDP_FEATURE_FLAG)) {
          await logMessages.load();
        }
        await clearExpiredActivity();
        handleDeferredEvents();
      }

      if (_loadDelay == 0) {
        await loadData();
      }
      else {
        // for testing purpose
        setTimeout(loadData, _loadDelay);
      }
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
   * @param {string} siteId SiteId
   * @param {Number} timestamp Event timestamp
   * @type {CdpEventDispatcher<{eventType: string,
   *                           siteId: string,
   *                           timeStamp: Number}>}
   */
  onCdpItem: new CdpEventDispatcher(),

  /**
   * Opt-out from CDP. Default is `true` (used opted out)
   * @param {boolean} value Pass `true` to opt-out
   * @returns {Promise} Promise that resolves when the setting is set.
   */
  async setOptOut(value) {
    Prefs.cdp_opt_in_out = (value ?
      CDP_OPTED_OUT_BY_USER : CDP_OPTED_IN_BY_USER);
  },

  /**
   * Check whether user is opted out from CDP
   * @returns {Promise<boolean>} Returns `true` is user opted out from CDP
   */
  async isOptOut() {
    return Prefs.cdp_opt_in_out == CDP_OPTED_OUT ||
           Prefs.cdp_opt_in_out == CDP_OPTED_OUT_BY_USER;
  }
};

