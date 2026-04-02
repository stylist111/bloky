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

import sinon from "sinon/pkg/sinon.js";
import expect from "expect";
import {
  gateSnippetEvent
} from "../../../src/content/isolated/core/snippet-events.js";

describe("gateSnippetEvent", function() {
  let fakeSender;

  beforeEach(function() {
    fakeSender = sinon.stub();
  });

  it("returns the real sender when enabled is true", function() {
    const gated = gateSnippetEvent(true, fakeSender);
    expect(gated).toBe(fakeSender);
  });

  it("returns a no-op when enabled is false", function() {
    const gated = gateSnippetEvent(false, fakeSender);
    expect(gated).not.toBe(fakeSender);

    gated("some-event", "example.com");
    expect(fakeSender.called).toBe(false);
  });

  it("returns a no-op when enabled is undefined", function() {
    const gated = gateSnippetEvent(void 0, fakeSender);
    expect(gated).not.toBe(fakeSender);

    gated("some-event", "example.com");
    expect(fakeSender.called).toBe(false);
  });

  it("returns a no-op when enabled is null", function() {
    const gated = gateSnippetEvent(null, fakeSender);
    expect(gated).not.toBe(fakeSender);

    gated("some-event", "example.com");
    expect(fakeSender.called).toBe(false);
  });

  it("no-op is callable without error", function() {
    const gated = gateSnippetEvent(false, fakeSender);
    expect(() => {
      gated("some-event", "example.com", ".extra");
    }).not.toThrow();
  });
});
