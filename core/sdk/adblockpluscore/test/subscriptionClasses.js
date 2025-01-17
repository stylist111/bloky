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
const {LIB_FOLDER, createSandbox} = require("./_common");

let Subscription = null;
let SpecialSubscription = null;
let FullUpdatableSubscription = null;
let DiffUpdatableSubscription = null;
let RegularSubscription = null;
let Filter = null;

function compareSubscription(url, expected, postInit) {
  expected.push("[Subscription]");

  let subscription = Subscription.fromURL(url);

  if (postInit) {
    postInit(subscription);
  }
  let result = [...subscription.serialize()];
  assert.equal(result.sort().join("\n"), expected.sort().join("\n"), url);

  let map = Object.create(null);
  for (let line of result.slice(1)) {
    if (/(.*?)=(.*)/.test(line)) {
      map[RegExp.$1] = RegExp.$2;
    }
  }
  let subscription2 = Subscription.fromObject(map);
  assert.equal(subscription.toString(), subscription2.toString(), url + " deserialization");
}

describe("Subscription classes", function() {
  beforeEach(function() {
    // Sandbox required because subscriptions are remembered between tests, and
    // setRecommendations modifies global state.
    let sandboxedRequire = createSandbox();
    (
      {Subscription, SpecialSubscription, RegularSubscription,
       FullUpdatableSubscription, DiffUpdatableSubscription} =
         sandboxedRequire(LIB_FOLDER + "/subscriptionClasses"),
      {Filter} = sandboxedRequire(LIB_FOLDER + "/filterClasses")
    );
  });

  function compareSubscriptionFilters(subscription, expected) {
    assert.deepEqual([...subscription.filterText()], expected);

    assert.equal(subscription.filterCount, expected.length);

    for (let i = 0; i < subscription.filterCount; i++) {
      assert.equal(subscription.filterTextAt(i), expected[i]);
    }

    assert.ok(!subscription.filterTextAt(subscription.filterCount));
    assert.ok(!subscription.filterTextAt(-1));
  }

  it("Definitions", function() {
    assert.equal(typeof Subscription, "function", "typeof Subscription");
    assert.equal(typeof SpecialSubscription, "function", "typeof SpecialSubscription");
    assert.equal(typeof RegularSubscription, "function", "typeof RegularSubscription");
    assert.equal(typeof FullUpdatableSubscription, "function", "typeof FullUpdatableSubscription");
    assert.equal(typeof DiffUpdatableSubscription, "function", "typeof DiffUpdatableSubscription");
  });

  it("Subscriptions with state", function() {
    compareSubscription("~fl~", ["url=~fl~"]);
    compareSubscription("https://test/default", ["url=https://test/default", "title=https://test/default"]);
    compareSubscription(
      "https://test/default_titled", ["url=https://test/default_titled", "title=test"], subscription => {
        subscription.title = "test";
      }
    );
    compareSubscription(
      "https://test/non_default",
      [
        "url=https://test/non_default", "title=test", "disabled=true",
        "lastSuccess=8", "lastDownload=12", "lastCheck=16", "softExpiration=18",
        "expires=20", "downloadStatus=foo", "errors=3", "version=24",
        "requiredVersion=0.6"
      ],
      subscription => {
        subscription.title = "test";
        subscription.disabled = true;
        subscription.lastSuccess = 8;
        subscription.lastDownload = 12;
        subscription.lastCheck = 16;
        subscription.softExpiration = 18;
        subscription.expires = 20;
        subscription.downloadStatus = "foo";
        subscription.errors = 3;
        subscription.version = 24;
        subscription.requiredVersion = "0.6";
      }
    );
    compareSubscription(
      "~wl~", ["url=~wl~", "disabled=true", "title=Test group"], subscription => {
        subscription.title = "Test group";
        subscription.disabled = true;
      }
    );
    compareSubscription("~md~", ["url=~md~", "metadata={\"meta\":\"data\"}"], subscription => {
      subscription.metadata = {meta: "data"};
    });
  });

  it("Filter management", function() {
    let subscription = Subscription.fromURL("https://example.com/");

    compareSubscriptionFilters(subscription, []);

    subscription.addFilter(Filter.fromText("##.foo"));
    compareSubscriptionFilters(subscription, ["##.foo"]);
    assert.equal(subscription.findFilterTextIndex("##.foo"), 0);

    subscription.addFilter(Filter.fromText("##.bar"));
    compareSubscriptionFilters(subscription, ["##.foo", "##.bar"]);
    assert.equal(subscription.findFilterTextIndex("##.bar"), 1);

    // Repeat filter.
    subscription.addFilter(Filter.fromText("##.bar"));
    compareSubscriptionFilters(subscription, ["##.foo", "##.bar",
                                              "##.bar"]);

    // The first occurrence is found.
    assert.equal(subscription.findFilterTextIndex("##.bar"), 1);

    subscription.deleteFilterAt(0);
    compareSubscriptionFilters(subscription, ["##.bar", "##.bar"]);
    assert.equal(subscription.findFilterTextIndex("##.bar"), 0);

    subscription.insertFilterTextAt("##.foo", 0);
    compareSubscriptionFilters(subscription, ["##.foo", "##.bar",
                                              "##.bar"]);
    assert.equal(subscription.findFilterTextIndex("##.bar"), 1);

    subscription.deleteFilterAt(1);
    compareSubscriptionFilters(subscription, ["##.foo", "##.bar"]);
    assert.equal(subscription.findFilterTextIndex("##.bar"), 1);

    subscription.deleteFilterAt(1);
    compareSubscriptionFilters(subscription, ["##.foo"]);
    assert.equal(subscription.findFilterTextIndex("##.bar"), -1);

    subscription.addFilter(Filter.fromText("##.bar"));
    compareSubscriptionFilters(subscription, ["##.foo", "##.bar"]);
    assert.equal(subscription.findFilterTextIndex("##.bar"), 1);

    subscription.clearFilters();
    compareSubscriptionFilters(subscription, []);
    assert.equal(subscription.findFilterTextIndex("##.foo"), -1);
    assert.equal(subscription.findFilterTextIndex("##.bar"), -1);

    subscription.addFilter(Filter.fromText("##.bar"));
    compareSubscriptionFilters(subscription, ["##.bar"]);

    subscription.addFilter(Filter.fromText("##.foo"));
    compareSubscriptionFilters(subscription, ["##.bar", "##.foo"]);
    assert.equal(subscription.findFilterTextIndex("##.bar"), 0);
    assert.equal(subscription.findFilterTextIndex("##.foo"), 1);

    // Insert outside of bounds.
    subscription.insertFilterTextAt("##.lambda", 1000);
    compareSubscriptionFilters(subscription, ["##.bar", "##.foo",
                                              "##.lambda"]);
    assert.equal(subscription.findFilterTextIndex("##.lambda"), 2);

    // Delete outside of bounds.
    subscription.deleteFilterAt(1000);
    compareSubscriptionFilters(subscription, ["##.bar", "##.foo",
                                              "##.lambda"]);
    assert.equal(subscription.findFilterTextIndex("##.lambda"), 2);

    // Insert outside of bounds (negative).
    subscription.insertFilterTextAt("##.lambda", -1000);
    compareSubscriptionFilters(subscription, ["##.lambda", "##.bar",
                                              "##.foo", "##.lambda"]);
    assert.equal(subscription.findFilterTextIndex("##.lambda"), 0);

    // Delete outside of bounds (negative).
    subscription.deleteFilterAt(-1000);
    compareSubscriptionFilters(subscription, ["##.lambda", "##.bar",
                                              "##.foo", "##.lambda"]);
    assert.equal(subscription.findFilterTextIndex("##.lambda"), 0);
  });

  it("Subscription delta", function() {
    let subscription = Subscription.fromURL("https://example.com/");

    subscription.addFilter(Filter.fromText("##.foo"));
    subscription.addFilter(Filter.fromText("##.bar"));

    compareSubscriptionFilters(subscription, ["##.foo", "##.bar"]);

    let delta = subscription.updateFilterText(["##.lambda", "##.foo"]);

    // The filters should be in the same order in which they were in the
    // argument to updateFilterText()
    compareSubscriptionFilters(subscription, ["##.lambda", "##.foo"]);

    assert.deepEqual(delta, {added: ["##.lambda"], removed: ["##.bar"]});

    // Add ##.lambda a second time.
    subscription.addFilter(Filter.fromText("##.lambda"));
    compareSubscriptionFilters(subscription, ["##.lambda", "##.foo",
                                              "##.lambda"]);

    delta = subscription.updateFilterText(["##.bar", "##.bar"]);

    // Duplicate filters should be allowed.
    compareSubscriptionFilters(subscription, ["##.bar", "##.bar"]);

    // If there are duplicates in the text, there should be duplicates in the
    // delta.
    assert.deepEqual(delta, {
      added: ["##.bar", "##.bar"],
      removed: ["##.lambda", "##.foo", "##.lambda"]
    });
  });

  it("set filter text properly", function() {
    let subscription = Subscription.fromURL("https://example.com/");
    subscription.setFilterText([
      "##.foo",
      "## .bar"
    ]);

    assert.ok(subscription.hasFilterText("##.foo"));
    // This will have been normalized.
    assert.equal(subscription.filterTextAt(1), "##.bar");
    assert.equal(subscription._filterText.length, 2);

    let subscription2 = Subscription.fromURL("https://example.com/the_other.txt");
    assert.throws(() => subscription2.setFilterText("##.foo"));
    assert.equal(subscription2._filterText.length, 0);

    let subscription3 = Subscription.fromURL("https://example.com/the_other2.txt");
    subscription3.setFilterText([
      "##.foo",
      "##.bar"
    ], {
      version: "1",
      homepage: "https://abptestpages.org",
      title: "Another example"
    });
    assert.ok(subscription3.hasFilterText("##.foo"));
    assert.equal(subscription3.filterTextAt(0), "##.foo");
    assert.equal(subscription3.filterTextAt(1), "##.bar");
    assert.equal(subscription3._filterText.length, 2);
    assert.equal(subscription3.title, "Another example");
    assert.ok(subscription3.fixedTitle);
    assert.equal(subscription3.homepage, "https://abptestpages.org/");
  });
});

describe("DNR mode", function() {
  let setRecommendations;

  beforeEach(function() {
    // Sandbox required because subscriptions are remembered between tests, and
    // setRecommendations modifies global state.
    let sandboxedRequire = createSandbox();
    (
      {Subscription, RegularSubscription, FullUpdatableSubscription} =
        sandboxedRequire(LIB_FOLDER + "/subscriptionClasses"),
      {setRecommendations} = sandboxedRequire(LIB_FOLDER + "/recommendations")
    );

    Subscription.dnr = true;
    let recommendations = require("./data/v3_index.json");
    setRecommendations(recommendations);
  });

  afterEach(function() {
    Subscription.dnr = false;
  });

  it("Set the properties from recommended", function() {
    let subscription = Subscription.fromURL("https://easylist-downloads.adblockplus.org/v3/full/easylist.txt");
    assert.equal(subscription.title, "EasyList");
    assert.equal(subscription.fixedTitle, true);
    assert.equal(subscription.homepage, "https://easylist.to/");
  });

  it("Handles mv2 URL", function() {
    let sub1 = Subscription.fromURL("https://easylist-downloads.adblockplus.org/easylist.txt");
    assert.ok(sub1);
    assert.equal(sub1.url, "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt");
    assert.ok(sub1 instanceof RegularSubscription);
    assert.ok(!(sub1 instanceof FullUpdatableSubscription));
    assert.equal(sub1.id, "8C13E995-8F06-4927-BEA7-6C845FB7EEBF");
    assert.equal(sub1.type, "ads");
    assert.equal(sub1.downloadable, false);
    assert.deepEqual(sub1.languages, ["en"]);

    let sub2 = Subscription.fromURL("https://easylist-downloads.adblockplus.org/easylist.txt");
    assert.equal(sub1, sub2);

    let sub3 = Subscription.fromURL("https://easylist-downloads.adblockplus.org/v3/full/easylist.txt");
    assert.equal(sub1, sub3);

    compareSubscription(sub3.url, [
      "downloadable=false",
      "fixedTitle=true",
      "homepage=https://easylist.to/",
      "id=8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
      "title=EasyList",
      "url=https://easylist-downloads.adblockplus.org/v3/full/easylist.txt"
    ]);

    // This subscription isn't in the "recommendations"
    let sub4 = Subscription.fromURL("https://test/default");
    assert.ok(sub4 instanceof RegularSubscription);
    assert.ok(sub4 instanceof FullUpdatableSubscription);
    // This one is unknown so is has no ID.
    assert.strictEqual(sub4.id, null);
    assert.notEqual(sub1, sub4);
    assert.strictEqual(sub4.downloadable, true);
    compareSubscription(sub4.url, [
      "title=https://test/default",
      "url=https://test/default"
    ]);
  });

  it("Maps diff_url correctly", function() {
    let subscription = Subscription.fromURL("https://easylist-downloads.adblockplus.org/v3/full/abpindo.txt");
    assert.ok(subscription);
    compareSubscription(subscription.url, [
      "url=https://easylist-downloads.adblockplus.org/v3/full/abpindo.txt",
      "downloadable=false", "diffURL=https://easylist-downloads.adblockplus.org/v3/diff/abpindo/187271f7a9a62cda9661034000d12367bdfbb78c.json", "fixedTitle=true",
      "homepage=https://github.com/ABPindo/indonesianadblockrules/", "title=ABPindo",
      "id=A4A32212-E6BD-45F6-AD0F-E0FD18E8537B"
    ]);
  });
});

describe("Subscription.isValidURL()", function() {
  beforeEach(function() {
    // Sandbox required because subscriptions are remembered between tests, and
    // setRecommendations modifies global state.
    let sandboxedRequire = createSandbox();
    (
      {Subscription} = sandboxedRequire(LIB_FOLDER + "/subscriptionClasses")
    );
  });

  it("should return true for ~user~982682", function() {
    assert.strictEqual(Subscription.isValidURL("~user~982682"), true);
  });

  it("should return false for ~invalid~135692", function() {
    assert.strictEqual(Subscription.isValidURL("~invalid~135692"), false);
  });

  it("should return true for https://example.com/", function() {
    assert.strictEqual(Subscription.isValidURL("https://example.com/"), true);
  });

  it("should return true for https://example.com/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("https://example.com/list.txt"), true);
  });

  it("should return true for https://example.com:8080/", function() {
    assert.strictEqual(Subscription.isValidURL("https://example.com:8080/"), true);
  });

  it("should return true for https://example.com:8080/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("https://example.com:8080/list.txt"), true);
  });

  it("should return false for http://example.com/", function() {
    assert.strictEqual(Subscription.isValidURL("http://example.com/"), false);
  });

  it("should return false for http://example.com/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("http://example.com/list.txt"), false);
  });

  it("should return false for http://example.com:8080/", function() {
    assert.strictEqual(Subscription.isValidURL("http://example.com:8080/"), false);
  });

  it("should return false for http://example.com:8080/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("http://example.com:8080/list.txt"), false);
  });

  it("should return true for https:example.com/", function() {
    assert.strictEqual(Subscription.isValidURL("https:example.com/"), true);
  });

  it("should return true for https:example.com/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("https:example.com/list.txt"), true);
  });

  it("should return false for http:example.com/", function() {
    assert.strictEqual(Subscription.isValidURL("http:example.com/"), false);
  });

  it("should return false for http:example.com/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("http:example.com/list.txt"), false);
  });

  it("should return true for http://localhost/", function() {
    assert.strictEqual(Subscription.isValidURL("http://localhost/"), true);
  });

  it("should return true for http://localhost/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("http://localhost/list.txt"), true);
  });

  it("should return true for http://127.0.0.1/", function() {
    assert.strictEqual(Subscription.isValidURL("http://127.0.0.1/"), true);
  });

  it("should return true for http://127.0.0.1/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("http://127.0.0.1/list.txt"), true);
  });

  it("should return true for http://[::1]/", function() {
    assert.strictEqual(Subscription.isValidURL("http://[::1]/"), true);
  });

  it("should return true for http://[::1]/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("http://[::1]/list.txt"), true);
  });

  it("should return true for http://0x7f000001/", function() {
    assert.strictEqual(Subscription.isValidURL("http://0x7f000001/"), true);
  });

  it("should return true for http://0x7f000001/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("http://0x7f000001/list.txt"), true);
  });

  it("should return true for http://[0:0:0:0:0:0:0:1]/", function() {
    assert.strictEqual(Subscription.isValidURL("http://[0:0:0:0:0:0:0:1]/"), true);
  });

  it("should return true for http://[0:0:0:0:0:0:0:1]/list.txt", function() {
    assert.strictEqual(Subscription.isValidURL("http://[0:0:0:0:0:0:0:1]/list.txt"), true);
  });

  it("should return true for data:,Hello%2C%20World!", function() {
    assert.strictEqual(Subscription.isValidURL("data:,Hello%2C%20World!"), true);
  });

  it("should return true for data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==", function() {
    assert.strictEqual(Subscription.isValidURL("data:text/plain;base64,SGVsbG8sIFdvcmxkIQ=="), true);
  });

  it("should return false for null or undefined urls", function() {
    assert.strictEqual(Subscription.isValidURL(null), false);
    assert.strictEqual(Subscription.isValidURL(void 0), false);
  });
});
