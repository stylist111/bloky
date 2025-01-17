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

/* eslint-env node */
/* eslint-disable no-console */

import fs from "fs";
import path from "path";

import {BROWSERS} from "@eyeo/get-browser-binary";

const screenshotsPath = path.join(process.cwd(), "test", "screenshots");

export async function getHandle(driver, page, timeout = 8000) {
  let url;
  let handle = await driver.wait(() => switchToHandle(driver, handleUrl => {
    if (!handleUrl) {
      return false;
    }

    url = new URL(handleUrl);
    return url.pathname == page;
  }), timeout, `${page} did not open`);

  return handle;
}

export async function switchToHandle(driver, testFn) {
  for (let handle of await driver.getAllWindowHandles()) {
    let url;
    try {
      await driver.switchTo().window(handle);
      url = await driver.getCurrentUrl();
    }
    catch (e) {
      continue;
    }

    if (testFn(url)) {
      return handle;
    }
  }
}

export async function getDriver(browser, version, options) {
  let driver = await BROWSERS[browser].getDriver(version, options);

  let cap = await driver.getCapabilities();
  console.log(`Browser used for tests: ${cap.getBrowserName()} ${cap.getBrowserVersion()}`);

  return driver;
}

export async function writeScreenshot(driver, filename) {
  const data = await driver.takeScreenshot();
  const base64Data = data.replace(/^data:image\/png;base64,/, "");

  await fs.promises.mkdir(screenshotsPath, {recursive: true});
  const screenshotFile = path.join(screenshotsPath, filename);
  await fs.promises.writeFile(screenshotFile, base64Data, "base64");
  console.warn(`Screenshot written to ${screenshotFile}`);
}
