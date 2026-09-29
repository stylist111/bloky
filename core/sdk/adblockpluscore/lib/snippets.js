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
 * @file Snippets implementation.
 */

const {parseScript, stringifyScript} = require("./scriptParsing");
const {SnippetExceptions} = require("./snippetExceptions");

/**
 * `{@link module:snippets.snippets snippets}` implementation.
 */
class Snippets {
  /**
   * @param {SnippetExceptions} snippetExceptions The associated snippet
   *   exceptions.
   */
  constructor(snippetExceptions) {
    if (!(snippetExceptions instanceof SnippetExceptions)) {
      throw new Error("snippetExceptions must be a SnippetExceptions");
    }

    /** @type {SnippetExceptions} */
    this.snippetExceptions = snippetExceptions;

    /**
     * All known snippet filters.
     * @type {Set.<module:filterClasses.SnippetFilter>}
     * @private
     */
    this._filters = new Set();
  }

  /**
   * Removes all known snippet filters.
   */
  clear() {
    let {_filters} = this;

    if (_filters.size == 0) {
      return;
    }

    _filters.clear();
  }

  /**
   * Adds a new snippet filter.
   * @param {module:filterClasses.SnippetFilter} filter
   */
  add(filter) {
    this._filters.add(filter);
  }

  /**
   * Removes an existing snippet filter.
   * @param {module:filterClasses.SnippetFilter} filter
   */
  remove(filter) {
    this._filters.delete(filter);
  }

  /**
   * Checks whether a snippet filter exists.
   * @param {module:filterClasses.SnippetFilter} filter
   * @returns {boolean}
   */
  has(filter) {
    return this._filters.has(filter);
  }

  /**
   * Returns a list of all snippet filters active on the given domain,
   * with any commands disabled by a matching snippet exception removed
   * from their scripts.
   * @param {string} domain The domain.
   * @returns {Array.<module:filterClasses.SnippetFilter>} A list of snippet
   *   filters. Filters whose script is only partially disabled are
   *   represented by objects inheriting from the original filter, with the
   *   remaining commands as their script.
   */
  getFilters(domain) {
    let result = [];
    let hasExceptions = this.snippetExceptions.size > 0;

    for (let filter of this._filters) {
      if (!filter.isActiveOnDomain(domain)) {
        continue;
      }

      if (!hasExceptions) {
        result.push(filter);
        continue;
      }

      let commands = parseScript(filter.script);
      let remaining = commands.filter(
        command => !this.snippetExceptions.getException(command, domain)
      );

      if (remaining.length == commands.length) {
        result.push(filter);
      }
      else if (remaining.length > 0) {
        // Constructing a SnippetFilter here isn't possible without a
        // circular dependency on filterClasses, so the partially disabled
        // filter is represented by an object inheriting from the original
        // filter. This also keeps the original filter's text, e.g. for hit
        // logging.
        let partial = Object.create(filter);
        partial.body = stringifyScript(remaining);
        result.push(partial);
      }
    }

    return result;
  }

  /**
   * Returns a list of all snippet filters active on the given domain.
   * @param {string} domain The domain.
   * @returns {Array.<module:filterClasses.SnippetFilter>} A list of snippet
   *   filters.
   *
   * @deprecated Use <code>{@link module:snippets~Snippets#getFilters}</code>
   *   instead.
   * @see module:snippets~Snippets#getFilters
   */
  getFiltersForDomain(domain) {
    return this.getFilters(domain);
  }
}

/**
 * Container for snippet filters.
 */
exports.Snippets = Snippets;

/**
 * Compiles a script against a given list of libraries, passed as JSON
 * serialized string, or a an array of strings, into executable code.
 * @param {string|Array.<string>} scripts One or more scripts to convert into
 *  executable code.
 * @param {string} isolatedSnippetsLibrary The stringified bundle to be executed
 * in the isolated content script context.
 * @param {string} injectedSnippetsLibrary The stringified bundle to be injected
 * and executed in the main context.
 * @param {string|Array.<string>} injectedSnippetsList An array containing the
 * available injectable snippets.
 * @param {object} [environment] An object containing environment variables.
 * @returns {string} Executable code.
 */
exports.compileScript = function compileScript(scripts,
                                               isolatedSnippetsLibrary,
                                               injectedSnippetsLibrary,
                                               injectedSnippetsList,
                                               environment = {}) {
  let isolatedLib = JSON.stringify(isolatedSnippetsLibrary);
  let injectedLib = JSON.stringify(injectedSnippetsLibrary);
  let jsonEnv = JSON.stringify(environment);
  return `
    "use strict";
    (() => 
    {
      let scripts = ${JSON.stringify([].concat(scripts).map(parseScript))};

      let isolatedLib = ${isolatedLib};
      let imports = Object.create(null);
      let injectedSnippetsCount = 0;
      let loadLibrary = new Function("exports", "environment", isolatedLib);
      loadLibrary(imports, ${jsonEnv});
      const isolatedSnippets = imports.snippets;

      let injectedLib = ${injectedLib};
      let injectedSnippetsList = ${JSON.stringify(injectedSnippetsList)};
      let executable = "(() => {";
      executable += "let environment = ${jsonEnv.replace(/[\\"]/g, "\\$&")};";
      executable += injectedLib;

      let {hasOwnProperty} = Object.prototype;
      for (let script of scripts)
      {
        for (let [name, ...args] of script)
        {
          if (hasOwnProperty.call(isolatedSnippets, name))
          {
            let value = isolatedSnippets[name];
            if (typeof value == "function")
              value(...args);
          }
          if (injectedSnippetsList.includes(name))
          {
            executable += stringifyFunctionCall(name, ...args);
            injectedSnippetsCount++;
          }
        }
      }

      executable += "})();";

      if (injectedSnippetsCount > 0)
        injectSnippetsInMainContext(executable);

      function stringifyFunctionCall(func, ...params)
      {
        // Call JSON.stringify on the arguments to avoid any arbitrary code
        // execution.
        const f = "snippets['" + func + "']";
        const parameters = params.map(JSON.stringify).join(",");
        return f + "(" + parameters + ");";
      }

      function injectSnippetsInMainContext(exec)
      {
        // injecting phase
        let script = document.createElement("script");
        script.type = "application/javascript";
        script.async = false;

        // Firefox 58 only bypasses site CSPs when assigning to 'src',
        // while Chrome 67 and Microsoft Edge (tested on 44.17763.1.0)
        // only bypass site CSPs when using 'textContent'.
        if (typeof netscape != "undefined" && typeof browser != "undefined")
        {
          let url = URL.createObjectURL(new Blob([exec]));
          script.src = url;
          document.documentElement.appendChild(script);
          URL.revokeObjectURL(url);
        }
        else
        {
          script.textContent = exec;
          document.documentElement.appendChild(script);
        }

        document.documentElement.removeChild(script);
      }
    })();
  `;
};

/**
 * Prepares an inline script for injecting code into the main context.
 * This is necessary when `browser.scripting` is not available.
 * tabs.executeScript does not allow injecting scripts to main context.
 * So we resort to creating an inline script element.
 *
 * @param {any} codeToInject The code to be injected
 * @param {Array<any>} params Parameters to be passed to the injected code
 * @returns {string} The executable code to be injected
 */
exports.prepareInlineScriptForInjection =
  function prepareInlineScriptForInjection(codeToInject, ...params) {
    const args = JSON.stringify(params);
    // stringify injectedLib to escape backticks
    let code = JSON.stringify(codeToInject.toString());
    code = `"(${code.slice(1, -1)}).apply(null,${JSON.stringify(args).slice(1, -1)});"`;
    let executable =
      `function injectScriptInMainContext(executable)
        {
          // injecting phases
          let script = document.createElement("script");
          script.type = "application/javascript";
          script.async = false;

          // Firefox 58 only bypasses site CSPs when assigning to 'src',
          // while Chrome 67 and Microsoft Edge (tested on 44.17763.1.0)
          // only bypass site CSPs when using 'textContent'.
          if (typeof netscape != "undefined" && typeof browser != "undefined")
          {
            let url = URL.createObjectURL(new Blob([executable]));
            script.src = url;
            document.documentElement.appendChild(script);
            URL.revokeObjectURL(url);
          }
          else
          {
            script.textContent = executable;
            document.documentElement.appendChild(script);
          }

          document.documentElement.removeChild(script);
        };
        {
          const executable = ${code};
          injectScriptInMainContext(executable);
        }`;
    return executable;
  };
