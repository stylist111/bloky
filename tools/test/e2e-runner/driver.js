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
  await wait(
    async () => {
      try {
        for (handle of await driver.getAllWindowHandles()) {
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

async function doForceRefresh(warnMsg) {
  // eslint-disable-next-line no-console
  console.warn(`${warnMsg}, refreshing the page and retrying...`);
  await driver.navigate().refresh();
}

/**
 * Waits for an element to be displayed and returns it.
 *
 * @param {string} cssSelector - The CSS locator of the element
 * @param {Object} options - Options object
 * @param {number} options.timeout - polling timeout in ms
 * @param {boolean} options.forceRefresh - Refresh the page if the element is not found
 * @param {boolean} options.checkDisplayed - When false, the element doesn't need to be displayed
 * @returns {Promise<Object>} - The webdriver element found in the page
 */
export async function getDisplayedElement(
  cssSelector,
  { timeout = 500, forceRefresh = false, checkDisplayed = true } = {},
) {
  let elem;
  const findElement = async () => {
    await wait(
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
      `Element "${cssSelector}" was not displayed`,
    );
  };

  try {
    await findElement();
  } catch (err) {
    if (!forceRefresh) {
      throw err;
    }
    await doForceRefresh(`Element "${cssSelector}" is not displayed`);
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
 * Waits for an element to not be displayed. Usually used on elements that were
 * previously displayed and expected to become hidden after a certain action
 *
 * @param {string} cssSelector - The CSS locator of the element
 * @param {Object} options - Options object
 * @param {number} options.timeout - Overall polling timeout in ms
 * @param {number} options.displayedTimeout - Timeout in ms for the displayed element to be hidden
 * @param {boolean} options.forceRefresh - Refresh the page if the element is found
 * @returns {Promise<void>}
 * @example
 * timeout=1000, displayedTimeout=500 will produce up to 2 wait() retries
 * timeout=1500, displayedTimeout=500 will produce up to 3 retries
 * timeout=3000, displayedTimeout=1000 will also produce up to 3 retries, but
 *   waiting longer for the displayed element to be hidden
 */
export function waitForNotDisplayed(
  cssSelector,
  { timeout = 1000, displayedTimeout = 500, forceRefresh = false } = {},
) {
  return wait(
    async () => {
      try {
        await getDisplayedElement(cssSelector, { timeout: displayedTimeout });
        if (forceRefresh) {
          await doForceRefresh(`Element "${cssSelector}" is displayed`);
        }
        return false;
      } catch (err) {
        // getDisplayedElement is expected to fail to ensure the element is not displayed
        if (err.name === "TimeoutError") {
          return true;
        }
        throw err;
      }
    },
    timeout,
    `Element "${cssSelector}" is still displayed`,
  );
}

export async function waitForNotNullProperty(cssSelector, property, timeout = 1000) {
  let value;
  await wait(
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
  const elem = await getDisplayedElement(cssSelector);
  const attr = await elem.getAttribute("aria-checked");
  return attr === "true";
}

export async function waitForCheckboxStatus(
  cssSelector,
  { timeout = 1000, expectEnabled = true, isProperty = true, name, action = "click" } = {},
) {
  const enabledDisabled = expectEnabled ? "enabled" : "disabled";
  const timeoutMsg = `"${name || cssSelector}" was not ${enabledDisabled} after ${action}`;

  await wait(
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
  {
    timeout = 500,
    scrollIntoView = false,
    checkDisplayed = true,
    checkAttribute = null,
    jsClick = false,
  } = {},
) {
  const bigTimeout = timeout * 2;
  let elem;
  await wait(
    async () => {
      try {
        elem = await getDisplayedElement(cssSelector, { timeout, checkDisplayed });
        if (scrollIntoView) {
          await driver.executeScript("arguments[0].scrollIntoView();", elem);
        }
        if (checkAttribute) {
          const { name, value } = checkAttribute;
          expect(await elem.getAttribute(name)).toEqual(value);
        }
        // make sure the element is interactable
        await elem.isEnabled();

        if (jsClick) {
          // Workaround when elem.click() doesn't work
          await driver.executeScript((selector) => {
            document.querySelector(selector).click();
          }, cssSelector);
        } else {
          await elem.click();
        }

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
  const initialWindowHandles = await driver.getAllWindowHandles();

  await clickOnDisplayedElement(selector, { timeout: 2000, scrollIntoView: true });
  await wait(
    async () => {
      const currentWindowHandles = await driver.getAllWindowHandles();
      return currentWindowHandles.length > initialWindowHandles.length;
    },
    5000,
    `The element "${selector}" did not open a new tab with the URL "${expectedURL}"`,
  );

  const currentWindowHandles = await driver.getAllWindowHandles();
  const newWindowHandle = currentWindowHandles.find(
    (handle) => !initialWindowHandles.includes(handle),
  );

  if (!newWindowHandle) {
    throw new Error(`Could not find the new window handle after clicking "${selector}"`);
  }

  await driver.switchTo().window(newWindowHandle);

  await wait(
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

async function fullStacktraceOnError(promise) {
  try {
    return await promise;
  } catch (err) {
    const errorMessage = err.message || err.toString();
    const capturedError = new Error(errorMessage, { cause: err });
    capturedError.name = err.name || "Error";
    // Removes the fullStacktraceOnError call from the stacktrace
    Error.captureStackTrace(capturedError, fullStacktraceOnError);

    throw capturedError;
  }
}

/**
 * Wraps driver.wait to preserve the full stacktrace in case of error
 *
 * @see {@link https://www.selenium.dev/selenium/docs/api/javascript/WebDriver.html#wait}
 * @see {@link https://github.com/SeleniumHQ/selenium/issues/11080}
 */
export async function wait(condition, timeout = 0, message, pollTimeout = 200) {
  return fullStacktraceOnError(driver.wait(condition, timeout, message, pollTimeout));
}
