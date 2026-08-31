/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { getCampaignConfig, start } from "./campaign-config";
import { type Dialog } from "./dialog.types";
import { Timing } from "./timing.types";

jest.mock("@eyeo/webext-ad-filtering-solution", () => ({
  experiments: {
    getFlags: jest.fn(),
    onChanged: { addListener: jest.fn() }
  }
}));

jest.mock("../../logger/background", () => ({
  warn: jest.fn(),
  debug: jest.fn()
}));

const ipmId = "campaign-1";

const dialog: Dialog = {
  behavior: {
    displayDuration: 0,
    target: "https://adblockplus.org/",
    timing: Timing.afterNavigation,
    priority: 1
  },
  content: {
    body: [],
    button: "Button",
    title: "Title"
  },
  id: ipmId,
  ipmId
};

async function mockFlags(flags: Record<string, unknown>): Promise<void> {
  (ewe.experiments.getFlags as jest.Mock).mockResolvedValue(flags);
  await start();
}

describe("getCampaignConfig", () => {
  it("returns null when no flag is set", async () => {
    await mockFlags({});

    expect(getCampaignConfig(dialog)).toBeNull();
  });

  it("returns null when the flag has no entry for the campaign", async () => {
    await mockFlags({
      "crumbs-opd-config": { "other-campaign": { maxImpressions: 3 } }
    });

    expect(getCampaignConfig(dialog)).toBeNull();
  });

  it("returns the config for the campaign", async () => {
    await mockFlags({
      "crumbs-opd-config": {
        [ipmId]: { ignoreCooldown: true, maxImpressions: 3 }
      }
    });

    expect(getCampaignConfig(dialog)).toEqual({
      ignoreCooldown: true,
      maxImpressions: 3
    });
  });

  it("matches a flag name that carries an experiment id suffix", async () => {
    await mockFlags({
      "crumbs-opd-config-experiment-7": { [ipmId]: { maxImpressions: 2 } }
    });

    expect(getCampaignConfig(dialog)).toEqual({ maxImpressions: 2 });
  });

  it("applies each field independently", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { ignoreCooldown: true } }
    });

    expect(getCampaignConfig(dialog)).toEqual({ ignoreCooldown: true });
  });

  it("rejects a maximum of zero impressions", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { maxImpressions: 0 } }
    });

    expect(getCampaignConfig(dialog)).toBeNull();
  });

  it("rejects a negative maximum number of impressions", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { maxImpressions: -1 } }
    });

    expect(getCampaignConfig(dialog)).toBeNull();
  });

  it("rejects a fractional maximum number of impressions", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { maxImpressions: 2.5 } }
    });

    expect(getCampaignConfig(dialog)).toBeNull();
  });

  it("rejects a non-boolean cooldown override", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { ignoreCooldown: "yes" } }
    });

    expect(getCampaignConfig(dialog)).toBeNull();
  });

  it("rejects a flag value that is not an object", async () => {
    await mockFlags({ "crumbs-opd-config": true });

    expect(getCampaignConfig(dialog)).toBeNull();
  });

  it("rejects a campaign entry that is not an object", async () => {
    await mockFlags({ "crumbs-opd-config": { [ipmId]: 3 } });

    expect(getCampaignConfig(dialog)).toBeNull();
  });

  it("returns null for dialogs that don't come from a campaign", async () => {
    await mockFlags({
      "crumbs-opd-config": { [ipmId]: { maxImpressions: 3 } }
    });

    const localDialog: Dialog = { ...dialog, ipmId: undefined };

    expect(getCampaignConfig(localDialog)).toBeNull();
  });
});
