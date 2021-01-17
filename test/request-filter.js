const TEST_PAGES_URL = "http://localhost:3000";

describe("Blocking", () =>
{
  let page;
  let ABP;
  let restoreSubscriptions;

  function onErrorOccurred(details)
  {
    if (page && page.tabId == details.tabId)
      page.error = details;
  }

  function onCompleted(details)
  {
    if (page && details.tabId == page.tabId && details.frameId == 0)
      page.resolve({tabId: page.tabId, error: page.error});
  }

  function openTestPage(path)
  {
    return new Promise((resolve, reject) =>
    {
      let url = `${TEST_PAGES_URL}/${path}`;
      browser.tabs.create({url, active: false}).then(tab =>
      {
        if (page)
          browser.tabs.remove(page.tabId);
        page = {tabId: tab.id, resolve, error: null};
      }, reject);
    });
  }

  async function expectBlockedRequest(path, resource)
  {
    let {error} = await openTestPage(path);
    expect(error).toEqual(expect.objectContaining({
      error: expect.stringMatching(/^(net::ERR_BLOCKED_BY_CLIENT|NS_ERROR_ABORT)$/),
      url: `${TEST_PAGES_URL}/${resource}`
    }));
  }

  before(async() =>
  {
    ({ABP} = await browser.runtime.getBackgroundPage());
    restoreSubscriptions = ABP.clearSubscriptions();

    browser.webRequest.onErrorOccurred.addListener(
      onErrorOccurred, {urls: ["<all_urls>"]}
    );
    browser.webNavigation.onCompleted.addListener(onCompleted);
  });

  after(() =>
  {
    browser.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
    browser.webNavigation.onCompleted.removeListener(onCompleted);

    if (restoreSubscriptions)
      restoreSubscriptions();
  });

  afterEach(() =>
  {
    if (page)
    {
      browser.tabs.remove(page.tabId);
      page = null;
    }

    ABP.clearSubscriptions();
  });

  it("blocks an image request", async() =>
  {
    ABP.addFilter("/image.png^$image");
    await expectBlockedRequest("image.html", "image.png");
  });

  it("does not block an image request when allowlisted", async() =>
  {
    ABP.addFilter("/image.png^$image");
    ABP.addFilter("@@/image.png^$image");
    expect((await openTestPage("image.html")).error).toBeNull();
  });

  it("handles rewritten srcdoc frames", async() =>
  {
    ABP.addFilter(`|${TEST_PAGES_URL}/image.png^`);
    await expectBlockedRequest("srcdoc.html", "image.png");
    ABP.addFilter(`@@|${TEST_PAGES_URL}/srcdoc.html^$document`);
    expect((await openTestPage("srcdoc.html")).error).toBeNull();
  });

  it("does not block request sent by extension", async() =>
  {
    ABP.addFilter(`|${TEST_PAGES_URL}/image.png^`);
    await fetch(`${TEST_PAGES_URL}/image.png`);
  });

  describe("Content-Security-Policy", () =>
  {
    async function checkViolatedDirective()
    {
      let {tabId} = await openTestPage("csp.html");
      let code = "document.documentElement.dataset.violatedDirective";
      return (await browser.tabs.executeScript(tabId, {code}))[0];
    }

    it("gets injected", async() =>
    {
      ABP.addFilter("*$csp=img-src 'none'");
      expect(await checkViolatedDirective()).toEqual("img-src");
    });

    it("does not get injected when allowlisted", async() =>
    {
      ABP.addFilter("*$csp=img-src 'none'");
      ABP.addFilter(`@@|${TEST_PAGES_URL}/csp.html^$csp`);
      expect(await checkViolatedDirective()).toEqual("unset");
    });

    it("does not get injected when document is allowlisted", async() =>
    {
      ABP.addFilter("*$csp=img-src 'none'");
      ABP.addFilter(`@@|${TEST_PAGES_URL}/csp.html^$document`);
      expect(await checkViolatedDirective()).toEqual("unset");
    });
  });
});
