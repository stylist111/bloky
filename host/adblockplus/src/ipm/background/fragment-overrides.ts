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

import * as FutureFragment from "@eyeo-fragments/in-product-messaging/background";
import * as LegacyFragment from "@eyeo-fragments/ipm-legacy/background";

import {
  type FutureFragmentOverrides,
  type LegacyFragmentOverrides
} from "./fragment-overrides.types";
import { type CommandActor, type CommandName } from "./fragment-provider.types";

/**
 * Sets actor for handling command with given name
 *
 * @param commandName - Command name
 * @param actor - Command actor
 */
function setCommandActor(commandName: CommandName, actor: CommandActor): void {
  // The command actor is only set once during the extension initialization,
  // so we apply it to both fragments at once
  LegacyFragment.setCommandActor(commandName, actor);
  FutureFragment.setCommandActor(commandName, actor);
}

/**
 * Retrieves fragment API overrides for divergent functionality between them
 *
 * @returns fragment overrides
 */
export function getFutureFragmentOverrides(): FutureFragmentOverrides {
  return {
    checkLanguage: async () => {},
    defaultLicenseState: LegacyFragment.LicenseState.inactive,
    doesLicenseStateMatch: async () => true,
    isValidLicenseStateList: () => true,
    setCommandActor
  };
}

/**
 * Retrieves fragment API overrides for divergent functionality between them
 *
 * @returns fragment overrides
 */
export function getLegacyFragmentOverrides(): LegacyFragmentOverrides {
  return {
    setCommandActor
  };
}
