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
 * @file Element hiding implementation.
 */

const {domainSuffixes, hasWildcard, matchesWildcards} =
  require("./url");
const {FiltersByDomain, FilterMap} = require("./filtersByDomain");
const {ElemHideExceptions} = require("./elemHideExceptions");

class ElemHide {
  /**
   * @param {ElemHideExceptions} elemHideExceptions The associated element
   *   hiding exceptions.
   */
  constructor(elemHideExceptions) {
    if (!(elemHideExceptions instanceof ElemHideExceptions)) {
      throw new Error("elemHideExceptions must be an ElemHideExceptions");
    }

    /** @type {ElemHideExceptions} */
    this.elemHideExceptions = elemHideExceptions;

    /**
     * Lookup table, active flag, by filter by domain.
     *
     * (Only contains filters that aren't unconditionally matched for all
     * domains.)
     *
     * @type {FiltersByDomain}
     *
     * @private
     */
    this._filtersByDomain = new FiltersByDomain();

    /**
     * Lookup table, active flag, by filter by domain, but only for inline CSS
     * filters.
     *
     * (Only contains filters that aren't unconditionally matched for all
     * domains.)
     *
     * @type {FiltersByDomain}
     *
     * @private
     */
    this._cssFiltersByDomain = new FiltersByDomain();

    /**
     * Lookup table, filter by selector.
     *
     * (Only used for selectors that are unconditionally matched for all
     * domains.)
     *
     * @type {Map.<string, Filter>}
     *
     * @private
     */
    this._filterBySelector = new Map();

    /**
     * Lookup table, filter by selector, but only for inline CSS filters.
     *
     * (Only used for selectors that are unconditionally matched for all
     * domains.)
     *
     * @type {Map.<string, Filter>}
     *
     * @private
     */
    this._cssFilterBySelector = new Map();

    /**
     * Caches the unconditional selectors and inline CSS rules — those that
     * apply on all domains — derived from
     * `{@link module:elemHide~ElemHide#_filterBySelector _filterBySelector}`
     * and
     * `{@link module:elemHide~ElemHide#_cssFilterBySelector
     *          _cssFilterBySelector}`.
     *
     * It will be `null` if the cache needs to be rebuilt.
     *
     * @type {?{selectors: Array.<string>,
     *          inlineCssRules: Array.<{selector: string, css: Object}>}}
     *
     * @private
     */
    this._unconditionalSelectors = null;

    /**
     * The default style sheet that applies on all domains.
     *
     * This is based on the value of
     * `{@link module:elemHide~ElemHide#_unconditionalSelectors
     *         _unconditionalSelectors}`.
     *
     * @type {?string}
     *
     * @private
     */
    this._defaultStyleSheet = null;

    /**
     * The common style sheet that applies on all unknown domains.
     *
     * This is a concatenation of the default style sheet and an additional
     * style sheet based on selectors from all generic filters that are not in
     * the `{@link module:elemHide~ElemHide#_unconditionalSelectors
     *             _unconditionalSelectors}` list.
     *
     * @type {?string}
     *
     * @private
     */
    this._commonStyleSheet = null;

    /**
     * Set containing known element hiding filters
     * @type {Set.<module:filterClasses.ElemHideFilter>}
     * @private
     */
    this._filters = new Set();

    /**
     * All domains known to occur in exceptions
     * @type {Set.<string>}
     * @private
     */
    this._exceptionDomains = new Set();

    /**
     * All domain with wildcards known to occur in exceptions
     * @type {Set<any>}
     * @private
     */
    this._exceptionDomainsWithWildcards = new Set();

    this.elemHideExceptions.on("added", this._onExceptionAdded.bind(this));
  }

  /**
   * Removes all known element hiding filters.
   */
  clear() {
    this._commonStyleSheet = null;

    for (let collection of [this._filtersByDomain,
                            this._cssFiltersByDomain,
                            this._filterBySelector,
                            this._cssFilterBySelector,
                            this._filters,
                            this._exceptionDomains,
                            this._exceptionDomainsWithWildcards]) {
      collection.clear();
    }

    this._unconditionalSelectors = null;
    this._defaultStyleSheet = null;
  }

  /**
   * Add a new element hiding filter.
   * @param {module:filterClasses.ElemHideFilter} filter
   */
  add(filter) {
    if (this._filters.has(filter)) {
      return;
    }

    this._commonStyleSheet = null;

    let {domains, selector, css} = filter;

    const domainSpecific =
      domains || this.elemHideExceptions.hasExceptions(selector);

    if (css != null) {
      if (!domainSpecific) {
        this._cssFilterBySelector.set(selector, filter);
        this._unconditionalSelectors = null;
        this._defaultStyleSheet = null;
      }
      else {
        this._cssFiltersByDomain.add(filter, domains);
      }
    }
    else if (!domainSpecific) {
      // The new filter's selector is unconditionally applied to all domains
      this._filterBySelector.set(selector, filter);
      this._unconditionalSelectors = null;
      this._defaultStyleSheet = null;
    }
    else {
      // The new filter's selector only applies to some domains
      this._filtersByDomain.add(filter, domains);
    }

    this._filters.add(filter);
  }

  /**
   * Removes an existing element hiding filter.
   * @param {module:filterClasses.ElemHideFilter} filter
   */
  remove(filter) {
    if (!this._filters.has(filter)) {
      return;
    }

    this._commonStyleSheet = null;

    let {selector, css} = filter;

    if (css != null) {
      // Unconditionally applied element hiding filters with inline CSS
      if (this._cssFilterBySelector.get(selector) == filter) {
        this._cssFilterBySelector.delete(selector);
        this._unconditionalSelectors = null;
        this._defaultStyleSheet = null;
      }
      // Conditionally applied element hiding filters with inline CSS
      else {
        this._cssFiltersByDomain.remove(filter);
      }
    }
    // Unconditionally applied element hiding filters
    else if (this._filterBySelector.get(selector) == filter) {
      this._filterBySelector.delete(selector);
      this._unconditionalSelectors = null;
      this._defaultStyleSheet = null;
    }
    // Conditionally applied element hiding filters
    else {
      this._filtersByDomain.remove(filter);
    }

    this._filters.delete(filter);
  }

  /**
   * Checks whether an element hiding filter exists.
   * @param {module:filterClasses.ElemHideFilter} filter
   * @returns {boolean}
   */
  has(filter) {
    return this._filters.has(filter);
  }

  /**
   * @typedef {Object} ElemHideStyleSheet
   * @property {string} code CSS code.
   * @property {?Array.<string>} selectors List of selectors.
   * @property {?Array.<string>} exceptions List of exceptions.
   * @property {?Array.<Object>} inlineCssRules List of selectors with inline
   *   CSS bodies.
   * @property {string} inlineCssRules.selector selector
   * @property {Object} inlineCssRules.css CSS body
   */

  /**
   * Returns a style sheet for a given domain based on the current set of
   * filters.
   *
   * @param {string} domain The domain.
   * @param {boolean} [specificOnly=false] Whether selectors from generic
   *   filters should be included.
   * @param {boolean} [includeExceptions=false] Whether the return value should
   *   include a separate list of exceptions.
   *
   * @returns {module:elemHide~ElemHideStyleSheet} An object containing the CSS
   *   code and the list of selectors.
   */
  getStyleSheet(domain, specificOnly = false,
                includeExceptions = false) {
    let code = null;
    let selectors = null;
    let exceptions = null;
    let inlineCssRules = [];

    if (specificOnly) {
      if (includeExceptions) {
        ({selectors, exceptions, inlineCssRules} =
          this._getConditionalSelectorsWithExceptions(domain, true));
      }
      else {
        ({selectors, inlineCssRules} =
          this._getConditionalSelectors(domain, true));
      }

      code = createStyleSheet(selectors, inlineCssRules);
    }
    else {
      let knownSuffix = this._getKnownSuffix(domain);
      let conditionalSelectors = null;
      let conditionalCssRules = null;
      if (includeExceptions) {
        ({selectors: conditionalSelectors, exceptions,
          inlineCssRules: conditionalCssRules} =
          this._getConditionalSelectorsWithExceptions(knownSuffix, false));
      }
      else {
        ({selectors: conditionalSelectors,
          inlineCssRules: conditionalCssRules} =
          this._getConditionalSelectors(knownSuffix, false));
      }
      let {selectors: unconditionalSelectors,
           inlineCssRules: unconditionalCssRules} =
        this._getUnconditionalSelectors();

      code = knownSuffix == "" ? this._getCommonStyleSheet() :
        this._getDefaultStyleSheet() +
        createStyleSheet(conditionalSelectors, conditionalCssRules);

      selectors = unconditionalSelectors.concat(conditionalSelectors);
      inlineCssRules = unconditionalCssRules.concat(conditionalCssRules);
    }

    return {
      code,
      selectors,
      exceptions,
      inlineCssRules
    };
  }

  /**
   * Returns the suffix of the given domain that is known.
   *
   * If no suffix is known, an empty string is returned.
   *
   * @param {?string} domain
   *
   * @returns {string}
   *
   * @private
   */
  _getKnownSuffix(domain) {
    for (let suffix of domainSuffixes(domain)) {
      if (this._filtersByDomain.has(suffix) ||
          this._cssFiltersByDomain.has(suffix) ||
          this._exceptionDomains.has(suffix)) {
        return suffix;
      }

      for (let domainWithWildcards of this._exceptionDomainsWithWildcards) {
        if (matchesWildcards(suffix, domainWithWildcards)) {
          return suffix;
        }
      }
    }

    return "";
  }

  /**
   * Returns selectors and inline CSS rules that apply on each website
   * unconditionally.
   *
   * @returns {{selectors: Array.<string>,
   *            inlineCssRules: Array.<{selector: string, css: Object}>}}
   * @private
   */
  _getUnconditionalSelectors() {
    if (!this._unconditionalSelectors) {
      let inlineCssRules = [];
      for (let filter of this._cssFilterBySelector.values()) {
        inlineCssRules.push({
          selector: filter.selector,
          css: filter.css
        });
      }
      this._unconditionalSelectors = {
        selectors: [...this._filterBySelector.keys()],
        inlineCssRules
      };
    }

    return this._unconditionalSelectors;
  }

  /**
   * Returns the list of selectors and inline CSS rules that apply on a given
   * domain from the subset of filters that do not apply unconditionally on all
   * domains.
   *
   * @param {string} domain The domain.
   * @param {boolean} specificOnly Whether selectors from generic filters should
   *   be included.
   *
   * @returns {{selectors: Array.<string>,
   *            inlineCssRules: Array.<{selector: string, css: Object}>}}
   *
   * @private
   */
  _getConditionalSelectors(domain, specificOnly) {
    let selectors = [];
    let inlineCssRules = [];

    let excluded = new Set();
    let cssExcluded = new Set();

    for (let currentDomain of domainSuffixes(domain, !specificOnly)) {
      let map = this._filtersByDomain.get(currentDomain);
      if (map) {
        for (let [filter, include] of (map instanceof FilterMap ?
          map.entries() : [[map, true]])) {
          if (!include) {
            excluded.add(filter);
          }
          else {
            let {selector} = filter;
            if ((excluded.size == 0 || !excluded.has(filter)) &&
                !this.elemHideExceptions.getException(selector, domain)) {
              selectors.push(selector);
            }
          }
        }
      }

      let cssMap = this._cssFiltersByDomain.get(currentDomain);
      if (cssMap) {
        for (let [filter, include] of (cssMap instanceof FilterMap ?
            cssMap.entries() : [[cssMap, true]])) {
          if (!include) {
            cssExcluded.add(filter);
          }
          else {
            let {selector, css} = filter;
            if ((cssExcluded.size == 0 || !cssExcluded.has(filter)) &&
                !this.elemHideExceptions.getException(selector, domain)) {
              inlineCssRules.push({
                selector,
                css
              });
            }
          }
        }
      }
    }

    return {selectors, inlineCssRules};
  }

  /**
   * Returns the list of selectors, exceptions, and inline CSS rules that apply
   * on a given domain from the subset of filters that do not apply
   * unconditionally on all domains.
   *
   * @param {string} domain The domain.
   * @param {boolean} specificOnly Whether selectors from generic filters should
   *   be included.
   *
   * @returns {{selectors: Array.<string>,
   *            exceptions: Array.<module:filterClasses.ElemHideException>,
   *            inlineCssRules: Array.<{selector: string, css: Object}>}}
   *  An object containing all relevant selectors and exceptions, including
   *  inline CSS rules.
   *
   * @private
   */
  _getConditionalSelectorsWithExceptions(domain, specificOnly) {
    let selectors = [];
    let exceptions = [];
    let inlineCssRules = [];

    let excluded = new Set();
    let cssExcluded = new Set();

    for (let currentDomain of domainSuffixes(domain, !specificOnly)) {
      let map = this._filtersByDomain.get(currentDomain);
      if (map) {
        for (let [filter, include] of (map instanceof FilterMap ?
          map.entries() : [[map, true]])) {
          if (!include) {
            excluded.add(filter);
          }
          else if (excluded.size == 0 || !excluded.has(filter)) {
            let {selector} = filter;
            let exception =
                this.elemHideExceptions.getException(selector, domain);

            if (exception) {
              exceptions.push(exception);
            }
            else {
              selectors.push(selector);
            }
          }
        }
      }

      let cssMap = this._cssFiltersByDomain.get(currentDomain);
      if (cssMap) {
        for (let [filter, include] of (cssMap instanceof FilterMap ?
            cssMap.entries() : [[cssMap, true]])) {
          if (!include) {
            cssExcluded.add(filter);
          }
          else if (cssExcluded.size == 0 || !cssExcluded.has(filter)) {
            let {selector, css} = filter;
            let exception =
              this.elemHideExceptions.getException(selector, domain);

            if (exception) {
              exceptions.push(exception);
            }
            else {
              inlineCssRules.push({
                selector,
                css
              });
            }
          }
        }
      }
    }

    return {selectors, exceptions, inlineCssRules};
  }

  /**
   * Returns the default style sheet that applies on all domains.
   * @returns {string}
   * @private
   */
  _getDefaultStyleSheet() {
    if (!this._defaultStyleSheet) {
      let {selectors, inlineCssRules} = this._getUnconditionalSelectors();
      this._defaultStyleSheet = createStyleSheet(selectors, inlineCssRules);
    }

    return this._defaultStyleSheet;
  }

  /**
   * Returns the common style sheet that applies on all unknown domains.
   * @returns {string}
   * @private
   */
  _getCommonStyleSheet() {
    if (!this._commonStyleSheet) {
      let {selectors, inlineCssRules} = this._getConditionalSelectors("", false);
      this._commonStyleSheet =
        this._getDefaultStyleSheet() +
        createStyleSheet(selectors, inlineCssRules);
    }

    return this._commonStyleSheet;
  }

  _onExceptionAdded(exception) {
    let {domains, selector} = exception;

    this._commonStyleSheet = null;

    if (domains) {
      for (let domain of domains.keys()) {
        // Note: Once an exception domain is known it never becomes unknown,
        // even when all the exceptions containing that domain are removed.
        // This is a best-case optimization.
        if (domain != "") {
          if (hasWildcard(domain)) {
            this._exceptionDomainsWithWildcards.add(domain);
          }
          else {
            this._exceptionDomains.add(domain);
          }
        }
      }
    }

    // If this is the first exception for a previously unconditionally applied
    // element hiding selector we need to take care to update the lookups.
    let unconditionalFilterForSelector = this._filterBySelector.get(selector);
    if (unconditionalFilterForSelector) {
      this._filtersByDomain.add(unconditionalFilterForSelector);
      this._filterBySelector.delete(selector);
      this._unconditionalSelectors = null;
      this._defaultStyleSheet = null;
    }

    let unconditionalCssFilterForSelector =
        this._cssFilterBySelector.get(selector);
    if (unconditionalCssFilterForSelector) {
      this._cssFiltersByDomain.add(unconditionalCssFilterForSelector);
      this._cssFilterBySelector.delete(selector);
      this._unconditionalSelectors = null;
      this._defaultStyleSheet = null;
    }
  }
}

/**
 * Container for element hiding filters.
 */
exports.ElemHide = ElemHide;

/**
 * Yields rules from a style sheet returned by
 * `{@link module:elemHide.createStyleSheet createStyleSheet()}`.
 *
 * @param {string} styleSheet A style sheet returned by
 *   `{@link module:elemHide.createStyleSheet createStyleSheet()}`. If the
 *   given style sheet is *not* a value previously returned by a call to
 *   `{@link module:elemHide.createStyleSheet createStyleSheet()}`, the
 *   behavior is undefined.
 *
 * @generator
 * @yields {string} A rule from the given style sheet.
 */
exports.rulesFromStyleSheet = function* rulesFromStyleSheet(styleSheet) {
  let startIndex = 0;
  while (startIndex < styleSheet.length) {
    let ruleTerminatorIndex = styleSheet.indexOf("\n", startIndex);
    yield styleSheet.substring(startIndex, ruleTerminatorIndex);
    startIndex = ruleTerminatorIndex + 1;
  }
};

/**
 * Escapes curly braces to prevent CSS rule injection.
 *
 * @param {string} selector
 *
 * @returns {string}
 */
function escapeSelector(selector) {
  return selector.replace(/[{}]/g, c => `\\${c.charCodeAt().toString(16)} `);
}

/**
 * Creates an inline CSS rule for a given selector and CSS properties object.
 *
 * Each property value is suffixed with `!important`.
 *
 * @param {string} selector The CSS selector.
 * @param {Object} css Key-value pairs of CSS property names and values.
 *
 * @returns {string} A CSS rule.
 */
function createInlineCSSRule(selector, css) {
  let declarations = Object.entries(css)
    .map(([k, v]) => `${k}: ${v} !important;`)
    .join(" ");
  return createRule(selector, `{${declarations}}`);
}

/**
 * Creates an element hiding CSS rule for a given list of selectors.
 *
 * @param {string} selector The CSS selector for the rule.
 * @param {string} [declarationBlock] Optional CSS code to use as the
 *   declaration block. By default, the code `{display: none !important;}` is
 *   used. If specified, the value is injected as-is into the rule.
 *
 * @returns {string} A CSS rule.
 */
function createRule(
  selector,
  declarationBlock = "{display: none !important;}"
) {
  return `${escapeSelector(selector)} ${declarationBlock}\n`;
}

let createStyleSheet =
/**
 * Creates an element hiding CSS style sheet from a given list of selectors
 * and inline CSS rules.
 *
 * @param {Array.<string>} selectors The list of selectors.
 * @param {Array.<{selector: string, css: Object}>} inlineCssRules List of
 *   inline CSS rules. Each entry produces a rule with per-property
 *   `!important` declarations.
 * @param {string} [declarationBlock] Optional CSS code to use as the
 *   declaration block. By default, the code `{display: none !important;}` is
 *   used. If specified, the value is injected as-is into the style sheet.
 *
 * @returns {string} A CSS style sheet.
 */
exports.createStyleSheet = function createStyleSheet(selectors,
                                                     inlineCssRules,
                                                     declarationBlock) {
  let styleSheet = "";

  for (let selector of selectors) {
    styleSheet += createRule(selector, declarationBlock);
  }

  for (let {selector, css} of inlineCssRules) {
    styleSheet += createInlineCSSRule(selector, css);
  }

  return styleSheet;
};
