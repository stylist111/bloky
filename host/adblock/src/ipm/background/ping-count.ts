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
 * Retrieves the number of IPM pings
 *
 * @returns number of IPM pings
 */
export async function getIPMPingCount(): Promise<number> {
  const storage = await browser.storage.local.get("total_ipm_pings");
  const count = storage.total_ipm_pings;
  return typeof count === "number" && !Number.isNaN(count) ? count : 0;
}
