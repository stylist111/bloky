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

import expect from "expect";
import {toTrackedFilterListUrl, isActiveFilterList} from "../../../src/background/remote-config/filter-list-urls.js";

const MV2_BASE = "https://easylist-downloads.adblockplus.org/";
const MV3_BASE = "https://easylist-downloads.adblockplus.org/v3/full/";

describe("toTrackedFilterListUrl", function() {
  it("passes through tracked filter lists", function() {
    const trackedFilenames = [
      "easylist.txt",
      "exceptionrules.txt",
      "exceptionrules-privacy-friendly.txt",
      "abp-filters-anti-cv.txt",
      "easyprivacy.txt",
      "adblock_premium.txt"
    ];

    for (const filename of trackedFilenames) {
      expect(toTrackedFilterListUrl(`${MV2_BASE}${filename}`))
        .toEqual([`${MV2_BASE}${filename}`]);
      expect(toTrackedFilterListUrl(`${MV3_BASE}${filename}`))
        .toEqual([`${MV3_BASE}${filename}`]);
    }
  });

  it("normalizes EasyList+Language variants to base EasyList URL (MV3)", function() {
    expect(toTrackedFilterListUrl(`${MV3_BASE}easylistgermany+easylist.txt`))
      .toEqual([`${MV3_BASE}easylist.txt`]);
    expect(toTrackedFilterListUrl(`${MV3_BASE}liste_ar+liste_fr+easylist.txt`))
      .toEqual([`${MV3_BASE}easylist.txt`]);
    expect(toTrackedFilterListUrl(`${MV2_BASE}easylistgermany+easylist.txt`))
      .toEqual([`${MV2_BASE}easylist.txt`]);
  });

  it("drops untracked filter lists", function() {
    expect(toTrackedFilterListUrl(`${MV3_BASE}fanboy-social.txt`)).toEqual([]);
    expect(toTrackedFilterListUrl(`${MV3_BASE}fanboy-notifications.txt`)).toEqual([]);
  });

  it("drops +easylist.txt URLs from unknown domains", function() {
    expect(toTrackedFilterListUrl("https://example.com/easylistgermany+easylist.txt")).toEqual([]);
  });
});

describe("isActiveFilterList", function() {
  const url = `${MV3_BASE}abp-filters-anti-cv.txt`;

  it("includes enabled bundled lists that were never downloaded", function() {
    expect(isActiveFilterList({
      url, enabled: true, downloadable: false, downloadCount: 0
    })).toBe(true);
  });

  it("excludes enabled downloadable lists that were never downloaded", function() {
    expect(isActiveFilterList({
      url, enabled: true, downloadable: true, downloadCount: 0
    })).toBe(false);
  });

  it("includes enabled downloadable lists after a download", function() {
    expect(isActiveFilterList({
      url, enabled: true, downloadable: true, downloadCount: 1
    })).toBe(true);
  });

  it("excludes disabled lists", function() {
    expect(isActiveFilterList({
      url, enabled: false, downloadable: false, downloadCount: 3
    })).toBe(false);
  });

  it("excludes subscriptions without a URL", function() {
    expect(isActiveFilterList({
      url: null, enabled: true, downloadable: false, downloadCount: 0
    })).toBe(false);
  });
});
