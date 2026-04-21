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

import {isHttpOrHttps, stripQuery} from "#adblockpluscore/lib/url.js";
import browser from "../browser.js";
import {Prefs, CDP_OPTED_IN, CDP_OPTED_OUT, CDP_OPTED_IN_BY_USER,
        CDP_OPTED_OUT_BY_USER, isInitialized as isPrefsInitialized}
  from "../prefs.js";
import {getFrameInfo, TOP_LEVEL_FRAME_ID} from "../frame-state.js";
import {PersistentState} from "../persistence.js";
import {trace, debug, warn, error} from "../debugging.js";
import {isFirefox} from "../info.js";
import {EventDispatcher} from "../types.js";
import {log as _log} from "../safari-logs.js";

import {SpecialDomainsProcessor} from "./domain-processor.js";
import {setPremiumStatusCallback} from "./callbacks.js";

/**
 * "Page view" event type. These are triggered whenever a new page is viewed,
 * both using a full page refresh or a single page app navigation.
 * @ignore
 */
export const EVENT_PAGE_VIEW = "page_view";

/**
 * "Session started" event type. These are triggered when the user starts a new
 * session on a site. A session is considered over if there has been no activity
 * on that site for 30 minutes (configurable in Prefs).
 * @ignore
 */
export const EVENT_SESSION_START = "session_start";

/**
 * "Blockthrough AAPV" event type. This is a page view, on which the
 * Blockthrough tag is loaded, detects the presence of an adblocker, and
 * indicates that Acceptable Ads is active.
 * @ignore
 */
export const EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW =
  "blockthrough_acceptable_ads_page_view";

/**
 * "Wall detection" event type. These are triggered when a snippet detects
 * a wall (ad reinsertion, anti-adblock overlay, etc.) on a page.
 * Counts are stored per domain for CDP domain stats.
 * @ignore
 */
export const EVENT_WALL_DETECTION = "wall_detection";

// CDP events and pages user activity loading delay (for testing)
let _loadDelay = 0;

let deferredBrowserEvents = [];
let deferredBlockthroughEvents = [];
let deferredWallDetectionEvents = [];

// incapsulates domain to site grouping logics
let processor = new SpecialDomainsProcessor();

/**
 * Put a message into CDP log
 * @param {string} message Message to log
 * @ignore
 */
export function log(message) {
  debug(message);
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

async function removeUnusedLegacyEvents() {
  // ewe:cdp-blocking was previously used for counting onBlockableItem
  // events.
  await browser.storage.local.remove("ewe:cdp-blocking");
}

function initializeEvents() {
  events = new Map([
    [EVENT_PAGE_VIEW, new PersistentState("ewe:cdp-page-view", browser.storage.local)],
    [EVENT_SESSION_START, new PersistentState("ewe:cdp-session", browser.storage.local)],
    [
      EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW,
      new PersistentState(
        "ewe:cdp-blockthrough-acceptable-ads-page-view", browser.storage.local
      )
    ],
    [
      EVENT_WALL_DETECTION,
      new PersistentState(
        "ewe:cdp-wall-detection", browser.storage.local
      )
    ]
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

async function count(eventType, siteId, timeStamp) {
  trace({eventType, siteId, timeStamp});
  log(`count(${eventType}, ${siteId}, ${timeStamp})`);

  const state = events.get(eventType);
  let counter = toCounter(state.getState()[siteId]);
  state.getState()[siteId] = counter + 1;

  if (isStateLoaded()) {
    await state.save();
  }
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
 * Set the events array. This is for use in testing, in real use the data is
 * set by listening to events.
 * @param {string} eventType The type of event (see EVENT_...)
 * @param {Array<string>} domains The domain to get events for
 * @param {Array<Number>} counters Events counter.
 *                                 The size must be equal to domains size.
 * @ignore
 */
export async function setDataArray(eventType, domains, counters) {
  const state = events.get(eventType);
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    const counter = counters[i];
    state.getState()[domain] = counter;
  }
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

  let counter = toCounter(events.get(eventType).getState()[siteId]);
  debug("counter=" + counter);
  return counter;
}

/**
 * Returns the in-memory wall detection counts per domain.
 * @returns {Promise<Object>} Domain-keyed counts object.
 * @ignore
 */
export async function getWallDetectionState() {
  return events.get(EVENT_WALL_DETECTION).getStateLoaded();
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
export async function clearData() {
  trace({});
  log("clearData()");

  for (const state of events.values()) {
    state.clearState();
    await state.save();
  }
}

let startupPromise;

async function handleBrowserEvent(details, doMarkActive) {
  trace(details);

  if (!isStateLoaded()) {
    warn(() => `Deferring browser event: ${JSON.stringify(details)}`);
    deferredBrowserEvents.push({details, doMarkActive});
    return;
  }

  if (isOptedOut()) {
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
}

function onCommitted(details) {
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

/**
 * Gets the current CDP opt-out status. This should only be called after Prefs
 * has been initialized.
 *
 * @returns {boolean} True if the user has opted out, false if we can send
 *   payloads.
 * @ignore
 */
export function isOptedOut() {
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
 *
 * This should only be called after prefs have been initialized.
 *
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

let dispatchBTAADetectionEvent = () => {};

/**
 * Count a Blockthrough Acceptable Ads detection event if it counts as an
 * Acceptable Ads Page View (BT AAPV).
 * @param {string} url The URL of the page where the BTAADetectionEvent was
 * emitted.
 * @param {Object} details Detail object from the BTAADetectionEvent, including
 * the `ab` and `acceptable` properties.
 * @ignore
 */
export function countBTAADetectionEvent(url, details) {
  trace({url, details});

  if (!isStateLoaded()) {
    warn(() => `Deferring blockthrough acceptable ads page view event: ${JSON.stringify({url})}`);
    deferredBlockthroughEvents.push({url, details});
    return;
  }

  if (isOptedOut()) {
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  }
  catch (e) {
    error(e.message);
    return;
  }
  if (!isHttpOrHttps(parsedUrl)) {
    warn(`Ignore ${stripQuery(parsedUrl)}`);
    return;
  }

  const siteId = processor.getSiteId(parsedUrl.hostname);
  if (!siteId) {
    return;
  }

  let isAAPV = details.ab && details.acceptable;

  dispatchBTAADetectionEvent({
    siteId,
    isAAPV,
    ab: details.ab,
    acceptable: details.acceptable,
    sessionId: details.sessionId
  });

  if (!isAAPV) {
    return;
  }

  log(`onBlockthroughAcceptableAdsPageView() url*=${stripQuery(url)}, hostname=${parsedUrl.hostname}, siteId=${siteId}`);

  const timeStamp = Date.now();
  count(EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW, siteId, timeStamp);
}

/**
 * Count a wall detection event for CDP domain stats.
 * Takes a getBaseDomain-normalised domain directly, NOT via
 * SpecialDomainsProcessor.findSiteId. Intentional: wall detection
 * needs exact domain granularity, not the site-group split used
 * by sessions/page_views/BTAA. Both es and ds paths use the same
 * normalised domain for consistency.
 * @param {string} domain The normalised domain where the wall was detected.
 * @ignore
 */
export function countWallDetectionEvent(domain) {
  trace({domain});

  if (!isStateLoaded()) {
    warn(() => `Deferring wall detection event: ${JSON.stringify({domain})}`);
    deferredWallDetectionEvents.push({domain});
    return;
  }

  if (isOptedOut()) {
    return;
  }

  if (!domain) {
    return;
  }

  log(`countWallDetectionEvent() domain=${domain}`);

  const timeStamp = Date.now();
  count(EVENT_WALL_DETECTION, domain, timeStamp);
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
  if (!isPrefsInitialized) {
    return false;
  }
  return true;
}

function drainQueue(queue, name, handler) {
  if (queue.length > 0) {
    for (const event of queue) {
      handler(event);
    }
    warn(`Processed ${queue.length} deferred ${name} events`);
    queue.length = 0;
  }
}

function handleDeferredEvents() {
  drainQueue(deferredBrowserEvents, "browser",
    e => handleBrowserEvent(e.details, e.doMarkActive));
  drainQueue(deferredBlockthroughEvents, "blockthrough",
    e => countBTAADetectionEvent(e.url, e.details));
  drainQueue(deferredWallDetectionEvents, "wall detection",
    e => countWallDetectionEvent(e.domain));
}

/**
 * @ignore
 */
export function stop() {
  if (!startupPromise) {
    return;
  }

  startupPromise = null;

  browser.webNavigation.onCommitted.removeListener(onCommitted);
  browser.webNavigation.onHistoryStateUpdated.removeListener(
    onHistoryStateUpdated);

  initializeEvents();
  initializeActivity();
}

/**
 * Get all the current known domain event counts, sorted by session count
 * descending.
 *
 * @returns {Array<Object>} List of domains and their known stats.
 * @ignore
 */
export function getDomainStats() {
  const domainsMap = new Map();

  // collect all the domains from required metrics events
  for (const [eventType, state] of events) {
    let loadedEventState = state.getState();
    for (const domain in loadedEventState) {
      let value = domainsMap.get(domain) || {};
      value[eventType] = toCounter(loadedEventState[domain]);
      domainsMap.set(domain, value);
    }
  }

  let domainStats = [];
  for (let [domain, stats] of domainsMap) {
    domainStats.push({domain, stats});
  }

  domainStats.sort(
    (a, b) => b.stats[EVENT_SESSION_START] - a.stats[EVENT_SESSION_START]
  );

  return domainStats;
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
      // assuming `Prefs` are initialized and loaded as
      // we use "user opted out" and "domains" settings

      // CDP must be disabled for Firefox by default
      // and enabled on other browsers. Also we can't override
      // the value if it was set by user intentionally.
      if (isFirefox() && Prefs.cdp_opt_in_out == CDP_OPTED_IN) {
        Prefs.cdp_opt_in_out = CDP_OPTED_OUT;
      }

      browser.webNavigation.onCommitted.addListener(onCommitted);
      _log("cdp.js subscribing to browser.webNavigation.onHistoryStateUpdated ...");
      _log(browser.webNavigation);
      _log(browser.webNavigation.onHistoryStateUpdated);
      try {
        browser.webNavigation.onHistoryStateUpdated.addListener(
          onHistoryStateUpdated);
      }
      catch (e) {
        _log("Failed to subscribe!");
        _log(browser.webNavigation);
        throw e;
      }
      _log("cdp.js subscribed");

      async function loadData() {
        await loadEvents();
        await activity.load();
        await clearExpiredActivity();
        handleDeferredEvents();
        await removeUnusedLegacyEvents();
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

/**
 * @namespace cdp
 */
export default {
  /**
   * Blockthrough Acceptable Ads detection details
   * @typedef {Object} BtaaDetectionDetails
   * @property {boolean} ab Indicates whether an ad blocker has been detected
   *   on the page
   * @property {boolean} acceptable Indicates whether Acceptable Ads has been
   *   detected on the page
   * @property {boolean} isAAPV Indicates whether it's an Acceptable Ads
   *   pageview
   * @property {string} sessionId Page session ID
   * @property {string} siteId Site ID
   */

  /**
   * Emitted when we process a BTAADetectionEvent.
   *
   * @event
   * @type {EventDispatcher<BtaaDetectionDetails>}
   * @memberof cdp
   */
  onBTAADetectionEvent: new EventDispatcher(
    dispatch => {
      dispatchBTAADetectionEvent = dispatch;
    },
    () => {
      dispatchBTAADetectionEvent = () => {};
    }),

  /**
   * Opt-out from CDP. Default is `true` (used opted out)
   * @param {boolean} value Pass `true` to opt-out
   * @returns {Promise} Promise that resolves when the setting is set.
   * @memberof cdp
   */
  async setOptOut(value) {
    Prefs.cdp_opt_in_out = (value ?
      CDP_OPTED_OUT_BY_USER : CDP_OPTED_IN_BY_USER);
  },

  /**
  * Set the premium status callback to be called when CDP data
  * is to be uploaded.
  *
  * @param {function():Promise<boolean>} callback The user defined function
  *   that will be called to fill the premium status. This function should
  *   be called as soon as possible after EWE start. The callback must
  *   return a status of the license as a string.
  *   Options supported: true, false.
  * @memberof cdp
  */
  setPremiumStatusCallback
};
