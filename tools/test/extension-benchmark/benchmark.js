/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-env node */
/* eslint-disable no-console */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import CDP from "chrome-remote-interface";
import {
  remoteDebuggingPort,
  getNewDriver,
  getCurrentDriver,
  getHandle,
  setPageLoadTimeout,
} from "../sdk-runner/driver.js";
import { runLighthouse, calculateMetricBaseline } from "./lighthouse.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
export const resultsPath = path.join(dirname, "results");
export const extensionsPath = path.join(dirname, "extensions");
export const urlsFilePath = path.join(dirname, "urls.txt");
const noExtensionName = "no-adblocker";

const metrics = [
  { metric: "interactive", description: "Time it takes for the page to become fully interactive" },
  {
    metric: "speed-index",
    description: "Measures how quickly content is visually displayed during page load",
  },
  {
    metric: "bootup-time",
    description: "Time to load and execute the minimal JavaScript necessary to start the web app",
  },
  {
    metric: "total-blocking-time",
    description: "Total time a page is blocked from responding to user input",
  },
  {
    metric: "max-potential-fid",
    description: "Measures how quickly the browser can respond to the first user interaction",
  },
  {
    metric: "mainthread-work-breakdown",
    description:
      "Time the main thread spends executing JavaScript, rendering, and painting tasks during page load",
  },
  {
    metric: "server-response-time",
    description:
      "Time for the browser to receive the first byte of page content after making the request",
  },
  {
    metric: "network-requests",
    description: "Lists the network requests that were made during page load",
  },
  { metric: "total-byte-weight", description: "Size of network payloads in bytes" },
];

const extendedMetrics = [
  ...metrics,
  { metric: "tabMemoryInMB", description: "Memory used by the URL tab in MB" },
  { metric: "swMemoryInMB", description: "Memory used by the extension service worker in MB" },
];

function parseLighthouseMetrics(audits) {
  const lighthouseResult = {};
  for (const { metric } of metrics) {
    if (!audits) {
      lighthouseResult[metric] = null;
      continue;
    }

    if (metric == "network-requests") {
      lighthouseResult[metric] = audits[metric].details?.items.length || null;
    } else {
      lighthouseResult[metric] = Math.trunc(audits[metric].numericValue);
    }
  }

  return lighthouseResult;
}

async function logResults(runResults, extensionName, urls) {
  const logs = [];

  for (const url of urls) {
    // Because of how we gather lighthouse results we need to group them by URL
    const lighthouseResults = [];
    for (const runResultAllUrls of runResults) {
      const { lighthouseResult } = runResultAllUrls.find((urlResult) => urlResult.url === url);
      lighthouseResults.push(lighthouseResult);
    }

    const metricResults = [];
    for (const { metric } of extendedMetrics) {
      // keep average only
      const { average } = calculateMetricBaseline(metric, lighthouseResults);
      metricResults.push({ metric, average });
    }

    const urlBaseline = { url, metricResults };
    logs.push(urlBaseline);
  }

  const resultsFilePath = path.join(resultsPath, `${extensionName}.json`);
  await fs.promises.writeFile(resultsFilePath, JSON.stringify(logs, null, 2));
  console.log(`Results written to ${resultsFilePath}`);
}

async function getServiceWorkerMemory() {
  // Connect via CDP
  const client = await CDP({ port: remoteDebuggingPort });
  const { ServiceWorker, Runtime, Target } = client;
  await ServiceWorker.enable();

  // List all targets including service workers
  const { targetInfos } = await Target.getTargets();
  const swTargets = targetInfos.filter(
    (t) => t.type === "service_worker" && t.url.startsWith("chrome-extension://"),
  );

  if (swTargets.length == 0) {
    await client.close();
    return 0;
  }

  // Attach to SW and get memory
  // Assumes the first service worker is the right one, which should be true
  // if there's only one extension installed. Check sw.url if needed
  const sw = swTargets[0];
  const { sessionId } = await Target.attachToTarget({
    targetId: sw.targetId,
    flatten: true,
  });

  // Query heap usage for this SW
  const heap = await Runtime.getHeapUsage({ sessionId });
  const swMemoryInMB = Math.trunc(heap.usedSize / (1024 * 1024));

  await client.close();
  return swMemoryInMB;
}

async function getExtraMetrics(url) {
  const extraMetrics = { tabMemoryInMB: null, swMemoryInMB: null };
  const driver = getCurrentDriver();

  const currentTimeout = await setPageLoadTimeout(10000);
  const currentWindowHandle = await driver.getWindowHandle();
  await driver.switchTo().newWindow("tab");
  let urlLoaded = false;
  try {
    // May rarely throw "Timed out receiving message from renderer"
    await driver.navigate().to(url);
    urlLoaded = true;
  } catch (err) {
    console.warn(`URL couldn't be loaded to get extra metrics. ${err.name}: ${err.message}`);
  }

  if (urlLoaded) {
    // sleep to allow more content to be loaded
    await new Promise((r) => setTimeout(r, 1000));

    // tab memory
    const memory = await driver.executeScript("return window.performance.memory.usedJSHeapSize");
    extraMetrics.tabMemoryInMB = Math.trunc(memory / (1024 * 1024));

    extraMetrics.swMemoryInMB = await getServiceWorkerMemory();
  }

  await driver.close();
  await driver.switchTo().window(currentWindowHandle);
  await setPageLoadTimeout(currentTimeout);

  return extraMetrics;
}

async function waitForBenchmarkExtension(extensionName, sleepPostInstall) {
  if (!extensionName) {
    return;
  }

  if (extensionName.includes("adblockplus-chrome")) {
    await getHandle("/en/installed", 25000);
  } else if (extensionName.includes("adblock-chrome")) {
    await getHandle("/en/installed/", 25000);
  } else if (extensionName.includes("adguard")) {
    await getHandle("/v2/thankyou.html", 25000);
  }

  if (sleepPostInstall > 0) {
    console.log(`Sleeping ${sleepPostInstall}s after extension post install ...`);
    await new Promise((r) => setTimeout(r, sleepPostInstall * 1000));
  }
}

export async function benchmarkRun(extensionName, urls, { browser, version, params }) {
  const extensionLogName = extensionName || noExtensionName;
  console.log(`\n--Benchmark run for "${extensionLogName}"--`);
  console.log(`Getting ready to run ${browser} ${version} ...`);

  const { forceHeadful, runsPerURL, restartBrowser, sleepPostInstall } = params;
  const headless = !forceHeadful;

  const benchmarkExtensionPath = extensionName ? path.join(extensionsPath, extensionName) : null;
  const extensionPaths = extensionName ? [benchmarkExtensionPath] : [];
  const extraArgs = [
    `--remote-debugging-port=${remoteDebuggingPort}`,
    "--window-size=1920,1080",
    "--enable-precise-memory-info",
  ];
  const options = { extensionPaths, extraArgs, headless };

  await getNewDriver(browser, version, options);
  await waitForBenchmarkExtension(extensionName, sleepPostInstall);
  const runResults = [];
  for (let i = 0; i < runsPerURL; i++) {
    if (runsPerURL > 1) {
      console.log(`Run ${i + 1} out of ${runsPerURL} ...`);
    }

    const runResultAllUrls = [];
    for (const url of urls) {
      let audits = null;
      try {
        audits = await runLighthouse(url);
      } catch (err) {
        console.warn(`Lighthouse coudn't run on the URL. ${err.name}: ${err.message}`);
        if (err.name == "LighthouseError") {
          // When "LighthouseError: PROTOCOL_TIMEOUT" is thrown the driver session
          // may be not valid anymore. Restarting the driver as a workaround
          console.warn("Restarting the browser/driver...");
          await getNewDriver(browser, version, options);
          await waitForBenchmarkExtension(extensionName, sleepPostInstall);
        }
      }
      const lighthouseResult = parseLighthouseMetrics(audits);
      const extraMetrics = await getExtraMetrics(url);

      runResultAllUrls.push({ url, lighthouseResult: { ...lighthouseResult, ...extraMetrics } });
    }
    runResults.push(runResultAllUrls);

    if (restartBrowser && i !== runsPerURL - 1) {
      await getNewDriver(browser, version, options);
      await waitForBenchmarkExtension(extensionName, sleepPostInstall);
    }
  }

  await logResults(runResults, extensionLogName, urls);
}

export async function buildReport() {
  const reportFilePath = path.join(resultsPath, "results.md");
  await fs.promises.rm(reportFilePath, { force: true });

  const extensionReports = (await fs.promises.readdir(resultsPath, { withFileTypes: true }))
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name);

  const mdTable = {};
  for (const extensionReport of extensionReports) {
    const resultsFilePath = path.join(resultsPath, extensionReport);
    const resultsJSON = JSON.parse(await fs.promises.readFile(resultsFilePath));
    for (const { url, metricResults } of resultsJSON) {
      if (!mdTable[url]) {
        mdTable[url] = [];
      }
      mdTable[url].push({ extensionReport, metricResults });
    }
  }

  // Title, description
  let mdReport = "# Benchmarking extensions report\n\n## Metrics description\n\n";
  for (const { metric, description } of extendedMetrics) {
    mdReport += `- ${metric}: ${description}\n`;
  }
  mdReport += "\n## Results\n\n";

  // Table header
  const extensionNames = extensionReports.map((er) => er.replace(".json", ""));
  mdReport += "| URL | " + extensionNames.join(" | ") + " |\n";
  for (let i = 0; i <= extensionNames.length; i++) {
    mdReport += "| ----- ";
  }
  mdReport += "|\n";

  // Table content
  for (const [url, urlReports] of Object.entries(mdTable)) {
    mdReport += `| ${url} `;
    for (const { metricResults } of urlReports) {
      mdReport += "| ";
      for (const { metric, average } of metricResults) {
        mdReport += `${metric}: ${average}<br>`;
      }
    }
    mdReport += "|\n";
  }

  await fs.promises.writeFile(reportFilePath, mdReport);
  console.log(`Report written to ${reportFilePath}`);
}
