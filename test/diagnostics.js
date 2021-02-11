import {Page, Popup} from "./utils.js";

describe("Diagnostics", () =>
{
  let ABP;
  let restoreSubscriptions;

  before(async() =>
  {
    ({ABP} = await browser.runtime.getBackgroundPage());
    restoreSubscriptions = ABP.subscriptions.removeAll();
  });

  after(() =>
  {
    if (restoreSubscriptions)
      restoreSubscriptions();
  });

  afterEach(() =>
  {
    ABP.subscriptions.removeAll();
    Page.removeCurrent();
    Popup.removeCurrent();
  });

  async function checkLogging(filter, callback)
  {
    let fake = sinon.fake();

    ABP.onFilterMatch.addListener(fake);
    ABP.filters.add(filter);

    try
    {
      await callback();
    }
    finally
    {
      ABP.onFilterMatch.removeListener(fake);
    }

    expect(fake.called).toBeTruthy();
    expect(fake.firstArg).toEqual({details: expect.any(Object), filter});
  }

  function checkRequestLogging(page, filter)
  {
    return checkLogging(filter, async() =>
    {
      let tabId = await new Page(page).created;

      await new Promise(resolve =>
      {
        function onCompleted(details)
        {
          if (details.tabId == tabId && details.frameId == 0)
          {
            browser.webNavigation.onCompleted.removeListener(onCompleted);
            resolve();
          }
        }
        browser.webNavigation.onCompleted.addListener(onCompleted);
      });
    });
  }

  it("logs blocking request filter", async() =>
  {
    await checkRequestLogging("image.html", "/image.png^$image");
  });

  it("logs allowlisting request filter", async() =>
  {
    ABP.filters.add("/image.png^$image");
    await checkRequestLogging("image.html", "@@$image");
  });

  it("logs blocking $header filter", async() =>
  {
    await checkRequestLogging("header.html", "*$header=x-header=whatever");
  });

  it("logs allowlisting $header filter", async() =>
  {
    ABP.filters.add("*$header=x-header=whatever");
    await checkRequestLogging("header.html", "@@$header");
  });

  it("logs blocking $csp filter", async() =>
  {
    await checkRequestLogging("csp.html", "*$csp=img-src 'none'");
  });

  it("logs allowlisting $csp filter", async() =>
  {
    ABP.filters.add("*$csp=img-src 'none'");
    await checkRequestLogging("csp.html", "@@$csp");
  });

  function checkPopupLogging(filter)
  {
    return checkLogging(filter, () =>
      new Popup("link", new Page("popup-opener.html")).blocked
    );
  }

  it("logs blocking popup filter", async() =>
  {
    await checkPopupLogging("*popup.html^$popup");
  });

  it("logs allowlisting popup filter", async() =>
  {
    ABP.filters.add("*popup.html^$popup");
    await checkPopupLogging("@@$popup");
  });
});
