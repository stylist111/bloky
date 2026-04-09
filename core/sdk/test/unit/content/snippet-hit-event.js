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
  createSnippetHitEventSender
} from "../../../src/content/isolated/core/snippet-events.js";
import {AbstractLogger} from "../../../src/all/telemetry.js";
import {default as events} from "../../../events.js";

describe("createSnippetHitEventSender", function() {
  let mockLogger;
  let mockSentry;
  let sendSnippetHitEvent;

  let sandbox;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
    sandbox.stub(console, "error");
    mockLogger = {
      behavior: sinon.stub()
    };
    mockSentry = {
      reportError: sinon.stub()
    };
    sendSnippetHitEvent = createSnippetHitEventSender(
      mockLogger, mockSentry
    );
  });

  afterEach(function() {
    sandbox.restore();
  });

  it("calls logger.behavior with correct event name and data", function() {
    sendSnippetHitEvent("json-prune 'ads' 'userId'", "example.com");

    expect(mockLogger.behavior.calledOnce).toBe(true);
    expect(mockLogger.behavior.calledWith("snippet_hit_event", {
      filter: "json-prune 'ads' 'userId'",
      domain: "example.com"
    })).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("does not call logger when no arguments provided", function() {
    sendSnippetHitEvent();

    expect(mockLogger.behavior.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/filter and domain are required strings/);
  });

  it("does not call logger when filter is missing", function() {
    sendSnippetHitEvent(void 0, "example.com");

    expect(mockLogger.behavior.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/filter and domain are required strings/);
  });

  it("does not call logger when domain is missing", function() {
    sendSnippetHitEvent("override-property-read 'adConfig' 'undefined'");

    expect(mockLogger.behavior.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/filter and domain are required strings/);
  });

  it("does not call logger when filter is not a string", function() {
    sendSnippetHitEvent(123, "example.com");

    expect(mockLogger.behavior.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/filter and domain are required strings/);
  });

  it("does not call logger when domain is not a string", function() {
    sendSnippetHitEvent("override-property-read 'adConfig'", 123);

    expect(mockLogger.behavior.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/filter and domain are required strings/);
  });

  it("handles multiple calls independently", function() {
    sendSnippetHitEvent("override-property-read 'adConfig'", "example.com");
    sendSnippetHitEvent("json-prune 'ads'", "other.com");

    expect(mockLogger.behavior.callCount).toBe(2);
    expect(mockLogger.behavior.firstCall.args[1].filter).toBe("override-property-read 'adConfig'");
    expect(mockLogger.behavior.secondCall.args[1].filter).toBe("json-prune 'ads'");
  });

  it("ignores extra arguments", function() {
    sendSnippetHitEvent("override-property-read 'adConfig'", "example.com", "extra");

    expect(mockLogger.behavior.calledOnce).toBe(true);
    expect(mockLogger.behavior.calledWith("snippet_hit_event", {
      filter: "override-property-read 'adConfig'",
      domain: "example.com"
    })).toBe(true);
    expect(console.error.called).toBe(false);
  });

  // Workaround: the logger doesn't guarantee it won't throw, so the
  // sender catches errors defensively. Ideally the logger would handle
  // this internally.
  it("does not throw when logger throws, reports to sentry", function() {
    const error = new Error("telemetry failure");
    mockLogger.behavior.throws(error);

    expect(() => {
      sendSnippetHitEvent("override-property-read", "example.com");
    }).not.toThrow();
    expect(mockSentry.reportError.calledOnce).toBe(true);
    expect(mockSentry.reportError.calledWith(error)).toBe(true);
  });

  it("returns a function", function() {
    const sender = createSnippetHitEventSender(mockLogger);
    expect(typeof sender).toBe("function");
  });
});

describe("snippet_hit_event schema validation", function() {
  let logger;
  let spy;

  beforeEach(function() {
    logger = new AbstractLogger("snippets", events);
    spy = sinon.spy(logger, "_validatedLog");
    sinon.stub(console, "error");
  });

  afterEach(function() {
    sinon.restore();
  });

  it("passes validation with filter and domain", function() {
    logger.behavior("snippet_hit_event", {
      filter: "override-property-read 'adConfig' 'undefined'",
      domain: "example.com"
    });

    expect(spy.calledOnce).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("fails validation without domain property", function() {
    logger.behavior("snippet_hit_event", {
      filter: "override-property-read 'adConfig'"
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/does not match the schema/);
  });

  it("fails validation without filter property", function() {
    logger.behavior("snippet_hit_event", {
      domain: "example.com"
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/does not match the schema/);
  });

  it("passes validation with extra unknown properties", function() {
    logger.behavior("snippet_hit_event", {
      filter: "override-property-read 'adConfig'",
      domain: "example.com",
      extra: "ignored"
    });

    expect(spy.calledOnce).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("fails validation with non-string filter", function() {
    logger.behavior("snippet_hit_event", {
      filter: 123,
      domain: "example.com"
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
  });

  it("fails validation with non-string domain", function() {
    logger.behavior("snippet_hit_event", {
      filter: "override-property-read 'adConfig'",
      domain: 123
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
  });
});
