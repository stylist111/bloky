import {Page, TEST_PAGES_URL} from "./utils.js";

describe("Pop-up blocking", () =>
{
  let ABP;
  let restoreSubscriptions;
  let openerTabId;
  let popupTabId;

  before(async() =>
  {
    ({ABP} = await browser.runtime.getBackgroundPage());
    restoreSubscriptions = ABP.subscriptions.removeAll();
    openerTabId = await new Page("popup-opener.html").created;
  });

  after(() =>
  {
    if (restoreSubscriptions)
      restoreSubscriptions();

    Page.removeCurrent();
  });

  afterEach(() =>
  {
    ABP.subscriptions.removeAll();

    if (popupTabId)
    {
      browser.tabs.remove(popupTabId);
      popupTabId = null;
    }
  });

  async function isPopupBlocked()
  {
    let onTabCreated;
    let onNavTarget;
    let onTabRemoved;
    let onCompleted;

    popupTabId = await new Promise(resolve =>
    {
      onTabCreated = tab => resolve(tab.id);
      onNavTarget = details => resolve(details.tabId);

      browser.tabs.onCreated.addListener(onTabCreated);
      browser.webNavigation.onCreatedNavigationTarget.addListener(onNavTarget);
    });

    browser.tabs.onCreated.removeListener(onTabCreated);
    browser.webNavigation.onCreatedNavigationTarget.removeListener(onNavTarget);

    let blocked = await new Promise(resolve =>
    {
      onTabRemoved = tabId =>
      {
        if (tabId == popupTabId)
        {
          popupTabId = null;
          resolve(true);
        }
      };

      onCompleted = details =>
      {
        if (details.tabId == popupTabId &&
            details.frameId == 0 &&
            details.url != "about:blank")
          resolve(false);
      };

      browser.tabs.onRemoved.addListener(onTabRemoved);
      browser.webNavigation.onCompleted.addListener(onCompleted);
    });

    browser.tabs.onRemoved.removeListener(onTabRemoved);
    browser.webNavigation.onCompleted.removeListener(onCompleted);

    return blocked;
  }

  async function checkPopup(id)
  {
    let blocked = isPopupBlocked();
    let code = `document.getElementById("${id}").click()`;
    await browser.tabs.executeScript(openerTabId, {code});
    return blocked;
  }

  it("blocks a link-based popup", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await checkPopup("link")).toBeTruthy();
  });

  it("blocks a script-based popup tab", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await checkPopup("script-tab")).toBeTruthy();
  });

  it("blocks a script-based popup window", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await checkPopup("script-window")).toBeTruthy();
  });

  it("blocks a script-based popup with deferred navigation", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await checkPopup("script-deferred")).toBeTruthy();
  });

  it("doesn't block an allowlisted popup", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    ABP.filters.add(`@@|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await checkPopup("link")).toBeFalsy();
  });
});
