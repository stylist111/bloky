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

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as browser from "webextension-polyfill";
import {
  addCohortAssignmentsSearchParam,
  addExperimentsSearchParams,
  createSafeOriginUrl,
  getBehavior,
  getCommand,
  isCommandExpired,
} from "@eyeo-fragments/in-product-messaging/background";

import { Prefs } from "../../adblock-betafish/alias/prefs";
import {
  CreationMethod,
  setNewTabCommandHandler,
} from "../../adblock-betafish/new-tab/background/middleware";
import {
  coolDownPeriodKey,
  lastShownKey,
} from "../../adblock-betafish/new-tab/background/tab-manager.types";
import { start } from "../../adblock-betafish/new-tab/background/tab-manager";

vi.mock("webextension-polyfill", () => ({
  management: { getSelf: vi.fn() },
  tabs: {
    create: vi.fn(),
    remove: vi.fn(),
    onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  telemetry: {
    ServerLogger: class {
      behavior = vi.fn();
    },
  },
}));

vi.mock("@eyeo-fragments/in-product-messaging/background", () => ({
  addCohortAssignmentsSearchParam: vi.fn(),
  addExperimentsSearchParams: vi.fn(),
  createSafeOriginUrl: vi.fn(),
  dismissCommand: vi.fn(),
  getBehavior: vi.fn(),
  getCommand: vi.fn(),
  isCommandExpired: vi.fn(),
}));

vi.mock("../../adblock-betafish/utilities/background", () => ({
  debug: vi.fn(),
  error: vi.fn(),
  reportAndLogError: vi.fn(),
}));

vi.mock("../../adblock-betafish/prefs/background/settings", () => ({
  // eslint-disable-next-line camelcase
  getSettings: vi.fn(() => ({ suppress_update_page: false })),
  settings: { onload: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../adblock-betafish/alias/prefs", () => ({
  Prefs: {
    get: vi.fn(),
    set: vi.fn(),
    untilLoaded: Promise.resolve(),
  },
}));

vi.mock("../../adblock-betafish/new-tab/background/middleware", () => ({
  CreationMethod: { default: "default", force: "force" },
  isNewTabBehavior: vi.fn(
    (candidate: unknown) =>
      candidate !== null &&
      typeof candidate === "object" &&
      "target" in candidate &&
      "method" in candidate &&
      "priority" in candidate,
  ),
  setNewTabCommandHandler: vi.fn(),
}));

describe("TabManager", () => {
  describe("queueOpenNewtab", () => {
    const ipmId = "queue-test";

    beforeEach(async () => {
      vi.mocked(browser.management.getSelf).mockResolvedValue({
        id: "self",
        installType: "normal",
      } as unknown as Awaited<ReturnType<typeof browser.management.getSelf>>);

      vi.mocked(Prefs.get).mockImplementation((preference: string) => {
        if (preference === "marketing_opt_out") {
          return false;
        }
        // Both 0 so that the cool down period is never ongoing.
        if (preference === lastShownKey || preference === coolDownPeriodKey) {
          return 0;
        }
        return undefined;
      });
      vi.mocked(Prefs.set).mockResolvedValue(undefined);

      vi.mocked(getBehavior).mockReturnValue({
        target: "https://example.com",
        method: CreationMethod.force,
        priority: 1,
      });
      vi.mocked(createSafeOriginUrl).mockReturnValue("https://example.com");
      vi.mocked(addExperimentsSearchParams).mockResolvedValue(null);
      vi.mocked(addCohortAssignmentsSearchParam).mockResolvedValue(null);
      vi.mocked(getCommand).mockReturnValue({
        command_name: "create_tab",
        version: 1,
        payload: {},
      } as unknown as ReturnType<typeof getCommand>);
      vi.mocked(isCommandExpired).mockReturnValue(false);
      vi.mocked(browser.tabs.create).mockResolvedValue({
        id: 1,
        index: 0,
        highlighted: false,
        active: false,
        pinned: false,
        incognito: false,
      } as browser.Tabs.Tab);

      await start();

      // `force` commands are picked up immediately without registering
      // tab event listeners, keeping this test focused on the queue.
      const [handleCommand] = vi.mocked(setNewTabCommandHandler).mock.calls[0];
      await handleCommand(ipmId);
    });

    it("only opens one tab when triggered concurrently", async () => {
      // Simulates the race between concurrent triggers (e.g. tab events and
      // processed IPM commands) that used to be able to open the same
      // waiting candidate's tab more than once.
      const [, , onCommandsProcessed] = vi.mocked(setNewTabCommandHandler).mock.calls[0];
      await Promise.all([onCommandsProcessed(), onCommandsProcessed()]);

      expect(browser.tabs.create).toHaveBeenCalledTimes(1);
    });
  });
});
