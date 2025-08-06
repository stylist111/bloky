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
 * along with EWE. If not, see <http://www.gnu.org/licenses/>.
 */

import {exec} from "child_process";
import {promisify} from "util";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";


let cwd = process.cwd();

const commands = [
  "npx eslint --ext js,html,mjs .",
  "npx markdownlint --ignore-path ../../.gitignore ."
];

(async() => {
  const args = yargs(hideBin(process.argv))
    .option("fix", {
      description: "Automatically fix problems",
      boolean: true
    })
    .parse();

  try {
    for (let command of commands) {
      if (args.fix) {
        command += " --fix";
      }

      await promisify(exec)(command, {cwd});
      console.log(`OK: ${command}`);
    }
  }
  catch (err) {
    console.error(`${err.cmd}\n${err.stdout}\n${err.stderr}`);
    process.exit(1);
  }
})();
