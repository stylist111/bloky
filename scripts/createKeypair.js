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

import {webcrypto as crypto} from "crypto";

function arrayBufferToBase64(buffer) {
  let binary = "";
  let bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++)
    binary += String.fromCharCode(bytes[i]);

  return btoa(binary);
}

async function createKeypair() {
  let algorithm = {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 4096,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: {name: "SHA-512"}
  };

  let key = await crypto.subtle.generateKey(algorithm, true, []);

  let pub = arrayBufferToBase64(
    await crypto.subtle.exportKey("spki", key.publicKey)
  );
  console.log("Public key:", pub);

  let priv = arrayBufferToBase64(
    await crypto.subtle.exportKey("pkcs8", key.privateKey)
  );
  console.log("Private key:", priv);
}

createKeypair();
