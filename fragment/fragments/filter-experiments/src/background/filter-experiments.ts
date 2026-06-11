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
import { syncFilters } from "./sync-filters.js";

export async function start(): Promise<void> {
  void syncFilters();
  ewe.experiments.onChanged.addListener(async () => {
    await syncFilters();
  });
}
