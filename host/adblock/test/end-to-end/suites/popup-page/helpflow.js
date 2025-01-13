import { expect } from "expect";
import { blockHideUrl } from "@eyeo/test-utils/urls";
import { getOptionsHandle } from "@eyeo/test-utils/extension";
import {
  getDisplayedElement,
  openNewTab,
  getTabId,
  clickOnDisplayedElement,
} from "@eyeo/test-utils/driver";
import {
  initPopupPage,
  programaticallyAddFilters,
  initOptionsGeneralTab,
} from "../../utils/page.js";

const seeAdSelector = "[i18n='see_ad']";

async function getLastDownloadTimestamp() {
  await initOptionsGeneralTab(getOptionsHandle());
  return driver.executeScript(() =>
    browser.runtime.sendMessage({ type: "subscriptions.get" }).then((result) => {
      // Access the first filterlist subscription in the array to get the lastDownload time
      const firstSubscription = result[0];
      const lastDownloadTimestamp = firstSubscription.lastDownload;
      return lastDownloadTimestamp;
    }),
  );
}

async function clickHelpIcon() {
  await openNewTab(blockHideUrl);
  const tabId = await getTabId(getOptionsHandle());

  await initPopupPage(tabId);
  await clickOnDisplayedElement("#help_link", { timeout: 1000 });
  // Ensure the right helpflow UI has effectively loaded
  await getDisplayedElement(seeAdSelector, { timeout: 1000 });
}

export default () => {
  it("initiates helpflow for first time ad", async function () {
    // Capture the last download timestamp before filterlists are updated
    const lastDownloadBeforeReload = await getLastDownloadTimestamp();
    await clickHelpIcon();
    await clickOnDisplayedElement(seeAdSelector, { timeout: 1000 });
    await clickOnDisplayedElement("[i18n='first_time_seeing_ad']", { timeout: 1000 });
    await clickOnDisplayedElement("[i18n='ok']", { timeout: 3000 });
    await clickOnDisplayedElement("[i18n='reload_the_page']");
    await initOptionsGeneralTab(getOptionsHandle());
    // Capture the last download timestamp after filterlists are updated
    const lastDownloadAfterReload = await getLastDownloadTimestamp();
    // Compare the lastDownload timestamps
    expect(lastDownloadAfterReload).not.toEqual(lastDownloadBeforeReload);
  });

  it("initiates helpflow and removes allowlisted site from the allowlist", async function () {
    await programaticallyAddFilters("@@testpages.eyeo.com:3005$document");
    await clickHelpIcon();
    await clickOnDisplayedElement(seeAdSelector, { timeout: 1000 });
    await clickOnDisplayedElement("[i18n='first_time_seeing_ad']", { timeout: 1000 });

    await clickOnDisplayedElement("[i18n='ok']", { timeout: 1000 });
    const allowlistText = await getDisplayedElement("[i18n='page_is_whitelisted']", {
      timeout: 1000,
    });
    expect(await allowlistText.getText()).toContain(
      "This page is on your allowlist, which is why you're seeing an ad.",
    );
    await clickOnDisplayedElement("[i18n='no']");
    await clickOnDisplayedElement("[i18n-aria-label='back_help_flow']");
    await clickOnDisplayedElement("[i18n='yes']");
    await clickOnDisplayedElement("[i18n='reload_the_page']", { timeout: 1000 });
  });

  it("initiates helpflow for ads everywhere", async function () {
    await clickHelpIcon();

    await clickOnDisplayedElement(seeAdSelector, { timeout: 1000 });
    await clickOnDisplayedElement("[i18n='see_ad_everywhere']", { timeout: 1000 });

    await clickOnDisplayedElement("[i18n='learn_more_to_resolve']", { timeout: 1000 });
    const helpWindow = await driver.getWindowHandle();
    await driver.switchTo().window(helpWindow);
  });
};
