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
import sinon from "sinon/pkg/sinon.js";
import {
  isSnippetEventDuplicate,
  clearDedupState,
  setDedupWindowForTesting,
  restoreDedupWindow
} from "../../../src/background/telemetry/snippet-event-dedup.js";

const FIVE_MINUTES = 5 * 60 * 1000;

describe("Snippet event de-duplication", function() {
  let clock;

  beforeEach(function() {
    clock = sinon.useFakeTimers({now: 1000000});
    clearDedupState();
  });

  afterEach(function() {
    clock.restore();
  });

  it("returns false for the first event of a (type, domain) pair", function() {
    expect(isSnippetEventDuplicate("adshield-script", "example.com"))
      .toBe(false);
  });

  it("returns true for the same (type, domain) within 5 minutes", function() {
    isSnippetEventDuplicate("adshield-script", "example.com");

    clock.tick(FIVE_MINUTES - 1);
    expect(isSnippetEventDuplicate("adshield-script", "example.com"))
      .toBe(true);
  });

  it("returns false for the same (type, domain) at exactly 5 minutes", function() {
    isSnippetEventDuplicate("adshield-script", "example.com");

    clock.tick(FIVE_MINUTES);
    expect(isSnippetEventDuplicate("adshield-script", "example.com"))
      .toBe(false);
  });

  it("returns false for different type, same domain", function() {
    isSnippetEventDuplicate("adshield-script", "example.com");

    expect(isSnippetEventDuplicate("freestar-recovered", "example.com"))
      .toBe(false);
  });

  it("returns false for same type, different domain", function() {
    isSnippetEventDuplicate("adshield-script", "example.com");

    expect(isSnippetEventDuplicate("adshield-script", "other.com"))
      .toBe(false);
  });

  it("resets all state on clearDedupState", function() {
    isSnippetEventDuplicate("adshield-script", "example.com");

    clearDedupState();

    expect(isSnippetEventDuplicate("adshield-script", "example.com"))
      .toBe(false);
  });

  it("re-records expired entry with new timestamp", function() {
    isSnippetEventDuplicate("adshield-script", "example.com");

    clock.tick(FIVE_MINUTES);
    expect(isSnippetEventDuplicate("adshield-script", "example.com"))
      .toBe(false);

    clock.tick(60000);
    expect(isSnippetEventDuplicate("adshield-script", "example.com"))
      .toBe(true);

    clock.tick(FIVE_MINUTES - 60000);
    expect(isSnippetEventDuplicate("adshield-script", "example.com"))
      .toBe(false);
  });

  it("handles null type", function() {
    expect(isSnippetEventDuplicate(null, "example.com"))
      .toBe(false);
    expect(isSnippetEventDuplicate(null, "example.com"))
      .toBe(true);
  });

  it("handles undefined domain", function() {
    expect(isSnippetEventDuplicate("adshield-script", void 0))
      .toBe(false);
    expect(isSnippetEventDuplicate("adshield-script", void 0))
      .toBe(true);
  });

  it("handles empty string type and domain", function() {
    expect(isSnippetEventDuplicate("", ""))
      .toBe(false);
    expect(isSnippetEventDuplicate("", ""))
      .toBe(true);
  });

  it("tracks multiple interleaved events independently", function() {
    expect(isSnippetEventDuplicate("adshield-script", "example.com"))
      .toBe(false);
    expect(isSnippetEventDuplicate("freestar-recovered", "other.com"))
      .toBe(false);

    clock.tick(60000);
    expect(isSnippetEventDuplicate("adshield-script", "example.com"))
      .toBe(true);
    expect(isSnippetEventDuplicate("freestar-recovered", "other.com"))
      .toBe(true);

    clock.tick(FIVE_MINUTES - 60000);
    expect(isSnippetEventDuplicate("adshield-script", "example.com"))
      .toBe(false);
    expect(isSnippetEventDuplicate("freestar-recovered", "other.com"))
      .toBe(false);
  });

  describe("window override", function() {
    afterEach(function() {
      restoreDedupWindow();
    });

    it("uses overridden window for duplicate check", function() {
      setDedupWindowForTesting(1000);
      isSnippetEventDuplicate("adshield-script", "example.com");

      clock.tick(999);
      expect(isSnippetEventDuplicate("adshield-script", "example.com"))
        .toBe(true);

      clock.tick(1);
      expect(isSnippetEventDuplicate("adshield-script", "example.com"))
        .toBe(false);
    });

    it("restores default 5-minute window", function() {
      setDedupWindowForTesting(100);
      restoreDedupWindow();
      isSnippetEventDuplicate("adshield-script", "example.com");

      clock.tick(FIVE_MINUTES - 1);
      expect(isSnippetEventDuplicate("adshield-script", "example.com"))
        .toBe(true);

      clock.tick(1);
      expect(isSnippetEventDuplicate("adshield-script", "example.com"))
        .toBe(false);
    });
  });
});
