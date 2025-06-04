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

import * as ewe from "@eyeo/webext-ad-filtering-solution/content-api";

const flagName = "onboarding_flow";
const flagValue = "test-content-script-flag";
const elemId = "experiments-content-api-test";

const serverLogger = new ewe.telemetry.ServerLogger("test_ewe_content_api");

async function startExperiment() {
  const flag = await ewe.experiments.getFlag(flagName);
  serverLogger.debug("test_got_experiment_flag", {flagName, flag});

  if (flag === flagValue) {
    const div = document.createElement("div");
    div.id = elemId;
    document.body.appendChild(div);
  }

  const allFlags = await ewe.experiments.getFlags();

  for (let key in allFlags) {
    const div = document.createElement("div");
    div.id = key;
    div.innerText = `${key} = ${allFlags[flag]}`;
    document.body.appendChild(div);
  }
}

async function start() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startExperiment);
  }
  else {
    startExperiment();
  }
}

start();
