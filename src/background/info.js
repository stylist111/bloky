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

import {setRecommendations} from "adblockpluscore/lib/recommendations.js";
import * as features from "adblockpluscore/lib/features.js";

export let addonName;
export let addonVersion;
export let addonBundledSubscriptions;
export let addonBundledSubscriptionsPath;
export let application;
export let applicationVersion;
export let platform;
export let platformVersion;
export let manifestVersion;

export let sdkName = "eyeo-webext-ad-filtering-solution";
export let sdkVersion = webpackDotenvPlugin.VERSION;

initializeDefaultAddonInfo();

export function getBrowserVersion() {
  return applicationVersion.split(".").map(str => parseInt(str, 10));
}

export function isFirefox() {
  return application.includes("firefox");
}

export function isEdge() {
  return application.includes("edg");
}

export function initializeDefaultAddonInfo() {
  let manifest = browser.runtime.getManifest();

  addonName = manifest.short_name || manifest.name;
  addonVersion = manifest.version;
  application = "unknown";
  applicationVersion = "0";
  platformVersion = "0";
  manifestVersion = String(manifest.manifest_version);

  if (typeof netscape != "undefined") {
    platform = "gecko";

    let match = /\brv:([^;)]+)/.exec(navigator.userAgent);
    if (match) {
      platformVersion = match[1];
    }

    browser.runtime.getBrowserInfo().then(browserInfo => {
      application = browserInfo.name.toLowerCase();
      applicationVersion = browserInfo.version;
    });
  }
  else {
    platform = "chromium";
    parseChromiumUserAgent();
  }
}

function parseChromiumUserAgent() {
  let regexp = /(\S+)\/(\S+)(?:\s*\(.*?\))?/g;
  let match;

  while (match = regexp.exec(navigator.userAgent)) {
    let [, app, version] = match;

    // For compatibility with legacy websites, Chrome's UA
    // also includes a Mozilla, AppleWebKit and Safari tokens.
    // Any further name/version pair indicates a fork.
    if (app == "Mozilla" || app == "AppleWebKit" || app == "Safari") {
      continue;
    }

    if (app == "Chrome") {
      platformVersion = version;
      if (application != "unknown") {
        continue;
      }
    }

    application = app == "OPR" ? "opera" : app.toLowerCase();
    applicationVersion = version;
  }
}

export function setAddonInfo(addonInfo) {
  let warnings = [];

  if (browser.declarativeNetRequest) {
    if (!addonInfo) {
      throw new Error("No addonInfo provided to EWE.start");
    }

    if (!addonInfo.bundledSubscriptions) {
      throw new Error("No `bundledSubscriptions` provided");
    }

    if (!addonInfo.bundledSubscriptionsPath) {
      throw new Error("No `bundledSubscriptionsPath` provided");
    }
  }

  if (!addonInfo) {
    return {warnings};
  }

  if (addonInfo.name) {
    addonName = addonInfo.name;
  }
  if (addonInfo.version) {
    addonVersion = addonInfo.version;
  }
  if (addonInfo.manifestVersion) {
    manifestVersion = addonInfo.manifestVersion;
  }

  addonBundledSubscriptions = addonInfo.bundledSubscriptions;
  addonBundledSubscriptionsPath = addonInfo.bundledSubscriptionsPath;

  if (addonBundledSubscriptions &&
      addonBundledSubscriptions.length > 0) {
    setRecommendations(addonBundledSubscriptions);
  }

  if (addonInfo.featureFlags) {
    try {
      features.setFeatureFlags(addonInfo.featureFlags);
    }
    catch (e) {
      warnings.push(e.message);
    }
  }

  return {warnings};
}
