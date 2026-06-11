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

import { describe, it, expect } from "vitest"; // Added beforeEach
import {
  getExperimentFlags,
  getExperimentAssignments,
} from "~/background/api-handlers/experiments";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

describe("Experiments", () => {
  it("should return the experiment flags from ewe.experiments.getFlags", async () => {
    const mockFlags = { experimentA: true, experimentB: false };
    ewe.experiments.getFlags.mockResolvedValue(mockFlags);

    const flags = await getExperimentFlags();
    expect(flags).toEqual(mockFlags);
    expect(ewe.experiments.getFlags).toHaveBeenCalledTimes(1);
  });

  it("should return the experiment assignments", async () => {
    const mockedAssignments = {
      experimentA: "variantA",
      experimentB: "variantB",
    };
    ewe.experiments.getAssignments.mockResolvedValue(mockedAssignments);

    const assignments = await getExperimentAssignments();
    expect(assignments).toEqual(mockedAssignments);
    expect(ewe.experiments.getAssignments).toHaveBeenCalledTimes(1);
  });
});
