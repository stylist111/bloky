/*
 * This file is part of eyeo's Cookie banner detection fragment,
 * Copyright (C) 2025-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Tests import browser from "webextension-polyfill" and access browser.webNavigation.
// Aliasing browser to the vitest-chrome mock causes webextension-polyfill to
// return the mock directly (with spyable mock functions) rather than wrapping it.
Object.assign(global, { browser: chrome });
