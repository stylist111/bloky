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

/* eslint-disable no-await-in-loop */

import { findUrl, openNewTab } from "@eyeo/test-utils/driver";
import { localTestPageUrl } from "@eyeo/test-utils/host-urls";
import {
  reloadExtension,
  setTimeoutForExtensionReload,
  updatePrefs,
  updateSettings,
} from "@eyeo/test-utils/extension";

import { initOptionsGeneralTab, setMarketingOptOutState } from "../utils/page.js";
import { updateUrl } from "../utils/urls.js";

// Wednesday of an even-numbered week
const dateWithUpdateCampaign = "2025-01-08";
// Wednesday of an odd-numbered week
const dateWithoutUpdateCampaign = "2025-01-01";
const lastShownOld = new Date("2024-01-01").getTime();
// Tuesday of an even-numbered week
const lastShownRecent = new Date("2025-01-07").getTime();

export default () => {
  beforeEach(async function () {
    await updatePrefs(
      initOptionsGeneralTab,
      "testing_update_campaign_date_override",
      dateWithUpdateCampaign,
    );
    await updatePrefs(initOptionsGeneralTab, "update_campaign_last_shown", lastShownOld);
  });

  afterEach(async function () {
    await setMarketingOptOutState(false);
    await updatePrefs(initOptionsGeneralTab, "testing_update_campaign_date_override", "");
  });

  after(async function () {
    await updatePrefs(initOptionsGeneralTab, "update_campaign_last_shown", 0);
    await updateSettings(initOptionsGeneralTab, "suppress_update_page", true);
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
    await findUrl(updateUrl, { timeout: 15000, exists: false });
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
    await findUrl(updateUrl, { timeout: 15000 });
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
    await findUrl(updateUrl, { timeout: 15000, exists: false });
  });

  it("doesn't trigger an update campaign on Firefox if week is skipped", async function () {
    // IPMs are not supported on Firefox, hence we need to fall back
    // to running an update campaign directly
    if (browserDetails.browserName !== "firefox") {
      this.skip();
    }

    await updatePrefs(
      initOptionsGeneralTab,
      "testing_update_campaign_date_override",
      dateWithoutUpdateCampaign,
    );

    setTimeoutForExtensionReload(this);
    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrl, { timeout: 15000, exists: false });
  });

  it("doesn't trigger an update campaign on Firefox if already shown in the same week", async function () {
    // IPMs are not supported on Firefox, hence we need to fall back
    // to running an update campaign directly
    if (browserDetails.browserName !== "firefox") {
      this.skip();
    }

    await updatePrefs(initOptionsGeneralTab, "update_campaign_last_shown", lastShownRecent);

    setTimeoutForExtensionReload(this);
    await reloadExtension(initOptionsGeneralTab, { suppressUpdatePage: false });

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrl, { timeout: 15000, exists: false });
  });
};
