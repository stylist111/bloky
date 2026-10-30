/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

// The real module only takes the bundled subscriptions from `setAddonInfo()`,
// which the module under test doesn't expose. Tests set them on a global
// instead and import with `mock(filename, null, ["./info.js"])`.
export {addonBundledSubscriptionsPath, isSafari}
  from "../../../../src/background/info.js";

// eslint-disable-next-line no-undef
export let addonBundledSubscriptions = global.addonBundledSubscriptions;
