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

// the path is relative to adblockpluscore
import {OUTPUT_DIR as inputDir}
  from "./fetchSubscriptions.js";
import {processFile} from "adblockpluscore/scripts/text2dnr.js";
import {createConverter} from "adblockpluscore/lib/dnr/index.js";
import fs from "fs";
import path from "path";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

const outputDir = path.join("scriptsOutput", "rulesets");

let highestRuleId = 1;

function generateRuleId() {
  return highestRuleId++;
}

async function addRuleId(filename) {
  const encoding = "utf-8";
  let json = fs.readFileSync(filename, {encoding});
  let rules = JSON.parse(json);
  for (let rule of rules)
    rule["id"] = generateRuleId();
  json = JSON.stringify(rules, null, 2);
  await fs.promises.unlink(filename);
  fs.writeFileSync(filename, json, {encoding});
}

async function convert(inDir, outDir) {
  let files = fs.readdirSync(inDir);
  if (!fs.existsSync(outDir))
    fs.mkdirSync(outDir, {recursive: true});

  let converter = createConverter({
    modifyRule(rule) {
      if (rule.condition.regexFilter) {
        console.warn(`Skipping regex rule ${rule.condition.regexFilter}..`);
        return Error("Regex rules are temporarily disabled.");
      }
      return rule;
    }
  });
  for (let inFile of files) {
    let inFileAbs = path.join(inDir, inFile);
    let outFileAbs = path.join(outDir, path.parse(inFile).base);
    console.log(`Converting ${inFileAbs} to ${outFileAbs} ...`);
    await processFile(converter, inFileAbs, outFileAbs);
    await addRuleId(outFileAbs);
  }
}

async function main() {
  const args = yargs(hideBin(process.argv))
    .option("input", {
      alias: "i",
      type: "string",
      requiresArg: true,
      description: "Input directory"
    })
    .option("output", {
      alias: "o",
      type: "string",
      requiresArg: true,
      description: "Output directory"
    })
    .parse();

  let inDir = args.input || inputDir;
  let outDir = args.output || outputDir;
  await convert(inDir, outDir);
}

let proc = process.argv[1];
let stats = fs.statSync(proc);
if (stats.isSymbolicLink)
  proc = fs.realpathSync(proc);
if (import.meta.url === `file://${proc}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export {outputDir};
export {convert};
