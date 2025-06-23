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

import fs from "fs";
import path from "path";

import {cleanup} from "./clean-mv3-files.js";
import {isMain} from "./utils.js";
import {commonRun} from "./prepare-mv3-common.js";

import {subAntiCVLive, subEasylistLive, subAcceptableAdsLive} from "../test/fixtures/subscriptions.js";

async function run() {
  const scriptsOutputDir = path.join(process.cwd(), "scriptsOutput", "performance-mv3");
  const subsInput = path.join(scriptsOutputDir, "custom-mv3-subscriptions.json");

  await cleanup(scriptsOutputDir);

  const subs = [subAntiCVLive, subEasylistLive, subAcceptableAdsLive];
  await fs.promises.writeFile(subsInput, JSON.stringify(subs, null, 2), {encoding: "utf-8"});

  await commonRun(subsInput, scriptsOutputDir);
}

if (isMain(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
