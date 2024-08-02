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

/** @module */

const {contentTypes} = require("../contentTypes");
const {resources} = require("../../data/resources.js");

// We differentiate generic rules from specific ones in order to support the
// conversion of $genericblock exception filters. Since with the
// declarativeNetRequest API "allow" rules take priority over "allowAllRequest"
// rules, we also need to take care to give "allowAllRequest" rules a slighlty
// higher priority.
const GENERIC_PRIORITY = 1000;
exports.GENERIC_PRIORITY = GENERIC_PRIORITY;
const GENERIC_ALLOW_ALL_PRIORITY = 1001;
exports.GENERIC_ALLOW_ALL_PRIORITY = GENERIC_ALLOW_ALL_PRIORITY;
const SPECIFIC_PRIORITY = 2000;
exports.SPECIFIC_PRIORITY = SPECIFIC_PRIORITY;
const SPECIFIC_ALLOW_ALL_PRIORITY = 2001;
exports.SPECIFIC_ALLOW_ALL_PRIORITY = SPECIFIC_ALLOW_ALL_PRIORITY;


const requestTypes = new Map([
  [contentTypes.OTHER, ["other", "csp_report"]],
  [contentTypes.SCRIPT, ["script"]],
  [contentTypes.IMAGE, ["image"]],
  [contentTypes.STYLESHEET, ["stylesheet"]],
  [contentTypes.OBJECT, ["object"]],
  [contentTypes.SUBDOCUMENT, ["sub_frame"]],
  [contentTypes.WEBSOCKET, ["websocket"]],
  [contentTypes.WEBBUNDLE, ["webbundle"]],
  [contentTypes.PING, ["ping"]],
  [contentTypes.XMLHTTPREQUEST, ["xmlhttprequest"]],
  [contentTypes.MEDIA, ["media"]],
  [contentTypes.FONT, ["font"]]
]);
exports.requestTypes = requestTypes;

const supportedRequestTypes = Array.from(requestTypes.keys())
                                   .reduce(((srt, t) => srt | t));
exports.supportedRequestTypes = supportedRequestTypes;

function getResourceTypes(filterContentType) {
  // The default is to match everything except "main_frame", which is fine.
  if ((filterContentType & supportedRequestTypes) == supportedRequestTypes) {
    return;
  }

  let result = [];

  for (let [mask, types] of requestTypes) {
    if (filterContentType & mask) {
      result = result.concat(types);
    }
  }

  return result;
}

function getDomains(filterDomains) {
  let domains = [];
  let excludedDomains = [];
  let isGenericFilter = true;

  if (filterDomains) {
    for (let [domain, enabled] of filterDomains) {
      if (domain == "") {
        isGenericFilter = enabled;
      }
      else {
        (enabled ? domains : excludedDomains).push(domain);
      }
    }
  }

  return {domains, excludedDomains, isGenericFilter};
}

function getConditions(filter, urlFilter, resourceTypes, matchCase) {
  let baseCondition = {};

  if (urlFilter) {
    baseCondition.urlFilter = urlFilter;
  }
  else if (filter.regexp) {
    baseCondition.regexFilter = filter.regexp.source;
  }

  // Before Chromium 118, the default for isUrlFilterCaseSensitive is true. From
  // Chromium 118, the default is false. If we at some point make our minimum
  // supported Chromium 118, then we can leave this undefined if !matchCase.
  baseCondition.isUrlFilterCaseSensitive = matchCase;

  if (filter.thirdParty != null) {
    baseCondition.domainType = filter.thirdParty ? "thirdParty" : "firstParty";
  }

  let {domains, excludedDomains, isGenericFilter} = getDomains(filter.domains);

  let conditions = [];

  if (resourceTypes && (domains.length || excludedDomains.length)) {
    let mainFrameResourceTypes = resourceTypes.filter(t => t == "main_frame");
    let otherResourceTypes = resourceTypes.filter(t => t != "main_frame");

    if (mainFrameResourceTypes.length) {
      let condition = {
        resourceTypes: mainFrameResourceTypes,
        ...baseCondition
      };

      if (domains.length) {
        condition.requestDomains = domains;
      }
      if (excludedDomains.length) {
        condition.excludedRequestDomains = excludedDomains;
      }

      conditions.push(condition);
    }

    if (otherResourceTypes.length) {
      let condition = {
        resourceTypes: otherResourceTypes,
        ...baseCondition
      };

      if (domains.length) {
        condition.initiatorDomains = domains;
      }
      if (excludedDomains.length) {
        condition.excludedInitiatorDomains = excludedDomains;
      }

      conditions.push(condition);
    }
  }
  else {
    let condition = {
      ...baseCondition
    };

    if (resourceTypes) {
      condition.resourceTypes = resourceTypes;
    }
    if (domains.length) {
      condition.initiatorDomains = domains;
    }
    if (excludedDomains.length) {
      condition.excludedInitiatorDomains = excludedDomains;
    }

    conditions.push(condition);
  }

  return {conditions, isGenericFilter};
}

exports.generateRedirectRules = function(filter, urlFilter, matchCase) {
  let url = resources[filter.rewrite];

  // We can't generate rules for unknown abp-resources...
  if (!url) {
    return [];
  }

  let resourceTypes = getResourceTypes(filter.contentType);

  // We can't generate rules for filters which don't include any supported
  // resource types.
  if (resourceTypes && resourceTypes.length == 0) {
    return [];
  }

  let {conditions, isGenericFilter} = getConditions(
    filter, urlFilter, resourceTypes, matchCase
  );

  return conditions.map(condition => {
    return {
      priority: isGenericFilter ? GENERIC_PRIORITY : SPECIFIC_PRIORITY,
      condition,
      action: {
        type: "redirect",
        redirect: {url}
      }
    };
  });
};

exports.generateCSPRules = function(filter, urlFilter, matchCase) {
  let {conditions, isGenericFilter} = getConditions(
    filter, urlFilter, ["main_frame", "sub_frame"], matchCase
  );

  let rules;

  if (!filter.blocking) {
    // The DNR makes no distinction between CSP rules and main_frame/sub_frame
    // rules. Ideally, we would give CSP rules a different priority therefore,
    // to ensure that a $csp exception filter would not accidentally allowlist
    // the whole website. Unfortunately, I don't think that's possible if we are
    // to also support the distinction between specific and generic rules.
    //   Luckily, we are adding an "allow" rule (not "allowAllRequest") here and
    // there is no such thing as a blocking filter which applies to the
    // $document (main_frame), so we don't have to worry about that. There is
    // such a thing as a $subdocument blocking filter though, which a $csp
    // exception filter should not usually affect.
    //   As a compromise in order to support both $csp and $genericblock, we
    // accept that $csp exception filters might wrongly prevent frame-blocking
    // filters from matching. If this compromise proves problematic, we might
    // need to reconsider this in the future.
    rules = conditions.map(condition => {
      return {
        action: {
          type: "allow"
        },
        condition,
        priority: filter.contentType & contentTypes.GENERICBLOCK ?
          GENERIC_PRIORITY : SPECIFIC_PRIORITY
      };
    });
  }
  else {
    rules = conditions.map(condition => {
      return {
        action: {
          type: "modifyHeaders",
          responseHeaders: [{
            header: "Content-Security-Policy",
            operation: "append",
            value: filter.csp
          }]
        },
        condition,
        priority: isGenericFilter ? GENERIC_PRIORITY : SPECIFIC_PRIORITY
      };
    });
  }

  return rules;
};

exports.generateBlockingRules = function(filter, urlFilter, matchCase) {
  let resourceTypes = getResourceTypes(filter.contentType);

  // We can't generate rules for filters which don't include any supported
  // resource types.
  if (resourceTypes && resourceTypes.length == 0) {
    return [];
  }

  let {conditions, isGenericFilter} = getConditions(
    filter, urlFilter, resourceTypes, matchCase
  );

  return conditions.map(condition => {
    return {
      priority: isGenericFilter ? GENERIC_PRIORITY : SPECIFIC_PRIORITY,
      condition,
      action: {
        type: "block"
      }
    };
  });
};

exports.generateAllowingRules = function(filter, urlFilter, matchCase) {
  let rules = [];
  let {contentType} = filter;

  let genericBlock = contentType & contentTypes.GENERICBLOCK;

  if (contentType & contentTypes.DOCUMENT || genericBlock) {
    contentType &= ~contentTypes.SUBDOCUMENT;

    let {conditions} = getConditions(filter,
                                     urlFilter,
                                     ["main_frame", "sub_frame"],
                                     matchCase);

    for (let condition of conditions) {
      rules.push({
        priority: genericBlock ?
          GENERIC_ALLOW_ALL_PRIORITY : SPECIFIC_ALLOW_ALL_PRIORITY,
        condition,
        action: {
          type: "allowAllRequests"
        }
      });
    }
  }

  let resourceTypes = getResourceTypes(contentType);
  if (!resourceTypes || resourceTypes.length) {
    let {conditions} =
        getConditions(filter, urlFilter, resourceTypes, matchCase);

    for (let condition of conditions) {
      rules.push({
        priority: genericBlock ? GENERIC_PRIORITY : SPECIFIC_PRIORITY,
        condition,
        action: {
          type: "allow"
        }
      });
    }
  }

  return rules;
};

function validateIsAsciiOnly(str) {
  // [0-127] range is considered to be allowed ASCII characters
  if (!/^[\x00-\x7F]*$/.test(str)) {
    throw new Error(`Invalid ASCII characters found in: "${str}"`);
  }
}
exports.validateIsAsciiOnly = validateIsAsciiOnly;

function validateDomains(domains) {
  if (domains) {
    for (let domain of domains) {
      validateIsAsciiOnly(domain);
    }
  }
}

function validateCondition(condition) {
  if (condition.urlFilter) {
    validateIsAsciiOnly(condition.urlFilter);
  }
  if (condition.regexFilter) {
    validateIsAsciiOnly(condition.regexFilter);
  }

  validateDomains(condition.initiatorDomains);
  validateDomains(condition.requestDomains);

  // deprecated starting Chrome 101
  validateDomains(condition.domains);
  validateDomains(condition.excludedDomains);

  // starting Chrome 101
  validateDomains(condition.excludedInitiatorDomains);
  validateDomains(condition.excludedRequestDomains);
}

exports.validateRule = function(rule) {
  try {
    validateCondition(rule.condition);
    return rule;
  }
  catch (e) {
    return e;
  }
};
