/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

let {readFile, writeFile} = require("fs/promises");
let process = require("process");

let yargs = require("yargs");
let {hideBin} = require("yargs/helpers");

let {createConverter} = require("../lib/dnr/index.js");
let {normalize} = require("../lib/filters/index.js");
let {parseFilterList} = require("../lib/filters/lists.js");

const ENCODING = {encoding: "utf-8"};

/**
 * @typedef {Object} FilterListContent
 * @property {Array.<Object>} rules The DNR rules.
 * @property {Array.<Array.<string, [number]>>} dnrMap The DNR map entries
 *    as key value pairs of the filter text and the rule ids.
 */
/**
 * Process the filter list content
 *
 * @param {Object} converter The converter for the rules.
 * @param {Array.<string>} lines The content of the filter
 *   list as lines.
 * @return {FilterListContent} An object containing the rules and the
 *   DNR map.
 *
 * @ignore
 */
async function processContent(converter, lines) {
  lines.shift();
  let dnrMap = [];
  let rules = [];

  for (let filter of lines) {
    let normalized = normalize(filter);
    let newRules = await converter(normalized);
    if (Array.isArray(newRules) && newRules.length > 0) {
      let ids = newRules.map(r => r.id);
      dnrMap.push([normalized, ids]);

      for (let rule of newRules) {
        if (!(rule instanceof Error)) {
          rules.push(rule);
        }
      }
    }
  }

  return {
    rules,
    dnrMap
  };
}

function parseArgs(cliArgv) {
  const args = yargs(hideBin(cliArgv))
        .scriptName("text2dnr")
        .usage("Usage: $0 [-o output] <inputfile>")
        .option("o", {
          alias: "output",
          describe: "Output file",
          type: "string",
          requiresArg: true
        })
        .check((argv, options) => {
          if (argv._.length != 1) {
            throw new Error("Exactly one filename is needed.\n");
          }
          else if (argv.output == "") {
            throw new Error("Output filename must be specified.\n");
          }
          else {
            return true;
          }
        })
        .exitProcess(false)
        .help();

  let outputfile = args.argv.output;
  let filename = args.argv._[0];

  return {filename, outputfile};
}

async function readAndProcessFile(converter, filename, outputfile) {
  let fileContent = await readFile(filename, ENCODING);
  let {error, lines} = await parseFilterList(fileContent);
  if (error) {
    throw new Error(error);
  }

  return await processFile(converter, lines, outputfile);
}

async function processFile(converter, lines, outputfile, spaces = 2) {
  let results = await processContent(converter, lines);
  if (typeof outputfile != "undefined") {
    await writeFile(
      outputfile,
      JSON.stringify(results.rules, null, spaces),
      ENCODING
    );
    await writeFile(
      outputfile + ".map",
      JSON.stringify(results.dnrMap, null, spaces),
      ENCODING
    );
  }
  else {
    process.stdout.write(JSON.stringify(results, null, spaces));
  }

  return results.rules.length;
}

async function main() {
  let {filename, outputfile} = parseArgs(process.argv);
  await readAndProcessFile(createConverter({}), filename, outputfile);
}


if (require.main == module) {
  main().catch(err => {
    console.error(err);
    process.exit(255);
  });
}


exports.parseArgs = parseArgs;
exports.processFile = processFile;
exports.readAndProcessFile = readAndProcessFile;
