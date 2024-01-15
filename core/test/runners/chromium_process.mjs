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

import {BROWSERS} from "@eyeo/get-browser-binary";
import {executeScript} from "./webdriver.mjs";

const CHROMIUM_VERSION = "120.0.6099.71";

async function runScript(script, scriptArgs) {
  let headless = process.env.BROWSER_TEST_HEADLESS != "0";
  console.log(`Getting ready to run Chromium ${CHROMIUM_VERSION} ...`);
  let driver = await BROWSERS.chromium.getDriver(CHROMIUM_VERSION, {headless});

  return executeScript(driver, "Chromium (WebDriver)", script, scriptArgs);
}

export default function(script, scriptName, ...scriptArgs) {
  return runScript(script, scriptArgs);
}
