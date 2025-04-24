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
    const getFlags: () => Promise<Record<string, unknown>>
  }
}
