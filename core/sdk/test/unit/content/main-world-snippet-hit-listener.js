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
  handleSnippetHitMessage
} from "../../../src/content/isolated/core/snippet-events.js";

describe("handleSnippetHitMessage", function() {
  let sendFn;

  beforeEach(function() {
    sendFn = sinon.stub();
  });

  it("calls sendFn with filter and domain when enabled", function() {
    handleSnippetHitMessage(
      {filter: "json-prune 'ads'", domain: "example.com"},
      true,
      sendFn
    );

    expect(sendFn.calledOnce).toBe(true);
    expect(sendFn.calledWith("json-prune 'ads'", "example.com")).toBe(true);
  });

  it("does not call sendFn when disabled", function() {
    handleSnippetHitMessage(
      {filter: "json-prune", domain: "example.com"},
      false,
      sendFn
    );

    expect(sendFn.called).toBe(false);
  });

  it("does not call sendFn when filter is not a string", function() {
    handleSnippetHitMessage(
      {filter: 123, domain: "example.com"},
      true,
      sendFn
    );

    expect(sendFn.called).toBe(false);
  });

  it("does not call sendFn when domain is not a string", function() {
    handleSnippetHitMessage(
      {filter: "json-prune", domain: null},
      true,
      sendFn
    );

    expect(sendFn.called).toBe(false);
  });

  it("does not call sendFn when filter is missing", function() {
    handleSnippetHitMessage(
      {domain: "example.com"},
      true,
      sendFn
    );

    expect(sendFn.called).toBe(false);
  });

  it("does not call sendFn when domain is missing", function() {
    handleSnippetHitMessage(
      {filter: "json-prune"},
      true,
      sendFn
    );

    expect(sendFn.called).toBe(false);
  });
});
