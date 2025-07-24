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

import {runCommand} from "../utils.js";

export async function run() {
  if (!process.platform === "darwin") {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  await runCommand("npx webpack -c ./scripts/safari/webpack.config.js --entry ./test/extension-safari/index.js");
  await runCommand("./scripts/safari/build-test-app.sh");
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
