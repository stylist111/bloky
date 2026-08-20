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

import dependencySnippets from "@eyeo/snippets/isolated/heavy";

// dependencySnippets can't cross the `func`/`code` injection boundary: it's
// too large to pass via `args`, and holds functions, which aren't
// structured-cloneable, so closures can't carry it either. Loading it as a
// real file is the only way to get it into the isolated world at all.
// Exposing a single global here lets the separately injected caller reach
// it with plain, serializable arguments instead.
// See background/content-filter.js's injectHeavySnippets().
globalThis.eweRunHeavySnippets = (names, environment, scripts) => {
  for (const name of names) {
    const dependency = dependencySnippets.get(name);
    if (dependency) {
      try {
        dependency.call(globalThis);
      }
      catch (e) {
        // Do not let one dependency's registration failure prevent
        // other dependencies from registering.
      }
    }
  }
  dependencySnippets(environment, ...scripts);
};
