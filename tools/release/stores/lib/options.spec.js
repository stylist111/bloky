/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2026-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

import { describe, expect, it } from "vitest";

import { requireOptions } from "./options.js";

describe("requireOptions", () => {
  it("accepts options that are all present", () => {
    expect(() =>
      requireOptions({ apiKey: "key", retries: 0 }, ["apiKey", "retries"], "x"),
    ).not.toThrow();
  });

  it("lists every missing, null or empty option", () => {
    expect(() =>
      requireOptions(
        { accessToken: "", publisherId: null },
        ["accessToken", "publisherId", "itemId"],
        "createChromeWebStoreClient",
      ),
    ).toThrow(
      new TypeError(
        "createChromeWebStoreClient: missing required option(s): accessToken, publisherId, itemId",
      ),
    );
  });

  it("treats missing options objects as empty", () => {
    expect(() => requireOptions(undefined, ["idToken"], "upload")).toThrow(
      "upload: missing required option(s): idToken",
    );
  });
});
