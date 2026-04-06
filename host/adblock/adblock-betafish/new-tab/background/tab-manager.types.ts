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

/**
 * The query parameter that holds the humber of blocked
 * requests (the "block count", or short "bc").
 */
export const blockCountQueryParameter = "bc";

/**
 * The key under which we store the timestamp of the last time we opened a
 * tab.
 */
export const lastShownKey = "new_tab_last_shown";

/**
 * The key under which we store the minimum amount of time between two
 * tabs being opened.
 */
export const coolDownPeriodKey = "new_tab_cool_down";
