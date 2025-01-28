#!/usr/bin/env node
/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

// The following filters depend on several "testpages.eyeo.com" filters existing
// in live versions of EasyLyst, Acceptable Ads and Cincumvention filterlists.

export const allowlistingFilter = "@@||testpages.eyeo.com^$document";
export const snippetFilter = "testpages.eyeo.com#$#hide-if-contains 'filter not applied' p[id]";
export const allowlistedDomain = "testpages.eyeo.com";
export const easylistFilter = "testpages.eyeo.com*js/test-script.js";
export const customBlockingFilter = "localhost*js/test-script.js";
