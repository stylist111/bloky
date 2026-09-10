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

const {DnrMapper} = require(LIB_FOLDER + "/dnr/mapper");

describe("DNR Mapper", function() {
  function loader() {
    return [["-ad-button-", [454852]]];
  }

  it("finds the filter in the map", async function() {
    let mapper = new DnrMapper(async() => loader());
    await mapper.load();

    let ids = mapper.get("-ad-button-");
    assert.deepEqual(ids, [454852]);
  });
});
