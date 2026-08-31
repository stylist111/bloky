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

import { type Dialog } from "./dialog.types";
import { type Stats } from "./stats.types";
import { shouldBeDismissed, start } from "./timing";
import { Timing } from "./timing.types";

jest.mock("../../../adblockpluschrome/lib/prefs", () => {
  const prefsData: Record<string, any> = {
    onpage_dialog_timing_configurations: {
      after_navigation: {
        cooldownDuration: 1,
        maxDisplayCount: 1
      },
      immediate: {
        cooldownDuration: 0,
        maxDisplayCount: 0
      }
    }
  };

  return {
    Prefs: {
      get: (key: string) => prefsData[key],
      set: (key: string, value: any) => {
        prefsData[key] = value;
      },
      on: jest.fn(),
      untilLoaded: Promise.resolve()
    }
  };
});

const dialog: Dialog = {
  behavior: {
    displayDuration: 0,
    target: "",
    timing: Timing.afterNavigation,
    priority: 1
  },
  content: { body: [], button: "", title: "" },
  id: "campaign-1",
  ipmId: "campaign-1"
};

function statsAfter(displayCount: number): Stats {
  return { displayCount, lastDisplayTime: 0 };
}

describe("shouldBeDismissed", () => {
  beforeAll(async () => {
    await start();
  });

  it("dismisses once the display count from preferences is reached", () => {
    expect(shouldBeDismissed(dialog, statsAfter(1))).toBe(true);
  });

  it("keeps the dialog active below the display count from preferences", () => {
    expect(shouldBeDismissed(dialog, statsAfter(0))).toBe(false);
  });

  it("uses the overridden display count instead of the preference", () => {
    expect(shouldBeDismissed(dialog, statsAfter(1), 3)).toBe(false);
    expect(shouldBeDismissed(dialog, statsAfter(2), 3)).toBe(false);
    expect(shouldBeDismissed(dialog, statsAfter(3), 3)).toBe(true);
  });

  it("falls back to the preference when no override is given", () => {
    expect(shouldBeDismissed(dialog, statsAfter(1), undefined)).toBe(true);
  });

  it("does not let one campaign's override affect another campaign", () => {
    expect(shouldBeDismissed(dialog, statsAfter(2), 3)).toBe(false);
    expect(shouldBeDismissed(dialog, statsAfter(2))).toBe(true);
  });

  it("treats an unknown timing as dismissed", () => {
    const unknown: Dialog = {
      ...dialog,
      behavior: { ...dialog.behavior, timing: Timing.afterWebAllowlisting }
    };

    expect(shouldBeDismissed(unknown, statsAfter(0))).toBe(true);
  });

  it("keeps timings with an unlimited display count active", () => {
    const unlimited: Dialog = {
      ...dialog,
      behavior: { ...dialog.behavior, timing: Timing.immediate }
    };

    expect(shouldBeDismissed(unlimited, statsAfter(99))).toBe(false);
  });
});
