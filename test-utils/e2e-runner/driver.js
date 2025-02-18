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

import fs from "fs";
import path from "path";
import { By } from "selenium-webdriver";
import { expect } from "expect";

export async function findUrl(expectedUrl, timeout = 5000) {
  let url;
  let handle;
  await driver.wait(
    async () => {
      try {
        for (handle of await safeGetAllWindowHandles()) {
          await driver.switchTo().window(handle);
          url = await driver.getCurrentUrl();
          if (url && url.includes(expectedUrl)) {
            return true;
          }
        }
      } catch (err) {
        if (err.name !== "NoSuchWindowError") {
          throw err;
        }
      }
    },
    timeout,
    `${expectedUrl} was not found`,
  );

  return { url, handle };
}

// Gets the ID of current tab using the browser.tabs WebExtension API.
// This is mainly used to work with the popup when it is open in a tab.
export async function getTabId(optionsHandle) {
  const currentHandle = await driver.getWindowHandle();
  const url = await driver.getCurrentUrl();

  await driver.switchTo().window(optionsHandle);
  const tabId = await driver.executeAsyncScript(
    async (params, callback) => {
      try {
        const tabs = await browser.tabs.query({});
        // filtering with browser.tabs.query({ url }) does not work for all URLs
        // e.g. http://localhost:3005/test.html
        for (const tab of tabs) {
          if (tab.url === params.url) {
            callback(tab.id);
            return;
          }
        }
      } catch (e) {}

      callback(browser.tabs.TAB_ID_NONE);
    },
    { url },
  );

  await driver.switchTo().window(currentHandle);
  return tabId;
}

// The forceRefresh property is a temporary workaround, to be removed when fixing
// https://eyeo.atlassian.net/browse/EXT-335
export async function getDisplayedElement(
  cssSelector,
  { timeout = 500, forceRefresh = true, checkDisplayed = true } = {},
) {
  let elem;
  const findElement = async () => {
    await driver.wait(
      async () => {
        try {
          elem = await driver.findElement(By.css(cssSelector));
          if (checkDisplayed) {
            return await elem.isDisplayed();
          }
          return true;
        } catch (e) {}
      },
      timeout,
      `Element "${cssSelector}" was not displayed after ${timeout}ms`,
    );
  };

  try {
    await findElement();
  } catch (err) {
    if (!forceRefresh) {
      throw err;
    }

    // eslint-disable-next-line no-console
    console.warn(`Element "${cssSelector}" is not displayed, refreshing the page and retrying...`);
    await driver.navigate().refresh();
    await findElement();
  }

  return elem;
}

export async function openNewTab(url) {
  await driver.switchTo().newWindow("tab");
  await driver.navigate().to(url);
  return driver.getWindowHandle();
}

/**
 * Waits for an element to not be displayed is usually used on elements that
 * were previously displayed and expected to become hidden after a certain action
 *
 * @param {string} cssText - The CSS locator of the element
 * @param {Object} options - Options object
 * @param {number} options.timeout - Overall polling timeout in ms
 * @param {number} options.displayedTimeout - Timeout in ms for the displayed element to be hidden
 * @returns {Promise<void>}
 * @example
 * timeout=1000, displayedTimeout=500 will produce up to 2 driver.wait() retries
 * timeout=1500, displayedTimeout=500 will produce up to 3 retries
 * timeout=3000, displayedTimeout=1000 will also produce up to 3 retries, but
 *   waiting longer for the displayed element to be hidden
 */
export function waitForNotDisplayed(cssText, { timeout = 1000, displayedTimeout = 500 } = {}) {
  return driver.wait(
    async () => {
      try {
        await getDisplayedElement(cssText, { timeout: displayedTimeout, forceRefresh: false });
        return false;
      } catch (err) {
        if (err.name === "TimeoutError") {
          return true;
        }
        throw err;
      }
    },
    timeout,
    `Element "${cssText}" is still displayed`,
  );
}

export async function waitForNotNullProperty(cssSelector, property, timeout = 1000) {
  let value;
  await driver.wait(
    async () => {
      try {
        value = await driver.executeScript(
          (selector, prop) => {
            return document.querySelector(selector)[prop];
          },
          cssSelector,
          property,
        );
        return value !== null;
      } catch (e) {}
    },
    timeout,
    `Null property "${property}" for element "${cssSelector}"`,
  );
  return value;
}

export function isCheckboxPropertyEnabled(cssSelector) {
  return waitForNotNullProperty(cssSelector, "checked");
}

export async function isCheckboxAttributeEnabled(cssSelector) {
  const elem = await getDisplayedElement(cssSelector, { forceRefresh: false });
  const attr = await elem.getAttribute("aria-checked");
  return attr === "true";
}

export async function waitForCheckboxStatus(
  cssSelector,
  { timeout = 1000, expectEnabled = true, isProperty = true, name, action = "click" } = {},
) {
  const enabledDisabled = expectEnabled ? "enabled" : "disabled";
  const timeoutMsg = `"${name || cssSelector}" was not ${enabledDisabled} after ${action}`;

  await driver.wait(
    async () => {
      if (isProperty) {
        return (await isCheckboxPropertyEnabled(cssSelector)) === expectEnabled;
      } else {
        return (await isCheckboxAttributeEnabled(cssSelector)) === expectEnabled;
      }
    },
    timeout,
    timeoutMsg,
  );
}

export async function clickOnDisplayedElement(
  cssSelector,
  { timeout = 500, scrollIntoView = false, checkDisplayed = true, checkAttribute = null } = {},
) {
  const bigTimeout = timeout * 2;
  let elem;
  await driver.wait(
    async () => {
      try {
        elem = await getDisplayedElement(cssSelector, {
          timeout,
          forceRefresh: false,
          checkDisplayed,
        });
        if (scrollIntoView) {
          await driver.executeScript("arguments[0].scrollIntoView();", elem);
        }
        if (checkAttribute) {
          const { name, value } = checkAttribute;
          expect(await elem.getAttribute(name)).toEqual(value);
        }
        // make sure the element is interactable
        await elem.isEnabled();

        await elem.click();
        return true;
      } catch (err) {
        // Other element would receive the click
        if (err.name === "ElementClickInterceptedError") {
          console.warn(err.message);
          return false;
        } else if (err.name === "ElementNotInteractableError") {
          console.warn(`Element ${cssSelector} not interactable`);
          return false;
        }

        throw err;
      }
    },
    bigTimeout,
    `Element ${cssSelector} couldn't be clicked`,
  );

  return elem;
}

export async function clickAndSendKeys(cssSelector, text, options) {
  const elem = await clickOnDisplayedElement(cssSelector, options);
  await elem.sendKeys(text);
}

export async function clickAndNavigateBack(selector, expectedURL) {
  const currentURL = await driver.getCurrentUrl();
  await clickOnDisplayedElement(selector);

  const newURL = await driver.getCurrentUrl();
  if (newURL !== expectedURL) {
    throw new Error(`Expected URL to be "${expectedURL}", but got "${newURL}"`);
  }

  await driver.navigate().to(currentURL);
  await driver.navigate().refresh();
}

export async function clickAndCloseNewTab(selector, expectedURL) {
  const currentWindowHandle = await driver.getWindowHandle();
  const initialWindowHandles = await safeGetAllWindowHandles();

  await clickOnDisplayedElement(selector, { timeout: 2000, scrollIntoView: true });
  await driver.wait(
    async () => {
      const currentWindowHandles = await safeGetAllWindowHandles();
      return currentWindowHandles.length > initialWindowHandles.length;
    },
    5000,
    `The element "${selector}" did not open a new tab with the URL "${expectedURL}"`,
  );

  const currentWindowHandles = await safeGetAllWindowHandles();
  const newWindowHandle = currentWindowHandles.find(
    (handle) => !initialWindowHandles.includes(handle),
  );

  if (!newWindowHandle) {
    throw new Error(`Could not find the new window handle after clicking "${selector}"`);
  }

  await driver.switchTo().window(newWindowHandle);

  await driver.wait(
    async () => {
      const newWindowURL = await driver.getCurrentUrl();
      return newWindowURL === expectedURL;
    },
    2000,
    `The new tab did not navigate to the expected URL "${expectedURL}", actual URL: ${await driver.getCurrentUrl()}`,
  );

  // Close the new tab and switch back to the original window
  await driver.close();
  await driver.switchTo().window(currentWindowHandle);
}

// As of Microsoft Edge 133 (possibly even Chromium 133), getWindowHandle() also
// returns the extensions' background pages, so we need to ignore them, in order
// not to accidentally interact with those.
export async function safeGetAllWindowHandles() {
  if (global.config.browserName === "firefox") {
    return await driver.getAllWindowHandles();
  }

  const previousHandle = await driver.getWindowHandle();

  const allHandles = await driver.getAllWindowHandles();
  const safeHandles = [];
  for (const handle of allHandles) {
    try {
      await driver.switchTo().window(handle);
      const url = await driver.getCurrentUrl();
      if (url.includes("_generated_background_page.html")) {
        continue;
      }

      safeHandles.push(handle);
    } catch (e) {
      // Ignoring errors here, as they have no impact on anything that comes
      // after it
    }
  }

  if (previousHandle) {
    try {
      await driver.switchTo().window(previousHandle);
    } catch (err) {
      console.error("Failed to switch back to previous handle", err);
    }
  }

  return safeHandles;
}

export async function scrollToBottom() {
  await driver.executeScript(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await driver.sleep(500); // Sometimes the scrolling is not done when the element is searched for
}

export function getFromStorage(storage, key) {
  return driver.executeAsyncScript(
    async (params, callback) => {
      const result = await browser.storage[params.storage].get([params.key]);
      callback(result[params.key]);
    },
    { storage, key },
  );
}

/**
 * Takes a screenshot of the current page
 *
 * @param {string} title - The title of the screenshot image without the extension
 */
export async function screenshot(title) {
  const data = await driver.takeScreenshot();
  const base64Data = data.replace(/^data:image\/png;base64,/, "");
  const { screenshotsPath } = global.config;

  // ensure screenshots directory exists and write the screenshot to a file
  await fs.promises.mkdir(screenshotsPath, { recursive: true });
  await fs.promises.writeFile(path.join(screenshotsPath, `${title}.png`), base64Data, "base64");
}

export async function getCSSProperty(element, cssProperty, pseudoElement) {
  return driver.executeScript(
    (elem, cssProp, pseudoElem) => {
      return window.getComputedStyle(elem, pseudoElem).getPropertyValue(cssProp);
    },
    element,
    cssProperty,
    pseudoElement,
  );
}
