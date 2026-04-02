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
  createSnippetDetectionEventSender
} from "../../../src/content/isolated/core/snippet-events.js";
import {AbstractLogger} from "../../../src/all/telemetry.js";
import {default as events} from "../../../events.js";

describe("createSnippetDetectionEventSender", function() {
  let mockLogger;
  let mockSentry;
  let sendDetectionEvent;

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
    sendDetectionEvent = createSnippetDetectionEventSender(
      mockLogger, mockSentry
    );
  });

  afterEach(function() {
    sandbox.restore();
  });

  it("calls logger.behavior with correct event name and full data", function() {
    sendDetectionEvent("wall_detected", "example.com", ".overlay-wall-container");

    expect(mockLogger.behavior.calledOnce).toBe(true);
    expect(mockLogger.behavior.calledWith("snippet_detection_event", {
      type: "wall_detected",
      domain: "example.com",
      specifier: ".overlay-wall-container"
    })).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("passes specifier as null when not provided", function() {
    sendDetectionEvent("wall_detected", "example.com");

    expect(mockLogger.behavior.calledOnce).toBe(true);
    expect(mockLogger.behavior.calledWith("snippet_detection_event", {
      type: "wall_detected",
      domain: "example.com",
      specifier: null
    })).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("passes specifier as null when explicitly null", function() {
    sendDetectionEvent("wall_detected", "example.com", null);

    expect(mockLogger.behavior.calledOnce).toBe(true);
    const callArgs = mockLogger.behavior.firstCall.args;
    expect(callArgs[1].specifier).toBe(null);
    expect(console.error.called).toBe(false);
  });

  it("passes specifier as null when undefined", function() {
    sendDetectionEvent("wall_detected", "example.com", void 0);

    expect(mockLogger.behavior.calledOnce).toBe(true);
    const callArgs = mockLogger.behavior.firstCall.args;
    expect(callArgs[1].specifier).toBe(null);
    expect(console.error.called).toBe(false);
  });

  it("includes specifier when empty string", function() {
    sendDetectionEvent("wall_detected", "example.com", "");

    expect(mockLogger.behavior.calledOnce).toBe(true);
    const callArgs = mockLogger.behavior.firstCall.args;
    expect(callArgs[1]).toHaveProperty("specifier", "");
    expect(console.error.called).toBe(false);
  });

  it("ignores non-string specifier: number", function() {
    sendDetectionEvent("wall_detected", "example.com", 42);

    expect(mockLogger.behavior.calledOnce).toBe(true);
    const callArgs = mockLogger.behavior.firstCall.args;
    expect(callArgs[1].specifier).toBe(null);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/specifier must be a string/);
  });

  it("ignores non-string specifier: object", function() {
    sendDetectionEvent("wall_detected", "example.com", {selector: ".wall"});

    expect(mockLogger.behavior.calledOnce).toBe(true);
    const callArgs = mockLogger.behavior.firstCall.args;
    expect(callArgs[1].specifier).toBe(null);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/specifier must be a string/);
  });

  it("ignores non-string specifier: array", function() {
    sendDetectionEvent("wall_detected", "example.com", [".wall"]);

    expect(mockLogger.behavior.calledOnce).toBe(true);
    const callArgs = mockLogger.behavior.firstCall.args;
    expect(callArgs[1].specifier).toBe(null);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/specifier must be a string/);
  });

  it("ignores non-string specifier: boolean", function() {
    sendDetectionEvent("wall_detected", "example.com", true);

    expect(mockLogger.behavior.calledOnce).toBe(true);
    const callArgs = mockLogger.behavior.firstCall.args;
    expect(callArgs[1].specifier).toBe(null);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/specifier must be a string/);
  });

  it("does not call logger when no arguments provided", function() {
    sendDetectionEvent();

    expect(mockLogger.behavior.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/type and domain are required strings/);
  });

  it("does not call logger when type is missing", function() {
    sendDetectionEvent(void 0, "example.com");

    expect(mockLogger.behavior.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/type and domain are required strings/);
  });

  it("does not call logger when domain is missing", function() {
    sendDetectionEvent("wall_detected");

    expect(mockLogger.behavior.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/type and domain are required strings/);
  });

  it("does not call logger when type is not a string", function() {
    sendDetectionEvent(123, "example.com");

    expect(mockLogger.behavior.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/type and domain are required strings/);
  });

  it("does not call logger when domain is not a string", function() {
    sendDetectionEvent("wall_detected", 123);

    expect(mockLogger.behavior.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/type and domain are required strings/);
  });

  it("handles multiple calls independently", function() {
    sendDetectionEvent("wall_detected", "example.com", ".wall");
    sendDetectionEvent("wall_detected", "other.com");

    expect(mockLogger.behavior.callCount).toBe(2);
    expect(mockLogger.behavior.firstCall.args[1].specifier).toBe(".wall");
    expect(mockLogger.behavior.secondCall.args[1].specifier).toBe(null);
  });

  it("ignores extra arguments", function() {
    sendDetectionEvent("wall_detected", "example.com", ".wall", "extra", "args");

    expect(mockLogger.behavior.calledOnce).toBe(true);
    expect(mockLogger.behavior.calledWith("snippet_detection_event", {
      type: "wall_detected",
      domain: "example.com",
      specifier: ".wall"
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
      sendDetectionEvent("wall_detected", "example.com");
    }).not.toThrow();
    expect(mockSentry.reportError.calledOnce).toBe(true);
    expect(mockSentry.reportError.calledWith(error)).toBe(true);
  });

  it("returns a function", function() {
    const sender = createSnippetDetectionEventSender(mockLogger);
    expect(typeof sender).toBe("function");
  });
});

describe("snippet_detection_event schema validation", function() {
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

  it("passes validation with type, domain, and specifier", function() {
    logger.behavior("snippet_detection_event", {
      type: "wall_detected",
      domain: "example.com",
      specifier: ".overlay-wall-container"
    });

    expect(spy.calledOnce).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("passes validation with specifier as null", function() {
    logger.behavior("snippet_detection_event", {
      type: "wall_detected",
      domain: "example.com",
      specifier: null
    });

    expect(spy.calledOnce).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("fails validation without specifier property (schema requires all properties)", function() {
    logger.behavior("snippet_detection_event", {
      type: "wall_detected",
      domain: "example.com"
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/does not match the schema/);
  });

  it("passes validation with specifier as empty string", function() {
    logger.behavior("snippet_detection_event", {
      type: "wall_detected",
      domain: "example.com",
      specifier: ""
    });

    expect(spy.calledOnce).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("passes validation with extra unknown properties", function() {
    logger.behavior("snippet_detection_event", {
      type: "wall_detected",
      domain: "example.com",
      specifier: null,
      extra: "ignored"
    });

    expect(spy.calledOnce).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("fails validation with non-string type", function() {
    logger.behavior("snippet_detection_event", {
      type: 123,
      domain: "example.com",
      specifier: null
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
  });

  it("fails validation with non-string domain", function() {
    logger.behavior("snippet_detection_event", {
      type: "wall_detected",
      domain: 123,
      specifier: null
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
  });
});
