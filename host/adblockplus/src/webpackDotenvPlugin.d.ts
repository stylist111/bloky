/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

export {};

declare global {
  const webpackDotenvPlugin: {
    /*
     * WebpackDotenv plugin declared env. variables for CDP
     */
    CDP_BEARER?: string;
    CDP_PING_URL?: string;
    CDP_PUBLIC_KEY_URL?: string;
    /*
     * WebpackDotenv plugin declared env. variables for logging
     */
    EYEOMETRY_EVENT_LOGGING_URL?: string;
    EYEOMETRY_EVENT_LOGGING_BEARER?: string;
    /*
     * WebpackDotenv plugin declared env. variables for eyeometry
     */
    EYEOMETRY_URL?: string;
    EYEOMETRY_BEARER?: string;
    /**
     * WebpackDotenv plugin declared env. variables for Sentry
     */
    SENTRY_DSN?: string;
    SENTRY_ENVIRONMENT?: string;
  };
}
