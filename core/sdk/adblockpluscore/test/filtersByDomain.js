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

const {Filter} = require(LIB_FOLDER + "/filterClasses");
const {FiltersByDomain, FilterMap} = require(LIB_FOLDER + "/filtersByDomain");

describe("Filters by domain", function() {
  it("Filters by domain", function() {
    let filtersByDomain = new FiltersByDomain();

    assert.equal(filtersByDomain.size, 0);
    assert.equal([...filtersByDomain.entries()].length, 0);
    assert.equal(filtersByDomain.has("example.com"), false);
    assert.strictEqual(filtersByDomain.get("example.com"), undefined);

    filtersByDomain.clear();

    let filter1 = Filter.fromText("^foo^$domain=example.com|~www.example.com");

    assert.equal(filtersByDomain.size, 0);
    assert.equal([...filtersByDomain.entries()].length, 0);
    assert.equal(filtersByDomain.has("example.com"), false);
    assert.strictEqual(filtersByDomain.get("example.com"), undefined);

    filtersByDomain.remove(filter1);

    assert.equal(filtersByDomain.size, 0);
    assert.equal([...filtersByDomain.entries()].length, 0);
    assert.equal(filtersByDomain.has("example.com"), false);
    assert.strictEqual(filtersByDomain.get("example.com"), undefined);

    filtersByDomain.add(filter1);

    // FiltersByDomain {
    //   "example.com" => filter1,
    //   "www.example.com" => FilterMap { filter1 => false }
    // }
    assert.equal(filtersByDomain.size, 2);
    assert.equal([...filtersByDomain.entries()].length, 2);
    assert.equal(filtersByDomain.has("example.com"), true);
    assert.equal(filtersByDomain.get("example.com"), filter1);

    assert.equal(filtersByDomain.has("www.example.com"), true);
    assert.ok(filtersByDomain.get("www.example.com") instanceof FilterMap);
    assert.equal(filtersByDomain.get("www.example.com").size, 1);
    assert.deepEqual(
      [...filtersByDomain.get("www.example.com").entries()],
      [[filter1, false]]
    );

    let filter2 = Filter.fromText("^bar^$domain=example.com");

    filtersByDomain.add(filter2);

    // FiltersByDomain {
    //   "example.com" => FilterMap { filter1 => true, filter2 => true }
    //   "www.example.com" => FilterMap { filter1 => false }
    // }
    assert.equal(filtersByDomain.size, 2);
    assert.equal([...filtersByDomain.entries()].length, 2);
    assert.equal(filtersByDomain.has("example.com"), true);

    assert.ok(filtersByDomain.get("example.com") instanceof FilterMap);
    assert.equal(filtersByDomain.get("example.com").size, 2);
    assert.deepEqual(
      [...filtersByDomain.get("example.com").entries()],
      [[filter1, true], [filter2, true]]
    );

    let filter3 = Filter.fromText("^lambda^$domain=~images.example.com");

    filtersByDomain.add(filter3);

    // FiltersByDomain {
    //   "example.com" => FilterMap { filter1 => true, filter2 => true }
    //   "www.example.com" => FilterMap { filter1 => false }
    //   "" => filter3,
    //   "images.example.com" => FilterMap { filter3 => false }
    // }
    assert.equal(filtersByDomain.size, 4);
    assert.equal([...filtersByDomain.entries()].length, 4);
    assert.equal(filtersByDomain.has(""), true);
    assert.equal(filtersByDomain.get(""), filter3);

    assert.equal(filtersByDomain.has("images.example.com"), true);
    assert.ok(filtersByDomain.get("images.example.com") instanceof FilterMap);
    assert.equal(filtersByDomain.get("images.example.com").size, 1);
    assert.deepEqual(
      [...filtersByDomain.get("images.example.com").entries()],
      [[filter3, false]]
    );

    filtersByDomain.remove(filter1);

    // FiltersByDomain {
    //   "example.com" => filter2,
    //   "" => filter3,
    //   "images.example.com" => FilterMap { filter3 => false }
    // }
    assert.equal(filtersByDomain.size, 3);
    assert.equal([...filtersByDomain.entries()].length, 3);
    assert.equal(filtersByDomain.has("www.example.com"), false);
    assert.strictEqual(filtersByDomain.get("www.example.com"), undefined);

    assert.equal(filtersByDomain.has("example.com"), true);
    assert.equal(filtersByDomain.get("example.com"), filter2);

    filtersByDomain.remove(filter2);

    // FiltersByDomain {
    //   "" => filter3,
    //   "images.example.com" => FilterMap { filter3 => false }
    // }
    assert.equal(filtersByDomain.size, 2);
    assert.equal([...filtersByDomain.entries()].length, 2);
    assert.equal(filtersByDomain.has("example.com"), false);
    assert.strictEqual(filtersByDomain.get("example.com"), undefined);

    filtersByDomain.remove(filter3);

    // FiltersByDomain {}
    assert.equal(filtersByDomain.size, 0);
    assert.equal([...filtersByDomain.entries()].length, 0);
    assert.equal(filtersByDomain.has("images.example.com"), false);
    assert.strictEqual(filtersByDomain.get("images.example.com"), undefined);

    assert.equal(filtersByDomain.has(""), false);
    assert.strictEqual(filtersByDomain.get(""), undefined);

    filtersByDomain.add(filter1);
    filtersByDomain.add(filter2);
    filtersByDomain.add(filter3);

    assert.equal(filtersByDomain.size, 4);
    assert.equal([...filtersByDomain.entries()].length, 4);

    filtersByDomain.clear();

    assert.equal(filtersByDomain.size, 0);
    assert.equal([...filtersByDomain.entries()].length, 0);
  });

  it("Filters by domain wildcards", function() {
    let filtersByDomain = new FiltersByDomain();

    assert.equal(filtersByDomain.size, 0);
    assert.equal([...filtersByDomain.entries()].length, 0);
    assert.equal(filtersByDomain.has("example.com"), false);
    assert.strictEqual(filtersByDomain.get("example.com"), undefined);

    filtersByDomain.clear();

    let filter1 = Filter.fromText("^foo1^$domain=example.*");
    filtersByDomain.add(filter1);

    // wildcards FiltersByDomain {
    //   "example.*" => filter1
    // }

    // "example.*" is added to separately internally stored list of
    // domains with wildcards (this.domainsWithWildcards) leaving the main map empty
    assert.equal(filtersByDomain.size, 0);
    assert.equal([...filtersByDomain.entries()].length, 0);

    // matching
    assert.equal(filtersByDomain.has("example.com"), true);
    assert.strictEqual(filtersByDomain.get("example.com").size, 1);

    // not matching
    assert.equal(filtersByDomain.has("domain.com"), false);
    assert.strictEqual(filtersByDomain.get("domain.com"), undefined);

    // removal
    filtersByDomain.remove(filter1);

    // wildcards FiltersByDomain {
    // }

    assert.equal(filtersByDomain.size, 0);
    assert.equal([...filtersByDomain.entries()].length, 0);
    assert.equal(filtersByDomain.has("example.com"), false);
    assert.strictEqual(filtersByDomain.get("example.com"), undefined);

    filtersByDomain.add(filter1);

    let filter2 = Filter.fromText("^foo2^$domain=~images.example.*");
    filtersByDomain.add(filter2);

    // empty string mapping is reserved for generic matching

    // FiltersByDomain {
    //   "" => filter2
    // }
    // wildcards FiltersByDomain {
    //   "example.*" => filter1
    //   "images.example.*" => FilterMap { filter2 => false }
    // }

    // filter1 is used as an equivalent of `FilterMap { filter1 => true }`
    // for better memory consumption

    assert.equal(filtersByDomain.size, 1);
    assert.equal([...filtersByDomain.entries()].length, 1);
    assert.equal(filtersByDomain.has(""), true);
    assert.equal(filtersByDomain.get(""), filter2);

    assert.equal(filtersByDomain.has("images.example.com"), true);
    assert.ok(filtersByDomain.get("images.example.com") instanceof FilterMap);
    assert.equal(filtersByDomain.get("images.example.com").size, 2);

    assert.deepEqual(
      [...filtersByDomain.get("images.example.com").entries()],
      [[filter1, true], [filter2, false]]
    );

    let filter3 = Filter.fromText("^foo3^$domain=images.example.*");
    filtersByDomain.add(filter3);

    // FiltersByDomain {
    //   "" => filter2
    // }
    // wildcards FiltersByDomain {
    //   "example.*" => filter1
    //   "images.example.*" => FilterMap { filter2 => false, filter3 => true }
    // }

    assert.equal(filtersByDomain.has("images.example.com"), true);
    assert.ok(filtersByDomain.get("images.example.com") instanceof FilterMap);
    assert.equal(filtersByDomain.get("images.example.com").size, 3);

    assert.deepEqual(
      [...filtersByDomain.get("images.example.com").entries()],
      [[filter1, true], [filter2, false], [filter3, true]]
    );

    let filter4 = Filter.fromText("^foo4^$domain=images.example.com");
    filtersByDomain.add(filter4);

    // FiltersByDomain {
    //   "" => filter2
    //   "images.example.com" => filter4
    // }
    // wildcards FiltersByDomain {
    //   "example.*" => filter1
    //   "images.example.*" => FilterMap { filter2 => false, filter3 => true }
    // }

    assert.equal(filtersByDomain.has("images.example.com"), true);
    assert.ok(filtersByDomain.get("images.example.com") instanceof FilterMap);
    assert.equal(filtersByDomain.get("images.example.com").size, 4);

    assert.deepEqual(
      [...filtersByDomain.get("images.example.com").entries()],
      [[filter4, true], [filter1, true], [filter2, false], [filter3, true]]
    );
  });

  it("returns the matches for TLDs", function() {
    let filtersByDomain = new FiltersByDomain();

    let filter1 = Filter.fromText("||foo.net^$domain=example.*");
    filtersByDomain.add(filter1);

    let filter2 = Filter.fromText("||bar.net^$domain=~example.*");
    filtersByDomain.add(filter2);

    for (let suffix of [".com", ".ae", ".ru"]) {
      let domain = "example" + suffix;
      assert.equal(filtersByDomain.has(domain), true);
      assert.ok(filtersByDomain.get(domain) instanceof FilterMap);
      assert.equal(filtersByDomain.get(domain).size, 2);

      assert.deepEqual(
        [...filtersByDomain.get(domain).entries()],
        [[filter1, true], [filter2, false]]
      );
    }
  });
});
