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

import {exec} from "child_process";
import {promisify} from "util";
import path from "path";
import url from "url";

let cwd = path.dirname(url.fileURLToPath(import.meta.url));

(async() => {
  try {
    await promisify(exec)("npm i", {cwd});
    await promisify(exec)("npx webpack", {cwd});
  }
  catch (e) {
    console.error(e);
    process.exit(1);
  }
  console.log("Bundle test OK"); // eslint-disable-line no-console
})();
