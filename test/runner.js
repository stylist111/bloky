/* eslint-env node */

import got from "got";
import webdriver from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import "chromedriver"; // Windows needs this to start the driver

import {ensureChromium}
  from "../adblockpluscore/test/runners/chromium_download.mjs";

async function getLatestVersion()
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

function getDriver(binary)
{
  let options = new chrome.Options();
  options.addArguments("no-sandbox", `load-extension=${process.cwd()}`);
  options.setChromeBinaryPath(binary);

  let builder = new webdriver.Builder();
  builder.forBrowser("chrome");
  builder.setChromeOptions(options);
  return builder.build();
}

(async() =>
{
  let binary = await ensureChromium(await getLatestVersion());
  let driver = await getDriver(binary);
  let passed;
  let failed;
  let log;

  try
  {
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
    }, 1000, "unit tests page did not open");

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
