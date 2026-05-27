/*
 * This file is part of eyeo's Filter Experiments fragment,
 * Copyright (C) 2026-present eyeo GmbH
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

import * as ewe from "@eyeo/webext-ad-filtering-solution";

const ORIGIN_ID = "experiment";

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isValidFlagId(value: unknown): value is string {
  return typeof value === "string" && value.endsWith(":filters");
}

async function getExperimentUserFiltersByFlag(): Promise<
  Map<string, Set<string>>
> {
  const filtersByFlag = new Map<string, Set<string>>();
  for (const filter of await ewe.filters.getUserFilters()) {
    if (!filter.metadata || filter.metadata.origin !== ORIGIN_ID) {
      continue;
    }
    const flagId = filter.metadata.flagId;
    if (!isValidFlagId(flagId)) {
      continue;
    }
    const filters = filtersByFlag.get(flagId) ?? new Set<string>();
    filters.add(filter.text);
    filtersByFlag.set(flagId, filters);
  }
  return filtersByFlag;
}

async function getExperimentFiltersByFlag(): Promise<Map<string, string[]>> {
  const flags = await ewe.experiments.getFlags();
  const filtersByFlag = new Map<string, string[]>();

  for (const [flagId, value] of Object.entries(flags)) {
    if (!isValidFlagId(flagId)) {
      continue;
    }

    if (isStringArray(value) && value.length > 0) {
      filtersByFlag.set(flagId, value);
    }
  }

  return filtersByFlag;
}

export async function syncFilters(): Promise<void> {
  const currentByFlag = await getExperimentUserFiltersByFlag();
  const desiredByFlag = await getExperimentFiltersByFlag();

  // Diff rather than wipe-and-replace: only remove filters that are no longer
  // desired, and (below) only add ones that aren't already active. A naive
  // remove-all-then-add-all would risk hitting the MV3 dynamic rule limit on
  // the add step and leaving the user with no experiment filters at all.
  const filtersToRemove: string[] = [];
  for (const [flagId, currentFilters] of currentByFlag) {
    const desiredFilters = desiredByFlag.get(flagId);
    for (const filter of currentFilters) {
      if (!desiredFilters?.includes(filter)) {
        filtersToRemove.push(filter);
      }
    }
  }
  if (filtersToRemove.length > 0) {
    await ewe.filters.remove(filtersToRemove);
  }

  for (const [flagId, desiredFilters] of desiredByFlag) {
    const currentFilters = currentByFlag.get(flagId) ?? new Set<string>();
    const filtersToAdd = [];
    for (const filter of desiredFilters) {
      if (currentFilters.has(filter)) {
        console.warn(`Skipping duplicated experiment filter "${filter}"`);
        continue;
      }
      const error = ewe.filters.validate(filter);
      if (error) {
        console.warn(`Skipping invalid experiment filter "${filter}":`, error);
        continue;
      }
      filtersToAdd.push(filter);
    }

    if (filtersToAdd.length === 0) {
      continue;
    }

    // For the purpose of experimental filters cleanup, only origin and flagId
    // are required.
    await ewe.filters.add(filtersToAdd, {
      origin: ORIGIN_ID,
      flagId,
    });
  }
}
