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

/**
 * Event used to communicate between content script contexts
 * @type {string}
 */
export const HANDSHAKE_EVENT_NAME = "handshake";

/**
 * Storage key used to caching the filters config in content scripts
 * @type {string}
 */
export const CACHED_FILTERS_CONFIG_KEY = "ewe-filters-config";

/**
 * CSS properties applied to elements hidden in debug mode
 * @type {string[][]}
 */
export const DEBUG_CSS_PROPERTIES = [
  ["background", "repeating-linear-gradient(to bottom, #e67370 0, #e67370 9px, white 9px, white 10px)"],
  ["outline", "solid red"]
];
