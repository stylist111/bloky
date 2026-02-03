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

import browser from "webextension-polyfill";

import {ignoreNoConnectionError, toSerializableError} from "../../../all/errors.js";

async function forwardError(error) {
  ignoreNoConnectionError(
    browser.runtime.sendMessage({
      type: "ewe:sentry-error",
      error: toSerializableError(error)
    })
  );
}

/**
 * API to interact with the sentry module from content scripts
 * @namespace sentry
 */
export default {
  /**
   * Report error to Sentry
   *
   * @param {Error} error - Error to send to Sentry.
   */
  async reportError(error) {
    return await forwardError(error);
  }
};
