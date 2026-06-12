/**
 * This file is part of eyeo's Fragment Test Extension,
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

import expect from "expect";
import { openNewTab, getTabId } from "@eyeo/test-utils/driver";
import { getOptionsHandle, ytAllowlistUrl } from "@eyeo/test-utils/extension";

export default () => {
  it("auto-allowlists YouTube", async function () {
    const eventName = "yt-site.ad-wall-detected";

    await driver.wait(
      async () => {
        const handlers = await driver.executeScript(() =>
          browser.runtime.sendMessage({
            method: "testing.getRegisteredHandlers",
          }),
        );
        return handlers.includes(eventName);
      },
      7000,
      `'${eventName}' handler was not registered in time`,
    );

    await openNewTab(ytAllowlistUrl);
    const ytTabId = await getTabId(getOptionsHandle());

    await driver.executeScript(() => {
      function appendElement() {
        const el = document.createElement("ytd-enforcement-message-view-model");
        document.body.appendChild(el);
      }
      if (document.body) {
        appendElement();
      } else {
        document.addEventListener("DOMContentLoaded", appendElement);
      }
    });

    await driver.switchTo().window(getOptionsHandle());

    await driver.executeScript(
      (eventName, ytTabId, ytAllowlistUrl) => {
        return browser.runtime.sendMessage({
          method: "testing.triggerHandler",
          args: [
            eventName,
            { userLoggedIn: "1", currentPlaybackTime: 10 },
            { tab: { id: ytTabId, url: ytAllowlistUrl } },
          ],
        });
      },
      eventName,
      ytTabId,
      ytAllowlistUrl,
    );

    await driver.wait(
      async () => {
        const result = await driver.executeScript(() =>
          browser.runtime.sendMessage({ method: "ewe.filters.getUserFilters" }),
        );
        return (
          Array.isArray(result) &&
          result.some((f) => f.text?.includes("@@||youtube.com"))
        );
      },
      4000,
      "Expected YouTube allowlist filter not added",
    );

    const result = await driver.executeScript(() =>
      browser.runtime.sendMessage({ method: "ewe.filters.getUserFilters" }),
    );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringMatching(/@@\|\|youtube\.com/),
        }),
      ]),
    );
  });
};
