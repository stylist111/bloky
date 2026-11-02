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

import { describe, expect, it } from "vitest";

import { AI_SUMMARIES_FLAG, isAiSummariesRolledOut } from "../../src/core/subscriptions/shared";

describe("isAiSummariesRolledOut", () => {
  it("has a stable flag name", () => {
    expect(AI_SUMMARIES_FLAG).toBe("ai-summaries-enabled");
  });

  it("returns false for users outside the experiment", () => {
    expect(isAiSummariesRolledOut({})).toBe(false);
    expect(isAiSummariesRolledOut({ other: true })).toBe(false);
    expect(isAiSummariesRolledOut({ [AI_SUMMARIES_FLAG]: "true" })).toBe(false);
  });

  it("returns true when the flag is set", () => {
    expect(isAiSummariesRolledOut({ [AI_SUMMARIES_FLAG]: true })).toBe(true);
  });

  it("returns false when the flags are not available", () => {
    expect(isAiSummariesRolledOut(undefined)).toBe(false);
  });
});
