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

/* eslint-disable no-console */

import path from "path";
import fs from "fs";
import {fileURLToPath} from "url";

import {By} from "selenium-webdriver";

import {runLighthouse, calculateMetricBaseline} from "@eyeo/test-utils/lighthouse";
import {getNewDriver, getHandle} from "@eyeo/test-utils/sdk-driver";

export const baselineRunsPerUrl = 20;
const dirname = path.dirname(fileURLToPath(import.meta.url));
const isDockerRun = process.env.IS_DOCKER_RUN === "true";
const baselineFileName = isDockerRun ? "baseline_docker.json" : "baseline_local.json";
const baselineFilePath = path.join(dirname, baselineFileName);

const metrics = [
  {metric: "interactive", type: "factor"}, // Time it takes for the page to become fully interactive
  {metric: "speed-index", type: "factor"}, // Measures how quickly content is visually displayed during page load
  {metric: "bootup-time", type: "factor"}, // Time to load and execute the minimal JavaScript necessary to start the web app
  {metric: "total-blocking-time", type: "scaling"}, // Total time a page is blocked from responding to user input
  {metric: "max-potential-fid", type: "scaling"}, // Measures how quickly the browser can respond to the first user interaction
  {metric: "mainthread-work-breakdown", type: "scaling"}, // Time the main thread spends executing JavaScript, rendering, and painting tasks during page load
  {metric: "server-response-time", type: "health"} // Time for the browser to receive the first byte of page content after making the request
];
const websiteUrls = [
  {url: "https://www.example.com", factor: 2},
  {url: "https://www.bing.com/search?q=hotels&rdr=1&rdrig=9CD9B92BAD5040239D3AE448A7A9AABD", factor: 3.5},
  {url: "https://en.m.wikipedia.org/wiki/Cat", factor: 3},
  {url: "https://harrypotter.fandom.com/wiki/Main_Page", factor: 2.5},
  {url: "https://m.youtube.com/watch?v=dQw4w9WgXcQ", factor: 2},
  {url: "https://www.microsoft.com/de-de/", factor: 3}
];

function parseLighthouseMetrics(audits) {
  const lighthouseResult = {};
  for (const {metric} of metrics) {
    lighthouseResult[metric] = Math.trunc(audits[metric].numericValue);
  }

  return lighthouseResult;
}

function getScalingValue(baselineValue) {
  const factor = 1.8;
  const scaling = 4000;
  const transition = 50;
  const dynFactor = factor + (scaling / (baselineValue + transition));
  const normalizedBaseline = baselineValue === 0 ? 1 : baselineValue;

  return Math.round(normalizedBaseline * dynFactor);
}

function getFactorValue(baselineMetric, factor, url) {
  const {metric, median, max} = baselineMetric;
  const {type} = metrics.find(metricObj => metricObj.metric === metric);

  let maxExpectedValue;
  if (type === "factor") {
    maxExpectedValue = median * factor;
  }
  else if (type === "scaling") {
    maxExpectedValue = getScalingValue(median);
  }
  else if (type === "health") {
    maxExpectedValue = max * factor;
  }
  else {
    throw new Error(`Unexpected metric type: ${JSON.stringify({metric, type})}`);
  }

  if (maxExpectedValue < max) {
    maxExpectedValue = max;
    console.warn(`Using max on ${metric} ${url}`);
  }

  return maxExpectedValue;
}

async function saveBaseline(runResults) {
  const baseline = [];

  for (const {url} of websiteUrls) {
    // Because of how we gather lighthouse results we need to group them by URL
    const lighthouseResults = [];
    for (const runResultAllUrls of runResults) {
      const {lighthouseResult} =
        runResultAllUrls.find(urlResult => urlResult.url === url);
      lighthouseResults.push(lighthouseResult);
    }

    const baselineMetrics = [];
    for (const {metric} of metrics) {
      const calculatedMetric =
        calculateMetricBaseline(metric, lighthouseResults);
      baselineMetrics.push(calculatedMetric);
    }

    const urlBaseline = {url, baselineMetrics};
    baseline.push(urlBaseline);
  }

  await fs.promises.writeFile(baselineFilePath, JSON.stringify(
    baseline, null, 2));
  console.log(`Results have been written to ${baselineFilePath}`);
}

async function checkResults(runResults) {
  const baselines = JSON.parse(await fs.promises.readFile(baselineFilePath));
  const errors = [];

  let skipped = 0;
  for (const {url, lighthouseResult} of runResults[0]) {
    const urlBaseline = baselines.find(baseline => baseline.url === url);
    if (!urlBaseline) {
      throw new Error(`Baseline for url ${url} does not exist`);
    }

    const {factor} = websiteUrls.find(link => link.url === url);
    let errorsPerUrl = [];
    for (const {metric} of metrics) {
      const baselineMetric =
        urlBaseline.baselineMetrics.find(result => result.metric === metric);
      const maxExpectedValue = getFactorValue(baselineMetric, factor, url);
      const actualValue = lighthouseResult[metric];

      if (metric === "server-response-time" && actualValue > maxExpectedValue) {
        console.warn(`Skipping performance checks on ${url}. Reason:`, {metric, actualValue, maxExpectedValue});
        errorsPerUrl = [];
        skipped++;
        break;
      }

      if (actualValue > maxExpectedValue) {
        errorsPerUrl.push({metric, actualValue, maxExpectedValue});
      }
    }

    if (errorsPerUrl.length > 0) {
      errors.push({url, errorsPerUrl});
    }
  }

  if (skipped === websiteUrls.length) {
    errors.push("All url checks have been skipped");
  }
  else if (skipped > 0) {
    console.warn(`Skipped url checks: ${skipped}. See logs above for details.`);
  }

  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors, null, 2));
  }

  console.log("Lighthouse tests OK.");
}

export async function waitForPerformanceExtension(driver) {
  console.log("Waiting for performance extension ...");

  await getHandle("/status.html", 25000);
  const elem = await driver.findElement(By.id("status"));
  if ((await elem.getAttribute("errors")) == "true") {
    const errors = [];
    for (const error of await elem.findElements(By.css("ul"))) {
      errors.push(await error.getAttribute("innerText"));
    }
    throw new Error(errors.join("\n"));
  }
}

export async function lighthouseTests(
  isBaselineRun, {browser, version, options}
) {
  const runsPerUrl = isBaselineRun ? baselineRunsPerUrl : 1;
  const title = isBaselineRun ? "Save baseline" : "Tests";

  console.log(`\n--Lighthouse performance: ${title}--`);

  const runResults = [];
  for (let i = 0; i < runsPerUrl; i++) {
    if (runsPerUrl > 1) {
      console.log(`Run ${i + 1} out of ${runsPerUrl} ...`);
    }

    const runResultAllUrls = [];
    for (const {url} of websiteUrls) {
      const audits = await runLighthouse(url);
      const lighthouseResult = parseLighthouseMetrics(audits);
      runResultAllUrls.push({url, lighthouseResult});
    }
    runResults.push(runResultAllUrls);

    if (i !== runsPerUrl - 1) {
      const driver = await getNewDriver(browser, version, options);
      await waitForPerformanceExtension(driver);
    }
  }

  if (isBaselineRun) {
    await saveBaseline(runResults);
  }
  else {
    await checkResults(runResults);
  }
}
