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
  withTopLevelDomain
} from "../../../src/content/isolated/core/snippet-events.js";

// withTopLevelDomain wraps sendDetectionEvent so that detection events
// from iframes report the top-level page domain instead of the iframe
// domain. When no top-level domain is available, the original sender
// is returned unchanged.
describe("withTopLevelDomain", function() {
  let mockSendDetectionEvent;

  beforeEach(function() {
    mockSendDetectionEvent = sinon.stub();
  });

  it("returns site domain when event fires on an iframe", function() {
    const send = withTopLevelDomain(
      "the-crossword-solver.com", mockSendDetectionEvent
    );
    send("wall_detected", "7.html-load.com", "script-loader");

    expect(mockSendDetectionEvent.calledOnce).toBe(true);
    expect(mockSendDetectionEvent.firstCall.args[0]).toBe("wall_detected");
    expect(mockSendDetectionEvent.firstCall.args[1])
      .toBe("the-crossword-solver.com");
    expect(mockSendDetectionEvent.firstCall.args[2]).toBe("script-loader");
  });

  it("sends through the original event when the domains match (not an iframe)", function() {
    const send = withTopLevelDomain(
      "example.com", mockSendDetectionEvent
    );
    send("wall_detected", "example.com", "overlay-container");

    expect(mockSendDetectionEvent.calledOnce).toBe(true);
    expect(mockSendDetectionEvent.firstCall.args[0]).toBe("wall_detected");
    expect(mockSendDetectionEvent.firstCall.args[1]).toBe("example.com");
    expect(mockSendDetectionEvent.firstCall.args[2]).toBe("overlay-container");
  });

  it("still handles events without a specifier", function() {
    const send = withTopLevelDomain(
      "example.com", mockSendDetectionEvent
    );
    send("wall_detected", "iframe-domain.com");

    expect(mockSendDetectionEvent.calledOnce).toBe(true);
    expect(mockSendDetectionEvent.firstCall.args[0]).toBe("wall_detected");
    expect(mockSendDetectionEvent.firstCall.args[1]).toBe("example.com");
    expect(mockSendDetectionEvent.firstCall.args.length).toBe(2);
  });

  it("doesn't change the event if top level domain is empty string", function() {
    const send = withTopLevelDomain("", mockSendDetectionEvent);
    send("wall_detected", "7.html-load.com", "script-loader");

    expect(mockSendDetectionEvent.calledOnce).toBe(true);
    expect(mockSendDetectionEvent.firstCall.args[0]).toBe("wall_detected");
    expect(mockSendDetectionEvent.firstCall.args[1]).toBe("7.html-load.com");
    expect(mockSendDetectionEvent.firstCall.args[2]).toBe("script-loader");
  });

  it("doesn't change the event if top level domain passed through is null", function() {
    const send = withTopLevelDomain(null, mockSendDetectionEvent);
    send("wall_detected", "7.html-load.com", "script-loader");

    expect(mockSendDetectionEvent.calledOnce).toBe(true);
    expect(mockSendDetectionEvent.firstCall.args[0]).toBe("wall_detected");
    expect(mockSendDetectionEvent.firstCall.args[1]).toBe("7.html-load.com");
    expect(mockSendDetectionEvent.firstCall.args[2]).toBe("script-loader");
  });

  it("doesn't change the event if top level domain is undefined", function() {
    const send = withTopLevelDomain(void 0, mockSendDetectionEvent);
    send("wall_detected", "7.html-load.com", "script-loader");

    expect(mockSendDetectionEvent.calledOnce).toBe(true);
    expect(mockSendDetectionEvent.firstCall.args[0]).toBe("wall_detected");
    expect(mockSendDetectionEvent.firstCall.args[1]).toBe("7.html-load.com");
    expect(mockSendDetectionEvent.firstCall.args[2]).toBe("script-loader");
  });
});
