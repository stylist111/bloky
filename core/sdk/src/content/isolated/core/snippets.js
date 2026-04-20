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

/* global cloneInto */

import browser from "webextension-polyfill";
import {v4 as uuidv4} from "uuid";
import snippetsCallback from "@eyeo/snippets/isolated";
import {parseScript} from "#adblockpluscore/lib/snippets.js";
import {ignoreNoConnectionError} from "../../../all/errors.js";
import {
  CACHED_FILTERS_CONFIG_KEY,
  COMMS_CHANNEL_DATASET_KEY,
  DEBUG_CSS_PROPERTIES,
  HANDSHAKE_EVENT_NAME
} from "../../shared/constants.js";
import {claimCommsChannel} from "../../shared/helpers.js";
import {default as sentry} from "./sentry.js";
import {default as telemetry} from "../../../front/telemetry.js";
import {
  createSnippetDetectionEventSender,
  createSnippetHitEventSender,
  gateSnippetEvent,
  handleSnippetHitMessage,
  withTopLevelDomain
} from "./snippet-events.js";

const commsChannelName = claimCommsChannel(uuidv4());
let mainWorldReadyPromise;
let filtersConfigPromise;
let cachedFiltersConfig;
// cachedFiltersConfigSerialized defaults to `null` rather than `undefined`
// because that is the value we would get if it is uninitialized in
// sessionStorage.
let cachedFiltersConfigSerialized = null;
let storageAvailable = true;
const logger = new telemetry.ServerLogger("snippets");
const sendDetectionEvent = createSnippetDetectionEventSender(logger, sentry);
const sendSnippetHitEvent = createSnippetHitEventSender(logger, sentry);

let snippetHitEventEnabled = false;

/**
 * Checks if the current context is a cross-origin iframe
 *
 * @returns {boolean} True if the current context is an iframe, false otherwise
 */
function isCorsFrame() {
  if (window === window.parent) {
    return false;
  }

  try {
    window.parent.location.href;
    return false;
  }
  catch (e) {
    return true;
  }
}

const isCrossOrigin = isCorsFrame();

/**
 * Fetches snippet filters from the service worker/background script
 * @returns {Promise<*>}
 */
async function getFiltersConfig() {
  const response = await ignoreNoConnectionError(
    browser.runtime.sendMessage({
      type: "ewe:get-filters-config"
    })
  );
  if (response) {
    return response;
  }
}

/**
 * Executes the snippets based on the provided filters
 * @param {Object} [filtersConfig]
 */
function executeSnippets(filtersConfig) {
  if (
    !filtersConfig ||
    !filtersConfig.filters ||
    !filtersConfig.filters.length
  ) {
    // If no filters to apply, just return
    return;
  }

  const {debug, detectionEventEnabled} = filtersConfig;
  snippetHitEventEnabled = Boolean(filtersConfig.hitEventEnabled);
  const filters = filtersConfig.filters.map(parseScript);

  let eventDetails = {
    detail: {
      type: "ewe:filters-config",
      filters,
      debug
    }
  };
  if (typeof cloneInto === "function") {
    // Firefox requires content scripts to clone objects
    // that are passed to the document
    eventDetails = cloneInto(eventDetails, document.defaultView);
  }

  // START executing main snippets
  // Send the filters to the main world using the secret channel name
  // we know that handshake has already happened here because of the
  // channel name being consumed from the dataset.
  // eslint-disable-next-line max-len
  const mainWorldReady = !document.documentElement.dataset[COMMS_CHANNEL_DATASET_KEY];
  if (mainWorldReady) {
    document.dispatchEvent(new CustomEvent(commsChannelName, eventDetails));
  }
  else {
    // Wait for the handshake and then trigger execution for the main snippets
    mainWorldReadyPromise.then(() => {
      document.dispatchEvent(new CustomEvent(commsChannelName, eventDetails));
    });
  }

  // END execute main snippets

  // START executing isolated snippets

  // Find what filters belong to the isolated snippets library
  // and if there any dependencies that needs to be executed.
  const isolatedDependencies = [];
  const isolatedSnippets = [];
  for (const filter of filters) {
    for (let [snippet, ...args] of filter) {
      if (snippetsCallback.has(snippet)) {
        let dependency = snippetsCallback.get(snippet);
        if (dependency) {
          isolatedDependencies.push(dependency);
        }
        isolatedSnippets.push([snippet, ...args]);
      }
    }
  }

  // Execute the isolated snippets synchronously
  for (const dependencyFn of isolatedDependencies) {
    // IMPORTANT: Bind the dependency functions to globalThis
    // to ensure correct this
    dependencyFn.bind(globalThis)();
  }

  if (isolatedSnippets.length) {
    // sendDetectionEvent is only available to isolated world snippets
    // because it relies on ServerLogger and Sentry, which need extension
    // API access not available in the main world. See snippet-events.js.
    const env = {
      debugCSSProperties: debug ? DEBUG_CSS_PROPERTIES : null,
      sendDetectionEvent: gateSnippetEvent(
        detectionEventEnabled,
        withTopLevelDomain(
          filtersConfig.topLevelHostname, sendDetectionEvent
        )
      ),
      // sendSnippetHitEvent is not wrapped with withTopLevelDomain:
      // hit events get their domain from the filter, not the frame.
      sendSnippetHitEvent: gateSnippetEvent(
        snippetHitEventEnabled, sendSnippetHitEvent
      )
    };
    snippetsCallback(env, ...isolatedSnippets);
  }
}

/**
 * Syncs the cached filters config and reloads the page if needed
 * @param {Object} filtersConfig - filters config object
 * @returns {Object|null} - returns the filtersConfig or null.
 */
function syncCacheAndReload(filtersConfig) {
  if (!storageAvailable) {
    if (filtersConfig.useCache) {
      logger.debug("local_storage_unavailable", {
        isMainFrame: window === window.top
      });
    }

    return filtersConfig;
  }

  let websiteValue = null;
  if (cachedFiltersConfig) {
    websiteValue = cachedFiltersConfig.websiteValue;
  }
  else if (cachedFiltersConfigSerialized) {
    websiteValue = cachedFiltersConfigSerialized;
  }

  if (websiteValue) {
    filtersConfig.websiteValue = websiteValue;
  }

  // If there are no filters, then we don't have anything to cache. Rather avoid
  // the impact of having anything in the cache and remove our config if it is
  // there.
  const writeToStorage = filtersConfig.useCache &&
        filtersConfig.filters.length > 0;

  // Cache the snippet filters in Storage for future page loads
  const newFiltersConfigSerialized = writeToStorage ?
        JSON.stringify(filtersConfig) :
        websiteValue;

  if (cachedFiltersConfigSerialized === newFiltersConfigSerialized) {
    if (filtersConfig.useCache) {
      // We were instructed to use the cache and the data we expected was
      // already in Storage so it was executed on startup. Nothing more to
      // do.
      return null;
    }

    // Storage is in the state we expect it to be, but we aren't using cached
    // filters so we will execute them now.
    return filtersConfig;
  }

  try {
    if (newFiltersConfigSerialized) {
      sessionStorage.setItem(
        CACHED_FILTERS_CONFIG_KEY,
        newFiltersConfigSerialized
      );
    }
    else {
      sessionStorage.removeItem(CACHED_FILTERS_CONFIG_KEY);
    }

    // reload the page to apply the new snippets from cache on next load
    window.location.reload();
    // Break the chain of snippet execution as the page is reloading
    return null;
  }
  catch (e) {
    sentry.reportError(e);
    // In case caching failed, just return the config to execute snippets
    return filtersConfig;
  }
}

/**
 * Handles ewe:main-error messages from the main world.
 * @param {object} detail The event detail payload
 */
function handleMainWorldError(detail) {
  const {error} = detail;
  if (!error) {
    return;
  }

  // Usually a TypeError is thrown when the page tries
  // to tamper with the snippets context
  if (error.name && error.name === "TypeError") {
    logger.behavior("context_tampering");
  }

  // To be re-enabled if we want to track errors coming from the main world,
  // but for now we want to avoid consuming from the quota until we
  // actually get value from these errors.
  // sentry.reportError(error);
}

const mainWorldMessageHandlers = {
  "ewe:main-error": handleMainWorldError,
  "ewe:snippet-hit": (detail) =>
    handleSnippetHitMessage(detail, snippetHitEventEnabled, sendSnippetHitEvent)
};

/**
 * Listener for messages coming from the main world on the comms channel.
 * Routes each message to the appropriate handler by type.
 * @param {CustomEvent} event
 * @param {object} event.detail The event detail payload
 */
function mainWorldMessageListener({detail}) {
  if (!detail) {
    return;
  }

  const handler = mainWorldMessageHandlers[detail.type];
  if (handler) {
    handler(detail);
  }
}

/**
 * Starts the error listener for errors coming from the main world.
 */
function startErrorListener() {
  document.removeEventListener(commsChannelName, mainWorldMessageListener);
  document.addEventListener(commsChannelName, mainWorldMessageListener);
}

export function start() {
  startErrorListener();
  filtersConfigPromise = getFiltersConfig();
  // Promise that resolves when the handshake event is received
  mainWorldReadyPromise = new Promise(resolve => {
    function handleHandshake() {
      // clean up the handshake listener so it only runs once
      document.removeEventListener(HANDSHAKE_EVENT_NAME, handleHandshake);
      resolve(true);
    }
    document.addEventListener(HANDSHAKE_EVENT_NAME, handleHandshake);
  });

  try {
    cachedFiltersConfigSerialized = sessionStorage.getItem(
      CACHED_FILTERS_CONFIG_KEY
    );
  }
  catch (e) {
    storageAvailable = false;
  }

  if (cachedFiltersConfigSerialized) {
    try {
      cachedFiltersConfig = JSON.parse(cachedFiltersConfigSerialized);
    }
    catch (e) {
      // This can happen in normal operation, if a website defines the key
      // before we start caching filters, so we don't want to send this to
      // Sentry.
    }
  }

  // First try to apply the cached filters if they exist,
  // then apply the filters that come from the filterEngine
  // Don't execute from cache if we are in an iframe
  if (cachedFiltersConfig && !isCrossOrigin) {
    try {
      executeSnippets(cachedFiltersConfig);
    }
    catch (e) {
      sentry.reportError(e);
    }
  }

  // We don't want to reload the iframe as it can lose the
  // referrer and other important information, so we will
  // just execute the snippets after we receive the filters
  // config without trying to sync with the cache.
  if (isCrossOrigin) {
    filtersConfigPromise.then(executeSnippets);
  }
  else {
    filtersConfigPromise
      .then(syncCacheAndReload)
      .then(executeSnippets);
  }
}

