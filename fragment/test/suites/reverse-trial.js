/**
 * This file is part of eyeo's Fragment Test Extension,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import expect from "expect";
import { openNewTab } from "@eyeo/test-utils/driver";
import { getOptionsHandle } from "@eyeo/test-utils/extension";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const PREF_START_DATE = "reverse_trial_start_date";
const PREF_STEP = "reverse_trial_step";
// URL must match the content_scripts match pattern in the manifest
const targetUrl = "https://www.youtube.com/";

async function setReverseTrialPref(key, value) {
  await driver.switchTo().window(getOptionsHandle());
  return driver.executeScript(
    (k, v) =>
      browser.runtime.sendMessage({
        method: "testing.setReverseTrialPref",
        args: [k, v],
      }),
    key,
    value,
  );
}

async function getReverseTrialPref(key) {
  await driver.switchTo().window(getOptionsHandle());
  return driver.executeScript(
    (k) =>
      browser.runtime.sendMessage({
        method: "testing.getReverseTrialPref",
        args: [k],
      }),
    key,
  );
}

async function getStep() {
  return getReverseTrialPref(PREF_STEP);
}

async function setStep(value) {
  return setReverseTrialPref(PREF_STEP, value);
}

async function getStartDate() {
  return getReverseTrialPref(PREF_START_DATE);
}

async function setStartDate(value) {
  return setReverseTrialPref(PREF_START_DATE, value);
}

async function setIsPremium(value) {
  await driver.switchTo().window(getOptionsHandle());
  return driver.executeScript(
    (v) =>
      browser.runtime.sendMessage({
        method: "testing.setReverseTrialIsPremium",
        args: [v],
      }),
    value,
  );
}

async function sendDialogAction(touchPointStep, action) {
  await driver.switchTo().window(getOptionsHandle());
  return driver.executeScript(
    (tp, act) =>
      browser.runtime.sendMessage({
        method: "testing.triggerHandler",
        args: [
          "reverse-trial.dialog-action",
          { touchPointStep: tp, action: act },
        ],
      }),
    touchPointStep,
    action,
  );
}

async function isDialogVisible() {
  return driver.executeScript(() => {
    const elements = document.body.children;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const style = window.getComputedStyle(el);
      if (
        el.tagName === "DIV" &&
        style.position === "fixed" &&
        style.zIndex === "2147483647"
      ) {
        return true;
      }
    }
    return false;
  });
}

export default function () {
  this.timeout(15000);

  let tabHandle;

  async function openTabAndCheckDialog(expectDialogVisible) {
    // The tests only handle one youtube tab at a time.
    await closeTab();

    tabHandle = await openNewTab(targetUrl);
    await driver.switchTo().window(tabHandle);
    await driver.sleep(2000);
    const dialogVisible = await isDialogVisible();
    expect(dialogVisible).toBe(expectDialogVisible);
  }

  async function closeTab() {
    if (tabHandle) {
      await driver.switchTo().window(tabHandle);
      await driver.close();
      await driver.switchTo().window(getOptionsHandle());
      tabHandle = null;
    }
  }

  before(async function () {
    // Enable the reverse trial experiment only when this suite starts
    await driver.switchTo().window(getOptionsHandle());
    await driver.executeScript(() =>
      browser.runtime.sendMessage({
        method: "testing.enableReverseTrialExperiment",
      }),
    );
  });

  afterEach(async function () {
    await closeTab();
    await setIsPremium(false);
  });

  it("shows start dialog on first visit", async function () {
    await setStartDate(0);
    await setStep(0);

    await openTabAndCheckDialog(true);

    // Step should still be 0 (dialog shown but not dismissed), but the trail
    // has started.
    expect(await getStep()).toBe(0);
    expect(await getStartDate()).not.toBe(0);

    // Simulate user dismissing the start dialog
    await sendDialogAction(1, "close");
    expect(await getStep()).toBe(1);
  });

  it("does not show dialog again after touch point 1 dismissed", async function () {
    await setStartDate(0);
    await setStep(0);

    await openTabAndCheckDialog(true);
    await sendDialogAction(1, "close");
    await openTabAndCheckDialog(false);

    expect(await getStep()).toBe(1);
  });

  it("shows midpoint dialog when 7 days left", async function () {
    await setStartDate(Date.now() - 8 * MS_PER_DAY);
    await setStep(1);

    await openTabAndCheckDialog(true);

    // Step should still be 1 (not advanced yet)
    expect(await getStep()).toBe(1);

    // Dismiss via dialog-action, step advances
    await sendDialogAction(2, "cta");
    expect(await getStep()).toBe(2);
  });

  it("shows ended dialog when trial expired", async function () {
    await setStartDate(Date.now() - 15 * MS_PER_DAY);
    await setStep(2);

    await openTabAndCheckDialog(true);

    // Step should still be 2 (not advanced yet)
    expect(await getStep()).toBe(2);

    // Dismiss via dialog-action, step advances
    await sendDialogAction(3, "cta");
    expect(await getStep()).toBe(3);

    // Step 3 is the end, so opening again doesn't have any further dialogs
    await openTabAndCheckDialog(false);
    expect(await getStep()).toBe(3);
  });

  it("shows ended dialog when trial expired, even if previous steps not acknowledged", async function () {
    await setStartDate(Date.now() - 15 * MS_PER_DAY);
    await setStep(0);

    await openTabAndCheckDialog(true);

    // Dismiss via dialog-action, step advances straight to 3
    await sendDialogAction(3, "cta");
    expect(await getStep()).toBe(3);
  });

  it("does not show dialog and advances step to 3 when user is premium mid-trial", async function () {
    await setStartDate(Date.now() - 3 * MS_PER_DAY);
    await setStep(1);
    await setIsPremium(true);

    await openTabAndCheckDialog(false);

    expect(await getStep()).toBe(3);
  });
}
