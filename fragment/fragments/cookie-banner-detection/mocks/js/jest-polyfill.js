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

"use strict";

/**
 * This file is extending the browser object created by jest-webextension-mock.
 */

// jest-webextension-mock doesn't set the extension ID, but it needs to be set
// in order to make webextension-polyfill believe that it's running in an
// extension environment
browser.runtime.id = "unit-testing-extension";
