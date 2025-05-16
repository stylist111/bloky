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

declare module "@eyeo/webext-ad-filtering-solution/adblockpluscore/lib/url" {
  /**
   * Gets the base domain for the given hostname.
   *
   * @param hostname
   */
  const getBaseDomain: (hostname: string) => string;
}

declare module "@eyeo/webext-ad-filtering-solution/adblockpluscore/lib/snippets.js" {
  /**
   * Prepares an inline script for injecting code into the main context.
   * This is necessary when `browser.scripting` is not available.
   * tabs.executeScript does not allow injecting scripts to main context.
   * So we resort to creating an inline script element.
   *
   * @param {any} codeToInject The code to be injected
   * @param {Array<any>} params Parameters to be passed to the injected code
   * @returns {string} The executable code to be injected
   */
  const prepareInlineScriptForInjection: (codeToInject: any, ...params: Array<any>) => string;
}
