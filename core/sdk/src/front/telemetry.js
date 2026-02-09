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

import {ignoreNoConnectionError} from "../all/errors.js";
import {AbstractLogger} from "../all/telemetry.js";

/**
 * Represents a server logger. This is used to send data to our telemetry
 * server. The exact URL will be configured by the telemetry module in the
 * background script. Console logging is also provided for convenience.
 *
 * @param {string} module The module that this logger is for.
 */
class ServerLogger extends AbstractLogger {
  constructor(module) {
    super(module);
  }

  _validatedLog(logTime, level, event, data) {
    void ignoreNoConnectionError(
      browser.runtime.sendMessage({
        type: "ewe:telemetry-log",
        logTime,
        module: this._module,
        level,
        event,
        data
      })
    );
  }
}

/**
 * API to interact with the telemetry module
 * @namespace telemetry
 */
export default {
  ServerLogger
};
