/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2024-present  Adblock, Inc.
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

/* eslint-disable no-console */
import { By } from "selenium-webdriver";

export default function createWdioPolyfill(
  driver,
  browserName,
  fullBrowserVersion
) {
  const polyfillBrowser = {
    capabilities: {
      browserName:
        browserName === "firefox"
          ? browserName
          : browserName === "chromium"
            ? "chrome"
            : "microsoftedge",
      browserVersion: fullBrowserVersion
    }
  };

  /**
   * Wait until the given function returns a truthy value.
   * See: https://www.selenium.dev/selenium/docs/api/javascript/IWebDriver.html#wait
   *
   * @param {Function} fn - The function to execute
   * @param {number} timeout - The timeout in milliseconds
   * @param {string} timeoutMsg - The error message to throw when the timeout is reached
   * @param {number} interval - The interval in milliseconds to check the condition
   * @returns {Promise<*>}
   */
  polyfillBrowser.waitUntil = async (
    fn,
    { timeout, timeoutMsg, interval } = {}
  ) => {
    return driver.wait(fn, timeout, timeoutMsg, interval);
  };

  polyfillBrowser.getWindowHandles = async () => {
    return driver.getAllWindowHandles();
  };

  polyfillBrowser.getWindowHandle = async () => {
    return driver.getWindowHandle();
  };

  /**
   * Reload the current page.
   * @returns {Promise<*>}
   */
  polyfillBrowser.refresh = async () => driver.navigate().refresh();

  polyfillBrowser.switchToWindow = async (handle) => {
    return driver.switchTo().window(handle);
  };

  /**
   * Switch focus to a particular tab / window.
   * See: https://github.com/webdriverio/webdriverio/blob/main/packages/webdriverio/src/commands/browser/switchWindow.ts
   *
   * @param {string} matcher - String or regular expression that matches
   *    the title and url of the page or window name
   * @returns {Promise<*>}
   */
  polyfillBrowser.switchWindow = async (matcher) => {
    if (typeof matcher !== "string" && !(matcher instanceof RegExp)) {
      throw new Error(
        "Unsupported parameter for switchWindow, required is 'string' or an RegExp"
      );
    }

    let currentWindow;
    try {
      // It can happen that the tab is closed before the switchWindow command is executed
      // for example when the extension is uninstalled or reloaded and option pages are closed.
      // In this case, the current window handle is no longer valid, so
      // we catch the error and continue with the search.
      currentWindow = await driver.getWindowHandle();
    } catch (e) {
      // no-op
    }

    const tabs = await driver.getAllWindowHandles();

    const matchesTarget = (target) => {
      if (typeof matcher === "string") {
        return target.includes(matcher);
      }

      return !!target.match(matcher);
    };

    for (const tab of tabs) {
      await driver.switchTo().window(tab);

      /**
       * check if url matches
       */
      const url = await driver.getCurrentUrl();
      if (matchesTarget(url)) {
        return tab;
      }

      /**
       * check title
       */
      const title = await driver.getTitle();
      if (matchesTarget(title)) {
        return tab;
      }

      /**
       * check window name
       */
      const windowName = await driver.executeScript(() => window.name);
      if (windowName && matchesTarget(windowName)) {
        return tab;
      }
    }

    if (currentWindow) {
      await driver.switchTo().window(currentWindow);
    }
    throw new Error(
      `No window found with title, url or name matching "${matcher}"`
    );
  };

  /**
   * Switch focus to a particular frame.
   * @param {WebElementPolyfill} elemWrapper - The element to switch to
   * @returns {Promise<*>}
   */
  polyfillBrowser.switchToFrame = async (elemWrapper) => {
    if (!(elemWrapper instanceof WebElementPolyfill)) {
      throw new Error("switchToFrame expects an WebElementPolyfill instance");
    }

    return driver.switchTo().frame(elemWrapper.element);
  };

  polyfillBrowser.executeAsync = async (fn, ...args) => {
    return driver.executeAsyncScript(fn, ...args);
  };

  polyfillBrowser.execute = async function (fn, ...args) {
    return driver.executeScript(fn, ...args);
  };

  polyfillBrowser.executeScript = async (script, args) => {
    return driver.executeScript(script, ...args);
  };

  // -----------------------------------------------
  // NAVIGATION
  // -----------------------------------------------

  /**
   * Open a new tab with the given URL.
   * @param {string} url - The URL to open
   * @returns {Promise<*>}
   */
  polyfillBrowser.url = async (url) => {
    await driver.switchTo().newWindow("tab");
    return driver.navigate().to(url);
  };

  /**
   * Open a new window with the given URL.
   * @param {string} url - The URL to open
   * @returns {Promise<*>}
   */
  polyfillBrowser.newWindow = async (url) => {
    await driver.switchTo().newWindow("tab");
    return driver.navigate().to(url);
  };

  polyfillBrowser.closeWindow = async () => {
    await driver.close();
    const handles = await driver.getAllWindowHandles();
    if (handles.length) {
      return driver.switchTo().window(handles[handles.length - 1]);
    }
  };

  polyfillBrowser.getUrl = async () => {
    return driver.getCurrentUrl();
  };

  polyfillBrowser.getTitle = async () => {
    return driver.getTitle();
  };

  polyfillBrowser.pause = async (ms) => {
    return driver.sleep(ms);
  };

  polyfillBrowser.keys = async (keys) => {
    return driver.actions().sendKeys(keys).perform();
  };

  // -----------------------------------------------
  // $ - Element Selector
  // -----------------------------------------------

  class WebElementPolyfill {
    constructor(element) {
      this.element = element;
    }

    async isClickable() {
      try {
        await this.element.isDisplayed();
        await this.element.isEnabled();
        return true;
      } catch (e) {
        return false;
      }
    }

    async isDisplayed() {
      // the element is undefined, therefore not displayed
      if (!this.element) return false;

      let isDisplayed;
      try {
        isDisplayed = await this.element.isDisplayed();
      } catch (err) {
        if (err.name === "StaleElementReferenceError") {
          // stale element not found in the current frame, therefore not displayed
          return false;
        }
        throw err;
      }

      return isDisplayed;
    }

    async isExisting() {
      try {
        // If the element can return any text it means it exists
        await this.element.getText();
        return true;
      } catch (e) {
        return false;
      }
    }

    async isEnabled() {
      return this.element.isEnabled();
    }

    async click() {
      try {
        await this.scrollIntoView();
      } catch (e) {
        // no-op
      }
      return this.element.click();
    }

    async getText() {
      return this.element.getText();
    }

    async getAttribute(attrName) {
      return this.element.getAttribute(attrName);
    }

    async clearValue() {
      return this.element.clear();
    }

    async getCSSProperty(cssProperty, pseudoElement) {
      return driver.executeScript(
        (elem, cssProp, pseudoElem) => {
          return window
            .getComputedStyle(elem, pseudoElem)
            .getPropertyValue(cssProp);
        },
        this.element,
        cssProperty,
        pseudoElement
      );
    }

    /**
     * See: https://github.com/webdriverio/webdriverio/blob/v8/packages/webdriverio/src/commands/element/waitForDisplayed.ts
     * @param {number} [timeout] - The timeout in milliseconds
     * @param {string} [timeoutMsg] - The error message to throw when the timeout is reached
     * @param {boolean} [reverse=false] -  If true it waits for the opposite
     * @param {number} [interval] - The interval in milliseconds between checks
     * @returns {Promise<*>}
     */
    async waitForDisplayed({
      timeout,
      timeoutMsg,
      reverse = false,
      interval
    } = {}) {
      return driver.wait(
        async () => {
          return reverse !== (await this.isDisplayed());
        },
        timeout,
        timeoutMsg,
        interval
      );
    }

    /**
     * See: https://github.com/webdriverio/webdriverio/blob/v8/packages/webdriverio/src/commands/element/waitForEnabled.ts
     * @param {number} [timeout] - The timeout in milliseconds
     * @param {string} [timeoutMsg] - The error message to throw when the timeout is reached
     * @param {boolean} [reverse=false] -  If true it waits for the opposite
     * @param {number} [interval] - The interval in milliseconds between checks
     * @returns {Promise<*>}
     */
    async waitForEnabled({
      timeout,
      timeoutMsg,
      reverse = false,
      interval
    } = {}) {
      // if the element doesn't already exist, wait for it to exist
      if (!this.element && !reverse) {
        await this.waitForExist({ timeout, interval, timeoutMsg });
      }

      return driver.wait(
        async () => {
          return reverse !== (await this.isEnabled());
        },
        timeout,
        timeoutMsg,
        interval
      );
    }

    /**
     * See: https://github.com/webdriverio/webdriverio/blob/v8/packages/webdriverio/src/commands/element/waitForExist.ts
     * @param {number} [timeout] - The timeout in milliseconds
     * @param {string} [timeoutMsg] - The error message to throw when the timeout is reached
     * @param {boolean} [reverse=false] -  If true it waits for the opposite
     * @param {number} [interval] - The interval in milliseconds between checks
     * @returns {Promise<*>}
     */
    async waitForExist({
      timeout,
      timeoutMsg,
      reverse = false,
      interval
    } = {}) {
      return driver.wait(
        async () => {
          return reverse !== !!this.element;
        },
        timeout,
        timeoutMsg,
        interval
      );
    }

    /**
     * See: https://github.com/webdriverio/webdriverio/blob/v8/packages/webdriverio/src/commands/element/waitForClickable.ts
     * @param {number} [timeout] - The timeout in milliseconds
     * @param {string} [timeoutMsg] - The error message to throw when the timeout is reached
     * @param {boolean} [reverse=false] -  If true it waits for the opposite
     * @param {number} [interval] - The interval in milliseconds between checks
     * @returns {Promise<*>}
     */
    async waitForClickable({
      timeout,
      timeoutMsg,
      reverse = false,
      interval
    } = {}) {
      return driver.wait(
        async () => {
          return reverse !== (await this.isClickable());
        },
        timeout,
        timeoutMsg,
        interval
      );
    }

    async waitUntil(fn, { timeout, timeoutMsg, interval } = {}) {
      fn = fn.bind(this.element);
      return driver.wait(fn, timeout, timeoutMsg, interval);
    }

    async scrollIntoView() {
      return driver.executeScript((elem) => {
        elem.scrollIntoView({ block: "start", inline: "nearest" });
      }, this.element);
    }

    async isDisplayedInViewport() {
      let isInViewport = false;

      if (!(await this.isDisplayed())) {
        return false;
      }

      try {
        isInViewport = await driver.executeScript((elem) => {
          const rect = elem.getBoundingClientRect();
          return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <=
              (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <=
              (window.innerWidth || document.documentElement.clientWidth)
          );
        }, this.element);
      } catch (e) {
        // no-op
      }

      return isInViewport;
    }
  }

  async function findElement(selector, { timeout = 1000 } = {}) {
    let elem;

    try {
      await driver.wait(async () => {
        try {
          const locator = selector.startsWith("//")
            ? By.xpath(selector)
            : By.css(selector);
          elem = await driver.findElement(locator);
          return !!elem;
        } catch (e) {
          // no-op if the element is not found
        }
      }, timeout);
    } catch (e) {
      // no-op timout, element not found
    }

    return elem;
  }

  async function findElements(selector, { timeout = 1000 } = {}) {
    let elems = [];

    try {
      await driver.wait(async () => {
        try {
          const locator = selector.startsWith("//")
            ? By.xpath(selector)
            : By.css(selector);
          elems = await driver.findElements(locator);
          return elems.length > 0;
        } catch (e) {
          // no-op if the elements is not found
        }
      }, timeout);
    } catch (e) {
      // no-op timout, elements not found
    }

    return elems;
  }

  function createFinderProxy(promise) {
    // Use a Proxy to make `isClickable` and other methods available directly on the promise
    return new Proxy(promise, {
      get(target, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          // Return the promise's method directly for thenable behavior
          return target[prop].bind(target);
        }

        return prop in target
          ? target[prop]
          : (...args) => target.then((instance) => instance[prop](...args));
      }
    });
  }

  const $ = (selector) => {
    const promise = findElement(selector).then(
      (elem) => new WebElementPolyfill(elem)
    );
    promise.__selector = selector;
    return createFinderProxy(promise);
  };

  const $$ = (selector) => {
    const promise = findElements(selector).then((elements) =>
      elements.map((elem) => new WebElementPolyfill(elem))
    );
    promise.__selector = selector;
    return createFinderProxy(promise);
  };

  return [polyfillBrowser, $, $$];
}
