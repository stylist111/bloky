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

const assert = require("assert");
const {LIB_FOLDER} = require("./_common");

const {contentTypes, RESOURCE_TYPES} = require(LIB_FOLDER + "/contentTypes");
const {Filter, InvalidFilter, CommentFilter, ActiveFilter, URLFilter,
       BlockingFilter, AllowingFilter, ContentFilter, ElemHideBase,
       ElemHideFilter, ElemHideException, ElemHideEmulationFilter,
       SnippetFilter, isActiveFilter} = require(LIB_FOLDER + "/filterClasses");
const {FilterState} = require(LIB_FOLDER + "/filterState");
const {setFeatureFlags} = require(LIB_FOLDER + "/features.js");

describe("Filter classes", function() {
  beforeEach(function() {
    // This automatically sets the new filterState as the state used in
    // filterClasses.
    new FilterState();
  });

  afterEach(function() {
    Filter.useFilterState(null);
  });

  function serializeFilter(filter) {
    // Filter serialization only writes out essential properties, need to do a full serialization here
    let result = [];
    result.push("text=" + filter.text);
    result.push("type=" + filter.type);
    if (filter instanceof InvalidFilter) {
      result.push("reason=" + filter.reason);
    }
    else if (filter instanceof CommentFilter) {
    }
    else if (filter instanceof ActiveFilter) {
      result.push("disabled=" + filter.disabled);
      for (let disabledSubscription of filter.disabledSubscriptions) {
        result.push("disabledSubscriptions[]=" + disabledSubscription);
      }
      result.push("lastHit=" + filter.lastHit);
      result.push("hitCount=" + filter.hitCount);

      let domains = [];
      if (filter.domains) {
        for (let [domain, isIncluded] of filter.domains) {
          if (domain != "") {
            domains.push(isIncluded ? domain : "~" + domain);
          }
        }
      }
      result.push("domains=" + domains.sort().join("|"));

      if (filter instanceof URLFilter) {
        result.push("regexp=" + (filter.urlPattern.regexp ? filter.urlPattern.regexpSource : null));
        result.push("contentType=" + filter.contentType);
        result.push("matchCase=" + filter.matchCase);

        let sitekeys = filter.sitekeys || [];
        result.push("sitekeys=" + sitekeys.slice().sort().join("|"));

        result.push("thirdParty=" + filter.thirdParty);
        if (filter.header) {
          if (filter.header.value) {
            result.push("header=" + filter.header.name + "=" + filter.header.value);
          }
          else {
            result.push("header=" + filter.header.name);
          }
        }
        else {
          result.push("header=null");
        }
        if (filter instanceof BlockingFilter) {
          result.push("csp=" + filter.csp);
          result.push("rewrite=" + filter.rewrite);
        }
        else if (filter instanceof AllowingFilter) {
        }
      }
      else if (filter instanceof ElemHideBase) {
        result.push("selectorDomains=" +
                    [...filter.domains || []]
                    .filter(([domain, isIncluded]) => isIncluded)
                    .map(([domain]) => domain.toLowerCase()));
        result.push("selector=" + filter.selector);
        if (filter instanceof ElemHideEmulationFilter) {
          result.push("remove=" + filter.remove);
          if (filter.css) {
            let css = "{";
            for (let cssPropertyName in filter.css) {
              css += `${cssPropertyName}:${filter.css[cssPropertyName]};`;
            }
            css += "}";
            result.push("css=" + css);
          }
          else {
            result.push("css=null");
          }
        }
      }
      else if (filter instanceof SnippetFilter) {
        result.push("scriptDomains=" +
                    [...filter.domains || []]
                    .filter(([domain, isIncluded]) => isIncluded)
                    .map(([domain]) => domain.toLowerCase()));
        result.push("script=" + filter.script);
      }
    }
    return result;
  }

  function addDefaults(expected, text) {
    let type = null;
    let hasProperty = {};
    for (let entry of expected) {
      if (/^type=(.*)/.test(entry)) {
        type = RegExp.$1;
      }
      else if (/^(\w+)/.test(entry)) {
        hasProperty[RegExp.$1] = true;
      }
    }

    function addProperty(prop, value) {
      if (!(prop in hasProperty)) {
        expected.push(prop + "=" + value);
      }
    }

    addProperty("text", text);

    if (type == "allowing" || type == "blocking" || type == "elemhide" ||
        type == "elemhideexception" || type == "elemhideemulation" ||
        type == "snippet") {
      addProperty("disabled", "false");
      addProperty("lastHit", "0");
      addProperty("hitCount", "0");
    }
    if (type == "allowing" || type == "blocking") {
      addProperty("contentType", RESOURCE_TYPES);
      addProperty("regexp", "null");
      addProperty("matchCase", "false");
      addProperty("thirdParty", "null");
      addProperty("domains", "");
      addProperty("sitekeys", "");
      addProperty("header", "null");
    }
    if (type == "blocking") {
      addProperty("csp", "null");
      addProperty("rewrite", "null");
    }
    if (type == "elemhide" || type == "elemhideexception" ||
        type == "elemhideemulation") {
      addProperty("selectorDomains", "");
      addProperty("domains", "");
    }
    if (type == "elemhideemulation") {
      addProperty("remove", "false");
      addProperty("css", "null");
    }
    if (type == "snippet") {
      addProperty("scriptDomains", "");
      addProperty("domains", "");
    }
  }

  function compareFilter(text, expected, postInit) {
    addDefaults(expected, text);

    let filter = Filter.fromText(text);
    if (postInit) {
      postInit(filter);
    }
    let result = serializeFilter(filter);
    assert.equal(result.sort().join("\n"), expected.sort().join("\n"), text);

    // Test round-trip
    let filter2;
    let buffer = [...filter.serialize()];
    if (buffer.length) {
      let map = Object.create(null);
      for (let line of buffer.slice(1)) {
        if (/(.*?)=(.*)/.test(line)) {
          map[RegExp.$1] = RegExp.$2;
        }
      }
      filter2 = Filter.fromObject(map);
    }
    else {
      filter2 = Filter.fromText(filter.text);
    }

    assert.equal(serializeFilter(filter).join("\n"), serializeFilter(filter2).join("\n"), text + " deserialization");
  }

  it("Definitions", function() {
    assert.equal(typeof Filter, "function", "typeof Filter");
    assert.equal(typeof InvalidFilter, "function", "typeof InvalidFilter");
    assert.equal(typeof CommentFilter, "function", "typeof CommentFilter");
    assert.equal(typeof ActiveFilter, "function", "typeof ActiveFilter");
    assert.equal(typeof URLFilter, "function", "typeof URLFilter");
    assert.equal(typeof BlockingFilter, "function", "typeof BlockingFilter");
    assert.equal(typeof ContentFilter, "function", "typeof ContentFilter");
    assert.equal(typeof AllowingFilter, "function", "typeof AllowingFilter");
    assert.equal(typeof ElemHideBase, "function", "typeof ElemHideBase");
    assert.equal(typeof ElemHideFilter, "function", "typeof ElemHideFilter");
    assert.equal(typeof ElemHideException, "function", "typeof ElemHideException");
    assert.equal(typeof ElemHideEmulationFilter, "function", "typeof ElemHideEmulationFilter");
    assert.equal(typeof SnippetFilter, "function", "typeof SnippetFilter");
  });

  it("Comments", function() {
    compareFilter("!asdf", ["type=comment"]);
    compareFilter("!foo#bar", ["type=comment"]);
    compareFilter("!foo##bar", ["type=comment"]);
  });

  it("Invalid filters", function() {
    compareFilter("/??/", ["type=invalid", "reason=filter_invalid_regexp"]);
    compareFilter("asd$foobar", ["type=invalid", "reason=filter_unknown_option"]);

    // No $domain or $~third-party
    compareFilter("||example.com/ad.js$rewrite=abp-resource:noopjs", ["type=invalid", "reason=filter_invalid_rewrite"]);
    compareFilter("*example.com/ad.js$rewrite=abp-resource:noopjs", ["type=invalid", "reason=filter_invalid_rewrite"]);
    compareFilter("example.com/ad.js$rewrite=abp-resource:noopjs", ["type=invalid", "reason=filter_invalid_rewrite"]);
    // Patterns not starting with || or *
    compareFilter("example.com/ad.js$rewrite=abp-resource:noopjs,domain=foo.com", ["type=invalid", "reason=filter_invalid_rewrite"]);
    compareFilter("example.com/ad.js$rewrite=abp-resource:noopjs,~third-party", ["type=invalid", "reason=filter_invalid_rewrite"]);
    // $~third-party requires ||
    compareFilter("*example.com/ad.js$rewrite=abp-resource:noopjs,~third-party", ["type=invalid", "reason=filter_invalid_rewrite"]);

    // Not supported wildcards
    let invalidDomainWildcards = ["subdomain.*.example.com",
                                  "do*ain.*",
                                  "*",
                                  "*domain.*",
                                  "*domain",
                                  "examp*",
                                  "example.?",
                                  "example.co*",
                                  "example.or*",
                                  "example.d*",
                                  "example.**",
                                  "*.example.*",
                                  "example.com|example.**"];
    for (let domain of invalidDomainWildcards) {
      let invalidFilterText = "||foo^$domain=" + domain;
      compareFilter(invalidFilterText, ["type=invalid", "reason=filter_invalid_wildcard"]);
    }

    let validDomainWildcards = ["example.*", "images.domain.*"];
    for (let domain of validDomainWildcards) {
      let validFilterText = "||bar^$domain=" + domain;
      let filter = Filter.fromText(validFilterText);
      assert.equal(filter instanceof InvalidFilter, false);
    }

    function checkElemHideEmulationFilterInvalid(domains) {
      let filterText = domains + "#?#:-abp-properties(abc)";
      compareFilter(
        filterText, [
          "type=invalid",
          "reason=filter_elemhideemulation_nodomain"
        ]
      );
    }
    checkElemHideEmulationFilterInvalid("");
    checkElemHideEmulationFilterInvalid("~foo.com");
    checkElemHideEmulationFilterInvalid("~foo.com,~bar.com");
    checkElemHideEmulationFilterInvalid("foo");
    checkElemHideEmulationFilterInvalid("~foo.com,bar");
  });

  it("Filters with state", function() {
    compareFilter("blabla", ["type=blocking"]);
    compareFilter(
      "blabla_default", ["type=blocking"], filter => {
        filter.disabled = false;
        filter.hitCount = 0;
        filter.lastHit = 0;
      }
    );
    compareFilter(
      "blabla_non_default",
      ["type=blocking", "disabled=true", "hitCount=12", "lastHit=20"],
      filter => {
        filter.disabled = true;
        filter.hitCount = 12;
        filter.lastHit = 20;
      }
    );
    compareFilter(
      "blabla_non_default",
      ["type=blocking", "disabledSubscriptions[]=~user", "disabledSubscriptions[]=~easylist", "hitCount=12", "lastHit=20"],
      filter => {
        filter.setDisabledForSubscription("~user", true);
        filter.setDisabledForSubscription("~easylist", true);
        filter.hitCount = 12;
        filter.lastHit = 20;
      }
    );
  });

  it("Special characters", function() {
    compareFilter("/ddd|f?a[s]d/", ["type=blocking", "regexp=ddd|f?a[s]d"]);
    compareFilter("*asdf*d**dd*", ["type=blocking", "regexp=asdf.*d.*dd"]);
    compareFilter("|*asd|f*d**dd*|", ["type=blocking", "regexp=^.*asd\\|f.*d.*dd.*$"]);
    compareFilter("dd[]{}$%<>&()*d", ["type=blocking", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\).*d"]);

    compareFilter("@@/ddd|f?a[s]d/", ["type=allowing", "regexp=ddd|f?a[s]d", "contentType=" + RESOURCE_TYPES, "header=null"]);
    compareFilter("@@*asdf*d**dd*", ["type=allowing", "regexp=asdf.*d.*dd", "contentType=" + RESOURCE_TYPES, "header=null"]);
    compareFilter("@@|*asd|f*d**dd*|", ["type=allowing", "regexp=^.*asd\\|f.*d.*dd.*$", "contentType=" + RESOURCE_TYPES, "header=null"]);
    compareFilter("@@dd[]{}$%<>&()*d", ["type=allowing", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\).*d", "contentType=" + RESOURCE_TYPES, "header=null"]);
  });

  it("Filter options", function() {
    compareFilter("bla$match-case,csp=first csp,script,other,third-party,domain=FOO.cOm,sitekey=foO", ["type=blocking", "matchCase=true", "contentType=" + (contentTypes.SCRIPT | contentTypes.OTHER | contentTypes.CSP), "thirdParty=true", "domains=foo.com", "sitekeys=foO", "csp=first csp"]);
    compareFilter("bla$~match-case,~csp=csp,~script,~other,~third-party,domain=~bAr.coM", ["type=blocking", "contentType=" + (RESOURCE_TYPES & ~(contentTypes.SCRIPT | contentTypes.OTHER)), "thirdParty=false", "domains=~bar.com"]);
    compareFilter("@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bAR.foO.Com|~Foo.Bar.com,csp=c s p,sitekey=foo|bar", ["type=allowing", "matchCase=true", "contentType=" + (contentTypes.SCRIPT | contentTypes.OTHER | contentTypes.CSP), "thirdParty=true", "domains=bar.com|foo.com|~bar.foo.com|~foo.bar.com", "sitekeys=bar|foo", "header=null"]);
    compareFilter("@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com,sitekey=foo|bar", ["type=allowing", "matchCase=true", "contentType=" + (contentTypes.SCRIPT | contentTypes.OTHER), "thirdParty=true", "domains=bar.com|foo.com|~bar.foo.com|~foo.bar.com", "sitekeys=bar|foo", "header=null"]);

    compareFilter("||example.com/ad.js$rewrite=abp-resource:noopjs,domain=foo.com|bar.com", ["type=blocking", "regexp=null", "matchCase=false", "rewrite=noopjs", "contentType=" + (RESOURCE_TYPES), "domains=bar.com|foo.com"]);
    compareFilter("*example.com/ad.js$rewrite=abp-resource:noopjs,domain=foo.com|bar.com", ["type=blocking", "regexp=null", "matchCase=false", "rewrite=noopjs", "contentType=" + (RESOURCE_TYPES), "domains=bar.com|foo.com"]);
    compareFilter("||example.com/ad.js$rewrite=abp-resource:noopjs,~third-party", ["type=blocking", "regexp=null", "matchCase=false", "rewrite=noopjs", "thirdParty=false", "contentType=" + (RESOURCE_TYPES)]);
    compareFilter("||content.server.com/files/*.php$rewrite=$1", ["type=invalid", "reason=filter_invalid_rewrite"]);
    compareFilter("||content.server.com/files/*.php$rewrite=", ["type=invalid", "reason=filter_invalid_rewrite"]);

    // header blocking
    compareFilter("||example.com/ad.js$header=content-type=image/png", ["type=blocking", "regexp=null", "matchCase=false", "contentType=" + (contentTypes.HEADER | RESOURCE_TYPES), "header=content-type=image/png"]);
    compareFilter("||example.com/ad.js$header=x-brick=Everything\\x2c is\\x2c awesome!", ["type=blocking", "regexp=null", "matchCase=false", "contentType=" + (contentTypes.HEADER | RESOURCE_TYPES), "header=x-brick=Everything, is, awesome!"]);
    compareFilter("||example.com/ad.js$header=x-brick=Everything\\\\x2c is\\\\x2c awesome!", ["type=blocking", "contentType=" + (contentTypes.HEADER | RESOURCE_TYPES), "header=x-brick=Everything\\x2c is\\x2c awesome!"]);
    compareFilter("@@||example.com/ad.js$header=content-type=image/png", ["type=allowing", "regexp=null", "matchCase=false", "contentType=" + (contentTypes.HEADER | RESOURCE_TYPES), "header=content-type=image/png"]);
    compareFilter("@@||example.com/ad.js$header", ["type=allowing", "regexp=null", "matchCase=false", "contentType=" + (contentTypes.HEADER | RESOURCE_TYPES), "header=null"]);
    compareFilter("@@||example.com/ad.js$header=", ["type=allowing", "regexp=null", "matchCase=false", "contentType=" + (contentTypes.HEADER | RESOURCE_TYPES), "header=null"]);
    compareFilter("||example.com/ad.js$header", ["type=invalid", "reason=filter_invalid_header"]);
    compareFilter("||example.com/ad.js$header==value", ["type=invalid", "reason=filter_invalid_header"]);
    compareFilter("||example.com/ad.js$header=x-my-id=/[0-9]/", ["type=invalid", "reason=filter_invalid_header"]);

    compareFilter("||example.com/ad.js$header=content-type=.*image/[a-z]{1\\x2c3}", ["type=blocking", "regexp=null", "matchCase=false", "contentType=" + (contentTypes.HEADER | RESOURCE_TYPES), "header=content-type=.*image/[a-z]{1,3}"]);
    compareFilter("||example.com/ad.js$header=content-type=.*image/[a-z]{1\\\\x2c3}", ["type=blocking", "regexp=null", "matchCase=false", "contentType=" + (contentTypes.HEADER | RESOURCE_TYPES), "header=content-type=.*image/[a-z]{1\\x2c3}"]);
    compareFilter("||example.com/ad.js$header=content-type=", ["type=blocking", "regexp=null", "matchCase=false", "contentType=" + (contentTypes.HEADER | RESOURCE_TYPES), "header=content-type"]);
    compareFilter("||example.com/ad.js$header=Content-Type", ["type=blocking", "regexp=null", "matchCase=false", "contentType=" + (contentTypes.HEADER | RESOURCE_TYPES), "header=content-type"]);
    compareFilter("||example.com/ad.js$script,header=Content-Type", ["type=blocking", "regexp=null", "matchCase=false", "contentType=" + (contentTypes.HEADER | contentTypes.SCRIPT), "header=content-type"]);


    // background and image should be the same for backwards compatibility
    compareFilter("blah$image", ["type=blocking", "contentType=" + (contentTypes.IMAGE)]);
    compareFilter("blah$background", ["type=blocking", "contentType=" + (contentTypes.IMAGE)]);
    compareFilter("blah$~image", ["type=blocking", "contentType=" + (RESOURCE_TYPES & ~contentTypes.IMAGE)]);
    compareFilter("blah$~background", ["type=blocking", "contentType=" + (RESOURCE_TYPES & ~contentTypes.IMAGE)]);
    compareFilter("blah$webbundle", ["type=blocking", "contentType=" + (contentTypes.WEBBUNDLE)]);

    compareFilter("@@blah$~script,~other", ["type=allowing", "contentType=" + (RESOURCE_TYPES & ~(contentTypes.SCRIPT | contentTypes.OTHER)), "header=null"]);
    compareFilter("@@http://blah$~script,~other", ["type=allowing", "contentType=" + (RESOURCE_TYPES & ~(contentTypes.SCRIPT | contentTypes.OTHER))]);
    compareFilter("@@ftp://blah$~script,~other", ["type=allowing", "contentType=" + (RESOURCE_TYPES & ~(contentTypes.SCRIPT | contentTypes.OTHER)), "header=null"]);
    compareFilter("@@blah$~script,~other,document", ["type=allowing", "contentType=" + (RESOURCE_TYPES & ~(contentTypes.SCRIPT | contentTypes.OTHER) | contentTypes.DOCUMENT)]);
    compareFilter("@@blah$~script,~other,~document", ["type=allowing", "contentType=" + (RESOURCE_TYPES & ~(contentTypes.SCRIPT | contentTypes.OTHER)), "header=null"]);
    compareFilter("@@blah$document", ["type=allowing", "contentType=" + contentTypes.DOCUMENT, "header=null"]);
    compareFilter("@@blah$~script,~other,elemhide", ["type=allowing", "contentType=" + (RESOURCE_TYPES & ~(contentTypes.SCRIPT | contentTypes.OTHER) | contentTypes.ELEMHIDE), "header=null"]);
    compareFilter("@@blah$~script,~other,~elemhide", ["type=allowing", "contentType=" + (RESOURCE_TYPES & ~(contentTypes.SCRIPT | contentTypes.OTHER)), "header=null"]);
    compareFilter("@@blah$elemhide", ["type=allowing", "contentType=" + contentTypes.ELEMHIDE, "header=null"]);

    compareFilter("@@blah$~script,~other,donottrack", ["type=invalid", "reason=filter_unknown_option"]);
    compareFilter("@@blah$~script,~other,~donottrack", ["type=invalid", "reason=filter_unknown_option"]);
    compareFilter("@@blah$donottrack", ["type=invalid", "reason=filter_unknown_option"]);
    compareFilter("@@blah$foobar", ["type=invalid", "reason=filter_unknown_option"]);
    compareFilter("@@blah$image,foobar", ["type=invalid", "reason=filter_unknown_option"]);
    compareFilter("@@blah$foobar,image", ["type=invalid", "reason=filter_unknown_option"]);

    compareFilter("blah$csp", ["type=invalid", "reason=filter_invalid_csp"]);
    compareFilter("blah$csp=", ["type=invalid", "reason=filter_invalid_csp"]);

    // Blank CSP values are allowed for allowing filters.
    compareFilter("@@blah$csp", ["type=allowing", "contentType=" + (contentTypes.CSP | RESOURCE_TYPES)]);
    compareFilter("@@blah$csp=", ["type=allowing", "contentType=" + (contentTypes.CSP | RESOURCE_TYPES)]);

    compareFilter("blah$csp=report-uri", ["type=invalid", "reason=filter_invalid_csp"]);
    compareFilter("blah$csp=foo,csp=report-to", ["type=invalid", "reason=filter_invalid_csp"]);
    compareFilter("blah$csp=foo,csp=referrer foo", ["type=invalid", "reason=filter_invalid_csp"]);
    compareFilter("blah$csp=foo,csp=base-uri", ["type=invalid", "reason=filter_invalid_csp"]);
    compareFilter("blah$csp=foo,csp=upgrade-insecure-requests", ["type=invalid", "reason=filter_invalid_csp"]);
    compareFilter("blah$csp=foo,csp=ReFeRReR", ["type=invalid", "reason=filter_invalid_csp"]);
  });

  it("Element hiding rules", function() {
    compareFilter("##ddd", ["type=elemhide", "selector=ddd"]);
    compareFilter("##body > div:first-child", ["type=elemhide", "selector=body > div:first-child"]);
    compareFilter("fOO##ddd", ["type=elemhide", "selectorDomains=foo", "selector=ddd", "domains=foo"]);
    compareFilter("Foo,bAr##ddd", ["type=elemhide", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo"]);
    compareFilter("foo,~baR##ddd", ["type=elemhide", "selectorDomains=foo", "selector=ddd", "domains=foo|~bar"]);
    compareFilter("foo,~baz,bar##ddd", ["type=elemhide", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo|~baz"]);
  });

  it("Element hiding exceptions", function() {
    compareFilter("#@#ddd", ["type=elemhideexception", "selector=ddd"]);
    compareFilter("#@#body > div:first-child", ["type=elemhideexception", "selector=body > div:first-child"]);
    compareFilter("fOO#@#ddd", ["type=elemhideexception", "selectorDomains=foo", "selector=ddd", "domains=foo"]);
    compareFilter("Foo,bAr#@#ddd", ["type=elemhideexception", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo"]);
    compareFilter("foo,~baR#@#ddd", ["type=elemhideexception", "selectorDomains=foo", "selector=ddd", "domains=foo|~bar"]);
    compareFilter("foo,~baz,bar#@#ddd", ["type=elemhideexception", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo|~baz"]);
  });

  it("Element hiding emulation filters", function() {
    // Check valid domain combinations
    compareFilter("fOO.cOm#?#:-abp-properties(abc)", ["type=elemhideemulation", "selectorDomains=foo.com", "selector=:-abp-properties(abc)", "domains=foo.com"]);
    compareFilter("Foo.com,~bAr.com#?#:-abp-properties(abc)", ["type=elemhideemulation", "selectorDomains=foo.com", "selector=:-abp-properties(abc)", "domains=foo.com|~bar.com"]);
    compareFilter("foo.com,~baR#?#:-abp-properties(abc)", ["type=elemhideemulation", "selectorDomains=foo.com", "selector=:-abp-properties(abc)", "domains=foo.com|~bar"]);
    compareFilter("~foo.com,bar.com#?#:-abp-properties(abc)", ["type=elemhideemulation", "selectorDomains=bar.com", "selector=:-abp-properties(abc)", "domains=bar.com|~foo.com"]);

    // Actions / Remove
    compareFilter("example.net#?#abc {remove:true;}", [
      "type=elemhideemulation",
      "selectorDomains=example.net",
      "selector=abc",
      "domains=example.net",
      "remove=true"
    ]);
    compareFilter("example.net#?#abc {ReMoVe:TrUe;}", [
      "type=elemhideemulation",
      "selectorDomains=example.net",
      "selector=abc",
      "domains=example.net",
      "remove=true"
    ]);


    // Check some special cases
    compareFilter("#?#:-abp-properties(abc)", ["type=invalid", "reason=filter_elemhideemulation_nodomain"]);
    compareFilter("foo.com#?#abc", ["type=elemhideemulation", "selectorDomains=foo.com", "selector=abc", "domains=foo.com"]);
    compareFilter("foo.com#?#:-abp-foobar(abc)", ["type=elemhideemulation", "selectorDomains=foo.com", "selector=:-abp-foobar(abc)", "domains=foo.com"]);
    compareFilter("foo.com#?#aaa :-abp-properties(abc) bbb", ["type=elemhideemulation", "selectorDomains=foo.com", "selector=aaa :-abp-properties(abc) bbb", "domains=foo.com"]);
    compareFilter("foo.com#?#:-abp-properties(|background-image: url(data:*))", ["type=elemhideemulation", "selectorDomains=foo.com", "selector=:-abp-properties(|background-image: url(data:*))", "domains=foo.com"]);

    // Support element hiding emulation filters for localhost (#6931).
    compareFilter("localhost#?#:-abp-properties(abc)", ["type=elemhideemulation", "selectorDomains=localhost", "selector=:-abp-properties(abc)", "domains=localhost"]);
    compareFilter("localhost,~www.localhost#?#:-abp-properties(abc)", ["type=elemhideemulation", "selectorDomains=localhost", "selector=:-abp-properties(abc)", "domains=localhost|~www.localhost"]);
    compareFilter("~www.localhost,localhost#?#:-abp-properties(abc)", ["type=elemhideemulation", "selectorDomains=localhost", "selector=:-abp-properties(abc)", "domains=localhost|~www.localhost"]);
  });

  it("Empty element hiding domains", function() {
    let emptyDomainFilters = [
      ",##selector", ",,,##selector", "~,foo.com##selector", "foo.com,##selector",
      ",foo.com##selector", "foo.com,~##selector",
      "foo.com,,bar.com##selector", "foo.com,~,bar.com##selector"
    ];

    for (let filterText of emptyDomainFilters) {
      let filter = Filter.fromText(filterText);
      assert.ok(filter instanceof InvalidFilter);
      assert.equal(filter.reason, "filter_invalid_domain");
      assert.equal(filter.option, null);
    }
  });

  it("Element hiding rules with braces", function() {
    compareFilter(
      "###foo[style={color: red}]", [
        "type=elemhide",
        "selectorDomains=",
        "selector=#foo[style={color: red}]",
        "domains="
      ]
    );
    compareFilter(
      "foo.com#?#:-abp-properties(/margin: [3-4]{2}/)", [
        "type=elemhideemulation",
        "selectorDomains=foo.com",
        "selector=:-abp-properties(/margin: [3-4]{2}/)",
        "domains=foo.com"
      ]
    );
  });

  it("Inline CSS filters", function() {
    setFeatureFlags({inlineCss: true});

    compareFilter(
      "foo.com#?##banner {margin:0}", [
        "type=elemhideemulation",
        "selectorDomains=foo.com",
        "selector=#banner",
        "domains=foo.com",
        "css={margin:0;}"
      ]
    );

    compareFilter(
      "foo.com#?##banner {margin:0 0 auto unset}", [
        "type=elemhideemulation",
        "selectorDomains=foo.com",
        "selector=#banner",
        "domains=foo.com",
        "css={margin:0 0 auto unset;}"
      ]
    );

    compareFilter(
      "foo.com#?##banner  {  background   : #00ff00  }", [
        "type=elemhideemulation",
        "selectorDomains=foo.com",
        "selector=#banner",
        "domains=foo.com",
        "css={background:#00ff00;}"
      ]
    );

    compareFilter(
      "foo.com#?##banner {background:#00ff00 !important}", [
        "type=elemhideemulation",
        "selectorDomains=foo.com",
        "selector=#banner",
        "domains=foo.com",
        "css={background:#00ff00;}"
      ]
    );

    compareFilter(
      "foo.com##@font-face", [
        "type=invalid",
        "reason=filter_elemhide_invalid_selector"
      ]
    );

    compareFilter(
      "foo.com#?#.advert {}", [
        "type=invalid",
        "reason=filter_elemhide_invalid_inline_css"
      ]
    );

    compareFilter(
      "foo.com#?#.advert {--custom-property:0}", [
        "type=invalid",
        "reason=filter_elemhide_invalid_inline_css"
      ]
    );

    compareFilter(
      "foo.com#?#.advert {margin\\}suspicious-property:0}", [
        "type=invalid",
        "reason=filter_elemhide_invalid_inline_css"
      ]
    );

    compareFilter(
      "foo.com#?#.advert {background}", [
        "type=invalid",
        "reason=filter_elemhide_invalid_inline_css"
      ]
    );

    compareFilter(
      "foo.com#?#.advert {margin:0;background:url(http://example.com)}", [
        "type=invalid",
        "reason=filter_elemhide_invalid_inline_css"
      ]
    );

    compareFilter(
      "foo.com#?#.advert {content:\"Hello\"}", [
        "type=invalid",
        "reason=filter_elemhide_invalid_inline_css"
      ]
    );

    compareFilter(
      "foo.com#?#.advert {margin:something-malicious-and12px}", [
        "type=invalid",
        "reason=filter_elemhide_invalid_inline_css"
      ]
    );

    compareFilter(
      "foo.com#?#.advert {margin:12pxand-something-malicious}", [
        "type=invalid",
        "reason=filter_elemhide_invalid_inline_css"
      ]
    );

    compareFilter(
      "foo.com#?##banner {margin:0 0 auto invalid}", [
        "type=invalid",
        "reason=filter_elemhide_invalid_inline_css"
      ]
    );
  });

  it("Snippet filters", function() {
    compareFilter("foo.com#$#abc", ["type=snippet", "scriptDomains=foo.com", "script=abc", "domains=foo.com"]);
    compareFilter("foo.com,~bar.com#$#abc", ["type=snippet", "scriptDomains=foo.com", "script=abc", "domains=foo.com|~bar.com"]);
    compareFilter("foo.com,~bar#$#abc", ["type=snippet", "scriptDomains=foo.com", "script=abc", "domains=foo.com|~bar"]);
    compareFilter("~foo.com,bar.com#$#abc", ["type=snippet", "scriptDomains=bar.com", "script=abc", "domains=bar.com|~foo.com"]);
  });

  it("Filter normalization", function() {
    // Line breaks etc
    assert.equal(Filter.normalize("\n\t\nad\ns"),
                 "ads");

    // Comment filters
    assert.equal(Filter.normalize("   !  fo  o##  bar   "),
                 "!  fo  o##  bar");

    // Element hiding filters
    assert.equal(Filter.normalize("   domain.c  om## # sele ctor   "),
                 "domain.com### sele ctor");

    // Wildcard: "*" is allowed
    assert.equal(Filter.normalize("   domain.*## # sele ctor   "),
                 "domain.*### sele ctor");

    // Element hiding emulation filters
    assert.equal(Filter.normalize("   domain.c  om#?# # sele ctor   "),
                 "domain.com#?## sele ctor");

    // Element hiding emulation filters with actions
    assert.equal(Filter.normalize("   domain.c  om#?# # sele ctor  {  remove : true ; } "),
                 "domain.com#?## sele ctor {remove:true;}");

    // Element hiding emulation filters with actions missing the trailing semicolon
    assert.equal(Filter.normalize("   domain.c  om#?# # sele ctor  {  remove : true  } "),
                 "domain.com#?## sele ctor {remove:true;}");

    // Element Hiding Emulation with multiple inline CSS properties and missing final semicolon
    assert.equal(Filter.normalize("   domain.c  om#?#sele ctor {margin-bottom : 0px ; color : blue }"),
                 "domain.com#?#sele ctor {margin-bottom:0px;color:blue;}");

    // Element Hiding Emulation with inline CSS removes "!important" property from values
    assert.equal(Filter.normalize("domain.com#?#selector {margin-bottom: 0px !important}"),
                 "domain.com#?#selector {margin-bottom:0px;}");

    // Element Hiding Emulation with inline CSS removes spaces around property
    // values, but not inside the values.
    assert.equal(Filter.normalize("domain.com#?#selector { margin : 0px 0px auto 1em }"),
                 "domain.com#?#selector {margin:0px 0px auto 1em;}");

    // Wildcard: "*" is allowed
    assert.equal(Filter.normalize("   domain.*#?# # sele ctor   "),
                 "domain.*#?## sele ctor");

    // Incorrect syntax: the separator "#?#" cannot contain spaces; treated as a
    // regular filter instead
    assert.equal(Filter.normalize("   domain.c  om# ?#. sele ctor   "),
                 "domain.com#?#.selector");
    // Incorrect syntax: the separator "#?#" cannot contain spaces; treated as an
    // element hiding filter instead, because the "##" following the "?" is taken
    // to be the separator instead
    assert.equal(Filter.normalize("   domain.c  om# ?##sele ctor   "),
                 "domain.com#?##sele ctor");

    // Element hiding exception filters
    assert.equal(Filter.normalize("   domain.c  om#@# # sele ctor   "),
                 "domain.com#@## sele ctor");

    // Wildcard: "*" is allowed
    assert.equal(Filter.normalize("   domain.*#@# # sele ctor   "),
                 "domain.*#@## sele ctor");

    // Incorrect syntax: the separator "#@#" cannot contain spaces; treated as a
    // regular filter instead (not an element hiding filter either!), because
    // unlike the case with "# ?##" the "##" following the "@" is not considered
    // to be a separator
    assert.equal(Filter.normalize("   domain.c  om# @## sele ctor   "),
                 "domain.com#@##selector");

    // Snippet filters
    assert.equal(Filter.normalize("   domain.c  om#$#  sni pp  et   "),
                 "domain.com#$#sni pp  et");

    // {remove:true;} is an elemhide or elemhide emulation syntax, and so should
    // not have its whitespace removed in snippet filters where it might mean
    // something else.
    assert.equal(Filter.normalize("   domain.c  om#$#snippet {remove : true ;}"),
                 "domain.com#$#snippet {remove : true ;}");

    // Wildcard: "*" is allowed
    assert.equal(Filter.normalize("   domain.*#$#  sni pp  et   "),
                 "domain.*#$#sni pp  et");

    // All lines that are purely whitespace are the same
    assert.equal(Filter.normalize(""),
                 "");
    assert.equal(Filter.normalize("     \t\n"),
                 "");
    assert.equal(Filter.normalize(" \xA0    \t\n  ", true),
                 "");

    // Regular filters
    let normalized = Filter.normalize(
      "    b$l 	 a$sitekey=  foo  ,domain= do main.com |foo   .com,c sp= c   s p  "
    );
    assert.equal(
      normalized,
      "b$la$sitekey=foo,domain=domain.com|foo.com,csp=c s p"
    );
    compareFilter(
      normalized, [
        "type=blocking",
        "csp=c s p",
        "domains=domain.com|foo.com",
        "sitekeys=foo",
        "contentType=" + (contentTypes.CSP | RESOURCE_TYPES)
      ]
    );

    // Some $csp edge cases
    assert.equal(Filter.normalize("$csp=  "),
                 "$csp=");
    assert.equal(Filter.normalize("$csp= c s p"),
                 "$csp=c s p");
    assert.equal(Filter.normalize("$$csp= c s p"),
                 "$$csp=c s p");
    assert.equal(Filter.normalize("$$$csp= c s p"),
                 "$$$csp=c s p");
    assert.equal(Filter.normalize("foo?csp=b a r$csp=script-src  'self'"),
                 "foo?csp=bar$csp=script-src 'self'");
    assert.equal(Filter.normalize("foo$bar=c s p = ba z,cs p = script-src  'self'"),
                 "foo$bar=csp=baz,csp=script-src 'self'");
    assert.equal(Filter.normalize("foo$csp=c s p csp= ba z,cs p  = script-src  'self'"),
                 "foo$csp=c s p csp= ba z,csp=script-src 'self'");
    assert.equal(Filter.normalize("foo$csp=bar,$c sp=c s p"),
                 "foo$csp=bar,$csp=c s p");
    assert.equal(Filter.normalize(" f o   o   $      bar   $csp=ba r"),
                 "foo$bar$csp=ba r");
    assert.equal(Filter.normalize("f    $    o    $    o    $    csp=f o o "),
                 "f$o$o$csp=f o o");
    assert.equal(Filter.normalize("/foo$/$ csp = script-src  http://example.com/?$1=1&$2=2&$3=3"),
                 "/foo$/$csp=script-src http://example.com/?$1=1&$2=2&$3=3");
    assert.equal(Filter.normalize("||content.server.com/files/*.php$rewrite= $1"),
                 "||content.server.com/files/*.php$rewrite=$1");
  });

  it("InvalidFilter option propagated", function() {
    let text = "/(content\\.server\\/file\\/.*\\.txt)\\?.*$/$nope=$1";
    let filter = Filter.fromText(text);
    assert.ok(filter instanceof InvalidFilter);
    assert.equal(filter.type, "invalid");
    assert.equal(filter.reason, "filter_unknown_option");
    assert.equal(filter.option, "nope");
  });

  it("Filter rewrite option", function() {
    let text = "/(content\\.server\\/file\\/.*\\.txt)\\?.*$/$rewrite=$1";
    let filter = Filter.fromText(text);
    assert.ok(filter instanceof InvalidFilter);
    assert.equal(filter.type, "invalid");
    assert.equal(filter.reason, "filter_invalid_rewrite");
    assert.equal(filter.option, null);

    text = "||/(content\\.server\\/file\\/.*\\.txt)\\?.*$/$rewrite=blank-text,domains=content.server";
    filter = Filter.fromText(text);
    assert.ok(filter instanceof InvalidFilter);
    assert.equal(filter.type, "invalid");
    assert.equal(filter.reason, "filter_invalid_rewrite");
    assert.equal(filter.option, null);

    const rewriteTestCases = require("./data/rewrite.json");
    for (let {resource, expected} of rewriteTestCases) {
      text = `||/(content\\.server\\/file\\/.*\\.txt)\\?.*$/$rewrite=abp-resource:${resource},domain=content.server`;
      filter = Filter.fromText(text);
      assert.equal(filter.rewriteUrl("http://content.server/file/foo.txt"),
                   expected);
      assert.equal(filter.rewriteUrl("http://content.server/file/foo.txt?bar"),
                   expected);
    }
  });

  it("Empty strings are invalid filters", function() {
    let text = "";
    let filter = Filter.fromText(text);
    assert.ok(filter instanceof InvalidFilter);
    assert.equal(filter.type, "invalid");
    assert.equal(filter.reason, "filter_empty");
    assert.equal(filter.option, null);
  });

  it("Generic URL filters must have a pattern at least 4 characters long", function() {
    compareFilter("a", ["type=invalid", "reason=filter_url_not_specific_enough"]);
    compareFilter("adv", ["type=invalid", "reason=filter_url_not_specific_enough"]);
    compareFilter("||a", ["type=invalid", "reason=filter_url_not_specific_enough"]);
    compareFilter("||adv", ["type=invalid", "reason=filter_url_not_specific_enough"]);
    compareFilter("n$image", ["type=invalid", "reason=filter_url_not_specific_enough"]);
    compareFilter("n$domain=example.com", [
      "type=blocking",
      "domains=example.com"
    ]);
    compareFilter("advert", [
      "type=blocking"
    ]);
  });

  it("Generic content filters must have a pattern at least 3 characters long", function() {
    compareFilter("##p", ["type=invalid", "reason=filter_elemhide_not_specific_enough"]);
    compareFilter("#@#p", ["type=invalid", "reason=filter_elemhide_not_specific_enough"]);
    compareFilter("##li", ["type=invalid", "reason=filter_elemhide_not_specific_enough"]);
    compareFilter("##AD-SLOT", ["type=elemhide", "selector=AD-SLOT"]);
    compareFilter("example.com##p", [
      "type=elemhide",
      "selector=p",
      "domains=example.com",
      "selectorDomains=example.com"
    ]);
  });

  it("Filter header option", function() {
    let responseHeaders1 = [
      {name: "Server", value: "None"},
      {name: "Content-Type", value: "image/jpeg"}
    ];

    let responseHeaders2 = [
      {name: "Server", value: "None"},
      {name: "Content-Type", value: "text/javascriptt"},
      {name: "Content-Encoding", value: "gzip"}
    ];


    let text1 = "/images/$header=content-type=text/javascript";
    let filter1 = Filter.fromText(text1);
    assert.ok(!filter1.filterHeaders(responseHeaders1));
    assert.ok(filter1.filterHeaders(responseHeaders2));

    let text2 = "/images/$header=content-encoding";
    let filter2 = Filter.fromText(text2);
    assert.ok(!filter2.filterHeaders(responseHeaders1));
    assert.ok(filter2.filterHeaders(responseHeaders2));
  });

  it("Domain map deduplication", function() {
    let filter1 = Filter.fromText("foo$domain=blocking.example.com");
    let filter2 = Filter.fromText("bar$domain=blocking.example.com");
    let filter3 = Filter.fromText("elemhide.example.com##.foo");
    let filter4 = Filter.fromText("elemhide.example.com##.bar");

    // This compares the references to make sure that both refer to the same
    // object (#6815).

    assert.equal(filter1.domains, filter2.domains);
    assert.equal(filter3.domains, filter4.domains);

    let filter5 = Filter.fromText("bar$domain=www.example.com");
    let filter6 = Filter.fromText("www.example.com##.bar");

    assert.notEqual(filter2.domains, filter5.domains);
    assert.notEqual(filter4.domains, filter6.domains);
  });

  it("Filters with wildcard domains", function() {
    // Blocking filters
    compareFilter("||*", [
      "type=blocking",
      "domains=",
      "regexp=null"
    ]);

    compareFilter("||example.com^$domain=example.*", [
      "type=blocking",
      "domains=example.*"
    ]);

    compareFilter("||example.com^$domain=example.*|example.net", [
      "type=blocking",
      "domains=example.*|example.net"
    ]);

    compareFilter("||example.com^$domain=example.net|example.*", [
      "type=blocking",
      "domains=example.*|example.net"
    ]);

    compareFilter("||example.com^$domain=~example.net|example.*", [
      "type=blocking",
      "domains=example.*|~example.net"
    ]);

    compareFilter("||example.com^$domain=example.*|~example.net", [
      "type=blocking",
      "domains=example.*|~example.net"
    ]);

    // Allowing filters
    compareFilter("@@||example.com^$domain=example.*", [
      "type=allowing",
      "domains=example.*",
      "header=null"
    ]);

    compareFilter("@@||example.com^$domain=example.*|example.net", [
      "type=allowing",
      "domains=example.*|example.net",
      "header=null"
    ]);

    compareFilter("@@||example.com^$domain=example.net|example.*", [
      "type=allowing",
      "domains=example.*|example.net",
      "header=null"
    ]);

    compareFilter("@@||example.com^$domain=~example.net|example.*", [
      "type=allowing",
      "domains=example.*|~example.net",
      "header=null"
    ]);

    compareFilter("@@||example.com^$domain=example.*|~example.net", [
      "type=allowing",
      "domains=example.*|~example.net",
      "header=null"
    ]);

    // Element hiding filters
    compareFilter("example.*##abc", [
      "type=elemhide",
      "selectorDomains=example.*",
      "selector=abc",
      "domains=example.*"
    ]);

    compareFilter("example.*,example.net##abc", [
      "type=elemhide",
      "selectorDomains=example.*,example.net",
      "selector=abc",
      "domains=example.*|example.net"
    ]);

    compareFilter("example.net,example.*##abc", [
      "type=elemhide",
      "selectorDomains=example.net,example.*",
      "selector=abc",
      "domains=example.*|example.net"
    ]);

    compareFilter("~example.net,example.*##abc", [
      "type=elemhide",
      "selectorDomains=example.*",
      "selector=abc",
      "domains=example.*|~example.net"
    ]);

    compareFilter("example.*,~example.net##abc", [
      "type=elemhide",
      "selectorDomains=example.*",
      "selector=abc",
      "domains=example.*|~example.net"
    ]);

    // Element hiding emulation filters
    compareFilter("example.*#?#abc", [
      "type=elemhideemulation",
      "selectorDomains=example.*",
      "selector=abc",
      "domains=example.*"
    ]);

    compareFilter("example.*,example.net#?#abc", [
      "type=elemhideemulation",
      "selectorDomains=example.*,example.net",
      "selector=abc",
      "domains=example.*|example.net"
    ]);

    compareFilter("example.net,example.*#?#abc", [
      "type=elemhideemulation",
      "selectorDomains=example.net,example.*",
      "selector=abc",
      "domains=example.*|example.net"
    ]);

    compareFilter("~example.net,example.*#?#abc", [
      "type=elemhideemulation",
      "selectorDomains=example.*",
      "selector=abc",
      "domains=example.*|~example.net"
    ]);

    compareFilter("example.*,~example.net#?#abc", [
      "type=elemhideemulation",
      "selectorDomains=example.*",
      "selector=abc",
      "domains=example.*|~example.net"
    ]);

    // Element hiding exception filters
    compareFilter("example.*#@#abc", [
      "type=elemhideexception",
      "selectorDomains=example.*",
      "selector=abc",
      "domains=example.*"
    ]);

    compareFilter("example.*,example.net#@#abc", [
      "type=elemhideexception",
      "selectorDomains=example.*,example.net",
      "selector=abc",
      "domains=example.*|example.net"
    ]);

    compareFilter("example.net,example.*#@#abc", [
      "type=elemhideexception",
      "selectorDomains=example.net,example.*",
      "selector=abc",
      "domains=example.*|example.net"
    ]);

    compareFilter("~example.net,example.*#@#abc", [
      "type=elemhideexception",
      "selectorDomains=example.*",
      "selector=abc",
      "domains=example.*|~example.net"
    ]);

    compareFilter("example.*,~example.net#@#abc", [
      "type=elemhideexception",
      "selectorDomains=example.*",
      "selector=abc",
      "domains=example.*|~example.net"
    ]);

    // Snippet filters
    compareFilter("example.*#$#abc", [
      "type=snippet",
      "scriptDomains=example.*",
      "script=abc",
      "domains=example.*"
    ]);

    compareFilter("example.*,example.net#$#abc", [
      "type=snippet",
      "scriptDomains=example.*,example.net",
      "script=abc",
      "domains=example.*|example.net"
    ]);

    compareFilter("example.net,example.*#$#abc", [
      "type=snippet",
      "scriptDomains=example.net,example.*",
      "script=abc",
      "domains=example.*|example.net"
    ]);

    compareFilter("~example.net,example.*#$#abc", [
      "type=snippet",
      "scriptDomains=example.*",
      "script=abc",
      "domains=example.*|~example.net"
    ]);

    compareFilter("example.*,~example.net#$#abc", [
      "type=snippet",
      "scriptDomains=example.*",
      "script=abc",
      "domains=example.*|~example.net"
    ]);
  });
});

describe("isActiveFilter()", function() {
  // Blocking filters.
  it("should return true for example", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("example")), true);
  });

  it("should return true for ||example.com^", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("||example.com^")), true);
  });

  it("should return true for |https://example.com/foo/", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("|https://example.com/foo/")), true);
  });

  it("should return true for ||example.com/foo/$domain=example.net", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("||example.com/foo/$domain=example.net")), true);
  });

  // Allowing filters.
  it("should return true for @@example", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("@@example")), true);
  });

  it("should return true for @@||example.com^", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("@@||example.com^")), true);
  });

  it("should return true for @@|https://example.com/foo/", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("@@|https://example.com/foo/")), true);
  });

  it("should return true for @@||example.com/foo/$domain=example.net", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("@@||example.com/foo/$domain=example.net")), true);
  });

  // Element hiding filters.
  it("should return true for ##.foo", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("##.foo")), true);
  });

  it("should return true for example.com##.foo", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("example.com##.foo")), true);
  });

  // Element hiding exceptions.
  it("should return true for #@#.foo", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("#@#.foo")), true);
  });

  it("should return true for example.com#@#.foo", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("example.com#@#.foo")), true);
  });

  // Element hiding emulation filters.
  it("should return false for #?#.foo", function() {
    // Element hiding emulation filters require a domain.
    assert.strictEqual(isActiveFilter(Filter.fromText("#?#.foo")), false);
  });

  it("should return true for example.com#?#.foo", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("example.com#?#.foo")), true);
  });

  // Snippet filters.
  it("should return false for #$#log 'Hello, world'", function() {
    // Snippet filters require a domain.
    assert.strictEqual(isActiveFilter(Filter.fromText("#$#log 'Hello, world'")), false);
  });

  it("should return true for example.com#$#log 'Hello, world'", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("example.com#$#log 'Hello, world'")), true);
  });

  // Comment filters.
  it("should return false for ! example.com filters", function() {
    assert.strictEqual(isActiveFilter(Filter.fromText("! example.com filters")), false);
  });

  // Invalid filters.
  it("should return false for ||example.com/foo/$domains=example.net|example.org", function() {
    // $domain, not $domains
    assert.strictEqual(isActiveFilter(Filter.fromText("||example.com/foo/$domains=example.net|example.org")), false);
  });

  it("should return false for example.com,,example.net##.foo", function() {
    // There must be no blank domain in the list.
    assert.strictEqual(isActiveFilter(Filter.fromText("example.com,,example.net##.foo")), false);
  });
});

describe("ActiveFilter.isActiveOnDomain()", function() {
  it("returns true for the exact match", function() {
    let filter = Filter.fromText("foo$domain=example.com");
    assert.equal(filter.isActiveOnDomain("example.com"), true);
  });

  it("returns true for the wildcarded match", function() {
    let filter = Filter.fromText("foo$domain=example.*");
    assert.equal(filter.isActiveOnDomain("example.com"), true);
  });

  it("returns false for the wildcarded match with negation", function() {
    let filter = Filter.fromText("foo$domain=~example.*");
    assert.equal(filter.isActiveOnDomain("example.com"), false);
  });

  it("prefers the result for the exact match over wildcarded match", function() {
    let filter = Filter.fromText("foo$domain=example.com|~example.*");
    assert.equal(filter.isActiveOnDomain("example.com"), true);
    assert.equal(filter.isActiveOnDomain("images.example.com"), false);
  });

  it("prefers the result for the subdomain match over TLD match", function() {
    let filter = Filter.fromText("foo$domain=example.*|~images.example.com");
    assert.equal(filter.isActiveOnDomain("example.com"), true);
    assert.equal(filter.isActiveOnDomain("images.example.com"), false);
  });
});
