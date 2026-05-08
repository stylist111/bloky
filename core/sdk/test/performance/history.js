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

/* eslint-disable no-console */

import {By, until} from "selenium-webdriver";

import {writeScreenshot, getCurrentDriver} from "@eyeo/test-utils/sdk-driver";
import {screenshotsPath} from "../runners/shared.js";

// To be removed: https://eyeo.atlassian.net/browse/EXT-97
const historyTestSkipped = true;

export async function historyTest() {
  const driver = getCurrentDriver();

  console.log("\n--History performance test--");

  if (historyTestSkipped) {
    console.warn("History test is being skipped");
    return;
  }
  const failure = "History test FAILED";

  const url = "https://dev.motiv.fm";
  console.log(`\nRunning history test on ${url} ...`);
  await driver.navigate().to(url);

  const sidebarCss = ".layout-sidebar__menu > .layout-menu-menu-list__item > a";
  let sidebarLinks = await driver.findElements(By.css(sidebarCss));

  // Make sure sidebar elements are not initially stale
  let becameStale = false;
  for (let elem of sidebarLinks) {
    try {
      await driver.wait(until.stalenessOf(elem), 500);
      becameStale = true;
    }
    catch (e) {} // Sidebar elements may never become stale
  }
  if (becameStale) {
    sidebarLinks = await driver.findElements(By.css(sidebarCss));
  }

  if (sidebarLinks.length < 2) {
    throw new Error(`${failure}: At least 3 sidebar links are expected`);
  }

  let currentUrl;
  for (let elem of sidebarLinks) {
    try {
      await elem.click();
    }
    catch (err) {
      await writeScreenshot(screenshotsPath, "screenshot.png");
      if (err.name == "StaleElementReferenceError") {
        throw new Error(`${failure}: Clicking on a stale element`);
      }
      else {
        throw err;
      }
    }

    let nextUrl;
    await driver.wait(async() => {
      nextUrl = await driver.getCurrentUrl();
      return nextUrl != currentUrl;
    }, 1000, `${failure}: Clicking an element didn't load a new URL. Current: ${currentUrl}`);
    currentUrl = nextUrl;
  }

  console.log("History test OK.");
}

