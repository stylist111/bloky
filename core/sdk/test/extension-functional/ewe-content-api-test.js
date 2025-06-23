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

const serverLogger = new ewe.telemetry.ServerLogger("test_ewe_content_api");

async function startExperiment() {
  const flag = await ewe.experiments.getFlag(flagName);
  const flags = await ewe.experiments.getFlags();
  const assignments = await ewe.experiments.getAssignments();
  serverLogger.debug("test_got_experiment_flag", {flagName, flag});

  const div = document.createElement("div");
  div.id = "experiments-api-test";

  div.setAttribute("data-get-flag", JSON.stringify(flagValue));
  div.setAttribute("data-get-flags", JSON.stringify(flags));
  div.setAttribute("data-get-assignments", JSON.stringify(assignments));

  document.body.appendChild(div);
}

async function start() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startExperiment);
  }
  else {
    void startExperiment();
  }
}

void start();
