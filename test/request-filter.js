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
    if (page)
    {
      chrome.tabs.remove(page.tabId);
      page = null;
    }

    return new Promise(resolve =>
    {
      let url = `${TEST_PAGES_URL}/${path}`;
      chrome.tabs.create({url, active: false}, tab =>
      {
        page = {tabId: tab.id, resolve, error: null};
      });
    });
  }

  async function expectBlockedRequest(path, resource)
  {
    let {error} = await openTestPage(path);
    expect(error).toEqual(expect.objectContaining({
      error: expect.stringMatching(/^net::ERR_BLOCKED_BY_CLIENT|NS_ERROR_ABORT$/),
      url: `${TEST_PAGES_URL}/${resource}`
    }));
  }

  before(done =>
  {
    chrome.runtime.getBackgroundPage(background =>
    {
      ({ABP} = background);
      restoreSubscriptions = ABP.clearSubscriptions();
      done();
    });

    chrome.webRequest.onErrorOccurred.addListener(
      onErrorOccurred, {urls: ["<all_urls>"]}
    );
    chrome.webNavigation.onCompleted.addListener(onCompleted);
  });

  after(() =>
  {
    chrome.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
    chrome.webNavigation.onCompleted.removeListener(onCompleted);

    if (restoreSubscriptions)
      restoreSubscriptions();
  });

  afterEach(() =>
  {
    if (page)
    {
      chrome.tabs.remove(page.tabId);
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

  describe("Content-Security-Policy", () =>
  {
    async function checkViolatedDirective()
    {
      let {tabId} = await openTestPage("csp.html");
      return new Promise(resolve =>
        chrome.tabs.executeScript(
          tabId,
          {code: "document.documentElement.dataset.violatedDirective"},
          results => resolve(results[0])
        )
      );
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
