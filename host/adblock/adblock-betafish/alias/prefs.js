/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module prefs */

import * as info from "info";

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { installHandler } from "../../adblockplusui/adblockpluschrome/lib/messaging/events.js";
import { port } from "../../adblockplusui/adblockpluschrome/lib/messaging/port.js";
import { EventEmitter } from "../../adblockplusui/adblockpluschrome/lib/events.js";

import { commandStats } from "../ipm/background/command-library.types";

import { eventStorageKey } from "../ipm/background/data-collection.types";

import { statsStorageKey } from "../onpage-dialog/background/stats.types";

const keyPrefix = "pref:";

let eventEmitter = new EventEmitter();
let overrides = Object.create(null);

/** @lends module:prefs.Prefs */
let defaults = Object.create(null);

/**
 * Public keys used to verify authenticity of partners that are authorized to
 * use the allowlisting API.
 *
 * @type {string[]}
 */
defaults.allowlisting_authorizedKeys = [
  // Readership Link public key
  // https://gitlab.com/adblockinc/ext/adblock/adblock/-/issues/371
  `MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAwWP4dO4iYcHpcO6lVmjC
gg/jfLM4fP+wWNaoDvMke0gQ7m9smXVtgbYXb6qzEd0aDaCRX3em+eo6bWp6ps5U
+8USRxuNH4cs6ZLjGynmZnm2TXrJScixUEw4ULq8Rdexr4ZmtT1WfUjJSFQpWWwp
e69kVR0iwwiCFRq90I/7MfJWnwgHX2tkUkVBttmXt9o0wP8th/UOIdx+0VbrqhgY
wMyo3xCUvqcSpcKsHXoLkKGlpcplE96rKg2vOqhSSQzoHMr8ZrGIn7hsPI7enVsP
D/nMiJptavVowfNZjM/rd6Iv/TYfI1JOJWUeIM+aPyhZKrvWHGdC8VO2jneNkNXj
1B6tnZy6owPt4Lgdimr0u/146WvjAL+ZK1dc4CNecOLeRINn26POCIeOpYPHGhbi
N6K1UrHpC1Oon2NW5ms9dciE242O1BrQF5j/GvNzGoV74GvnbVFZ9eyBJm9MlIOU
Sd5O2iTqWPmJ03wVSXLx+6g0fgaGHEDtKtbfhuHvDG2dIoAB7q+oKBHQJ7CIFEbI
lBnPV1v+dxDLb3DdK0Ip9wM74S2+Nf9359TCjAaWgNjiTnhBw6xpwTGn/8vzNL3p
fcEVJJt8DUfuCYV9mtKPHbj06RHnLsaXQ72x6I+ocXi8TygTjldZFx13ttJqVvju
UaTE0E4KN9Mzb/2zEYTgCzcCAwEAAQ==`,
];

/**
 * Public keys used to verify authenticity of entities that are authorized to
 * use the bypass API.
 *
 * @type {string[]}
 */
defaults.bypass_authorizedKeys = [
  // Readership Link public key
  // https://eyeo.atlassian.net/browse/EXT-30
  `MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAt7CNJC8ntgHa4GviCdeV
f1sSIJMI73rDvUcGPS0u/SlJCoE0v71q76b6pEJd7Znztxiyfx9SePM+uaCZKpfm
2sXx/vOfOXDsSDGyUq0a3vj/kNtIaLEhoaZ+uYYBQV995BfQ/qOUgkFNimyfwzYg
+chyXqEvwjjqRQ5cWOUmK4lQoAr+OJXmoq9KHSK6TnW7gHZrm5CUhN9TR2DRv9io
DiVTDIcbBh7KpvN4o/gp+x+oCbh3sWtucweu9fhUwKvlqoO24xuMfLQJ+iSShy5z
gKfWCEcQoOYARsV5pTsOKo8u3e2bbc/D5rCKTOqG3vSkafaxLLyskUz9zEm+gkOO
PMF/M0BZIZ8gPzz+YlOr9qGvLfV9XiagIpF/sPxi86f7TPlMGnOi4N4PT5eMaFtK
tfy2y3PJZN9cxAOitFjtXlllPsDbu9VAERfSCCZgHM7QY+GqQKrMcaHC3tNGhcve
GhL5A8p+PLLu8msHcc11DmmDgNVVamRggk3h5STbJP+TkgoZ1BoAYPStjF+xzvCj
UnIc1wA9sRfRNPcW+fVjOFkAF99sqew6zqL3gwmMdHdd9iVUHx7yyLkJOwJhzM5n
I51tXMpSOPPNheNGfAY7b8xGGv8M3SgoLg+dtKAV1mjyFftZ/9KP2+82Hgu+QNAX
9OLtuZ8eT/2idUzy2F+u17cCAwEAAQ==`,
];

/**
 * The application version as set during initialization. Used to detect updates.
 *
 * @type {string}
 */
defaults.currentVersion = "";
/**
 * @see https://adblockplus.org/en/preferences#documentation_link
 * @type {string}
 */
defaults.documentation_link = "https://adblockplus.org/redirect?link=%LINK%&lang=%LANG%";
/**
 * The total number of requests blocked by the extension.
 *
 * @type {number}
 */
defaults.blocked_total = 0;

/**
 * Whether to show a badge in the toolbar icon indicating the number
 * of blocked ads.
 *
 * @type {boolean}
 */
defaults.show_statsinicon = true;
/**
 * Whether to show the "Block element" context menu entry.
 *
 * @type {boolean}
 */
defaults.shouldShowBlockElementMenu = true;

/**
 * Whether to show tracking warning in options page when both
 * Acceptable Ads and subscription of type "Privacy" are enabled.
 *
 * @type {boolean}
 */
defaults.ui_warn_tracking = true;

/**
 * Whether to show the developer tools panel.
 *
 * @type {boolean}
 */
defaults.show_devtools_panel = true;

/**
 * Whether the global data collection opt out is enabled or not.
 *
 * @type {boolean}
 */
defaults.data_collection_opt_out = false;

/**
 * Prevents unsolicited UI elements from showing up after installation. This
 * preference isn't set by the extension but can be pre-configured externally.
 *
 * @see https://adblockplus.org/development-builds/suppressing-the-first-run-page-on-chrome
 * @type {boolean}
 */
defaults.suppress_first_run_page = false;

/**
 * Additonal subscriptions to be automatically added when the extension is
 * loaded. This preference isn't set by the extension but can be pre-configured
 * externally.
 *
 * @type {string[]}
 */
defaults.additional_subscriptions = [];

/**
 * The version of major updates that the user is aware of. If it's too low,
 * the updates page will be shown to inform the user about intermediate changes.
 *
 * @type {number}
 */
defaults.last_updates_page_displayed = 0;

/**
 * Causes elements targeted by element hiding (and element hiding emulation)
 * to be highlighted instead of hidden.
 *
 * @type {boolean}
 */
defaults.elemhide_debug = false;

/**
 * Whether to recommend language filter lists to user.
 *
 * @type {boolean}
 */
defaults.recommend_language_subscriptions = false;

/**
 * Premium user ID
 *
 * @type {string}
 */
defaults.premium_user_id = "";

/**
 * Map of commands
 *
 * @type {Object}
 */
defaults.ipm_commands = {};

/**
 * Map of command stats
 *
 * @type {Object}
 */
defaults[commandStats] = {};

/**
 * Default trusted origin for URLs used in IPMs. This is the base URL used when
 * a relative URL is passed.
 *
 * @type {string}
 */
defaults.ipm_default_origin = "https://getadblock.com";

/**
 * Trusted origins for URLs used in IPMs
 *
 * @type {string}
 */
defaults.ipm_safe_origins = [
  defaults.ipm_default_origin,
  "https://blog.getadblock.com",
  "https://helpcenter.getadblock.com",
  "https://vpn.getadblock.com",
];

/**
 * Minimum log level
 *
 * @type {number}
 */
defaults.logger_log_level = 3;

/**
 * Map of command stats
 *
 * @type {Object}
 */
defaults.onpage_dialog_command_stats = {};

/**
 * The timestamp of the last time we showed a dialog.
 */
defaults.onpage_dialog_last_shown = 0;

/**
 * The minimum amount of time between two dialogs being shown.
 */
defaults.onpage_dialog_cool_down = 24 * 60 * 60 * 1000;

/**
 * The timestamp of the last time we opened a new tab.
 */
defaults.new_tab_last_shown = 0;

/**
 * The minimum amount of time between two new tabs being opened.
 */
defaults.new_tab_cool_down = 24 * 60 * 60 * 1000;

/**
 * Map of on-page dialog timing configurations
 *
 * @type {Object}
 */
defaults.onpage_dialog_timing_configurations = {
  after_web_allowlisting: {
    cooldownDuration: 24,
    maxAllowlistingDelay: 2,
    maxDisplayCount: 3,
  },
  immediate: {
    cooldownDuration: 0,
    maxDisplayCount: 0,
  },
  revisit_web_allowlisted_site: {
    cooldownDuration: 48,
    maxDisplayCount: 3,
    minAllowlistingDelay: 48 * 60,
  },
  after_navigation: {
    cooldownDuration: 1,
    maxDisplayCount: 1,
  },
};

/**
 * Map of IPM user events
 *
 * @type {Object}
 */
defaults[eventStorageKey] = [];

/**
 * The URL of the IPM server.
 *
 * @type {string}
 */
defaults.ipm_server_url = "https://ipm.adblock.dev/api/stats";

/**
 * The URL of the Ping server.
 *
 * @type {string}
 */
defaults.ping_server_url = "https://ping.getadblock.com/stats/";

/**
 * The URL of the backup Ping server.
 *
 * @type {string}
 */
defaults.backup_ping_server_url = "https://ping-retry.getadblock.com/stats/";

/**
 * Whether to send ad wall related log event messages
 *
 * @type {boolean}
 */
defaults.send_ad_wall_messages = true;

/**
 * Where the dialog for the YouTube wall should link users to
 *
 * @type {string}
 */
defaults.yt_auto_allow_dialog_url = "https://getadblock.com/youtube/";

/**
 * Start date (as a number) to start auto allowing YT
 *
 * @type {Number}
 */
defaults.yt_allowlist_start_date = 0;

/**
 * The number of milliseconds to extend the allowlisting filter's expiry when
 * the user navigated to a URL that matches the filter.
 *
 * @type {number}
 */
defaults.allowlisting_auto_extend_ms = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Whether all historic allowlisting filters were transitioned to smart allowlisting
 *
 * @type {boolean}
 */
defaults.migration_popup_to_smart_allowlist_complete = false;

/**
 * @namespace
 * @static
 */
export let Prefs = {
  /**
   * Retrieves the given preference.
   *
   * @param {string} preference
   * @return {any}
   */
  get(preference) {
    // We need to temporarily force-disable data collection in Firefox, while
    // we're working on improving our data collection opt-out mechanism based
    // on Mozilla's requirements
    // https://gitlab.com/adblockinc/ext/adblock/adblock/-/issues/574
    if (preference === "data_collection_opt_out" && info.application === "firefox") return true;

    let result = (preference in overrides ? overrides : defaults)[preference];

    // Object preferences are mutable, so we need to clone them to avoid
    // accidentally modifying the preference when modifying the object
    if (typeof result === "object") result = JSON.parse(JSON.stringify(result));

    return result;
  },

  /**
   * Resets the given preference to its default value.
   *
   * @param {string} preference
   * @return {Promise} A promise that resolves when the underlying
                       browser.storage.local.set/remove() operation completes
   */
  reset(preference) {
    return Prefs.set(preference, defaults[preference]);
  },

  /**
   * Sets the given preference.
   *
   * @param {string} preference
   * @param {any}    value
   * @return {Promise} A promise that resolves when the underlying
                       browser.storage.local.set/remove() operation completes
   */
  set(preference, value) {
    let defaultValue = defaults[preference];

    if (typeof value != typeof defaultValue) throw new Error("Attempt to change preference type");

    if (value == defaultValue) {
      let oldValue = overrides[preference];
      delete overrides[preference];

      // Firefox 66 fails to emit storage.local.onChanged events for falsey
      // values. https://bugzilla.mozilla.org/show_bug.cgi?id=1541449
      if (!oldValue && info.platform == "gecko" && parseInt(info.platformVersion, 10) == 66)
        onStorageChanged({ [prefToKey(preference)]: { oldValue } }, "local");

      return browser.storage.local.remove(prefToKey(preference));
    }

    overrides[preference] = value;
    return (customSave.get(preference) || savePref)(preference);
  },

  /**
   * Adds a callback that is called when the
   * value of a specified preference changed.
   *
   * @param {string}   preference
   * @param {function} callback
   */
  on(preference, callback) {
    eventEmitter.on(preference, callback);
  },

  /**
   * Removes a callback for the specified preference.
   *
   * @param {string}   preference
   * @param {function} callback
   */
  off(preference, callback) {
    eventEmitter.off(preference, callback);
  },

  /**
   * Reads the documentation_link preference and substitutes placeholders.
   *
   * @param {string} linkID
   * @return {string}
   */
  getDocLink(linkID) {
    return this.documentation_link
      .replace(/%LINK%/g, linkID)
      .replace(/%LANG%/g, browser.i18n.getUILanguage());
  },

  /**
   * A promise that is fullfilled when all preferences have been loaded.
   * Wait for this promise to be fulfilled before using preferences during
   * extension initialization.
   *
   * @type {Promise}
   */
  untilLoaded: null,
};

function keyToPref(key) {
  if (key.indexOf(keyPrefix) != 0) return null;

  return key.substr(keyPrefix.length);
}

function prefToKey(pref) {
  return keyPrefix + pref;
}

function savePref(pref) {
  return browser.storage.local.set({ [prefToKey(pref)]: overrides[pref] });
}

let customSave = new Map();
if (info.platform == "gecko" && parseInt(info.platformVersion, 10) < 66) {
  // Saving one storage value causes all others to be saved as well for
  // Firefox versions <66. Make sure that updating ad counter doesn't cause
  // the filters data to be saved frequently as a side-effect.
  let promise = null;
  customSave.set("blocked_total", (pref) => {
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        setTimeout(() => {
          promise = null;
          savePref(pref).then(resolve, reject);
        }, 60 * 1000);
      });
    }
    return promise;
  });
}

function addPreference(pref) {
  Object.defineProperty(Prefs, pref, {
    get() {
      return Prefs.get(pref);
    },
    set(value) {
      Prefs.set(pref, value);
    },
    enumerable: true,
  });
}

function onStorageChanged(changes) {
  for (let key in changes) {
    let pref = keyToPref(key);
    if (pref && pref in defaults) {
      let change = changes[key];
      if ("newValue" in change && change.newValue != defaults[pref])
        overrides[pref] = change.newValue;
      else delete overrides[pref];

      eventEmitter.emit(pref);
    }
  }
}

async function init() {
  let prefs = Object.keys(defaults);
  prefs.forEach(addPreference);

  let isEdgeChromium = info.application == "edge" && info.platform == "chromium";

  // When upgrading from EdgeHTML to Edge Chromium (v79) data stored in
  // browser.storage.local gets corrupted.
  // To fix it, we have to call JSON.parse twice.
  // See: https://gitlab.com/eyeo/adblockplus/adblockpluschrome/issues/152
  if (isEdgeChromium) {
    let items = await browser.storage.local.get(null);

    let fixedItems = {};
    for (let key in items) {
      if (typeof items[key] == "string") {
        try {
          fixedItems[key] = JSON.parse(JSON.parse(items[key]));
        } catch (e) {}
      }
    }

    await browser.storage.local.set(fixedItems);
  }

  {
    let items = await browser.storage.local.get(prefs.map(prefToKey));
    for (let key in items) overrides[keyToPref(key)] = items[key];
  }

  if ("managed" in browser.storage) {
    try {
      let items = await browser.storage.managed.get(null);
      for (let key in items) defaults[key] = items[key];
    } catch (e) {
      // Opera doesn't support browser.storage.managed, but instead of simply
      // removing the API, it gives an asynchronous error which we ignore here.
    }
  }

  browser.storage.onChanged.addListener(onStorageChanged);

  // Initialize notifications_ignoredcategories pseudo preference
  Object.defineProperty(Prefs, "notifications_ignoredcategories", {
    get() {
      return ewe.notifications.getIgnoredCategories();
    },
    set(value) {
      ewe.notifications.toggleIgnoreCategory("*", !!value);
    },
    enumerable: true,
  });

  ewe.notifications.on("ignored-category-added", () =>
    eventEmitter.emit("notifications_ignoredcategories"),
  );
  ewe.notifications.on("ignored-category-removed", () =>
    eventEmitter.emit("notifications_ignoredcategories"),
  );
}

Prefs.untilLoaded = init();

/**
 * Returns the value of the given preference key.
 *
 * @event "prefs.get"
 * @property {string} key - The preference key.
 * @returns {string|string[]|number|boolean}
 */
port.on("prefs.get", (message, sender) => Prefs[message.key]);

/**
 * Sets the value of the given preference key to the given value.
 *
 * @event "prefs.set"
 * @property {string} key - The preference key.
 * @property {string} value - The value to set.
 * @returns {string|string[]|number|boolean|undefined}
 */
port.on("prefs.set", async (message, sender) => (Prefs[message.key] = message.value));

/**
 * Toggles the value of the given preference key.
 *
 * @event "prefs.toggle"
 * @property {string} key - The preference key
 * @returns {?boolean}
 */
port.on("prefs.toggle", async (message, sender) => {
  if (message.key == "notifications_ignoredcategories")
    return ewe.notifications.toggleIgnoreCategory("*");

  return (Prefs[message.key] = !Prefs[message.key]);
});

/**
 * Returns a link to a page on our website, in the user's locale if possible.
 *
 * @event "prefs.getDocLink"
 * @property {string} link
 *   The link ID to generate the doc link for.
 * @returns {string}
 */
port.on("prefs.getDocLink", (message, sender) => {
  let { application, platform } = info;
  if (platform == "chromium" && application != "opera" && application != "edge")
    application = "chrome";
  else if (platform == "gecko") application = "firefox";

  return Prefs.getDocLink(message.link.replace("{browser}", application));
});

installHandler("prefs", null, (emit, action) => {
  const onChanged = () => emit(Prefs[action]);
  Prefs.on(action, onChanged);
  return () => Prefs.off(action, onChanged);
});
