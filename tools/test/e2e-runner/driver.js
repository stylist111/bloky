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
import { By, WebElement } from "selenium-webdriver";

// As of Microsoft Edge 136, driver.getWindowHandles() also returns the
// extensions' background pages (MV2), so we need to ignore them in order
// not to accidentally interact with those.
export async function getAllWindowHandlesSafe() {
  const { browserName, manifestVersion } = global.config;
  if (browserName === "firefox" || manifestVersion === "3") {
    return await driver.getAllWindowHandles();
  }

  let previousHandle;
  try {
    previousHandle = await driver.getWindowHandle();
  } catch (err) {
    // We can't get the current window handle. Ignoring it
    // Example: NoSuchWindowError
  }

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

  let handleSwitchErr;
  if (previousHandle) {
    try {
      await driver.switchTo().window(previousHandle);
    } catch (err) {
      // Switching to previous Handle didn't work.
      previousHandle = null;
      handleSwitchErr = err;
    }
  }

  // Cant be an "else" because previousHandle may habe been reassigned
  if (!previousHandle) {
    // To avoid having switched to the generated background page handle in the
    // previous loop, we need a safe handle to switch to
    const safeHandle = safeHandles.find((handle) => handle !== previousHandle);
    if (safeHandle) {
      await driver.switchTo().window(safeHandle);
    } else {
      console.warn(`There are no safe handles to switch to: ${handleSwitchErr}`);
    }
  }

  return safeHandles;
}

export async function findUrl(
  expectedUrl,
  { timeout = 5000, exists = true, mustLoad = false } = {},
) {
  let url;
  let handle;

  // When checking that the URL does not exist, we want to give it enough time in case it does open
  if (!exists) {
    await driver.sleep(timeout);
  }

  await wait(
    async () => {
      try {
        const handles = await getAllWindowHandlesSafe();
        let urlFound = false;

        for (handle of handles) {
          await driver.switchTo().window(handle);
          url = await driver.getCurrentUrl();
          if (url && url.includes(expectedUrl)) {
            urlFound = true;
            break;
          }
        }
        return exists ? urlFound : !urlFound;
      } catch (err) {
        if (err.name !== "NoSuchWindowError") {
          throw err;
        }
        return !exists;
      }
    },
    timeout,
    `${expectedUrl} was ${exists ? "not found" : "found"}`,
  );

  if (exists && mustLoad) {
    await wait(
      async () => {
        const readyState = await driver.executeScript("return document.readyState");
        return readyState === "complete";
      },
      timeout,
      "Page did not finish loading",
    );
  }

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

  if (tabId < 0) {
    throw new Error(`tabId could not be found for current URL ${url}`);
  }

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
 * @param {boolean} options.verboseLogging - When true, selector of the element that is not displayed
 *                                           is logged in the console
 * @returns {Promise<Object>} - The webdriver element found in the page
 */
export async function getDisplayedElement(
  cssSelector,
  { timeout = 500, forceRefresh = false, checkDisplayed = true, verboseLogging = false } = {},
) {
  let elem;
  const findElement = async () => {
    await wait(
      async () => {
        try {
          elem = await driver.findElement(By.css(cssSelector));
          if (checkDisplayed) {
            const isDisplayed = await elem.isDisplayed();
            if (verboseLogging && !isDisplayed) {
              console.warn(`The element ${cssSelector} is not displayed`);
            }
            return isDisplayed;
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
 * Waits for the duration of the timeout to confirm that an element has never
 * been displayed. Usually used for elements that weren't displayed before and
 * are expected to continue not being displayed after a certain action.
 *
 * @param {string} cssSelector - The CSS locator of the element
 * @param {Object} options - Options object
 * @param {number} options.timeout - Overall polling timeout in ms
 * @param {boolean} options.checkDisplayed - When false, the element doesn't need to be displayed
 * @returns {Promise<void>}
 */
export async function waitForNeverDisplayed(
  cssSelector,
  { timeout = 3000, checkDisplayed = true } = {},
) {
  try {
    await getDisplayedElement(cssSelector, { timeout, checkDisplayed });
  } catch (err) {
    return;
  }

  throw new Error(`Expected element "${cssSelector}" to never be displayed`);
}

/**
 * Waits for an element to no longer be displayed. Usually used on elements that were
 * previously displayed and expected to become hidden after a certain action.
 *
 * @param {string} cssSelector - The CSS locator of the element
 * @param {Object} options - Options object
 * @param {number} options.timeout - Overall polling timeout in ms
 * @param {number} options.displayedTimeout - Timeout in ms for the displayed element to be hidden
 * @param {boolean} options.forceRefresh - Refresh the page if the element is found
 * @param {boolean} options.checkDisplayed - When false, the element doesn't need to be displayed
 * @returns {Promise<void>}
 * @example
 * timeout=1000, displayedTimeout=500 will produce up to 2 wait() retries
 * timeout=1500, displayedTimeout=500 will produce up to 3 retries
 * timeout=3000, displayedTimeout=1000 will also produce up to 3 retries, but
 *   waiting longer for the displayed element to be hidden
 */
export function waitForNotDisplayed(
  cssSelector,
  { timeout = 1000, displayedTimeout = 500, forceRefresh = false, checkDisplayed = true } = {},
) {
  return wait(
    async () => {
      try {
        await getDisplayedElement(cssSelector, { timeout: displayedTimeout, checkDisplayed });
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

export async function waitForNotNullProperty(cssSelector, property, { timeout = 1000 } = {}) {
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

/**
 * Clicks on a displayed element.
 *
 * @param {string|Object} cssSelectorOrWebElement - Either the CSS locator of the element or an instance of Selenium's WebElement
 * @param {Object} options - Options object
 * @param {number} options.timeout - polling timeout in ms
 * @param {boolean} options.scrollIntoView - Scroll into element's view before click
 * @param {boolean} options.checkDisplayed - When false, the element doesn't need to be displayed
 * @param {boolean} options.jsClick - When true, do a javascript click instead of a regular Selenium click.
 *                                    Used as a workaround when elem.click() doesn't work
 * @returns {Promise<Object>} - The webdriver element found in the page
 */
export async function clickOnDisplayedElement(
  cssSelectorOrWebElement,
  { timeout = 500, scrollIntoView = false, checkDisplayed = true, jsClick = false } = {},
) {
  const bigTimeout = timeout * 2;

  let elem;
  let cssSelector;
  if (cssSelectorOrWebElement instanceof WebElement) {
    elem = cssSelectorOrWebElement;
  } else {
    cssSelector = cssSelectorOrWebElement;
  }

  await wait(
    async () => {
      try {
        if (cssSelector) {
          elem = await getDisplayedElement(cssSelector, { timeout, checkDisplayed });
        }
        if (scrollIntoView) {
          await driver.executeScript("arguments[0].scrollIntoView();", elem);
        }
        // make sure the element is interactable
        await elem.isEnabled();

        if (jsClick) {
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
  const initialWindowHandles = await getAllWindowHandlesSafe();

  await clickOnDisplayedElement(selector, { timeout: 2000, scrollIntoView: true });
  await wait(
    async () => {
      const currentWindowHandles = await getAllWindowHandlesSafe();
      return currentWindowHandles.length > initialWindowHandles.length;
    },
    5000,
    `The element "${selector}" did not open a new tab with the URL "${expectedURL}"`,
  );

  const currentWindowHandles = await getAllWindowHandlesSafe();
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
    5000,
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

export async function waitForAssertion(
  assertion,
  timeout = 1000,
  pollTimeout = 200,
  { forceRefresh = false } = {},
) {
  let lastError = null;
  function throwLastError() {
    throw lastError;
  }

  return wait(
    async function () {
      try {
        await assertion();
        return true;
      } catch (e) {
        lastError = e;
        if (forceRefresh) {
          await driver.navigate().refresh();
        }
        return false;
      }
    },
    timeout,
    throwLastError,
    pollTimeout,
  );
}
