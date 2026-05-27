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
import {
  getOptionsHandle,
  setOptionsHandle,
  setTimeoutForExtensionReload,
} from "@eyeo/test-utils/extension";
import { reloadExtension } from "@eyeo/test-utils/sdk-extension";

const experimentFlagId = "test:filters";
const experimentFilters = [
  "||example-publisher.com/ads/*",
  "example-publisher.com##.sponsored-slot",
];

async function removeUserFilters(filters) {
  await driver.executeScript(
    (texts) =>
      browser.runtime.sendMessage({
        method: "ewe.filters.remove",
        args: [texts],
      }),
    filters,
  );
}

async function reopenOptionsPage() {
  // Lower the pageLoad timeout so Firefox doesn't hang on an extension page
  // that isn't ready yet — the default is 5 minutes. Retry until the
  // post-reload extension is responsive again.
  const { pageLoad } = await driver.manage().getTimeouts();
  await driver.manage().setTimeouts({ pageLoad: 3000 });
  try {
    await driver.wait(
      async () => {
        try {
          await driver.navigate().to(`${global.extension.origin}/options.html`);
          setOptionsHandle(await driver.getWindowHandle());
          return true;
        } catch {
          try {
            await driver.navigate().refresh();
          } catch {
            // The driver may briefly fail mid-reload; let the wait loop retry.
          }
          return false;
        }
      },
      30000,
      "Options page not reachable after extension reload",
      1000,
    );
  } finally {
    await driver.manage().setTimeouts({ pageLoad });
  }
}

async function triggerExperiment(id, filters) {
  await driver.executeScript(
    (arg1, arg2) =>
      browser.runtime.sendMessage({
        method: "ewe.experiments.overrideFlag",
        args: [arg1, arg2],
      }),
    id,
    filters,
  );
}

async function clearExperiment(id) {
  await driver.executeScript(
    (arg1) =>
      browser.runtime.sendMessage({
        method: "ewe.experiments.clearFlagOverride",
        args: [arg1],
      }),
    id,
  );
}

async function resetExperimentData() {
  await driver.executeScript(() =>
    browser.runtime.sendMessage({
      method: "ewe.testing.resetExperimentData",
    }),
  );
}

async function mockExperimentFlags(flagsByFlagId) {
  // Wrap each flag in its own minimal experiment with a single 100%-range
  // variant. ewe.experiments.sync() will read this config and set state.flags
  // atomically, firing one experiments.onChanged event.
  const experiments = Object.entries(flagsByFlagId).map(([flagId, value]) => ({
    experimentId: `for-${flagId}`,
    variants: [
      { variantId: "v1", flags: { [flagId]: value }, mods: [0, 1000] },
    ],
  }));
  await driver.executeScript(
    (cfg) =>
      browser.runtime.sendMessage({
        method: "ewe.testing.mockRemoteConfig",
        args: [cfg],
      }),
    { schemaId: "1", experiments, cohorts: [] },
  );
}

async function syncExperiments() {
  await driver.executeScript(() =>
    browser.runtime.sendMessage({ method: "ewe.experiments.sync" }),
  );
}

async function addUserFilters(filters, metadata) {
  await driver.executeScript(
    (arg1, arg2) =>
      browser.runtime.sendMessage({
        method: "ewe.filters.add",
        args: [arg1, arg2],
      }),
    filters,
    metadata,
  );
}

async function getUserFilters() {
  return await driver.executeScript(() =>
    browser.runtime.sendMessage({ method: "ewe.filters.getUserFilters" }),
  );
}

async function waitForUserFilters(predicate, message, timeout = 5000) {
  let lastFilters = [];
  await driver.wait(
    async () => {
      try {
        lastFilters = await getUserFilters();
        return predicate(lastFilters);
      } catch {
        return false;
      }
    },
    timeout,
    message,
  );
  return lastFilters;
}

export default () => {
  beforeEach(async function () {
    // Ensure the driver is focused on the options page; prior tests may have
    // left it on an unrelated tab (e.g. when a tab close in another suite
    // fails), and our executeScript calls rely on `window.browser`.
    await driver.switchTo().window(getOptionsHandle());

    await resetExperimentData();
    const userFilters = await getUserFilters();
    await removeUserFilters(userFilters.map((f) => f.text));
    await waitForUserFilters(
      (filters) => filters.length === 0,
      "User filters were not cleared before test",
    );
  });

  it("adds experiment filters", async function () {
    await triggerExperiment(experimentFlagId, experimentFilters);
    const result = await waitForUserFilters(
      (filters) => filters.length === experimentFilters.length,
      "Experiment filters were not added",
    );

    expect(result).toEqual(
      expect.arrayContaining(
        experimentFilters.map((text) =>
          expect.objectContaining({
            text,
            metadata: { origin: "experiment", flagId: experimentFlagId },
          }),
        ),
      ),
    );
  });

  it("removes old experiment filters", async function () {
    const newExperimentFilters = [
      "||example-publisher-new.com/ads/*",
      "example-publisher-new.com##.sponsored-slot",
    ];

    await triggerExperiment(experimentFlagId, experimentFilters);
    await triggerExperiment(experimentFlagId, newExperimentFilters);
    const result = await waitForUserFilters(
      (filters) =>
        filters.length === newExperimentFilters.length &&
        newExperimentFilters.every((text) =>
          filters.some((f) => f.text === text),
        ),
      "Old experiment filters were not replaced",
    );

    expect(result.length).toEqual(newExperimentFilters.length);
    expect(result).toEqual(
      expect.arrayContaining(
        newExperimentFilters.map((text) => expect.objectContaining({ text })),
      ),
    );
  });

  it("only removes filters from cleared experiments", async function () {
    const otherFlagId = "test-2:filters";
    const otherFilters = [
      "||example-other.com/ads/*",
      "example-other.com##.sponsored-slot",
    ];

    await triggerExperiment(experimentFlagId, experimentFilters);
    await triggerExperiment(otherFlagId, otherFilters);
    await clearExperiment(experimentFlagId);
    const result = await waitForUserFilters(
      (filters) =>
        filters.length === otherFilters.length &&
        otherFilters.every((text) => filters.some((f) => f.text === text)),
      "Cleared experiment filters were not removed",
    );

    expect(result).toEqual(
      expect.not.arrayContaining(
        experimentFilters.map((text) => expect.objectContaining({ text })),
      ),
    );
    expect(result).toEqual(
      expect.arrayContaining(
        otherFilters.map((text) => expect.objectContaining({ text })),
      ),
    );
  });

  it("re-attributes a filter when one experiment ends as another starts", async function () {
    const otherFlagId = "test-2:filters";
    const sharedFilter = experimentFilters[0];

    // Use mockRemoteConfig + sync (not overrideFlag) so the second step can
    // atomically replace the flag set in one onChanged event — matching how
    // a production remote-config sync delivers experiment changes.
    await mockExperimentFlags({ [experimentFlagId]: [sharedFilter] });
    await syncExperiments();
    await waitForUserFilters(
      (filters) =>
        filters.some(
          (f) =>
            f.text === sharedFilter && f.metadata?.flagId === experimentFlagId,
        ),
      "Initial experiment did not register sharedFilter",
    );

    await mockExperimentFlags({ [otherFlagId]: [sharedFilter] });
    await syncExperiments();

    const result = await waitForUserFilters(
      (filters) =>
        filters.length === 1 &&
        filters[0]?.text === sharedFilter &&
        filters[0]?.metadata?.flagId === otherFlagId,
      "Shared filter was not re-attributed to the new experiment",
    );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: sharedFilter,
          metadata: { origin: "experiment", flagId: otherFlagId },
        }),
      ]),
    );
  });

  it("only adds a shared filter once when two concurrent experiments include it", async function () {
    const sharedFilter = "||example-publisher.com/ads/*";
    const otherFlagId = "test-2:filters";

    // Two experiments declare the same filter at once. The second
    // ewe.filters.add call inside syncFilters targets a filter that's already
    // active under a different flagId — we expect a single user-filter entry
    // attributed to the first flag only.
    await mockExperimentFlags({
      [experimentFlagId]: [sharedFilter],
      [otherFlagId]: [sharedFilter],
    });
    await syncExperiments();

    const result = await waitForUserFilters(
      (filters) => filters.length === 1 && filters[0]?.text === sharedFilter,
      "Shared filter was not added",
    );

    expect(result.length).toEqual(1);
    expect(result[0].text).toEqual(sharedFilter);
    expect(result[0].metadata?.flagId).toEqual(experimentFlagId);
  });

  it("keeps user filters", async function () {
    const sharedFilter = "||example-publisher.com/ads/*";
    const userMarker = "||example.com/ads/*";
    const experimentMarker = "||experiment-marker.com/ads/*";
    const otherMetadata = {
      origin: "other",
      experimentId: "other",
      variantId: "treatment",
    };

    // The user adds the filter first, with no experiment metadata.
    await addUserFilters([sharedFilter]);
    // The user adds a second filter, with some other non-experiment metadata.
    await addUserFilters([userMarker], otherMetadata);
    await waitForUserFilters(
      (filters) =>
        filters.every((f) => f.text === sharedFilter || f.text === userMarker),
      "User filter was not added",
    );

    // The experiment then declares the same filter plus a marker; the marker
    // is a new filter, so its presence tells us the experiment's sync has run.
    await triggerExperiment(experimentFlagId, [sharedFilter, experimentMarker]);
    await waitForUserFilters(
      (filters) => filters.some((f) => f.text === experimentMarker),
      "Experiment did not register (marker filter missing)",
    );

    // The user's filter must not be re-attributed to the experiment.
    let filters = await getUserFilters();
    let shared = filters.find((f) => f.text === sharedFilter);
    expect(shared).toBeDefined();
    expect(shared.metadata?.flagId).toBeUndefined();

    let user = filters.find((f) => f.text === userMarker);
    expect(user).toBeDefined();
    expect(user.metadata?.origin).toEqual(otherMetadata.origin);

    // Ending the experiment removes its own filters but must leave the user's
    // filter in place.
    await clearExperiment(experimentFlagId);
    filters = await waitForUserFilters(
      (filtersList) => !filtersList.some((f) => f.text === experimentMarker),
      "Experiment filters were not removed when the experiment ended",
    );

    shared = filters.find((f) => f.text === sharedFilter);
    expect(shared).toBeDefined();
    expect(shared.metadata?.flagId).toBeUndefined();

    user = filters.find((f) => f.text === userMarker);
    expect(user).toBeDefined();
    expect(user.metadata?.origin).toEqual(otherMetadata.origin);
  });

  it("keeps experiment filters even if a user tries to add the same filter", async function () {
    const sharedFilter = "||example-publisher.com/ads/*";
    const userMarker = "||user-marker.com/ads/*";

    // The experiment registers the filter first.
    await triggerExperiment(experimentFlagId, [sharedFilter]);
    await waitForUserFilters(
      (filters) =>
        filters.some(
          (f) =>
            f.text === sharedFilter && f.metadata?.flagId === experimentFlagId,
        ),
      "Experiment filter was not added",
    );

    // The user then tries to re-add the same filter, which is a no-op because
    // it already exists (added previously by the experient).
    // A second user filter is used to detect when the user-side add has been
    // processed.
    await addUserFilters([sharedFilter, userMarker]);
    await waitForUserFilters(
      (filters) => filters.some((f) => f.text === userMarker),
      "User marker filter was not added",
    );

    // The shared filter must remain attributed to the experiment — the user's
    // add for an already-present filter is a no-op.
    let filters = await getUserFilters();
    const shared = filters.find((f) => f.text === sharedFilter);
    expect(shared).toBeDefined();
    expect(shared.metadata?.flagId).toEqual(experimentFlagId);

    // When the experiment ends, the filter is removed — it only ever existed
    // as the experiment's entry, so there's nothing for the user's no-op add
    // to leave behind.
    await clearExperiment(experimentFlagId);
    filters = await waitForUserFilters(
      (filtersList) => !filtersList.some((f) => f.text === sharedFilter),
      "Shared filter was not removed when the experiment ended",
    );

    expect(filters.some((f) => f.text === sharedFilter)).toEqual(false);
  });

  it("keeps filters that are still part of the experiment on re-sync", async function () {
    const newFilter = "||example-publisher-new.com/ads/*";

    await triggerExperiment(experimentFlagId, experimentFilters);
    await triggerExperiment(experimentFlagId, [
      experimentFilters[0],
      newFilter,
    ]);
    const result = await waitForUserFilters(
      (filters) =>
        filters.length === 2 &&
        [experimentFilters[0], newFilter].every((text) =>
          filters.some((f) => f.text === text),
        ),
      "Re-sync did not converge on the expected experiment filters",
    );

    expect(result.length).toEqual(2);
    expect(result).toEqual(
      expect.arrayContaining(
        [experimentFilters[0], newFilter].map((text) =>
          expect.objectContaining({ text }),
        ),
      ),
    );
    expect(result).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ text: experimentFilters[1] }),
      ]),
    );
  });

  it("skips adding invalid filters", async function () {
    const invalidFilters = ["bad"];
    const validFilters = ["||example-publisher.com/ads/*"];

    await triggerExperiment(experimentFlagId, [
      ...invalidFilters,
      ...validFilters,
    ]);
    const result = await waitForUserFilters(
      (filters) =>
        validFilters.every((text) => filters.some((f) => f.text === text)),
      "Valid experiment filter was not added",
    );

    expect(result).toEqual(
      expect.not.arrayContaining(
        invalidFilters.map((text) => expect.objectContaining({ text })),
      ),
    );
    expect(result).toEqual(
      expect.arrayContaining(
        validFilters.map((text) => expect.objectContaining({ text })),
      ),
    );
  });

  it("reapplies experiment filters when the fragment is initialized", async function () {
    setTimeoutForExtensionReload(this);

    await triggerExperiment(experimentFlagId, experimentFilters);
    await waitForUserFilters(
      (filters) =>
        experimentFilters.every((text) => filters.some((f) => f.text === text)),
      "Experiment filters were not added before reload",
    );

    // Drift the user-filter store away from the flag state without clearing
    // the flag. After reload, only an init-time sync (not onChanged) can
    // restore the filters.
    await removeUserFilters(experimentFilters);

    const driftedFilters = await getUserFilters();
    expect(driftedFilters).toEqual(
      expect.not.arrayContaining(
        experimentFilters.map((text) => expect.objectContaining({ text })),
      ),
    );

    await reloadExtension(driver, getOptionsHandle());
    await reopenOptionsPage();

    const result = await waitForUserFilters(
      (filters) =>
        experimentFilters.every((text) => filters.some((f) => f.text === text)),
      "Experiment filters were not reapplied after fragment init",
      15000,
    );
    expect(result).toEqual(
      expect.arrayContaining(
        experimentFilters.map((text) =>
          expect.objectContaining({
            text,
            metadata: { origin: "experiment", flagId: experimentFlagId },
          }),
        ),
      ),
    );
  });
};
