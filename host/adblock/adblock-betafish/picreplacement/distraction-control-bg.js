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
/* global browser, log */

// Bloky: instead of silently posting the page URL and browser details to
// AdBlock's support server, open a pre-filled GitHub issue. The user sees
// exactly what will be sent and decides whether to submit it.
const sendDCReport = function (url, type) {
  if (!url || !type) {
    return;
  }
  const issue = new URL("https://github.com/stylist111/bloky/issues/new");
  issue.searchParams.set("title", `Distraction not hidden: ${new URL(url).hostname}`);
  issue.searchParams.set(
    "body",
    `Page: ${url}\nBloky version: ${browser.runtime.getManifest().version}\n\nWhat is still shown:\n`,
  );
  browser.tabs.create({ url: issue.href }).catch((error) => {
    log("could not open issue page: ", error);
  });
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== "sendDCReport" || !message.url || !message.type) {
    return;
  }
  sendDCReport(message.url, message.type);
  sendResponse({});
});
