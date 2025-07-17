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

import * as FutureFragment from "@eyeo-fragments/in-product-messaging/background";
import * as LegacyFragment from "@eyeo-fragments/ipm-legacy/background";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { port } from "../../../adblockplusui/adblockpluschrome/lib/messaging/port";
import { getFutureFragmentOverrides, getLegacyFragmentOverrides } from "./fragment-overrides";
import {
  featureFlagId,
  type Fragment,
  FragmentType,
  type SetFragmentMessage,
} from "./fragment-provider.types";
import { getFutureStartInfo, legacyStartInfo } from "./start-info";

/**
 * The currently used fragment type
 */
let selectedFragmentType: FragmentType = FragmentType.legacy;

/**
 * Returns the fragment type, as indicated by the feature flag
 *
 * @returns fragment type, as indicated by the feature flag
 */
async function getExpectedFragmentType(): Promise<FragmentType> {
  const featureFlag = await ewe.experiments.getFlag(featureFlagId);
  return featureFlag === true ? FragmentType.future : FragmentType.legacy;
}

/**
 * Returns a reference to the fragment
 *
 * @returns A reference to the fragment
 */
export function getFragment(): Fragment {
  if (selectedFragmentType === FragmentType.legacy) {
    return { ...LegacyFragment, ...getLegacyFragmentOverrides() };
  }

  return { ...FutureFragment, ...getFutureFragmentOverrides() };
}

/**
 * Selects the fragment to be used based on the according feature flag
 */
async function selectFragment(): Promise<void> {
  selectedFragmentType = await getExpectedFragmentType();
}

/**
 * Switches to the current selected fragment
 */
async function switchFragment(): Promise<void> {
  const expectedFragmentType = await getExpectedFragmentType();
  if (expectedFragmentType === selectedFragmentType) {
    return;
  }

  await getFragment().stop();
  await selectFragment();
  await startFragment();
}

/**
 * Starts the currently selected fragment and passes on the matching
 * StartInfo argument
 */
async function startFragment(): Promise<void> {
  const fragment = getFragment();

  if (selectedFragmentType === FragmentType.legacy) {
    await (fragment as typeof LegacyFragment).start(legacyStartInfo);
    return;
  }

  const futureStartInfo = await getFutureStartInfo();
  await (fragment as typeof FutureFragment).start(futureStartInfo);
}

/**
 * Starts the IPM fragment provider feature
 */
export async function start(): Promise<void> {
  await selectFragment();
  await startFragment();

  ewe.experiments.onChanged.addListener(() => {
    void switchFragment();
  });

  port.on("testing.getSelectedFragmentType", () => {
    return selectedFragmentType;
  });
  port.on("testing.resetIPMFragment", async () => {
    await ewe.experiments.clearFlagOverrides();
  });
  port.on("testing.setIPMFragment", async (message: SetFragmentMessage) => {
    await ewe.experiments.overrideFlag(featureFlagId, message.fragmentType === FragmentType.future);
  });
}
