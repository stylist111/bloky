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

import lighthouse from "lighthouse";
import { remoteDebuggingPort } from "../sdk-runner/driver.js";

export async function runLighthouse(url) {
  const options = {
    logLevel: "silent",
    output: "json",
    onlyCategories: ["performance"],
    port: remoteDebuggingPort,
  };

  console.log(`Running lighthouse on ${url}`);
  const { lhr } = await lighthouse(url, options);
  const { runWarnings, audits } = lhr;

  if (runWarnings.length > 0) {
    console.warn({ runWarnings });
  }

  return audits;
}

function getMedian(values) {
  return values.length % 2 !== 0
    ? values[Math.floor(values.length / 2)]
    : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
}

export function calculateMetricBaseline(metric, lighthouseResults) {
  const values = [];
  let total = 0;

  for (const lighthouseResult of lighthouseResults) {
    const value = lighthouseResult[metric];

    if (value === null) {
      console.warn("Skipping a value in calculateMetricBaseline:", { metric, value });
      continue;
    }

    total += value;
    values.push(value);
  }
  values.sort((a, b) => a - b);

  return {
    metric,
    min: values[0],
    max: values[values.length - 1],
    average: Math.round(total / values.length),
    median: getMedian(values),
  };
}
