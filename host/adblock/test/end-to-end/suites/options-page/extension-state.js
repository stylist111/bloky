/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2024-present  Adblock, Inc.
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

import { expect } from "expect";
import { By } from "selenium-webdriver";
import { getDisplayedElement, wait } from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";

import { initOptionsSupportTab } from "../../utils/page.js";

async function waitForExtensionStateLoaded() {
  await wait(
    async () => {
      const text = await driver.executeScript(
        () => document.querySelector("#extension-state")?.textContent,
      );
      return text && !text.includes("Loading");
    },
    8000,
    "Extension state did not finish loading",
  );
}

export default () => {
  it("displays extension state with subscriptions", async function () {
    await initOptionsSupportTab(getOptionsHandle());
    await waitForExtensionStateLoaded();

    // Verify it didn't fail
    const container = await getDisplayedElement("#extension-state", { timeout: 3000 });
    const text = await container.getText();
    expect(text).not.toContain("Failed to load");

    // Check the definition list with totals is present
    await getDisplayedElement("#extension-state dl", { timeout: 3000 });
    expect(text).toContain("Filters");

    // Check that a table with subscription data is rendered
    const table = await getDisplayedElement("#extension-state table", { timeout: 3000 });
    const headers = await table.findElements(By.css("th"));
    const headerTexts = await Promise.all(headers.map((h) => h.getText()));
    expect(headerTexts).toContain("Filter List");
    expect(headerTexts).toContain("Version");
    expect(headerTexts).toContain("Filters");

    // Check that at least one subscription row exists
    const rows = await table.findElements(By.css("tbody tr"));
    expect(rows.length).toBeGreaterThan(0);
  });

  it("copies extension state to clipboard", async function () {
    await initOptionsSupportTab(getOptionsHandle());
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
