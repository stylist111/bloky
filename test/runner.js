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

import {ensureChromium}
  from "../adblockpluscore/test/runners/chromium_download.mjs";
import {ensureFirefox}
  from "../adblockpluscore/test/runners/firefox_download.mjs";

// Required to start the driver on some platforms (e.g. Windows).
import "chromedriver";
import "geckodriver";
import "msedgedriver";

const MACOS_EDGE_BINARY =
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";

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
      os = "mac";

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
        npm_config_tmp: path.resolve("adblockpluscore",
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

    let binary = await ensureChromium(base);
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
    let binary = await ensureFirefox(version || await this.getLatestVersion());

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

async function run()
{
  let {browser, version, params} = parseArguments();
  let driver = await BROWSERS[browser].getDriver(version);
  let result;

  try
  {
    let cap = await driver.getCapabilities();
    // eslint-disable-next-line no-console
    console.log(`Browser: ${cap.getBrowserName()} ${cap.getBrowserVersion()}`);

    let url;
    await driver.wait(async() =>
    {
      for (let handle of await driver.getAllWindowHandles())
      {
        try
        {
          await driver.switchTo().window(handle);
          url = new URL(await driver.getCurrentUrl());
          if (url.pathname == "/test/index.html")
            return true;
        }
        catch (e) {}
      }
      return false;
    }, 2000, "unit tests page did not open");

    if (params)
    {
      url.search = querystring.encode(params);
      await driver.navigate().to(url.href);
    }

    result = await driver.executeScript("return done;");
  }
  finally
  {
    await driver.quit();
  }

  for (let args of result.log)
    console.log(...args); // eslint-disable-line no-console

  if (result.failed > 0 || result.passed == 0)
    process.exit(1);
}

run().catch(err =>
{
  console.error(err instanceof Error ? err.stack : `Error: ${err}`);
  process.exit(1);
});
