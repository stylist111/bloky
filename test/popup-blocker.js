import {TEST_PAGES_URL, Popup, Page} from "./utils.js";

describe("Pop-up blocking", () =>
{
  let ABP;
  let restoreSubscriptions;
  let opener;

  before(async() =>
  {
    ({ABP} = await browser.runtime.getBackgroundPage());
    restoreSubscriptions = ABP.subscriptions.removeAll();
    opener = new Page("popup-opener.html");
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
    Popup.removeCurrent();
  });

  it("blocks a link-based popup", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("link", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup tab", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-tab", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup window", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-window", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup with deferred navigation", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-deferred", opener).blocked).toBeTruthy();
  });

  it("doesn't block an allowlisted popup", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    ABP.filters.add(`@@|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("link", opener).blocked).toBeFalsy();
  });
});
