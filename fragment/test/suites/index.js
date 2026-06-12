/**
 * This file is part of eyeo's Fragment Test Extension,
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

import { beforeEachTasks } from "@eyeo/test-utils/hooks";

import example from "./example.js";
import filterExperiments from "./filter-experiments.js";
import youtubeAutoAllowlist from "./youtube-auto-allowlist.js";

export default () => {
  beforeEach(async function () {
    await beforeEachTasks();
  });

  describe("@eyeo-fragments/example", example);
  describe("@eyeo-fragments/filter-experiments", filterExperiments);
  describe("@eyeo-fragments/yt-wall-detection", youtubeAutoAllowlist);
};
