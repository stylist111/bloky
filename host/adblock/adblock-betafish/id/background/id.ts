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
import * as browser from "webextension-polyfill";

const userIdStorageKey = "userid";
let userIdPromise: Promise<string> | null = null;

/**
 * Generates a 16 character random string
 *
 * @returns the user id as 16 character random string
 */
// eslint-disable-next-line import/prefer-default-export
export function getUserId(): Promise<string> {
  if (userIdPromise) {
    return userIdPromise;
  }

  userIdPromise = (async () => {
    const response = await browser.storage.local.get(userIdStorageKey);
    const value = response[userIdStorageKey];

    if (value) {
      // Sometimes we generate user IDs that consist only of digits
      // we suspect that in some cases the browser may store them as numbers,
      // that is why we cast them to string here (EXT-1001)
      return String(value);
    }

    // The stored value is missing, generate a new one.
    const timeSuffix = (Date.now() % 1e8).toString().padStart(8, "0"); // 8 digits from end of timestamp
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const result = [];
    for (let i = 0; i < 8; i++) {
      const choice = Math.floor(Math.random() * alphabet.length);
      result.push(alphabet[choice]);
    }
    const newUserId = result.join("") + timeSuffix;
    await browser.storage.local.set({ [userIdStorageKey]: newUserId });
    return newUserId;
  })();

  return userIdPromise;
}
