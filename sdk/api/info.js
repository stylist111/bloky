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

import browser from "webextension-polyfill";

import {setRecommendations} from "adblockpluscore/lib/recommendations.js";

let manifest = browser.runtime.getManifest();

export let addonName = manifest.short_name || manifest.name;
export let addonVersion = manifest.version;
export let addonBundledSubscriptions;
export let addonBundledSubscriptionsPath;
export let application = "unknown";
export let applicationVersion = "0";
export let platform;
export let platformVersion = "0";
export let manifestVersion = String(manifest.manifest_version);

function parseChromiumUserAgent() {
  let regexp = /(\S+)\/(\S+)(?:\s*\(.*?\))?/g;
  let match;

  while (match = regexp.exec(navigator.userAgent)) {
    let [, app, version] = match;

    // For compatibility with legacy websites, Chrome's UA
    // also includes a Mozilla, AppleWebKit and Safari tokens.
    // Any further name/version pair indicates a fork.
    if (app == "Mozilla" || app == "AppleWebKit" || app == "Safari")
      continue;

    if (app == "Chrome") {
      platformVersion = version;
      if (application != "unknown")
        continue;
    }

    application = app == "OPR" ? "opera" : app.toLowerCase();
    applicationVersion = version;
  }
}

if (typeof netscape != "undefined") {
  platform = "gecko";

  let match = /\brv:([^;)]+)/.exec(navigator.userAgent);
  if (match)
    platformVersion = match[1];

  browser.runtime.getBrowserInfo().then(browserInfo => {
    application = browserInfo.name.toLowerCase();
    applicationVersion = browserInfo.version;
  });
}
else {
  platform = "chromium";
  parseChromiumUserAgent();
}

export function setAddonInfo(addonInfo) {
  if (browser.declarativeNetRequest) {
    if (!addonInfo)
      throw new Error("No addonInfo provided to EWE.start");

    if (!addonInfo.bundledSubscriptions)
      throw new Error("No `bundledSubscriptions` provided");

    if (!addonInfo.bundledSubscriptionsPath)
      throw new Error("No `bundledSubscriptionsPath` provided");
  }

  if (!addonInfo)
    return;

  if (addonInfo.name)
    addonName = addonInfo.name;
  if (addonInfo.version)
    addonVersion = addonInfo.version;
  if (addonInfo.manifestVersion)
    manifestVersion = addonInfo.manifestVersion;

  addonBundledSubscriptions = addonInfo.bundledSubscriptions;
  addonBundledSubscriptionsPath = addonInfo.bundledSubscriptionsPath;

  if (addonBundledSubscriptions &&
      addonBundledSubscriptions.length > 0)
    setRecommendations(addonBundledSubscriptions);
}
