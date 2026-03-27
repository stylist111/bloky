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

import { type FutureFragmentOverrides } from "./fragment-overrides.types";
import { type CommandActor, type CommandName } from "./fragment-provider.types";
import { LicenseState } from "./legacy.types";

/**
 * Sets actor for handling command with given name
 *
 * @param commandName - Command name
 * @param actor - Command actor
 */
function setCommandActor(commandName: CommandName, actor: CommandActor): void {
  // The command actor is only set once during the extension initialization,
  // so we apply it to both fragments at once
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
    defaultLicenseState: LicenseState.inactive,
    doesLicenseStateMatch: async () => true,
    isValidLicenseStateList: () => true,
    setCommandActor,
  };
}
