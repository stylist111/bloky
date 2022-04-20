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

const ERROR_NO_CONNECTION = "Could not establish connection. " +
                            "Receiving end does not exist.";
export const ERROR_DUPLICATE_FILTERS = "storage_duplicate_filters";
export const ERROR_FILTER_NOT_FOUND = "filter_not_found";

export function ignoreNoConnectionError(promise) {
  return promise.catch(error => {
    if (typeof error != "object" || error.message != ERROR_NO_CONNECTION)
      throw error;
  });
}
