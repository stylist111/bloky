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

const {hasWildcard, matchesWildcards} = require("./url");

/**
 * Map to be used instead when a filter has a blank `domains` property.
 * @type {Map.<string, boolean>}
 */
let defaultDomains = new Map([["", true]]);

let FilterMap =
/**
 * A `FilterMap` object contains a set of filters, each mapped to a boolean
 * value indicating whether the filter should be applied.
 *
 * It is used by
 * `{@link module:filtersByDomain.FiltersByDomain FiltersByDomain}`.
 *
 * @package
 */
exports.FilterMap = class FilterMap extends Map {};

/**
 * A `FiltersByDomain` object contains a set of domains, each mapped to a set
 * of filters along with a boolean value for each filter indicating whether the
 * filter should be applied to the domain.
 *
 * @package
 */
exports.FiltersByDomain = class FiltersByDomain {
  constructor(source) {
    // We keep concrete domains list (eg. "example.com") in `exactDomains` map
    // and the domain with wildcards in internal `domainsWithWildcards` map
    // because of different way of matching.
    // `Map` uses "equals" implementation for `get()` and for
    // wildcarded matching implementation we need to iterate existing entries
    // and call our own `matchesWildcards(..)` implementation.
    // So at filter adding to add it to the according map and override all the
    // relevant methods (has, get) to run the wildcards-related logic.
    this.domainsWithWildcards = new Map();
    this.exactDomains = new Map(source);
  }

  get size() {
    return this.exactDomains.size;
  }

  entries() {
    return this.exactDomains.entries();
  }

  /**
   * Adds a filter and all of its domains to the object.
   *
   * @param {module:filterClasses.ActiveFilter} filter The filter.
   * @param {Map.<string, boolean>} [domains] The filter's domains. If not
   *   given, the `{@link module:filterClasses.ActiveFilter#domains domains}`
   *   property of `filter` is used.
   */
  add(filter, domains = filter.domains) {
    for (let [domain, include] of domains || defaultDomains) {
      if (!include && domain == "") {
        continue;
      }

      if (hasWildcard(domain)) {
        this._addToMap(filter, domain, include, this.domainsWithWildcards);
      }
      else {
        this._addToMap(filter, domain, include, this.exactDomains);
      }
    }
  }

  _addToMap(filter, domain, include, toMap) {
    let map = toMap.get(domain, true);
    if (!map) {
      toMap.set(domain, include ? filter : new FilterMap([[filter, false]]));
    }
    else if (map.size == 1 && !(map instanceof FilterMap)) {
      if (filter != map) {
        toMap.set(domain, new FilterMap([[map, true], [filter, include]]));
      }
    }
    else {
      map.set(filter, include);
    }
  }

  has(domain) {
    let result = this.exactDomains.has(domain);
    if (!result) {
      // no filters for the concrete domain
      for (let domainWithWildcards of this.domainsWithWildcards.keys()) {
        if (matchesWildcards(domain, domainWithWildcards)) {
          result = true;
          break;
        }
      }
    }
    return result;
  }

  get(domain, skipWildcardCheck) {
    let result = [];
    let map = this.exactDomains.get(domain);
    if (map) {
      result.push(map);
    }

    if (!skipWildcardCheck) {
      for (let [domainWithWildcards, filterOrMap] of
        this.domainsWithWildcards.entries()) {
        if (matchesWildcards(domain, domainWithWildcards)) {
          result.push(filterOrMap);
        }
      }
    }

    if (result.length == 0) {
      result = void 0;
    }
    else if (result.length == 1) {
      result = result[0];
    }
    else {
      // merge the results
      let mergedMap = new FilterMap();
      for (let filterOrMap of result) {
        let fromMap = (filterOrMap instanceof Map ?
          filterOrMap : new Map([[filterOrMap, true]]));

        for (let [filter, isIncluded] of fromMap.entries()) {
          mergedMap.set(filter, isIncluded);
        }
      }
      result = mergedMap;
    }

    return result;
  }

  clear() {
    this.domainsWithWildcards.clear();
    this.exactDomains.clear();
  }

  /**
   * Removes a filter and all of its domains from the object.
   *
   * @param {module:filterClasses.ActiveFilter} filter The filter.
   * @param {Map.<string, boolean>} [domains] The filter's domains. If not
   *   given, the `{@link module:filterClasses.ActiveFilter#domains domains}`
   *   property of `filter` is used.
   */
  remove(filter, domains = filter.domains) {
    for (let domain of (domains || defaultDomains).keys()) {
      if (hasWildcard(domain)) {
        this._removeFromMap(filter, domain, this.domainsWithWildcards);
      }
      else {
        this._removeFromMap(filter, domain, this.exactDomains);
      }
    }
  }

  _removeFromMap(filter, domain, fromMap) {
    let map = fromMap.get(domain);
    if (map) {
      if (map.size > 1 || map instanceof FilterMap) {
        map.delete(filter);

        if (map.size == 0) {
          fromMap.delete(domain);
        }
        else if (map.size == 1) {
          for (let [lastFilter, include] of map.entries()) {
            // Reduce Map { "example.com" => Map { filter => true } } to
            // Map { "example.com" => filter }
            if (include) {
              fromMap.set(domain, lastFilter);
            }

            break;
          }
        }
      }
      else if (filter == map) {
        fromMap.delete(domain);
      }
    }
  }
};
