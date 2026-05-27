/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2026-present eyeo GmbH
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

/**
 * Triggers `browser.runtime.reload()` from a given extension window handle
 * and waits for that window to close. Host-agnostic: does not touch
 * options-page state or stored handles. Caller is responsible for navigating
 * to wherever they need next.
 *
 * Suitable for callers (e.g. SDK and fragment tests) that do not need the
 * suppress-update-page / options-page-init flow handled by `reloadExtension`.
 *
 * @param {Object} driver - Selenium webdriver instance
 * @param {Object} extensionPageHandle - The window handle of an extension page
 *   from which to trigger the reload (typically the options page).
 * @returns {Promise<void>}
 */

export async function reloadExtension(driver, extensionPageHandle) {
  // Extension pages will be closed during reload, create a safe tab to land
  // on so we avoid the "target window already closed" error.
  await driver.switchTo().newWindow("tab");
  const safeHandle = await driver.getWindowHandle();

  await driver.switchTo().window(extensionPageHandle);
  await driver.executeScript(() => {
    // Unloading the extension leads to an ECONNREFUSED error, so in order to
    // ensure that we have enough time to switch to a safe window handle,
    // we're delaying the triggering of the reload
    // https://eyeo.atlassian.net/browse/EXT-153
    // The "chrome" object is used instead of "browser" to support old chrome versions
    setTimeout(() => chrome.runtime.reload(), 1000);
  });
  // Workaround for `target window already closed`
  await driver.switchTo().window(safeHandle);

  // Wait until the current page closes, otherwise we might switch back to it
  // thinking that the reload is complete.
  await driver.wait(
    async () => {
      const handles = await driver.getAllWindowHandles();
      return !handles.includes(extensionPageHandle);
    },
    5000,
    "Extension page not closed after reload",
  );
}
