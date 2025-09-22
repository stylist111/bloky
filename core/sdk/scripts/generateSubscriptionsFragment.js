#!/usr/bin/env node
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

import fs from "fs";
import path from "path";
import {outputDir as convertOutputDir}
  from "./convertSubscriptions.js";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {isMain} from "./utils.js";

const outputDir = path.join("scriptsOutput", "rulesets");
const outputFile = path.join(outputDir, "rulesets.json");

const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

export function isUUID(str) {
  return uuidRegex.test(str);
}

function isValidRulesetFile(file) {
  return isUUID(path.parse(file).base);
}

function generateFragment(dir, pathPrefix, space = 2, defaultEnabled = []) {
  if (!fs.existsSync(dir)) {
    throw new Error(`DNR rules directory (${dir}) does not exist. ` +
      "Run `npm run \"subs-convert\"` to generate it.");
  }

  let files = fs.readdirSync(dir);
  let fragment = {rule_resources: []};
  for (let file of files) {
    if (!isValidRulesetFile(file)) {
      console.warn(`Not ruleset file (${file}) skipped`);
      continue;
    }
    const rulesetId = getRuleId(file);
    fragment.rule_resources.push({
      id: rulesetId,
      enabled: defaultEnabled.includes(rulesetId),
      path: (pathPrefix || "") + getFilePath(file)
    });
  }

  if (fragment.rule_resources.length === 0) {
    console.warn("No static rules generated.");
  }

  return JSON.stringify(fragment, null, space);
}

function getRuleId(file) {
  return path.parse(file).name; // without extension
}

function getFilePath(file) {
  return path.parse(file).base;
}

function main() {
  const args = yargs(hideBin(process.argv))
    .option("input", {
      alias: "i",
      type: "string",
      description: "Input directory"
    })
    .option("output", {
      alias: "o",
      type: "string",
      description: "Output file"
    })
    .option("prefix", {
      alias: "p",
      type: "string",
      description: "Path prefix (to be used in the fragment)"
    })
    .option("default-enabled", {
      alias: "d",
      type: "array",
      description: "List of subscription IDs to enable by default"
    })
    .parse();

  let fromDir = args.input || convertOutputDir;
  let toFile = args.output || outputFile;
  let pathPrefix = args.prefix;
  let defaultEnabled = args["default-enabled"];
  let fragmentJson = generateFragment(fromDir, pathPrefix, 2, defaultEnabled);
  fs.writeFileSync(toFile, fragmentJson);
  console.log(`Web extension manifest fragment file (${toFile}) generated.`);
}

if (isMain(import.meta.url)) {
  try {
    main();
  }
  catch (err) {
    console.error(err);
    process.exit(1);
  }
}

export {generateFragment};
