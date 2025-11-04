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

import { findUrl, openNewTab } from "@eyeo/test-utils/driver";
import { localTestPageUrl } from "@eyeo/test-utils/host-urls";
import {
  reloadExtension,
  setTimeoutForExtensionReload,
  updatePrefs
} from "@eyeo/test-utils/extension";

import {
  initOptionsGeneralTab,
  setMarketingOptOutState
} from "../utils/page.js";
import { integratedUpdateUrl } from "../utils/urls.js";

export default () => {
  afterEach(async function () {
    await setMarketingOptOutState(false);
  });

  after(async function () {
    await updatePrefs(initOptionsGeneralTab, "suppress_first_run_page", true);
  });

  it("doesn't trigger an update campaign on Chromium", async function () {
    // IPMs are supported on Chromium, hence we don't need to fall back
    // to running an update campaign directly
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    setTimeoutForExtensionReload(this);
    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });

    await openNewTab(localTestPageUrl);
    await findUrl(integratedUpdateUrl, {
      timeout: 15000,
      exists: false
    });
  });

  it("triggers an update campaign on Firefox", async function () {
    // IPMs are not supported on Firefox, hence we need to fall back
    // to running an update campaign directly
    if (browserDetails.browserName !== "firefox") {
      this.skip();
    }

    setTimeoutForExtensionReload(this);
    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });

    await openNewTab(localTestPageUrl);
    await findUrl(integratedUpdateUrl, {
      timeout: 15000,
      exists: true
    });
  });

  it("doesn't trigger an update campaign on Firefox if opted out of marketing messages", async function () {
    // IPMs are not supported on Firefox, hence we need to fall back
    // to running an update campaign directly
    if (browserDetails.browserName !== "firefox") {
      this.skip();
    }

    await setMarketingOptOutState(true);

    setTimeoutForExtensionReload(this);
    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });

    await openNewTab(localTestPageUrl);
    await findUrl(integratedUpdateUrl, {
      timeout: 15000,
      exists: false
    });
  });
};
