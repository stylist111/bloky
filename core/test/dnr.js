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

const {GENERIC_PRIORITY, GENERIC_ALLOW_ALL_PRIORITY, SPECIFIC_PRIORITY,
       SPECIFIC_ALLOW_ALL_PRIORITY} = require(LIB_FOLDER + "/dnr/rules");
const {contentTypes, RESOURCE_TYPES} = require(LIB_FOLDER + "/contentTypes");
const {asDNR, createConverter} = require(LIB_FOLDER + "/dnr");

const preParsedRule = {
  blocking: false,
  text: null,
  regexpSource: null,
  contentType: null,
  matchCase: null,
  domains: null,
  thirdParty: null,
  sitekeys: null,
  header: null,
  rewrite: null,
  csp: null
};

describe("DeclarativeNetRequest", function() {
  let convert = asDNR.bind({
    isRegexSupported: r => true,
    modifyRule: (rule, context) => rule
  });

  it("Returns error for sitekey filters", async function() {
    let parsedSitekey = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "abcd$sitekey=SiTeK3y",
        regexpSource: "abcd",
        contentType: RESOURCE_TYPES,
        sitekeys: "SiTeK3y"
      });

    let result = await convert(parsedSitekey);
    assert(result instanceof Error);
    assert.equal(result.message, "filter_unknown_option");
    assert.equal(result.detail.text, "abcd$sitekey=SiTeK3y");
  });

  it("Returns error for header filters", async function() {
    let parsedHeaderFiltering = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "abcd$header=content-type=application/pdf",
        regexpSource: "abcd",
        contentType: RESOURCE_TYPES | contentTypes.HEADER,
        header: {
          name: "content-type",
          value: "application/pdf"
        }
      });

    let result = await convert(parsedHeaderFiltering);
    assert(result instanceof Error);
    assert.equal(result.message, "filter_unknown_option");
    assert.equal(result.detail.text, "abcd$header=content-type=application/pdf");
  });

  it("Return error for invalid regexp", async function() {
    // This converter will reject the case maching /InVaLiD/i regexp
    let converter = createConverter({
      isRegexSupported: re => re.regex != "InVaLiD"
    });

    // This regexp is rejected by parse()
    let result = await converter("/??/");
    assert(result instanceof Error);
    assert.equal(result.message, "filter_invalid_regexp");
    assert.equal(result.detail.text, "/??/");

    result = await converter("pass");
    assert(!(result instanceof Error));
    assert.equal(result[0].action.type, "block");

    // The regexp is accepted by parse() but not by asDNR()
    result = await converter("/InVaLiD/$match-case");
    assert(result instanceof Error);
    assert.equal(result.message, "filter_invalid_regexp");
    assert.equal(result.detail.text, "/InVaLiD/$match-case");
  });

  it("Return error for invalid rewrite", async function() {
    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "||example.com^*/getspot/?spotid=$media,rewrite=abp-resource:blank-mp42,domain=example.com",
        regexpSource: "||example.com^*/getspot/?spotid=",
        contentType: 16384,
        domains: "example.com",
        rewrite: "blank-mp42"
      });

    let result = await convert(rule);
    assert.equal(result.length, 0);
  });

  it("Convert easylist blocking rules", async function() {
    let rule1 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "-ad-300x600px.",
        regexpSource: "-ad-300x600px."
      });
    let result = await convert(rule1);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {urlFilter: "-ad-300x600px.", isUrlFilterCaseSensitive: false});

    let rule2 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "-adwords.$domain=~consultant-adwords.com|~consultant-adwords.fr|~expert-adwords.com|~freelance-adwords.com|~freelance-adwords.fr",
        regexpSource: "-adwords.",
        domains: "~consultant-adwords.com|~consultant-adwords.fr|~expert-adwords.com|~freelance-adwords.com|~freelance-adwords.fr"
      });
    result = await convert(rule2);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {
      urlFilter: "-adwords.",
      isUrlFilterCaseSensitive: false,
      excludedInitiatorDomains: [
        "consultant-adwords.com",
        "consultant-adwords.fr",
        "expert-adwords.com",
        "freelance-adwords.com",
        "freelance-adwords.fr"
      ]
    });

    let rule3 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: ".openx.$domain=~openx.com|~openx.solar",
        regexpSource: ".openx.",
        domains: "~openx.com|~openx.solar"
      });
    result = await convert(rule3);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {
      urlFilter: ".openx.",
      isUrlFilterCaseSensitive: false,
      excludedInitiatorDomains: [
        "openx.com",
        "openx.solar"
      ]
    });

    let rule4 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "||contentpass.net/stats?$third-party",
        regexpSource: "||contentpass.net/stats?",
        thirdParty: true
      });
    result = await convert(rule4);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||contentpass.net/stats?",
      isUrlFilterCaseSensitive: false,
      domainType: "thirdParty"
    });
  });

  it("Convert easylist regexp blocking rules", async function() {
    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "/^https?://(.+?.)?anotherexample.com/images/uploads/[a-zA-Z]{6,15}-.*/",
        regexpSource: "/^https?://(.+?.)?anotherexample.com/images/uploads/[a-zA-Z]{6,15}-.*/"
      });
    let result = await convert(rule);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {
      regexFilter: "^https?:\\/\\/(.+?.)?anotherexample.com\\/images\\/uploads\\/[a-za-z]{6,15}-.*",
      isUrlFilterCaseSensitive: false
    });
  });

  it("Convert easylist allowing rules", async function() {
    let rule1 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: false,
        text: "@@||g.doubleclick.net/gpt/pubads_impl_$script,domain=example.com",
        regexpSource: "||g.doubleclick.net/gpt/pubads_impl_",
        contentType: 2,
        domains: "example.com"
      });
    let result = await convert(rule1);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, SPECIFIC_PRIORITY);
    assert.equal(result[0].action.type, "allow");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||g.doubleclick.net/gpt/pubads_impl_",
      isUrlFilterCaseSensitive: false,
      initiatorDomains: ["example.com"],
      resourceTypes: [
        "script"
      ]
    });

    // popup rules are discarded.
    let rule2 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: false,
        text: "@@||ads.microsoft.com^$popup",
        regexpSource: "||ads.microsoft.com^",
        contentType: 16777216
      });
    result = await convert(rule2);
    assert.equal(result.length, 0);


    let rule3 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: false,
        text: "@@||optout.exampleadvertising.org^$document",
        regexpSource: "||optout.exampleadvertising.org^",
        contentType: 134217728
      });

    result = await convert(rule3);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, SPECIFIC_ALLOW_ALL_PRIORITY);
    assert.equal(result[0].action.type, "allowAllRequests");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||optout.exampleadvertising.org^",
      isUrlFilterCaseSensitive: false,
      resourceTypes: [
        "main_frame",
        "sub_frame"
      ]
    });

    let rule4 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: false,
        text: "@@||optout.exampleadvertising.org^$genericblock,document",
        regexpSource: "||optout.exampleadvertising.org^",
        contentType: 402653184
      });

    result = await convert(rule4);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_ALLOW_ALL_PRIORITY);
    assert.equal(result[0].action.type, "allowAllRequests");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||optout.exampleadvertising.org^",
      isUrlFilterCaseSensitive: false,
      resourceTypes: [
        "main_frame",
        "sub_frame"
      ]
    });
  });

  it("Convert easylist rewrite rules", async function() {
    const {resources} = require("../data/resources.js");

    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "||example.com^*/getspot/?spotid=$media,rewrite=abp-resource:blank-mp3,domain=example.com",
        regexpSource: "||example.com^*/getspot/?spotid=",
        contentType: 16384,
        domains: "example.com",
        rewrite: "blank-mp3"
      });

    let result = await convert(rule);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, SPECIFIC_PRIORITY);
    assert.deepEqual(result[0].action, {type: "redirect", redirect: {
      url: resources[rule.rewrite]
    }});
    assert.deepEqual(result[0].condition, {
      urlFilter: "||example.com^*/getspot/?spotid=",
      resourceTypes: ["media"],
      isUrlFilterCaseSensitive: false,
      initiatorDomains: ["example.com"]
    });
  });

  it("Convert easylist CSP blocking rules", async function() {
    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "||example.com^$csp=script-src 'self' * 'unsafe-inline'",
        regexpSource: "||example.com^",
        contentType: 50331647,
        csp: "script-src 'self' * 'unsafe-inline'"
      });

    let result = await convert(rule);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.deepEqual(result[0].condition, {
      urlFilter: "||example.com^",
      isUrlFilterCaseSensitive: false,
      resourceTypes: [
        "main_frame",
        "sub_frame"
      ]
    });
    assert.deepEqual(result[0].action, {
      type: "modifyHeaders",
      responseHeaders: [{
        header: "Content-Security-Policy",
        operation: "append",
        value: "script-src 'self' * 'unsafe-inline'"
      }]
    });
  });

  it("Convert easylist CSP allowing rules", async function() {
    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: false,
        text: "@@||example.com/login$csp,~third-party",
        regexpSource: "||example.com/login",
        contentType: 50331647,
        thirdParty: false
      });

    let result = await convert(rule);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, SPECIFIC_PRIORITY);
    assert.equal(result[0].action.type, "allow");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||example.com/login",
      resourceTypes: [
        "main_frame",
        "sub_frame"
      ],
      isUrlFilterCaseSensitive: false,
      domainType: "firstParty"
    });
  });

  it("Convert easylist match-case rules", async function() {
    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "||example.com$match-case",
        regexpSource: "||example.com",
        matchCase: true
      });
    let result = await convert(rule);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||example.com",
      isUrlFilterCaseSensitive: true
    });
  });
});
