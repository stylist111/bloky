/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* For ESLint: List any global identifiers used in this file below */
/* global browser */

import { EventEmitter } from "../../../adblockplusui/adblockpluschrome/lib/events";

import {
  chromeStorageSetHelper,
  extend,
  log,
  logging,
} from "../../utilities/background/bg-functions";

/* eslint-disable-next-line import/no-mutable-exports */
export let settingsNotifier;
const abpPrefPropertyNames = [
  "show_statsinicon",
  "shouldShowBlockElementMenu",
  "show_devtools_panel",
  "send_ad_wall_messages",
  "data_collection_opt_out",
];
const validThemes = [
  "default_theme",
  "dark_theme",
  "watermelon_theme",
  "solarized_theme",
  "solarized_light_theme",
  "rebecca_purple_theme",
  "ocean_theme",
  "sunshine_theme",
];

// OPTIONAL SETTINGS
function Settings() {
  this.settingsKey = "settings";
  this.defaults = {
    debug_logging: false,
    youtube_channel_whitelist: true,
    youtube_manage_subscribed: true,
    show_advanced_options: false,
    display_menu_stats: true,
    show_survey: true,
    picreplacement: false,
    twitch_hiding: false,
    onpageMessages: true,
    color_themes: {
      popup_menu: "default_theme",
      options_page: "default_theme",
    },
  };
  const that = this;
  this.init = new Promise((resolve) => {
    browser.storage.local.get(that.settingsKey).then((response) => {
      const settings = response.settings || {};
      // Remove old sync settings if it exists
      // https://eyeo.atlassian.net/browse/EXT-1078
      // TODO: Remove this code after a few releases
      if (settings.sync_settings !== undefined) {
        delete settings.sync_settings;
        browser.storage.local.set({ settings });
      }
      that.data = extend(that.defaults, settings);
      if (settings.debug_logging) {
        logging(true);
      }
      if ("managed" in browser.storage) {
        browser.storage.managed.get(null).then(
          (items) => {
            for (const key in items) {
              if (
                key === "suppress_update_page" ||
                key === "suppress_surveys" ||
                key === "suppress_first_run_page"
              ) {
                that.data[key] = items[key];
              }
            }
            resolve();
          },
          // Opera and FF doesn't support browser.storage.managed, but instead of simply
          // removing the API, it gives an asynchronous error which we ignore here.
          () => {
            resolve();
          },
        );
      } else {
        resolve();
      }
    });
  }).then(() => {
    log("\n===SETTINGS FINISHED LOADING===\n\n");
  });
}

Settings.prototype = {
  set(name, isEnabled, callback) {
    const originalValue = this.data[name];
    // Firefox passes weak references to objects, so in case isEnabled is an object,
    // we need to store a local copy of the object
    const localIsEnabled = JSON.parse(JSON.stringify(isEnabled));
    this.data[name] = localIsEnabled;
    const that = this;

    // Don't store defaults that the user hasn't modified
    browser.storage.local.get(this.settingsKey).then((response) => {
      const storedData = response.settings || {};

      storedData[name] = localIsEnabled;
      chromeStorageSetHelper(that.settingsKey, storedData);
      if (originalValue !== localIsEnabled) {
        settingsNotifier.emit("settings.changed", name, localIsEnabled, originalValue);
      }
      if (callback !== undefined && typeof callback === "function") {
        callback();
      }
    });
  },

  getAll() {
    return this.data;
  },

  onload() {
    return this.init;
  },
};

/* eslint-disable-next-line import/no-mutable-exports */
export let settings;

export const getSettings = function () {
  return settings.getAll();
};

export const setSetting = function (name, isEnabled, callback) {
  settings.set(name, isEnabled, callback);

  if (name === "debug_logging") {
    logging(isEnabled);
  }
};

const disableSetting = function (name) {
  settings.set(name, false);
};

export const isValidTheme = (themeName) => validThemes.includes(themeName);

export function start() {
  settingsNotifier = new EventEmitter();
  settings = new Settings();

  // Attach methods to window
  // eslint-disable-next-line no-restricted-globals
  Object.assign(self, {
    disableSetting,
    getSettings,
    setSetting,
    settings,
    settingsNotifier,
    abpPrefPropertyNames,
    isValidTheme,
  });
}
