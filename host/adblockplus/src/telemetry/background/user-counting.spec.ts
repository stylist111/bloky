/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { start } from "./user-counting";

describe("User counting", () => {
  beforeEach(() => {
    jest.spyOn(ewe.telemetry, "setOptOut").mockReturnValue(Promise.resolve());
  });

  it("sets the opt-out value from prefs on initialization", async () => {
    await Prefs.set("data_collection_opt_out", true);
    await start();
    expect(ewe.telemetry.setOptOut).toHaveBeenCalledWith(true);
  });
});
