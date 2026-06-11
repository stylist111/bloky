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

import { describe, it, expect } from "vitest";
import { getIntegrationName } from "~/shared/helpers";
import { adblockName, adblockPlusName } from "~/shared/constants";

describe("getIntegrationName", () => {
  it("returns adblockName for 'AdBlock'", () => {
    expect(getIntegrationName("AdBlock")).toBe(adblockName);
  });

  it("returns adblockPlusName for 'Adblock Plus'", () => {
    expect(getIntegrationName("Adblock Plus")).toBe(adblockPlusName);
  });

  it("throws for invalid extension name", () => {
    expect(() => getIntegrationName("Unknown")).toThrow(
      "Invalid extension name",
    );
  });
});
