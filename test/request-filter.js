const TEST_PAGES_URL = "http://localhost:3000";
const SITEKEY = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANGtTstne7" +
                "e8MbmDHDiMFkGbcuBgXmiVesGOG3gtYeM1EkrzVhBj" +
                "GUvKXYE4GLFwqty3v5MuWWbvItUWBTYoVVsCAwEAAQ";

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
    restoreSubscriptions = ABP.subscriptions.removeAll();

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

    ABP.subscriptions.removeAll();
  });

  it("blocks a request", async() =>
  {
    ABP.filters.add("/image.png^$image");
    await expectBlockedRequest("image.html", "image.png");
  });

  it("does not block an allowlisted request", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add("@@/image.png^$image");
    expect((await openTestPage("image.html")).error).toBeNull();
  });

  it("does not block a request allowlisted by sitekey", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add(`@@$sitekey=${SITEKEY}`);
    expect((await openTestPage("image.html?sitekey=1")).error).toBeNull();
  });

  it("does not block a request from document allowlisted by sitekey", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add(`@@$document,sitekey=${SITEKEY}`);
    expect((await openTestPage("image.html?sitekey=1")).error).toBeNull();
  });

  it("handles rewritten srcdoc frames", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/image.png^`);
    await expectBlockedRequest("srcdoc.html", "image.png");
    ABP.filters.add(`@@|${TEST_PAGES_URL}/srcdoc.html^$document`);
    expect((await openTestPage("srcdoc.html")).error).toBeNull();
  });

  it("does not block a request sent by the extension", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/image.png^`);
    await fetch(`${TEST_PAGES_URL}/image.png`);
  });

  it("does not block requests with no filters", async() =>
  {
    expect((await openTestPage("image.html")).error).toBeNull();
  });

  describe("Content-Security-Policy", () =>
  {
    async function checkViolatedDirective(query = "")
    {
      let {tabId} = await openTestPage(`csp.html${query}`);
      let code = "document.documentElement.dataset.violatedDirective";
      return (await browser.tabs.executeScript(tabId, {code}))[0];
    }

    it("injects header", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      expect(await checkViolatedDirective()).toEqual("img-src");
    });

    it("does not inject header for allowlisted requests", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      ABP.filters.add(`@@|${TEST_PAGES_URL}/csp.html^$csp`);
      expect(await checkViolatedDirective()).toEqual("unset");
    });

    it("does not inject header for allowlisted requests by document", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      ABP.filters.add(`@@|${TEST_PAGES_URL}/csp.html^$document`);
      expect(await checkViolatedDirective()).toEqual("unset");
    });

    it("does not inject header for allowlisted requests by sitekey", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      ABP.filters.add(`@@$csp,sitekey=${SITEKEY}`);
      expect(await checkViolatedDirective("?sitekey=1")).toEqual("unset");
    });
  });
});
