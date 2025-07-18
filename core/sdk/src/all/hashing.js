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

export async function modHashString(str) {
  const sha1Buffer = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(str)
  );
  const sha1DataView = new DataView(sha1Buffer);

  // For simplicity, we only use the first 32 bits of the sha1. This is enough
  // entropy to give us a good uniform distribution.
  const sha1Subset = sha1DataView.getUint32(0);
  const unscaledRangeSize = Math.pow(2, 32);

  // We get into the 0-1000 range by multiplying and dividing, rather than
  // modulo, because modulo would introduce a bias towards the lower ends of the
  // number range.
  const scaledRangeSize = 1000;
  const hash = Math.floor(sha1Subset * scaledRangeSize / unscaledRangeSize);

  return hash;
}
