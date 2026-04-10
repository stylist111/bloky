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

"use strict";

const ewe = require("@eyeo/webext-ad-filtering-solution");

const { coreLocales } = require("../data/locales.json");

async function isAndroid() {
  const platformInfo = await browser.runtime.getPlatformInfo();
  return platformInfo.os == "android";
}

exports.showProblemNotification = async () => {
  if (await isAndroid()) return;

  const locale = browser.i18n.getUILanguage();

  // Due to a race condition, we cannot reliably target the notification to
  // only certain locales. Therefore we have to implement this check ourselves.
  // https://gitlab.com/eyeo/adblockplus/adblockpluschrome/issues/135
  void ewe.notifications.showNotification({
    id: "problem",
    type: /^(?:de|fr)\b/.test(locale) ? "information" : null,
    message: browser.i18n.getMessage("notification_problem_message"),
    links: ["abp:problem"]
  });
};

exports.showUpdatesNotification = async () => {
  if (await isAndroid()) return;

  const locale = browser.i18n.getUILanguage();
  // Due to a race condition, we cannot reliably target the notification to
  // only certain locales. Therefore we have to implement this check ourselves.
  // https://gitlab.com/eyeo/adblockplus/adblockpluschrome/issues/135
  if (!coreLocales.includes(locale)) {
    // That specific locale may not be part of our core languages. However,
    // the language it belongs to may be. Therefore we are able to show the
    // updates page with those translations instead.
    const [language] = locale.split("-");
    if (!coreLocales.includes(language)) return;
  }

  void ewe.notifications.showNotification(
    {
      id: "updates",
      type: "information",
      title: browser.i18n.getMessage("notification_updates_title"),
      message: browser.i18n.getMessage("notification_updates_message"),
      links: ["abp:updates"]
    },
    { ignorable: true }
  );
};
