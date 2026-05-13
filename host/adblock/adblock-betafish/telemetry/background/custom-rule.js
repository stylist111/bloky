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

/* For ESLint: List any global identifiers used in this file below */
/* global ewe */
import { FilterOrigin } from "../../../src/filters/shared";

const allowListingFiltersRegex = /^allowing$/;
const allFilterTypesRegex = /.*/;

/**
 * Returns the number of currently active filters that match the parameters
 *
 * @param type The type of filter list rule
 *
 * @returns {number} The filter count
 */
async function getFiltersByType(typeRegEx) {
  return (await ewe.filters.getUserFilters()).filter(
    (filter) => filter.type.match(typeRegEx) && filter.enabled,
  );
}

/**
 * Returns true if the meta-data matches the origin
 *
 * @param data The filter metadata from the filter.
 * @param origin The origin from that must be matched.
 *
 * @returns {boolean} true if parameters match
 */
function doesOriginMatch(data, origin) {
  return (data && data.origin === origin) || (!data && data === origin);
}
/**
 * Returns the number of currently active filters that match the parameters
 *
 * @param origin The origin from the meta that must be matched.
 *
 * @returns {number} The filter count
 */
async function getFilterCountForOrigin(filters, origin) {
  // collect the origin from the metadata
  const filtersMetadata = await Promise.all(
    filters.map(async (filter) => ewe.filters.getMetadata(filter.text)),
  );
  // count the ones that originated from the given origin
  return filtersMetadata.filter((data) => doesOriginMatch(data, origin)).length;
}

/**
 * Returns the number of currently active filters that have been added using
 * the experimental allowlisting functionality (i.e. that originated in the
 * web, and not in the extension popup).
 *
 * @returns {number} The filter count
 */
export async function getWebAllowlistingFilterCount() {
  // count the filters that originated in the web
  return getFilterCountForOrigin(
    await getFiltersByType(allowListingFiltersRegex),
    FilterOrigin.web,
  );
}

/**
 * Returns the number of currently active filters that have been added using
 * the extension popup menu
 *
 * @returns {number} The filter count
 */
export async function getPopupAllowlistingFilterCount() {
  // count the filters that originated from the popup menu
  return getFilterCountForOrigin(
    await getFiltersByType(allowListingFiltersRegex),
    FilterOrigin.popup,
  );
}

/**
 * Returns the number of currently active filters that have been added using
 * the Customize tab of the Options page
 *
 * @returns {number} The filter count
 */
export async function getCustomizedFilterCount() {
  // count the filters that originated from the customize tab
  return getFilterCountForOrigin(
    await getFiltersByType(allFilterTypesRegex),
    FilterOrigin.customize,
  );
}

/**
 * Returns the number of currently active filters that have been added using
 * either of the wizards
 *
 * @returns {number} The filter count
 */
export async function getWizardFilterCount() {
  // count the filters that originated from either of the wizards
  return getFilterCountForOrigin(await getFiltersByType(allFilterTypesRegex), FilterOrigin.wizard);
}

/**
 * Returns the number of currently active filters that don't have any
 * meta data associated with them
 *
 * @returns {number} The filter count
 */
export async function getMissingFilterCount() {
  // count the filters that don't have meta data
  return getFilterCountForOrigin(await getFiltersByType(allFilterTypesRegex), null);
}
