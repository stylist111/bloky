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
import {CACHED_FILTERS_CONFIG_KEY, DEBUG_CSS_PROPERTIES, HANDSHAKE_EVENT_NAME} from "../../shared/constants.js";
import {claimFiltersChannel} from "../../shared/helpers.js";
import {default as sentry} from "./sentry.js";

const filtersChannelName = claimFiltersChannel(uuidv4());
let mainWorldReadyPromise;
let filtersConfigPromise;
let cachedFiltersConfig;
let cachedFiltersConfigSerialized;

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

  const {debug} = filtersConfig;
  const filters = filtersConfig.filters.map(parseScript);

  let eventDetails = {detail: {filters, debug}};
  if (typeof cloneInto === "function") {
    // Firefox requires content scripts to clone objects
    // that are passed to the document
    eventDetails = cloneInto(eventDetails, document.defaultView);
  }

  // START executing main snippets
  // Send the filters to the main world using the secret channel name
  // we know that handshake has already happened here because of the
  // channel name being consumed from the dataset.
  const mainWorldReady = !document.documentElement.dataset.eweFiltersChannel;
  if (mainWorldReady) {
    document.dispatchEvent(new CustomEvent(filtersChannelName, eventDetails));
  }
  else {
    // Wait for the handshake and then trigger execution for the main snippets
    mainWorldReadyPromise.then(() => {
      document.dispatchEvent(new CustomEvent(filtersChannelName, eventDetails));
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
    const env = {
      debugCSSProperties: debug ? DEBUG_CSS_PROPERTIES : null
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

  // Cache the snippet filters in localStorage for future page loads
  const newFiltersConfigSerialized = writeToStorage ?
        JSON.stringify(filtersConfig) :
        websiteValue;

  if (cachedFiltersConfigSerialized === newFiltersConfigSerialized) {
    if (filtersConfig.useCache) {
      // We were instructed to use the cache and the data we expected was
      // already in localStorage so it was executed on startup. Nothing more to
      // do.
      return null;
    }

    // Storage is in the state we expect it to be, but we aren't using cached
    // filters so we will execute them now.
    return filtersConfig;
  }

  try {
    if (newFiltersConfigSerialized) {
      localStorage.setItem(
        CACHED_FILTERS_CONFIG_KEY,
        newFiltersConfigSerialized
      );
    }
    else {
      localStorage.removeItem(CACHED_FILTERS_CONFIG_KEY);
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

export function start() {
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
    cachedFiltersConfigSerialized = localStorage.getItem(
      CACHED_FILTERS_CONFIG_KEY
    );
    if (cachedFiltersConfigSerialized) {
      cachedFiltersConfig = JSON.parse(cachedFiltersConfigSerialized);
    }
  }
  catch (e) {
    // This can happen in normal operation, if a website defines the key before
    // we start caching filters, so we don't want to send this to Sentry.
  }

  // First try to apply the cached filters if they exist,
  // then apply the filters that come from the filterEngine
  if (cachedFiltersConfig) {
    try {
      executeSnippets(cachedFiltersConfig);
    }
    catch (e) {
      // Remove the cached value if there was a problem executing the filter
      localStorage.removeItem(CACHED_FILTERS_CONFIG_KEY);
      sentry.reportError(e);
    }
  }

  filtersConfigPromise
    .then(syncCacheAndReload)
    .then(executeSnippets);
}

