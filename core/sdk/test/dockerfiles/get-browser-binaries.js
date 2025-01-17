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
import {BROWSERS} from "@eyeo/get-browser-binary";
import yargs from "yargs";

async function getBrowserBinary() {
  let parser = yargs(process.argv.slice(2));
  parser.version(false);
  parser.strict();
  parser.command("$0 <browser> [version]", "", subparser => {
    subparser.positional("browser", {choices: Object.keys(BROWSERS)});
    subparser.positional("version", {type: "string"});
  });
  let {argv} = parser;
  let browser = argv.browser;
  let version = argv.version;
  await BROWSERS[browser].installBrowser(version);
  // eslint-disable-next-line no-console
  console.log(`Browser ${browser} cached `);
}

getBrowserBinary().catch(err => {
  console.error(err instanceof Error ? err.stack : `Error: ${err}`);
});
