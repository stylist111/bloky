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
import fs from "fs";

import got from "got";
import yargs from "yargs";
import webdriver from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import firefox from "selenium-webdriver/firefox.js";
import command from "selenium-webdriver/lib/command.js";
import extractZip from "extract-zip";

import {downloadChromium, downloadFirefox, download}
  from "./browser-download.js";

// Required to start the driver on some platforms (e.g. Windows).
import "chromedriver";
import "geckodriver";
import "msedgedriver";

const MACOS_EDGE_BINARY =
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";

let extensionDir;

class Chromium {
  async getBranchBasePosition(version) {
    let data = await got(`https://omahaproxy.appspot.com/deps.json?version=${version}`).json();
    return data.chromium_base_position;
  }

  async getLatestVersion(channel = "stable") {
    let os = process.platform;
    if (os == "win32")
      os = process.arch == "x64" ? "win64" : "win";
    else if (os == "darwin")
      os = process.arch == "arm64" ? "mac_arm64" : "mac";

    let data = await got(`https://omahaproxy.appspot.com/all.json?os=${os}`).json();
    let release = data[0].versions.find(ver => ver.channel == channel);
    let {current_version: version, branch_base_position: base} = release;

    if (release.true_branch && release.true_branch.includes("_")) {
      // A wrong base may be caused by a mini-branch (patched) release
      // In that case, the base is taken from the unpatched version
      version = [...version.split(".").slice(0, 3), "0"].join(".");
      base = await this.getBranchBasePosition(version);
    }

    return {version, base};
  }

  async installDriver(version) {
    await promisify(execFile)(
      process.execPath,
      [path.join("node_modules", "chromedriver", "install.js")],
      {env: {
        ...process.env,
        npm_config_chromedriver_skip_download: false,
        npm_config_tmp: path.resolve("test",
                                     "chromium-snapshots",
                                     "download-cache"),
        CHROMEDRIVER_VERSION: `LATEST_${version}`
      }}
    );
  }

  async installDevDriver(revision) {
    let platform = `${process.platform}-${process.arch}`;
    let buildTypes = {
      "win32-ia32": ["Win", "chromedriver_win32.zip", "chromedriver.exe"],
      "win32-x64": ["Win_x64", "chromedriver_win32.zip", "chromedriver.exe"],
      "linux-x64": ["Linux_x64", "chromedriver_linux64.zip", "chromedriver"],
      "darwin-x64": ["Mac", "chromedriver_mac64.zip", "chromedriver"],
      "darwin-arm64": ["Mac_Arm", "chromedriver_mac64.zip", "chromedriver"]
    };
    let [dir, zip, driver] = buildTypes[platform];

    let snapshotsDir = path.join(process.cwd(), "test", "chromium-snapshots");
    let cacheDir = path.join(snapshotsDir, "download-cache");
    let chromedriverDir = path.join(process.cwd(), "node_modules",
                                    "chromedriver", "lib", "chromedriver");
    let archive = path.join(cacheDir, `${revision}-${zip}`);

    await download(`https://commondatastorage.googleapis.com/chromium-browser-snapshots/${dir}/${revision}/${zip}`,
                   archive);
    await extractZip(archive, {dir: cacheDir});
    await fs.promises.mkdir(chromedriverDir, {recursive: true});
    await fs.promises.copyFile(path.join(cacheDir, zip.split(".")[0], driver),
                               path.join(chromedriverDir, driver));
  }

  async getDriver(version) {
    let base;
    let dev = version == "beta" || version == "dev";
    if (version && !dev)
      base = await this.getBranchBasePosition(version);
    else
      ({version, base} = await this.getLatestVersion(version));

    let {binary, revision} = await downloadChromium(base);
    if (dev)
      await this.installDevDriver(revision);
    else
      await this.installDriver(version);

    let options = new chrome.Options();
    options.addArguments("no-sandbox", `load-extension=${extensionDir}`);
    options.setChromeBinaryPath(binary);

    let builder = new webdriver.Builder();
    builder.forBrowser("chrome");
    builder.setChromeOptions(options);

    return builder.build();
  }
}

class Firefox {
  async getLatestVersion(branch) {
    let data = await got("https://product-details.mozilla.org/1.0/firefox_versions.json").json();
    return branch == "beta" ?
      data.FIREFOX_DEVEDITION : data.LATEST_FIREFOX_VERSION;
  }

  async getDriver(version) {
    if (!version || version == "beta")
      version = await this.getLatestVersion(version);
    let binary = await downloadFirefox(version);

    let options = new firefox.Options();
    options.headless();
    options.setBinary(binary);

    let builder = new webdriver.Builder();
    builder.forBrowser("firefox");
    builder.setFirefoxOptions(options);

    let driver = await builder.build();
    await driver.execute(
      new command.Command("install addon")
          .setParameter("path", extensionDir)
          .setParameter("temporary", true)
    );
    return driver;
  }
}

class Edge {
  async installDriver() {
    let stdout;
    if (process.platform == "win32") {
      let cmd = "(Get-ItemProperty ${Env:ProgramFiles(x86)}\\Microsoft\\" +
                "Edge\\Application\\msedge.exe).VersionInfo.ProductVersion";
      ({stdout} = await promisify(exec)(cmd, {shell: "powershell.exe"}));
    }
    else if (process.platform == "darwin") {
      ({stdout} = await promisify(execFile)(MACOS_EDGE_BINARY, ["--version"]));
    }
    else if (process.platform == "linux") {
      ({stdout} = await promisify(execFile)("microsoft-edge", ["--version"]));
    }
    let version = stdout.trim().replace(/.*\s/, "");

    if (!version)
      throw new Error("Edge is not installed");

    if (process.platform == "win32") {
      return await promisify(execFile)(
        process.execPath,
        [path.join("node_modules", "msedgedriver", "install.js")],
        {env: {...process.env, EDGECHROMIUMDRIVER_VERSION: version,
               npm_config_edgechromiumdriver_skip_download: false}}
      );
    }
    // "install.js" does not work for linux, and does not provide a fallback
    // mechanism when msedgedriver doesn't exist for the latest Edge version
    let platform = `${process.platform}-${process.arch}`;
    let buildTypes = {
      "linux-x64": "edgedriver_linux64",
      "darwin-x64": "edgedriver_mac64",
      "darwin-arm64": "edgedriver_arm64"
    };
    let zip = `${buildTypes[platform]}.zip`;
    let driver = "msedgedriver";
    let snapshotsDir = path.join(process.cwd(), "test", "edge-snapshots");
    let cacheDir = path.join(snapshotsDir, "download-cache");
    let driverDir = path.join(process.cwd(), "node_modules", "msedgedriver",
                              "bin");
    let archive = path.join(cacheDir, `${version}-${zip}`);

    let vSplit = version.split(".");
    let lastNum = parseInt(vSplit[3], 10);
    while (lastNum >= 0) {
      try {
        let attempt = `${vSplit[0]}.${vSplit[1]}.${vSplit[2]}.${lastNum}`;
        // eslint-disable-next-line no-console
        console.log(`Trying to download msedgedriver ${attempt} ...`);
        await download(`https://msedgedriver.azureedge.net/${attempt}/${zip}`,
                       archive);
        break;
      }
      catch (e) {
        lastNum--;
      }
    }

    if (lastNum < 0)
      throw new Error(`msedgedriver was not found for Edge ${version}`);

    await extractZip(archive, {dir: cacheDir});
    await fs.promises.mkdir(driverDir, {recursive: true});
    await fs.promises.copyFile(path.join(cacheDir, driver),
                               path.join(driverDir, driver));
  }

  async getDriver() {
    await this.installDriver();

    let builder = new webdriver.Builder();
    builder.forBrowser("MicrosoftEdge");
    builder.withCapabilities({
      "browserName": "MicrosoftEdge",
      "ms:edgeChromium": true,
      "ms:edgeOptions": {args: ["no-sandbox", `load-extension=${extensionDir}`]}
    });

    return builder.build();
  }
}

const BROWSERS = {
  chromium: new Chromium(),
  firefox: new Firefox(),
  edge: new Edge()
};

function parseArguments() {
  let parser = yargs(process.argv.slice(2));
  parser.version(false);
  parser.strict();
  parser.command("$0 <manifest> <browser> [version]", "", subparser => {
    subparser.positional("manifest", {choices: ["v2", "v3"]});
    subparser.positional("browser", {choices: Object.keys(BROWSERS)});
    subparser.positional("version", {type: "string"});
  });
  parser.option("timeout", {
    description: "Maximum running time for each test. 0 disables timeouts."
  });
  parser.option("grep");

  let {argv} = parser;
  let params;
  for (let param of ["timeout", "grep"]) {
    let value = argv[param];
    if (typeof value != "undefined")
      (params || (params = {}))[param] = value;
  }

  return {
    manifest: argv.manifest,
    browser: argv.browser,
    version: argv.version,
    params
  };
}

async function switchToHandle(driver, testFn) {
  for (let handle of await driver.getAllWindowHandles()) {
    let url;
    try {
      await driver.switchTo().window(handle);
      url = await driver.getCurrentUrl();
    }
    catch (e) {
      continue;
    }

    if (testFn(url))
      return handle;
  }
}

async function getHandle(driver, page) {
  let url;
  let handle = await driver.wait(() => switchToHandle(driver, handleUrl => {
    if (!handleUrl)
      return false;

    url = new URL(handleUrl);
    return url.pathname == page;
  }), 8000, `${page} did not open`);

  return handle;
}

async function pollMessages(driver, handle) {
  let result;
  let log = [];

  while (!result) {
    let messages = await driver.executeAsyncScript(`
      let callback = arguments[0];
      if (document.readyState == "complete")
        callback(poll());
      else
        window.addEventListener("load", () => callback(poll()));`);

    if (!messages)
      return;

    for (let [id, arg] of messages) {
      switch (id) {
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

async function startTestRun(driver, id, params) {
  let search = new URLSearchParams();
  for (let key in params)
    search.append(key, params[key]);

  await getHandle(driver, "/index.html");
  if (search.toString()) {
    let url = await driver.getCurrentUrl();
    url = `${url}?${search.toString()}`;
    await driver.navigate().to(url);
  }

  await driver.findElement(webdriver.By.id(id)).click();
}

async function run() {
  let {manifest, browser, version, params} = parseArguments();
  extensionDir = path.resolve(process.cwd(), "dist", `test-m${manifest}`);
  let driver = await BROWSERS[browser].getDriver(version);
  if (params && typeof params.timeout != "undefined") {
    let driverTimeouts = await driver.manage().getTimeouts();
    let paramsTimeout = parseInt(params.timeout, 10);
    if (paramsTimeout == 0) {
      // 0 is a mocha special case to disable timeouts
      await driver.manage().setTimeouts({
        script: null
      });
    }
    else if (paramsTimeout > driverTimeouts.script) {
      await driver.manage().setTimeouts({
        script: paramsTimeout
      });
    }
  }
  let resultUnit;
  let resultReload;

  try {
    let cap = await driver.getCapabilities();
    // eslint-disable-next-line no-console
    console.log(`Browser: ${cap.getBrowserName()} ${cap.getBrowserVersion()}`);

    await startTestRun(driver, "unit", params);
    let handle = await getHandle(driver, "/unit.html");
    resultUnit = await pollMessages(driver, handle);

    await startTestRun(driver, "reload");
    while (!resultReload ||
           resultReload.log.toString().includes("Reload (preparation)")) {
      handle = await getHandle(driver, "/reload.html");
      try {
        resultReload = await pollMessages(driver, handle);
      }
      catch (e) {
        if (e.name != "NoSuchWindowError")
          throw e;
      }
    }
  }
  finally {
    await driver.quit();
  }

  if (resultUnit.failures > 0 || resultUnit.total == 0 ||
      resultReload.failures > 0 || resultReload.total == 0)
    process.exit(1);
}

run().catch(err => {
  console.error(err instanceof Error ? err.stack : `Error: ${err}`);
  process.exit(1);
});
