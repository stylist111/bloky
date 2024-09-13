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
import {ignoreNoConnectionError} from "../../../sdk/all/errors.js";

describe("Errors", function() {
  it("ignores could not establish connection errors", async function() {
    await expect(
      ignoreNoConnectionError(
        Promise.reject(new Error("Could not establish connection. Receiving end does not exist."))
      )
    ).resolves.toBeUndefined();
  });

  it("ignores closed connection errors", async function() {
    await expect(
      ignoreNoConnectionError(
        Promise.reject(new Error("A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"))
      )
    ).resolves.toBeUndefined();
  });

  it("ignores manager disconnected errors", async function() {
    await expect(
      ignoreNoConnectionError(
        Promise.reject(new Error("Message manager disconnected"))
      )
    ).resolves.toBeUndefined();
  });

  it("passes through other errors", async function() {
    await expect(
      ignoreNoConnectionError(
        Promise.reject(new Error("Internal Error"))
      )
    ).rejects.toThrow();
  });
});
