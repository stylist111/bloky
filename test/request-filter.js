
describe("Blocking", () =>
{
  before(function(done)
  {
    chrome.runtime.getBackgroundPage(background =>
    {
      this.ABP = background.ABP;

      background.ABP.stop();

      (background.browser ||
       background.chrome).webRequest.onBeforeRequest.addListener = listener =>
      {
        this.onBeforeRequest = listener;
      };
      background.ABP.start().then(done, done);
    });
  });

  it("blocks an image request", function()
  {
    this.ABP.addFilter(
      "||testpages.adblockplus.org/testfiles/image/static/$image"
    );

    let details = {
      tabId: 1,
      frameId: 0,
      type: "image",
      url: "https://testpages.adblockplus.org/testfiles/image/static/static.png"
    };
    let result = this.onBeforeRequest(details);

    expect(result).toEqual({cancel: true});
  });

  it("does not block an image request when allowlisted", function()
  {
    this.ABP.addFilter(
      "||testpages.adblockplus.org/testfiles/image/static/$image"
    );

    // negate the above rule by allowlisting the same image.
    this.ABP.addFilter(
      "@@testpages.adblockplus.org/testfiles/image/static/$image");

    let details = {
      tabId: 1,
      frameId: 0,
      type: "image",
      url: "https://testpages.adblockplus.org/testfiles/image/static/static.png"
    };
    let result = this.onBeforeRequest(details);

    expect(result).not.toEqual(expect.objectContaining({
      cancel: true
    }));
  });
});
