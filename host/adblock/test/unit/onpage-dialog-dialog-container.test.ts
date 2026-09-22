/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

import { afterEach, describe, expect, it } from "vitest";

import { getDialogContainer } from "../../adblock-betafish/onpage-dialog/content/dialog-container";

describe("getDialogContainer", () => {
  afterEach(() => {
    document.documentElement.innerHTML = "<body></body>";
  });

  it("returns document.body for a normal page", () => {
    expect(getDialogContainer()).toBe(document.body);
  });

  it("returns document.documentElement when document.body is a <frameset>", () => {
    document.documentElement.innerHTML = "<frameset></frameset>";

    expect(document.body.tagName).toBe("FRAMESET");
    expect(getDialogContainer()).toBe(document.documentElement);
    expect(getDialogContainer()).not.toBe(document.body);
  });
});
