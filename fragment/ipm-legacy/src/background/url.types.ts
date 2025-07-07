/*
 * This file is part of eyeo's In Product Messaging (IPM) fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * An enum listing the keys of the search parameters when attached to a URL.
 */
export enum ExperimentSearchParameterKeys {
  revision = "er",
  variants = "ev",
}

/**
 * The key of the search parameter that contains the cohorts encoding.
 */
export const CohortIdsSearchParameterKey = "ca";

/**
 * The value for the revision search query parameter in case the ewe doesn't
 * report an id.
 */
export const noRevisionId = "";
