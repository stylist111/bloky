import {Page, Popup, TEST_PAGES_URL, SITEKEY} from "./utils.js";

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

  it("does not block an allowlisted popup", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    ABP.filters.add(`@@|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("link", opener).blocked).toBeFalsy();
  });

  it("does not block a popup allowlisted by sitekey", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    ABP.filters.add(`@@$popup,sitekey=${SITEKEY}`);
    let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
    expect(await popup.blocked).toBeFalsy();
  });

  it("does not block a popup opened by " +
     "a document allowlisted by sitekey", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    ABP.filters.add(`@@$document,sitekey=${SITEKEY}`);
    let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
    expect(await popup.blocked).toBeFalsy();
  });
});
