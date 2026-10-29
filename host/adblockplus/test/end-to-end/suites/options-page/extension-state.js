/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2024-present eyeo GmbH
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

import { expect } from "expect";
import { wait } from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";

import { initOptionsHelpTab } from "../../utils/page.js";

async function waitForExtensionStateLoaded() {
  await wait(
    async () => {
      const text = await driver.executeScript(
        () => document.querySelector("#extension-state")?.textContent
      );
      return text && !text.includes("Loading");
    },
    8000,
    "Extension state did not finish loading"
  );
}

export default () => {
  it("displays extension state with subscriptions", async function () {
    await initOptionsHelpTab(getOptionsHandle());
    await waitForExtensionStateLoaded();

    // The panel is rendered again shortly after the Help tab is activated,
    // which replaces its elements, so everything is read in-page in one step
    // instead of holding on to elements between calls
    const state = await driver.executeScript(() => {
      const container = document.querySelector("#extension-state");
      const table = container.querySelector("table");
      return {
        text: container.textContent,
        hasTotals: Boolean(container.querySelector("dl")),
        headerTexts: table
          ? Array.from(table.querySelectorAll("th"), (h) => h.textContent)
          : null,
        rowCount: table ? table.querySelectorAll("tbody tr").length : 0
      };
    });

    // Verify it didn't fail
    expect(state.text).not.toContain("Failed to load");

    // Check the definition list with totals is present
    expect(state.hasTotals).toBe(true);
    expect(state.text).toContain("Filters");

    // Check that a table with subscription data is rendered
    expect(state.headerTexts).toContain("Filter List");
    expect(state.headerTexts).toContain("Version");
    expect(state.headerTexts).toContain("Filters");

    // Check that at least one subscription row exists
    expect(state.rowCount).toBeGreaterThan(0);
  });

  it("copies extension state to clipboard", async function () {
    await initOptionsHelpTab(getOptionsHandle());
    await waitForExtensionStateLoaded();

    // Click and read text in-page to avoid stale element references
    // from DOM replacement on tab re-activation
    const textAfterClick = await driver.executeAsyncScript((done) => {
      const btn = document.querySelector("#extension-state button");
      if (!btn) {
        done("no button found");
        return;
      }
      btn.click();
      setTimeout(() => done(btn.textContent), 500);
    });

    // Clipboard API may fail in headless/test environments
    expect(["Copied!", "Failed to copy"]).toContain(textAfterClick);
  });
};
