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

import { findUrl } from "@eyeo/test-utils/driver";
import {
  checkInstallUninstallUrl,
  initOptionsGeneralTab
} from "../../utils/page.js";
import { uninstallExtension } from "@eyeo/test-utils/extension";
import { uninstallUrl } from "../../utils/urls.js";

export default () => {
  it("uninstalls the extension with default settings", async function () {
    const appVersion = await driver.executeScript(() => {
      return browser.runtime.getManifest().version;
    });

    await uninstallExtension(initOptionsGeneralTab);
    const { url } = await findUrl(uninstallUrl);

    await checkInstallUninstallUrl({ url, appVersion, uninstall: true });
  });
};
