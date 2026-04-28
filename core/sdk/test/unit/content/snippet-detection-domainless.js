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
import {AbstractLogger} from "../../../src/all/telemetry.js";
import {default as events} from "../../../events.js";
import {createSnippetDetectionDomainlessSender} from "../../../src/content/isolated/core/snippet-events.js";

describe("snippet_detection_domainless schema validation", function() {
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

  it("passes validation with type string and specifier string", function() {
    logger.behavior("snippet_detection_domainless", {
      type: "wall-adshield-script",
      specifier: "default"
    });

    expect(spy.calledOnce).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("passes validation with specifier as null", function() {
    logger.behavior("snippet_detection_domainless", {
      type: "wall-adshield-script",
      specifier: null
    });

    expect(spy.calledOnce).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("passes validation with specifier as empty string", function() {
    logger.behavior("snippet_detection_domainless", {
      type: "wall-adshield-script",
      specifier: ""
    });

    expect(spy.calledOnce).toBe(true);
    expect(console.error.called).toBe(false);
  });

  it("fails validation without specifier property", function() {
    logger.behavior("snippet_detection_domainless", {
      type: "wall-adshield-script"
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/does not match the schema/);
  });

  it("fails validation with non-string type", function() {
    logger.behavior("snippet_detection_domainless", {
      type: 123,
      specifier: null
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
  });

  it("fails validation without type property", function() {
    logger.behavior("snippet_detection_domainless", {
      specifier: null
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/does not match the schema/);
  });

  it("fails validation with specifier as undefined (documents why the sender coerces undefined to null)", function() {
    logger.behavior("snippet_detection_domainless", {
      type: "wall-adshield-script",
      specifier: void 0
    });

    expect(spy.called).toBe(false);
    expect(console.error.calledOnce).toBe(true);
    expect(console.error.firstCall.args[0]).toMatch(/does not match the schema/);
  });
});

describe("createSnippetDetectionDomainlessSender", function() {
  let logger;
  let sentryReporter;
  let behaviorSpy;

  beforeEach(function() {
    logger = new AbstractLogger("snippets", events);
    behaviorSpy = sinon.spy(logger, "behavior");
    sentryReporter = {reportError: sinon.spy()};
    sinon.stub(console, "error");
  });

  afterEach(function() {
    sinon.restore();
  });

  it("GDPR: domain MUST NOT appear in snippet_detection_domainless payload",
    function() {
      const sender = createSnippetDetectionDomainlessSender(
        logger, sentryReporter
      );
      sender("wall-adshield-script", "example.com", "div.paywall");

      expect(behaviorSpy.calledOnce).toBe(true);
      const data = behaviorSpy.firstCall.args[1];
      expect(data.type).toBe("wall-adshield-script");
      expect(data.specifier).toBe("div.paywall");
      expect(data.domain).toBeUndefined();
    });

  it("coerces undefined specifier to null so validation passes", function() {
    const sender = createSnippetDetectionDomainlessSender(
      logger, sentryReporter
    );
    sender("wall-adshield-script", "example.com", void 0);

    expect(behaviorSpy.calledOnce).toBe(true);
    const data = behaviorSpy.firstCall.args[1];
    expect(data.specifier).toBe(null);
    expect(console.error.called).toBe(false);
  });

  it("coerces absent specifier argument to null so validation passes",
    function() {
      const sender = createSnippetDetectionDomainlessSender(
        logger, sentryReporter
      );
      sender("wall-adshield-script", "example.com");

      expect(behaviorSpy.calledOnce).toBe(true);
      const data = behaviorSpy.firstCall.args[1];
      expect(data.specifier).toBe(null);
      expect(console.error.called).toBe(false);
    });

  it("logs console.error and does not send when type is not a string",
    function() {
      const sender = createSnippetDetectionDomainlessSender(
        logger, sentryReporter
      );
      sender(123, "example.com", "div.paywall");

      expect(behaviorSpy.called).toBe(false);
      expect(console.error.calledOnce).toBe(true);
    });

  it("logs console.error and sends null specifier when specifier is non-string",
    function() {
      const sender = createSnippetDetectionDomainlessSender(
        logger, sentryReporter
      );
      sender("wall-adshield-script", "example.com", 42);

      expect(console.error.calledOnce).toBe(true);
      expect(behaviorSpy.calledOnce).toBe(true);
      const data = behaviorSpy.firstCall.args[1];
      expect(data.specifier).toBe(null);
    });

  it("reports to sentry if logger throws", function() {
    const err = new Error("logger failure");
    const throwingLogger = new AbstractLogger("snippets", events);
    sinon.stub(throwingLogger, "behavior").throws(err);
    const sender = createSnippetDetectionDomainlessSender(
      throwingLogger, sentryReporter
    );
    sender("wall-adshield-script", "example.com");

    expect(sentryReporter.reportError.calledOnceWith(err)).toBe(true);
  });
});
