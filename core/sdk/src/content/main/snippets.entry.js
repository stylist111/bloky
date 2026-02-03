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

/* global chrome browser */

import {v4 as uuidv4} from "uuid";
import snippetsCallback from "@eyeo/snippets/main";
import {
  CACHED_FILTERS_CONFIG_KEY,
  DEBUG_CSS_PROPERTIES,
  HANDSHAKE_EVENT_NAME
} from "../shared/constants.js";
import {shimLocalStorage} from "./shims/storage.js";
import {claimFiltersChannel} from "../shared/helpers.js";

// Use chrome.storage to detect if we're in an isolated world.
// Note: chrome.runtime is unreliable since other extensions may expose it
// in the main world.
const isMainWorld = !(
  (typeof chrome === "object" && !!chrome.storage) ||
  (typeof browser === "object" && !!browser.storage)
);

const runStorageShim = (shimFn, configKey) => {
  try {
    if (typeof shimFn === "function" && configKey) {
      shimFn(configKey);
    }
  }
  catch (err) {
    // It would be good to report this error to Sentry, but we don't currently
    // have a way to do that from the main world.
  }
};

const runSnippets = snippetsConfig => {
  const {callback, filters, env} = snippetsConfig;

  if (filters.length) {
    try {
      callback(env, ...filters);
    }
    catch (e) {
      // It would be good to report this error to Sentry, but we don't currently
      // have a way to do that from the main world.
    }
  }
};

const createTrustedScriptPolicy = () => {
  const isTrustedTypesSupported = typeof trustedTypes !== "undefined";
  let policy = null;

  try {
    if (isTrustedTypesSupported) {
      policy = trustedTypes.createPolicy(uuidv4(), {
        createScript: code => code,
        createScriptURL: url => url
      });
    }
  }
  catch (_) {
  }
  return policy;
};

const injectScript = (executable, policy) => {
  const script = document.createElement("script");
  script.type = "application/javascript";
  script.async = false;

  if (policy) {
    script.textContent = policy.createScript(executable);
  }
  else {
    script.textContent = executable;
  }

  try {
    document.documentElement.appendChild(script);
  }
  catch (_) {}
  document.documentElement.removeChild(script);
};

const appendSnippets = snippetsConfig => {
  const {callback, filters, env, shimFn, shimConfigKey} = snippetsConfig;
  const policy = createTrustedScriptPolicy();

  const snippetsCode = filters.length ? `
    const callback = (${callback});
    const runSnippets = (${runSnippets});
    const snippetsConfig = {
      callback,
      env: ${JSON.stringify(env)},
      filters: ${JSON.stringify(filters)}
    };
    runSnippets(snippetsConfig);
  ` : "";

  const code = `(function () {
    const shimFn = (${shimFn});
    const shimConfigKey = "${shimConfigKey}";
    const runStorageShim = (${runStorageShim});
    runStorageShim(shimFn, shimConfigKey);
    ${snippetsCode}
  })();`;

  injectScript(code, policy);
};

const onFiltersReceived = event => {
  const {filters, debug} = event.detail;
  // Check which snippets need to be executed in the main world.
  const mainSnippets = [];
  for (const filter of filters) {
    for (const [name, ...args] of filter) {
      if (snippetsCallback.has(name)) {
        mainSnippets.push([name, ...args]);
      }
    }
  }

  const snippetsConfig = {
    callback: snippetsCallback,
    env: {debugCSSProperties: debug ? DEBUG_CSS_PROPERTIES : null},
    filters: mainSnippets,
    shimFn: shimLocalStorage,
    shimConfigKey: CACHED_FILTERS_CONFIG_KEY
  };

  // If this script is injected into the main world we can execute directly.
  // If we are on isolated world (MV2), we need to create an inline script to
  // inject the snippets into page context.
  if (isMainWorld) {
    runStorageShim(shimLocalStorage, CACHED_FILTERS_CONFIG_KEY);
    runSnippets(snippetsConfig);
  }
  else {
    appendSnippets(snippetsConfig);
  }
};

const filtersChannelName = claimFiltersChannel(uuidv4());
document.addEventListener(filtersChannelName, onFiltersReceived);
document.dispatchEvent(new CustomEvent(HANDSHAKE_EVENT_NAME));
