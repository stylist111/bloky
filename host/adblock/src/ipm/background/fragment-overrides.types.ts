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

import {
  type LicenseState,
  type LicenseStateBehavior,
} from "@eyeo-fragments/ipm-legacy/background";

import { type CommandActor, type CommandName } from "./fragment-provider.types";

/**
 * Abstract overrides for compatibility between legacy and future fragment
 */
interface AbstractOverrides {
  setCommandActor: (commandName: CommandName, actor: CommandActor) => void;
}

/**
 * Overrides for future fragment for compatibility with legacy fragment
 */
export interface FutureFragmentOverrides extends AbstractOverrides {
  checkLanguage: (ipmId: string) => Promise<void>;
  defaultLicenseState: LicenseState;
  doesLicenseStateMatch: (behavior: LicenseStateBehavior) => Promise<boolean>;
  isValidLicenseStateList: (candidate: unknown) => boolean;
}
