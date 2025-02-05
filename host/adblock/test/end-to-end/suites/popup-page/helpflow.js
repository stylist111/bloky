import { expect } from "expect";
import { blockHideUrl } from "@eyeo/test-utils/urls";
import { getOptionsHandle } from "@eyeo/test-utils/extension";
import {
  getDisplayedElement,
  openNewTab,
  getTabId,
  clickOnDisplayedElement,
  waitForNotDisplayed,
} from "@eyeo/test-utils/driver";
import { initPopupPage, initOptionsGeneralTab, setPausedStateFromPopup } from "../../utils/page.js";

const seeAdSelector = "div.segue-box > span[i18n='see_ad']";

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
  await clickOnDisplayedElement("#help_link", { timeout: 2000 });

  // Ensure the right helpflow UI has effectively loaded
  await getDisplayedElement(seeAdSelector, { timeout: 5000, checkDisplayed: false });
  // Adding a slight delay before clicking the seeAdSelector
}

async function clickThenWaitForAnimation(selector) {
  await driver.wait(
    async () => {
      try {
        await clickOnDisplayedElement(selector);
        // The button may be clicked while it's still animated, making the
        // click ineffective. That's why the next check is needed
        await waitForNotDisplayed(selector);
        return true;
      } catch (e) {}
    },
    2000,
    `${selector} was still displayed after clicking on it`,
  );
}

export default () => {
  it("initiates helpflow for first time ad", async function () {
    // Capture the last download timestamp before filterlists are updated
    const lastDownloadBeforeReload = await getLastDownloadTimestamp();
    await clickHelpIcon();
    await clickThenWaitForAnimation(seeAdSelector);
    await clickThenWaitForAnimation("[i18n='first_time_seeing_ad']");
    await clickThenWaitForAnimation("[i18n='ok']");
    await clickOnDisplayedElement("[i18n='reload_the_page']");
    await initOptionsGeneralTab(getOptionsHandle());
    // Capture the last download timestamp after filterlists are updated
    const lastDownloadAfterReload = await getLastDownloadTimestamp();
    // Compare the lastDownload timestamps
    expect(lastDownloadAfterReload).not.toEqual(lastDownloadBeforeReload);
  });

  it("initiates helpflow and removes allowlisted site from the allowlist", async function () {
    // pause adblock on the page
    await setPausedStateFromPopup(blockHideUrl, true);
    await clickHelpIcon();
    await clickThenWaitForAnimation(seeAdSelector);
    await clickThenWaitForAnimation("[i18n='first_time_seeing_ad']");
    await clickOnDisplayedElement("[i18n='ok']");
    const allowlistText = await getDisplayedElement("[i18n='page_is_whitelisted']", {
      timeout: 1000,
    });
    expect(await allowlistText.getText()).toContain(
      "This page is on your allowlist, which is why you're seeing an ad.",
    );
    await clickOnDisplayedElement("[i18n='no']", { timeout: 2000, checkDisplayed: false });
    await clickOnDisplayedElement("[i18n-aria-label='back_help_flow']", {
      timeout: 2000,
      checkDisplayed: false,
    });
    await clickOnDisplayedElement("[i18n='yes']", { timeout: 2000, checkDisplayed: false });
    await clickOnDisplayedElement("[i18n='reload_the_page']", {
      timeout: 5000,
      checkDisplayed: false,
    });
  });

  it("initiates helpflow for ads everywhere", async function () {
    await clickHelpIcon();
    await clickThenWaitForAnimation(seeAdSelector);
    await clickThenWaitForAnimation("[i18n='see_ad_everywhere']");
    await clickOnDisplayedElement("[i18n='learn_more_to_resolve']");
    const helpWindow = await driver.getWindowHandle();
    await driver.switchTo().window(helpWindow);
  });
};
