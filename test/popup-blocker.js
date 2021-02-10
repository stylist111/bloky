import {TEST_PAGES_URL, PopupOpener} from "./utils.js";

describe("Pop-up blocking", () =>
{
  let ABP;
  let restoreSubscriptions;
  let popupOpener;

  before(async() =>
  {
    ({ABP} = await browser.runtime.getBackgroundPage());
    restoreSubscriptions = ABP.subscriptions.removeAll();
    popupOpener = new PopupOpener();
  });

  after(() =>
  {
    if (restoreSubscriptions)
      restoreSubscriptions();

    if (popupOpener)
      popupOpener.close();
  });

  afterEach(() =>
  {
    ABP.subscriptions.removeAll();
    popupOpener.closePopup();
  });

  it("blocks a link-based popup", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await popupOpener.openPopup("link")).toBeTruthy();
  });

  it("blocks a script-based popup tab", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await popupOpener.openPopup("script-tab")).toBeTruthy();
  });

  it("blocks a script-based popup window", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await popupOpener.openPopup("script-window")).toBeTruthy();
  });

  it("blocks a script-based popup with deferred navigation", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await popupOpener.openPopup("script-deferred")).toBeTruthy();
  });

  it("doesn't block an allowlisted popup", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    ABP.filters.add(`@@|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await popupOpener.openPopup("link")).toBeFalsy();
  });
});
