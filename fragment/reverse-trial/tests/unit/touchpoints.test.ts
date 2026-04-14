/**
 * This file is part of eyeo's Reverse Trial fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { resolveNextTouchPoint } from "../../src/background/touchpoints";

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  experiments: {
    getFlag: vi.fn(),
  },
}));

describe("touch point config flag overrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue(null);
  });

  it("returns default autoDismissMs when no flag override is set", async () => {
    const result = await resolveNextTouchPoint(0, 0);
    expect(result?.autoDismissMs).toBe(10000);
  });

  it("overrides autoDismissMs for the resolved step", async () => {
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue({
      "1": { autoDismissMs: 3000 },
    });
    const result = await resolveNextTouchPoint(0, 0);
    expect(result?.autoDismissMs).toBe(3000);
  });

  it("override of null clears autoDismissMs for the resolved step", async () => {
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue({
      "1": { autoDismissMs: null },
    });
    const result = await resolveNextTouchPoint(0, 0);
    expect(result?.autoDismissMs).toBeUndefined();
  });

  it("does not override autoDismissMs when flag targets a different step", async () => {
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue({
      "2": { autoDismissMs: 3000 },
    });
    const result = await resolveNextTouchPoint(0, 0);
    expect(result?.autoDismissMs).toBe(10000);
  });

  it("ignores a non-object flag value", async () => {
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue(true);
    const result = await resolveNextTouchPoint(0, 0);
    expect(result?.autoDismissMs).toBe(10000);
  });

  it("ignores autoDismissMs override that is not a number", async () => {
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue({
      "1": { autoDismissMs: "fast" },
    });
    const result = await resolveNextTouchPoint(0, 0);
    expect(result?.autoDismissMs).toBe(10000);
  });

  it("overrides showFeedback for the resolved step", async () => {
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue({
      "1": { showFeedback: false },
    });
    const result = await resolveNextTouchPoint(0, 0);
    expect(result?.showFeedback).toBe(false);
  });

  it("override of null clears showFeedback for the resolved step", async () => {
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue({
      "1": { showFeedback: null },
    });
    const result = await resolveNextTouchPoint(0, 0);
    expect(result?.showFeedback).toBeUndefined();
  });

  it("overrides showDismissLink for the resolved step", async () => {
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue({
      "2": { showDismissLink: false },
    });
    const result = await resolveNextTouchPoint(1, 7);
    expect(result?.showDismissLink).toBe(false);
  });

  it("override of null clears showDismissLink for the resolved step", async () => {
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue({
      "2": { showDismissLink: null },
    });
    const result = await resolveNextTouchPoint(1, 7);
    expect(result?.showDismissLink).toBeUndefined();
  });
});
