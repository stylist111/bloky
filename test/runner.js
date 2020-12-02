/* eslint-env node */

import got from "got";
import webdriver from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import firefox from "selenium-webdriver/firefox.js";
import command from "selenium-webdriver/lib/command.js";

import {ensureChromium}
  from "../adblockpluscore/test/runners/chromium_download.mjs";
import {ensureFirefox}
  from "../adblockpluscore/test/runners/firefox_download.mjs";

// Windows needs this to start the driver
import "chromedriver";
import "geckodriver";

class Chromium
{
  async getLatestVersion()
  {
    let os = process.platform;
    if (os == "win32")
      os = process.arch == "x64" ? "win64" : "win";
    else if (os == "darwin")
      os = "mac";

    let data = await got(`https://omahaproxy.appspot.com/all.json?os=${os}`).json();
    let version = data[0].versions.find(ver => ver.channel == "stable");
    let base = version.branch_base_position;

    if (version.true_branch && version.true_branch.includes("_"))
    {
      // A wrong base may be caused by a mini-branch (patched) release
      // In that case, the base is taken from the unpatched version
      let cv = version.current_version.split(".");
      let unpatched = `${cv[0]}.${cv[1]}.${cv[2]}.0`;
      let unpatchedVersion = await got(`https://omahaproxy.appspot.com/deps.json?version=${unpatched}`).json();
      base = unpatchedVersion.chromium_base_position;
    }

    return base;
  }

  async ensureBrowser(version)
  {
    return ensureChromium(version);
  }

  getDriver(binary)
  {
    let options = new chrome.Options();
    options.addArguments("no-sandbox", `load-extension=${process.cwd()}`);
    options.setChromeBinaryPath(binary);

    let builder = new webdriver.Builder();
    builder.forBrowser("chrome");
    builder.setChromeOptions(options);

    return builder.build();
  }
}

class Firefox
{
  async getLatestVersion()
  {
    let data = await got("https://product-details.mozilla.org/1.0/firefox_versions.json").json();
    return data.LATEST_FIREFOX_VERSION;
  }

  async ensureBrowser(version)
  {
    return ensureFirefox(version);
  }

  async getDriver(binary)
  {
    let options = new firefox.Options();
    options.headless();
    options.setBinary(binary);

    let builder = new webdriver.Builder();
    builder.forBrowser("firefox");
    builder.setFirefoxOptions(options);

    let driver = await builder.build();
    await driver.execute(
      new command.Command("install addon")
          .setParameter("path", process.cwd())
          .setParameter("temporary", true)
    );
    return driver;
  }
}

(async() =>
{
  let browser = process.argv[2] == "firefox" ? new Firefox() : new Chromium();
  let binary = await browser.ensureBrowser(await browser.getLatestVersion());
  let driver = await browser.getDriver(binary);
  let passed;
  let failed;
  let log;

  try
  {
    let cap = await driver.getCapabilities();
    // eslint-disable-next-line no-console
    console.log(`Browser: ${cap.getBrowserName()} ${cap.getBrowserVersion()}`);

    await driver.wait(async() =>
    {
      for (let handle of await driver.getAllWindowHandles())
      {
        try
        {
          await driver.switchTo().window(handle);
          let url = await driver.getCurrentUrl();
          if (new URL(url).pathname == "/test/index.html")
            return true;
        }
        catch (e) {}
      }
      return false;
    }, 2000, "unit tests page did not open");

    ({passed, failed, log} = await driver.executeScript("return done;"));
  }
  finally
  {
    await driver.quit();
  }

  for (let args of log)
    console.log(...args); // eslint-disable-line no-console

  if (failed > 0 || passed == 0)
    process.exit(1);
})();
