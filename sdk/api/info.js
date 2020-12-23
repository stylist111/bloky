import browser from "webextension-polyfill";

let manifest = browser.runtime.getManifest();

export let addonName = manifest.short_name || manifest.name;
export let addonVersion = manifest.version;
export let application = "unknown";
export let applicationVersion = "0";
export let platform;
export let platformVersion = "0";

function parseChromiumUserAgent()
{
  let regexp = /(\S+)\/(\S+)(?:\s*\(.*?\))?/g;
  let match;

  while (match = regexp.exec(navigator.userAgent))
  {
    let [, app, version] = match;

    // For compatibility with legacy websites, Chrome's UA
    // also includes a Mozilla, AppleWebKit and Safari tokens.
    // Any further name/version pair indicates a fork.
    if (app == "Mozilla" || app == "AppleWebKit" || app == "Safari")
      continue;

    if (app == "Chrome")
    {
      platformVersion = version;
      if (application != "unknown")
        continue;
    }

    application = app == "OPR" ? "opera" : app.toLowerCase();
    applicationVersion = version;
  }
}

if (typeof netscape != "undefined")
{
  platform = "gecko";

  let match = /\brv:([^;)]+)/.exec(navigator.userAgent);
  if (match)
    platformVersion = match[1];

  browser.runtime.getBrowserInfo().then(browserInfo =>
  {
    application = browserInfo.name.toLowerCase();
    applicationVersion = browserInfo.version;
  });
}
else
{
  platform = "chromium";
  parseChromiumUserAgent();
}
