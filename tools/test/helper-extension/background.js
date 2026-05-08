/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

// Timeout needed by Firefox. Without it the helper extension is not able to
// open the options page.
// Edge also needs the timeout (see https://eyeo.atlassian.net/browse/EXT-245)
setTimeout(() => {
  chrome.management.getAll((extensions) => {
    for (const extension of extensions) {
      if (
        extension.type === "extension" &&
        extension.installType === "development" &&
        extension.id !== chrome.runtime.id &&
        extension.name !== "Chrome Automation Extension"
      ) {
        chrome.tabs.create({ url: extension.optionsUrl });
      }
    }
  });
}, 5000);
