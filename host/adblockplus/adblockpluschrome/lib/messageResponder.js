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

/** @module messageResponder */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { ORIGIN_ID as EXPERIMENT_FILTER_ORIGIN } from "@eyeo-fragments/filter-experiments/shared";
import rulesIndex from "@eyeo/rules-utils/adblockplus/index/adblockplus.json";

import { port } from "~/core/messaging/background";
import { Prefs } from "./prefs.js";
import { info } from "../../src/info/background";
import { hasActiveLicense } from "~/premium/background";

/**
 * Opens given UI page or switches to it, if it's already open
 *
 * @param {string} pathname - UI page path name
 */
async function openUiPage(pathname) {
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    const url = new URL(tab.url);
    if (pathname !== url.pathname) continue;

    void browser.tabs.update(tab.id, { active: true });
    return;
  }

  void browser.tabs.create({
    url: browser.runtime.getURL(pathname)
  });
}

let ruleInfoByUrl;
function getRuleInfoByUrl() {
  if (!ruleInfoByUrl) {
    ruleInfoByUrl = new Map(
      rulesIndex.map((entry) => [
        entry.url,
        {
          ruleCount: entry.rule_count != null ? entry.rule_count : 0,
          rulesetId: entry.id
        }
      ])
    );
  }
  return ruleInfoByUrl;
}

export function start() {
  /**
   * @deprecated Please send the "filters.getTypes" message instead.
   *
   * @event "types.get"
   */
  port.on("types.get", (message, sender) =>
    port.forward("filters.getTypes", message, sender)
  );

  /**
   * @deprecated Please send the "options.open" message instead.
   *
   * @event "app.open"
   */
  port.on("app.open", async (message, sender) => {
    switch (message.what) {
      case "options":
        await port.forward("options.open", message, sender);
        break;
      case "premium-onboarding":
        await openUiPage("premium-onboarding.html");
        break;
    }

    if (message.replaceTab) void browser.tabs.remove(sender.tab.id);
  });

  /**
   * @deprecated Please send the "subscriptions.getInitIssues",
   *             "prefs.getDocLink", "subscriptions.getRecommendations",
   *             "devtools.supported" or "info.get" messages, or call the
   *             browser.tabs.getCurrent(), browser.i18n.getUILanguage(),
   *             browser.i18n.getMessage("@@bidi_dir") APIs instead.
   *
   * @event "app.get"
   */
  port.on("app.get", async (message, sender) => {
    if (message.what == "localeInfo") {
      return {
        locale: browser.i18n.getUILanguage(),
        bidiDir: browser.i18n.getMessage("@@bidi_dir")
      };
    }

    if (message.what == "acceptableAdsUrl")
      return ewe.subscriptions.ACCEPTABLE_ADS_URL;

    if (message.what == "acceptableAdsPrivacyUrl")
      return ewe.subscriptions.ACCEPTABLE_ADS_PRIVACY_URL;

    if (message.what == "senderId") return sender.tab.id;

    if (message.what == "ctalink") {
      const ctaLinkNameToPrefsMap = new Map([
        ["premium-manage", "premium_manage_page_url"],
        ["premium-upgrade", "premium_upgrade_page_url"]
      ]);

      const { link: ctaLinkName, queryParams } = message;
      const prefsUrlKey = ctaLinkNameToPrefsMap.get(ctaLinkName);
      let url = Prefs[prefsUrlKey];

      const hasPremium = await hasActiveLicense();
      const linkPlaceholders = [
        ["LANG", () => browser.i18n.getUILanguage().replace("-", "_")],
        ["ADDON_NAME", () => info.addonName],
        ["ADDON_VERSION", () => info.addonVersion],
        ["APPLICATION_NAME", () => info.application],
        ["APPLICATION_VERSION", () => info.applicationVersion],
        ["PLATFORM_NAME", () => info.platform],
        ["PLATFORM_VERSION", () => info.platformVersion],
        ["LICENSE_CODE", () => Prefs.get("premium_license").code],
        ["HAS_PREMIUM", () => hasPremium],
        ["SOURCE", () => queryParams.source]
      ];

      for (const [key, getValue] of linkPlaceholders)
        url = url.replace(`%${key}%`, encodeURIComponent(getValue()));

      return url;
    }

    if (message.what == "doclink")
      return port.forward("prefs.getDocLink", message, sender);

    if (message.what == "recommendations")
      return port.forward("subscriptions.getRecommendations", message, sender);

    if (message.what == "features") {
      let devToolsPanel = await port.forward(
        "devtools.supported",
        message,
        sender
      );
      return { devToolsPanel };
    }

    if (message.what == "os") {
      let platformInfo = await browser.runtime.getPlatformInfo();
      return platformInfo.os;
    }

    return info[message.what];
  });

  /**
   * @typedef {object} infoGetResult
   * @property {string} addonName
   *   The extension's name, e.g. "adblockpluschrome".
   * @property {string} addonVersion
   *   The extension's version, e.g. "3.6.3".
   * @property {string} application
   *   The browser's name, e.g. "chrome".
   * @property {string} applicationVersion
   *   The browser's version, e.g. "77.0.3865.90".
   * @property {string} platform
   *   The browser platform, e.g. "chromium".
   * @property {string} platformVersion
   *   The browser platform's version, e.g. "77.0.3865.90".
   */

  /**
   * Returns the browser platform information.
   *
   * @event "info.get"
   * @returns {infoGetResult}
   */
  port.on("info.get", (message, sender) => info);

  /**
   * Returns a snapshot of the extension's current state for debugging.
   *
   * @event "app.getAdFilteringState"
   * @returns {object}
   */
  port.on("app.getAdFilteringState", async (message, sender) => {
    const manifestVersion = browser.runtime.getManifest().manifest_version;
    const isMV3 = manifestVersion === 3;
    const [allSubscriptions, userFilters, dynamicRules] = await Promise.all([
      ewe.subscriptions.getSubscriptions(),
      ewe.filters.getUserFilters(),
      isMV3 ? browser.declarativeNetRequest.getDynamicRules() : []
    ]);
    const subscriptions = allSubscriptions.filter((sub) => sub.enabled);
    const filterCounts = await Promise.all(
      subscriptions.map((sub) =>
        ewe.subscriptions.getFilters(sub.url).then((filters) => filters.length)
      )
    );
    const experimentFiltersCount = userFilters.filter(
      (filter) => filter.metadata?.origin === EXPERIMENT_FILTER_ORIGIN
    ).length;
    return {
      manifestVersion,
      subscriptions: subscriptions.map((sub, index) => {
        const ruleInfo = getRuleInfoByUrl().get(sub.url);
        return {
          title: sub.title || sub.url,
          version: sub.version,
          filterCount: filterCounts[index],
          ...(isMV3 && ruleInfo ? ruleInfo : {})
        };
      }),
      userFiltersCount: userFilters.length,
      experimentFiltersCount,
      dnrDynamicRulesCount: dynamicRules.length,
      maxEnabledRulesets: isMV3
        ? browser.declarativeNetRequest.MAX_NUMBER_OF_ENABLED_STATIC_RULESETS
        : 0,
      maxDynamicRules: isMV3
        ? browser.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES
        : 0
    };
  });
}
