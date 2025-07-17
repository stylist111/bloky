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

import type * as FutureFragment from "@eyeo-fragments/in-product-messaging/background";
import type * as LegacyFragment from "@eyeo-fragments/ipm-legacy/background";
import { type Message } from "~/core/messaging/shared";

// re-export types
export type {
  Command,
  CommandHandler,
  Content,
  LicenseStateBehavior,
  ParamDefinitionList
} from "@eyeo-fragments/in-product-messaging/background";

// re-export enums
export {
  CommandEventType,
  CommandName
} from "@eyeo-fragments/in-product-messaging/background";

// export differing types
export { type FutureFragment, type LegacyFragment };

/**
 * A type alias for the fragments
 */
export type Fragment = typeof LegacyFragment | typeof FutureFragment;

/**
 * An enum for the fragment types we have
 */
export enum FragmentType {
  legacy = "legacy",
  future = "future"
}

/**
 * Message object for "testing.setIPMFragment" type
 */
export interface SetIPMFragmentMessage extends Message {
  type: typeof featureFlagId;
  fragmentType: FragmentType;
}

/**
 * IPM fragment feature flag ID
 */
export const featureFlagId = "ipm-use-future-fragment";
