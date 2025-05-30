/**
 * This file is part of eyeo's Public API fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * URL of frames where the API needs to be injected
 * @type {string}
 */
export const apiFrameUrl = "https://btloader.com/trustedIframe.html";

/**
 * Event name for calling the public API
 * @type {string}
 */
export const requestEvent = "public-api.request";

/**
 * Event name for initializing the main world public API
 * @type {string}
 */
export const initializeEvent = "public-api.initialize";

/**
 * Event name for listening on responses for the public API
 * @type {string}
 */
export const responseEvent = "public-api.response";

/**
 * AdBlock integration identifier
 * @type {string}
 */
export const adblockName = "adblock";

/**
 * Adblock Plus integration identifier
 * @type {string}
 */
export const adblockPlusName = "adblockplus";

/**
 * List of integrations, contains the identifiers for AdBlock and Adblock Plus
 * @type {string[]}
 */
export const integrations = [adblockName, adblockPlusName];

/**
 * Number of milliseconds in a day.
 * @type {number}
 * @default 86400000
 */
export const MILLIS_IN_DAY = 86400000;
