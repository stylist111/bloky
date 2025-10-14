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

declare module "@eyeo/webext-ad-filtering-solution/ui" {
  /**
   * Represents a server logger. This is used to send data to a our telemetry
   * server. The exact URL will be configured by the telemetry module in the
   * background script. Console logging is also provided for convenience.
   *
   * @param {string} module The module that this logger is for.
   */
  export interface ServerLogger {
    constructor(module: string);
    /**
     * Creates a debug log.
     *
     * @param {string} event The name of the event to log. This should be unique.
     * @param {string|number|object|array|boolean|null} data
     *    The dynamic data relevant to the event.
     */
    debug(event: string, data?: string | number | object | any[] | boolean | null): void;
    /**
     * Creates an info log.
     *
     * @param {string} event The name of the event to log. This should be unique.
     * @param {string|number|object|array|boolean|null} data
     *    The dynamic data relevant to the event.
     */
    info(event: string, data?: string | number | object | any[] | boolean | null): void;
    /**
     * Creates a behaviour log.
     *
     * @param {string} event The name of the event to log. This should be unique.
     * @param {string|number|object|array|boolean|null} data
     *    The dynamic data relevant to the event.
     * @param {string} [ipmId] Optional IPM ID to associate with this event.
     */
    behavior(event: string, data?: string | number | object | any[] | boolean | null, ipmId?: string): void;
    /**
     * Creates a warn log.
     *
     * @param {string} event The name of the event to log. This should be unique.
     * @param {string|number|object|array|boolean|null} data
     *    The dynamic data relevant to the event.
     */
    warn(event: string, data?: string | number | object | any[] | boolean | null): void;
  }

  namespace account {
    /**
     * Retrieves the current user profile
     */
    const getProfile: () => Promise<UserProfile>;

    /**
     * Checks if the user has an active premium subscription.
     */
    const hasPremium: () => Promise<boolean>;
  }

  namespace sentry {
   /**
    * Report error to Sentry
    *
    * @param error - Error to send to Sentry.
    */
    const reportError: (error: Error) => void;
    /**
     * Initialize and start Sentry
     */
    const start: () => void;
  }

  namespace experiments {
    /**
     * Returns the value of the flag
     */
    const getFlag: (
      flagId: string
    ) => Promise<boolean | string | number | string[] | null>;
    /**
     * Retrieves all feature flags, including overridden flags and their values
     */
    const getFlags: () => Promise<Record<string, unknown>>;
    /**
     * Returns the assignments for the user
     */
    const getAssignments: () => Promise<Record<string, string>>;
  }

  namespace telemetry {
    /**
     * Represents a server logger. This is used to send data to a our telemetry
     * server. The exact URL will be configured by the telemetry module in the
     * background script. Console logging is also provided for convenience.
     *
     * @param {string} module The module that this logger is for.
     */
    export class ServerLogger {
      constructor(module: string);
      /**
       * Creates a debug log.
       *
       * @param {string} event The name of the event to log. This should be unique.
       * @param {string|number|object|array|boolean|null} data
       *    The dynamic data relevant to the event.
       */
      debug(event: string, data?: string | number | object | any[] | boolean | null): void;
      /**
       * Creates an info log.
       *
       * @param {string} event The name of the event to log. This should be unique.
       * @param {string|number|object|array|boolean|null} data
       *    The dynamic data relevant to the event.
       */
      info(event: string, data?: string | number | object | any[] | boolean | null): void;
      /**
       * Creates a behaviour log.
       *
       * @param {string} event The name of the event to log. This should be unique.
       * @param {string|number|object|array|boolean|null} data
       *    The dynamic data relevant to the event.
       * @param {string} [ipmId] Optional IPM ID to associate with this event.
       */
      behavior(event: string, data?: string | number | object | any[] | boolean | null, ipmId?: string): void;
      /**
       * Creates a warn log.
       *
       * @param {string} event The name of the event to log. This should be unique.
       * @param {string|number|object|array|boolean|null} data
       *    The dynamic data relevant to the event.
       */
      warn(event: string, data?: string | number | object | any[] | boolean | null): void;
    }
  }
}
