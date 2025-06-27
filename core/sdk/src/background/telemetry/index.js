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

import {Prefs} from "../prefs.js";
import * as serverLogger from "./server-logger.js";
import * as activePing from "./active-ping.js";

/**
 * API to interact with telemetry
 * @namespace telemetry
 */
export default {
  /**
   * Opt-out from telemetry. Default is `true` (used opted out)
   * @param {boolean} value Pass `true` to opt-out, pass `false` to opt in.
   * @returns {Promise} Promise that resolves when the setting is set.
   * @memberof telemetry
   */
  async setOptOut(value) {
    Prefs.telemetry_opt_out = value;

    await activePing.setOptOut(value);
    await serverLogger.setOptOut(value);
  },

  /**
    * @class {ServerLogger}
    * @memberof telemetry
    */
  ServerLogger: serverLogger.ServerLogger,

  /**
   * @ignore
   */
  resetConsoleLogLevel: serverLogger.resetConsoleLogLevel,

  /**
   * @ignore
   */
  setConsoleLogLevel: serverLogger.setConsoleLogLevel
};

