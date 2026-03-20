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

import { getFutureFragmentOverrides } from "./fragment-overrides";
import { type Fragment } from "./fragment-provider.types";
import { getFutureStartInfo } from "./start-info";

/**
 * Returns a reference to the currently selected fragment
 *
 * @returns A reference to the fragment
 */
export function getFragment(): Fragment {
  return { ...FutureFragment, ...getFutureFragmentOverrides() };
}

/**
 * Whether the currently selected fragment is the future fragment
 *
 * @returns whether the currently selected fragment is the future fragment
 */
export function isFutureFragment(): boolean {
  return true;
}

/**
 * Starts the currently selected fragment and passes on the matching
 * StartInfo argument
 */
async function startFragment(): Promise<void> {
  const fragment = getFragment() as typeof FutureFragment;
  const futureStartInfo = await getFutureStartInfo();
  await fragment.start(futureStartInfo);
}

/**
 * Starts the IPM fragment provider feature
 */
export async function start(): Promise<void> {
  await startFragment();
}
