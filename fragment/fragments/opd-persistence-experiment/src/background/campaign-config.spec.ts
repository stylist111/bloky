/*
 * This file is part of eyeo's OPD Persistence Experiment fragment,
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

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { getCampaignConfig, start } from "./campaign-config.js";

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  experiments: {
    getFlags: vi.fn(),
    onChanged: { addListener: vi.fn() },
  },
}));

const ipmId = "campaign-1";

const mockLogger = { debug: vi.fn(), warn: vi.fn() };

async function mockFlags(flags: Record<string, unknown>): Promise<void> {
  (ewe.experiments.getFlags as ReturnType<typeof vi.fn>).mockResolvedValue(
    flags,
  );
  await start(mockLogger);
}

describe("getCampaignConfig", () => {
  beforeEach(() => {
    mockLogger.debug.mockClear();
    mockLogger.warn.mockClear();
  });

  it("returns null when no flag is set", async () => {
    await mockFlags({});

    expect(getCampaignConfig(ipmId)).toBeNull();
  });

  it("returns null when the flag has no entry for the campaign", async () => {
    await mockFlags({
      "crumbs-opd-config": { "other-campaign": { maxImpressions: 3 } },
    });

    expect(getCampaignConfig(ipmId)).toBeNull();
  });

  it("returns the config for the campaign", async () => {
    await mockFlags({
      "crumbs-opd-config": {
        [ipmId]: { ignoreCooldown: true, maxImpressions: 3 },
      },
    });

    expect(getCampaignConfig(ipmId)).toEqual({
      ignoreCooldown: true,
      maxImpressions: 3,
    });
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "[opd-persistence-experiment]: Known campaign configs",
      expect.any(Map),
    );
  });

  it("matches a flag name that carries an experiment id suffix", async () => {
    await mockFlags({
      "crumbs-opd-config-experiment-7": { [ipmId]: { maxImpressions: 2 } },
    });

    expect(getCampaignConfig(ipmId)).toEqual({ maxImpressions: 2 });
  });

  it("applies each field independently", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { ignoreCooldown: true } },
    });

    expect(getCampaignConfig(ipmId)).toEqual({ ignoreCooldown: true });
  });

  it("rejects a maximum of zero impressions", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { maxImpressions: 0 } },
    });

    expect(getCampaignConfig(ipmId)).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[opd-persistence-experiment]: Invalid maxImpressions",
      ipmId,
    );
  });

  it("rejects a negative maximum number of impressions", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { maxImpressions: -1 } },
    });

    expect(getCampaignConfig(ipmId)).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[opd-persistence-experiment]: Invalid maxImpressions",
      ipmId,
    );
  });

  it("rejects a fractional maximum number of impressions", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { maxImpressions: 2.5 } },
    });

    expect(getCampaignConfig(ipmId)).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[opd-persistence-experiment]: Invalid maxImpressions",
      ipmId,
    );
  });

  it("rejects a non-boolean cooldown override", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { ignoreCooldown: "yes" } },
    });

    expect(getCampaignConfig(ipmId)).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[opd-persistence-experiment]: Invalid ignoreCooldown",
      ipmId,
    );
  });

  it("rejects a flag value that is not an object", async () => {
    await mockFlags({ "crumbs-opd-config": true });

    expect(getCampaignConfig(ipmId)).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[opd-persistence-experiment]: Campaign config flag is not an object",
      "crumbs-opd-config",
    );
  });

  it("rejects a campaign entry that is not an object", async () => {
    await mockFlags({ "crumbs-opd-config": { [ipmId]: 3 } });

    expect(getCampaignConfig(ipmId)).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[opd-persistence-experiment]: Campaign config is not an object",
      ipmId,
    );
  });

  it("returns null for a campaign with no IPM ID", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { maxImpressions: 3 } },
    });

    expect(getCampaignConfig(undefined)).toBeNull();
  });
});
