/*
 * This file is part of eyeo's In Product Messaging (IPM) fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import * as LegacyFragment from "@eyeo-fragments/ipm/background";
import * as FutureFragment from "@eyeo-fragments/in-product-messaging/background";

import { type Fragment, FragmentType } from "./fragment-provider.types";
import { getFragmentOverrides } from "./fragment-overrides";
import { startInfo } from "./start-info";

const featureFlagId = "ipm-use-future-fragment";

/**
 * An object pointing to the two imported fragments
 */
const fragmentImplementation: Record<FragmentType, Fragment> = {
  [FragmentType.legacy]: LegacyFragment,
  [FragmentType.future]: FutureFragment
};

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
  return {
    ...fragmentImplementation[selectedFragmentType],
    ...getFragmentOverrides()
  };
}

/**
 * Selects the fragment to be used based on the according feature flag
 *
 * @returns selected fragment
 */
async function selectFragment(): Promise<Fragment> {
  selectedFragmentType = await getExpectedFragmentType();
  return fragmentImplementation[selectedFragmentType];
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
  await getFragment().start(startInfo);
}

/**
 * Starts the IPM fragment provider feature
 */
export async function start(): Promise<void> {
  const fragment = await selectFragment();
  await fragment.start(startInfo);

  ewe.experiments.onChanged.addListener(() => {
    void switchFragment();
  });
}
