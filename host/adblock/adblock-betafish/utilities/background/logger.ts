/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
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

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { Prefs } from "../../alias/prefs";
import { LogFunction, LogLevel } from "./logger.types";

/**
 * Logs given data using provided log function
 *
 * @param fn - Log function
 * @param ...data - Data to log
 */
function log(level: LogLevel, fn: LogFunction, ...data: any[]): void {
  const minLevel: number = Prefs.get("logger_log_level");
  if (level < minLevel) {
    return;
  }

  fn(...data);
}

/* eslint-disable no-console */

/**
 * Logs messages for debugging
 *
 * @param ...data - Data to log
 */
export const debug = log.bind(null, LogLevel.debug, console.debug);

/**
 * Logs error messages
 *
 * @param ...data - Data to log
 */
export const error = log.bind(null, LogLevel.error, console.error);

/**
 * Logs informational messages
 *
 * @param ...data - Data to log
 */
export const info = log.bind(null, LogLevel.info, console.info);

/**
 * Logs warning messages
 *
 * @param ...data - Data to log
 */
export const warn = log.bind(null, LogLevel.warn, console.warn);

/**
 * Reports an error to Sentry and logs it to the console
 *
 * @param e - The error to send to Sentry. This will only send the error to
 * sentry if it is of type Error.
 * @param logContext - Additional context to log on the console.
 */
export function reportAndLogError(e: unknown, logContext?: string): void {
  if (e instanceof Error) {
    ewe.sentry.reportError(e);
  }

  if (logContext) {
    error(logContext, e);
  } else {
    error(e);
  }
}

/* eslint-enable no-console */
