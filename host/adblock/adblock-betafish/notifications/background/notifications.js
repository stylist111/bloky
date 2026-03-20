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

/* global browser */
/* eslint-disable import/prefer-default-export */

import { Prefs } from "prefs";
import * as info from "info";
import { TELEMETRY } from "../../telemetry/background";

/**
 * The domain where pages are hosted on.
 */
const pageDomain = "https://getadblock.com";

/**
 * A map of relative paths for pages.
 */
const pagePath = {
  installed: "/installed/",
};

/**
 * Opens a page in a new tab.
 *
 * @param {string} path The relative path to the page to open
 * @param {object} [queryParams] Optional query params to attach
 */
function openPage(path, queryParams) {
  let url = `${pageDomain}${path}`;
  if (queryParams) {
    url = `${url}?${new URLSearchParams(queryParams).toString()}`;
  }
  browser.tabs.create({ url });
}

/**
 * Opens the '/installed' page in a new tab.
 */
async function openInstalledPage() {
  // Prefs is already loaded by the caller (start -> onInstalled listener)
  const isOptedOut = Prefs.get("data_collection_opt_out");

  if (isOptedOut) {
    openPage(pagePath.installed);
    return;
  }

  const userID = await TELEMETRY.untilLoaded();
  openPage(pagePath.installed, {
    u: userID,
    lg: browser.i18n.getUILanguage(),
    an: info.addonName,
    av: info.addonVersion,
    ap: info.application,
    apv: info.applicationVersion,
    p: info.platform,
    pv: info.platformVersion,
  });
}

/**
 * Initializes the notifications module.
 */
function start() {
  browser.runtime.onInstalled.addListener(async (details) => {
    await Prefs.untilLoaded;
    if (details.reason === "install" && !Prefs.suppress_first_run_page) {
      openInstalledPage();
    }
  });
}

start();
