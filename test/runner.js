/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-env node */

import path from "path";
import {exec, execFile} from "child_process";
import {promisify} from "util";
import querystring from "querystring";

import got from "got";
import yargs from "yargs";
import webdriver from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import firefox from "selenium-webdriver/firefox.js";
import command from "selenium-webdriver/lib/command.js";

import {downloadChromium, downloadFirefox} from "./browser-download.js";

import {RECENT_FIREFOX_VERSION} from "./utils.js";

// Required to start the driver on some platforms (e.g. Windows).
import "chromedriver";
import "geckodriver";
import "msedgedriver";

const MACOS_EDGE_BINARY =
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
const {By} = webdriver;

class Chromium
{
  async getBranchBasePosition(version)
  {
    let data = await got(`https://omahaproxy.appspot.com/deps.json?version=${version}`).json();
    return data.chromium_base_position;
  }

  async getLatestVersion()
  {
    let os = process.platform;
    if (os == "win32")
      os = process.arch == "x64" ? "win64" : "win";
    else if (os == "darwin")
      os = process.arch == "arm64" ? "mac_arm64" : "mac";

    let data = await got(`https://omahaproxy.appspot.com/all.json?os=${os}`).json();
    let release = data[0].versions.find(ver => ver.channel == "stable");
    let {current_version: version, branch_base_position: base} = release;

    if (release.true_branch && release.true_branch.includes("_"))
    {
      // A wrong base may be caused by a mini-branch (patched) release
      // In that case, the base is taken from the unpatched version
      version = [...version.split(".").slice(0, 3), "0"].join(".");
      base = await this.getBranchBasePosition(version);
    }

    return {version, base};
  }

  async installDriver(version)
  {
    await promisify(execFile)(
      process.execPath,
      [path.join("node_modules", "chromedriver", "install.js")],
      {env: {
        ...process.env,
        npm_config_chromedriver_skip_download: false,
        npm_config_tmp: path.resolve("test",
                                     "chromium-snapshots",
                                     "chromedriver"),
        CHROMEDRIVER_VERSION: `LATEST_${version}`
      }}
    );
  }

  async getDriver(version)
  {
    let base;
    if (version)
      base = await this.getBranchBasePosition(version);
    else
      ({version, base} = await this.getLatestVersion());

    let binary = await downloadChromium(base);
    await this.installDriver(version);

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

  async getDriver(version)
  {
    let binary = await downloadFirefox(version ||
                                       await this.getLatestVersion());

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

class Edge
{
  async installDriver()
  {
    let version;
    if (process.platform == "win32")
    {
      let cmd = "(Get-ItemProperty ${Env:ProgramFiles(x86)}\\Microsoft\\" +
                "Edge\\Application\\msedge.exe).VersionInfo.ProductVersion";
      let {stdout} = await promisify(exec)(cmd, {shell: "powershell.exe"});
      version = stdout.trim();
    }
    else if (process.platform == "darwin")
    {
      let {stdout} =
        await promisify(execFile)(MACOS_EDGE_BINARY, ["--version"]);
      version = stdout.trim().replace(/.*\s/, "");
    }

    if (!version)
      throw new Error("Edge is not installed");

    await promisify(execFile)(
      process.execPath,
      [path.join("node_modules", "msedgedriver", "install.js")],
      {env: {...process.env, EDGECHROMIUMDRIVER_VERSION: version,
             npm_config_edgechromiumdriver_skip_download: false}}
    );
  }

  async getDriver()
  {
    await this.installDriver();

    let builder = new webdriver.Builder();
    builder.forBrowser("MicrosoftEdge");
    builder.withCapabilities({
      "browserName": "MicrosoftEdge",
      "ms:edgeChromium": true,
      "ms:edgeOptions": {args: [`load-extension=${process.cwd()}`]}
    });

    return builder.build();
  }
}

const BROWSERS = {
  chromium: new Chromium(),
  firefox: new Firefox(),
  edge: new Edge()
};

function parseArguments()
{
  let parser = yargs(process.argv.slice(2));
  parser.version(false);
  parser.strict();
  parser.command("$0 <browser> [version]", "", subparser =>
  {
    subparser.positional("browser", {choices: Object.keys(BROWSERS)});
    subparser.positional("version", {type: "string"});
  });
  parser.option("timeout");
  parser.option("grep");

  let {argv} = parser;
  let params;
  for (let param of ["timeout", "grep"])
  {
    let value = argv[param];
    if (value)
      (params || (params = {}))[param] = value;
  }

  return {browser: argv.browser, version: argv.version, params};
}

async function switchToHandle(driver, testFn)
{
  for (let handle of await driver.getAllWindowHandles())
  {
    let url;
    try
    {
      await driver.switchTo().window(handle);
      url = await driver.getCurrentUrl();
    }
    catch (e)
    {
      continue;
    }

    if (testFn(url))
      return handle;
  }
}

async function getHandle(driver, page, params)
{
  let url;
  let timeout = 5000;
  let cap = await driver.getCapabilities();
  let version = parseInt(cap.getBrowserVersion().split(".")[0], 10);
  if (cap.getBrowserName() == "firefox" && version < RECENT_FIREFOX_VERSION)
    timeout = 8000;
  let handle = await driver.wait(() => switchToHandle(driver, handleUrl =>
  {
    if (!handleUrl)
      return false;

    url = new URL(handleUrl);
    return url.pathname == page;
  }), timeout, `${page} did not open`);

  if (params)
  {
    url.search = querystring.encode(params);
    await driver.navigate().to(url.href);
  }

  return handle;
}

async function pollMessages(driver, handle)
{
  let result;
  let log = [];

  while (!result)
  {
    let messages = await driver.executeAsyncScript(`
      let callback = arguments[0];
      if (document.readyState == "complete")
        callback(poll());
      else
        window.addEventListener("load", () => callback(poll()));`);

    if (!messages)
      return;

    for (let [id, arg] of messages)
    {
      switch (id)
      {
        case "log":
          log.push(arg);
          console.log(...arg); // eslint-disable-line no-console
          break;

        case "click":
          await switchToHandle(driver, handleUrl => handleUrl == arg.url);
          await driver.findElement(webdriver.By.css(arg.selector)).click();
          await driver.switchTo().window(handle);
          break;

        case "end":
          result = arg;
          result.log = log;
          break;
      }
    }
  }
  return result;
}

async function startTestRun(driver, id)
{
  await getHandle(driver, "/test/index.html");
  await driver.findElement(By.id(id)).click();
}

async function run()
{
  let {browser, version, params} = parseArguments();
  let driver = await BROWSERS[browser].getDriver(version);
  let resultUnit;
  let resultReload;

  try
  {
    let cap = await driver.getCapabilities();
    // eslint-disable-next-line no-console
    console.log(`Browser: ${cap.getBrowserName()} ${cap.getBrowserVersion()}`);

    await startTestRun(driver, "unit");
    let handle = await getHandle(driver, "/test/unit.html", params);
    resultUnit = await pollMessages(driver, handle);

    await startTestRun(driver, "reload");
    while (!resultReload ||
           resultReload.log.toString().includes("Reload (preparation)"))
    {
      handle = await getHandle(driver, "/test/reload.html", params);
      try
      {
        resultReload = await pollMessages(driver, handle);
      }
      catch (e)
      {
        if (e.name != "NoSuchWindowError")
          throw e;
      }
    }
  }
  finally
  {
    await driver.quit();
  }

  if (resultUnit.failures > 0 || resultUnit.total == 0 ||
      resultReload.failures > 0 || resultReload.total == 0)
    process.exit(1);
}

run().catch(err =>
{
  console.error(err instanceof Error ? err.stack : `Error: ${err}`);
  process.exit(1);
});
