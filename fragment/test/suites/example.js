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

import { openNewTab, getFromStorage } from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";
import { fragmentExampleTestPageUrl } from "@eyeo/test-utils/host-urls";

const testPageDomain = new URL(fragmentExampleTestPageUrl).hostname;

async function clearCounts() {
  await driver.switchTo().window(getOptionsHandle());
  await driver.executeScript(
    (domain) => browser.storage.local.remove([domain]),
    testPageDomain,
  );
}

async function getCount() {
  return getFromStorage("local", testPageDomain);
}

export default () => {
  beforeEach(clearCounts);

  after(clearCounts);

  it("stores image count when visiting a page", async function () {
    await openNewTab(fragmentExampleTestPageUrl);

    await driver.switchTo().window(getOptionsHandle());
    await driver.wait(
      async () => {
        const count = await getCount();
        return typeof count === "number";
      },
      3000,
      "Image count not stored",
    );

    const count = await getCount();
    expect(count).toEqual(3);
  });
};
