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

/** @module */

"use strict";

/**
 * @file Parsing of snippet filter scripts.
 */

let singleCharacterEscapes = new Map([
  ["n", "\n"], ["r", "\r"], ["t", "\t"]
]);

/**
 * Parses a script and returns a list of all its commands and their arguments.
 * @param {string} script The script.
 * @returns {Array.<string[]>} A list of commands and their arguments.
 * @package
 */
exports.parseScript = function parseScript(script) {
  let tree = [];

  let escape = false;
  let withinQuotes = false;

  let unicodeEscape = null;

  let quotesClosed = false;

  let call = [];
  let argument = "";

  for (let character of script.trim() + ";") {
    let afterQuotesClosed = quotesClosed;
    quotesClosed = false;

    if (unicodeEscape != null) {
      unicodeEscape += character;

      if (unicodeEscape.length == 4) {
        let codePoint = parseInt(unicodeEscape, 16);
        if (!isNaN(codePoint)) {
          argument += String.fromCodePoint(codePoint);
        }

        unicodeEscape = null;
      }
    }
    else if (escape) {
      escape = false;

      if (character == "u") {
        unicodeEscape = "";
      }
      else {
        argument += singleCharacterEscapes.get(character) || character;
      }
    }
    else if (character == "\\") {
      escape = true;
    }
    else if (character == "'") {
      withinQuotes = !withinQuotes;

      if (!withinQuotes) {
        quotesClosed = true;
      }
    }
    else if (withinQuotes || character != ";" && !/\s/.test(character)) {
      argument += character;
    }
    else {
      if (argument || afterQuotesClosed) {
        call.push(argument);
        argument = "";
      }

      if (character == ";" && call.length > 0) {
        tree.push(call);
        call = [];
      }
    }
  }

  return tree;
};

function quoteArgument(argument) {
  return "'" + argument.replace(/([\\'])/g, "\\$1") + "'";
}

/**
 * Converts a list of parsed commands and their arguments, as returned by
 * `{@link module:scriptParsing.parseScript parseScript()}`, back into a
 * script.
 *
 * `parseScript()` is lossy: it removes the quoting and escaping from the
 * original script text, which snippet exceptions rely on to match commands
 * regardless of how their arguments are spelled. When only some commands of
 * a snippet filter are disabled by exceptions, the remaining parsed commands
 * must be converted back into a script, with any quoting and escaping
 * restored, because a filter's script is text that is parsed again later,
 * e.g. by content scripts. The result parses back to the given commands:
 * `parseScript(stringifyScript(script))` is equivalent to `script`.
 *
 * @param {Array.<string[]>} script A list of commands and their arguments.
 * @returns {string} The script.
 * @package
 */
exports.stringifyScript = function stringifyScript(script) {
  return script.map(command => command.map(quoteArgument).join(" "))
    .join("; ");
};
