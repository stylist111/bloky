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

/* eslint-env node */
/* eslint-disable no-console */

import fs from "fs";
import path from "path";

import { BROWSERS } from "@eyeo/get-browser-binary";

export const remoteDebuggingPort = 33560; // used by lighthouse

let driver;

export async function quitDriver() {
  if (driver) {
    await driver.quit();
    driver = null;
  }
}

export async function getNewDriver(browser, version, options) {
  await quitDriver();

  try {
    driver = await BROWSERS[browser].getDriver(version, options);
  } catch (err) {
    if (err.name === "SessionNotCreatedError") {
      console.warn(
        `SessionNotCreatedError was thrown. Please check if port ${remoteDebuggingPort} is already in use`,
      );
    }
    throw err;
  }

  const cap = await driver.getCapabilities();
  console.log(`Browser used for tests: ${cap.getBrowserName()} ${cap.getBrowserVersion()}`);

  return driver;
}

export function getCurrentDriver() {
  return driver;
}

export async function setMinDriverTimeout(timeout) {
  const driverTimeouts = await driver.manage().getTimeouts();
  const paramsTimeout = parseInt(timeout, 10);
  if (paramsTimeout === 0) {
    // 0 is a mocha special case to disable timeouts
    await driver.manage().setTimeouts({
      script: null,
    });
  } else if (driverTimeouts.script && paramsTimeout > driverTimeouts.script) {
    await driver.manage().setTimeouts({
      script: paramsTimeout,
    });
  }
}

// Change the pageLoad timeout. Useful to prevent driver calls in switchToHandle
// to potentially spend the default 5 min timeout.
// https://www.selenium.dev/documentation/webdriver/drivers/options/#page-load-timeout
export async function setPageLoadTimeout(timeout) {
  const { pageLoad } = await driver.manage().getTimeouts();
  await driver.manage().setTimeouts({ pageLoad: timeout });

  return pageLoad; // In case we want to restore the previous timeout later on
}

export async function getHandle(page, timeout = 8000) {
  const currentTimeout = await setPageLoadTimeout(4000);

  let url;
  try {
    const handle = await driver.wait(
      () =>
        switchToHandle((handleUrl) => {
          if (!handleUrl) {
            return false;
          }

          url = new URL(handleUrl);
          return url.pathname === page;
        }),
      timeout,
      `${page} did not open`,
    );

    return handle;
  } finally {
    await setPageLoadTimeout(currentTimeout);
  }
}

export async function switchToHandle(testFn) {
  for (const handle of await driver.getAllWindowHandles()) {
    let url;
    try {
      await driver.switchTo().window(handle);
      url = await driver.getCurrentUrl();
    } catch (e) {
      continue;
    }

    if (testFn(url)) {
      return handle;
    }
  }
}

export async function writeScreenshot(screenshotsPath, filename) {
  const data = await driver.takeScreenshot();
  const base64Data = data.replace(/^data:image\/png;base64,/, "");

  await fs.promises.mkdir(screenshotsPath, { recursive: true });
  const screenshotFile = path.join(screenshotsPath, filename);
  await fs.promises.writeFile(screenshotFile, base64Data, "base64");
  console.warn(`Screenshot written to ${screenshotFile}`);
}
