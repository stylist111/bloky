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

import type * as FutureFragment from "@eyeo-fragments/in-product-messaging/background";

import { type FutureFragmentOverrides } from "./fragment-overrides.types";

// re-export common types
export type {
  Command,
  CommandActor,
  CommandHandler,
  Content,
  ParamDefinitionList,
} from "@eyeo-fragments/in-product-messaging/background";
// re-export legacy types
export type { LicenseStateBehavior } from "@eyeo-fragments/ipm-legacy/background";

// re-export enums
export { CommandEventType, CommandName } from "@eyeo-fragments/in-product-messaging/background";

// export differing types
export { type FutureFragment };

/**
 * A type alias for the fragments
 */
export type Fragment = typeof FutureFragment & FutureFragmentOverrides;

/**
 * An enum for the fragment types we have
 */
export enum FragmentType {
  future = "future",
}
