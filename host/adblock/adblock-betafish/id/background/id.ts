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

function generateRandomId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const targetLength = 16;
  const result: string[] = [];

  // We're going to generate random Uint8 values, but our alphabet is 36
  // characters long. We want to avoid having a modulo bias that picks the
  // letters at the beginning of our alphabet more than the end, so we use
  // rejection sampling. In other words, we skip values above a cutoff, and
  // the cutoff is determined by how many times we can fit out whole alphabet
  // sequence into the range.
  const uint8Length = 256;
  const maxUnbiased = uint8Length - (uint8Length % alphabet.length);

  while (result.length < targetLength) {
    const randomBytes = new Uint8Array(targetLength);
    crypto.getRandomValues(randomBytes);
    for (const byte of randomBytes) {
      if (byte < maxUnbiased) {
        result.push(alphabet[byte % alphabet.length]);
        if (result.length === targetLength) {
          break;
        }
      }
    }
  }

  return result.join("");
}

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
    const newUserId = generateRandomId();
    await browser.storage.local.set({ [userIdStorageKey]: newUserId });
    return newUserId;
  })();

  return userIdPromise;
}
