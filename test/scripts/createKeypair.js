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

import expect from "expect";
import {webcrypto as crypto} from "crypto";
import {TextEncoder} from "util";

import {algorithm, createKeypair} from "../../scripts/createKeypair.js";

function base64ToArrayBuffer(base64) {
  let binaryString = atob(base64);
  return Uint8Array.from(binaryString, c => c.charCodeAt(0));
}

describe("createKeypair script", function() {
  it("creates a keypair that can be used for signature verification", async function() {
    this.timeout(10000);

    let {publicKey, privateKey} = await createKeypair();

    let importedPrivateKey = await crypto.subtle.importKey(
      "pkcs8",
      base64ToArrayBuffer(privateKey),
      algorithm,
      false,
      ["sign"]
    );

    let data = (new TextEncoder()).encode("Some data I guess");
    let signature = await crypto.subtle.sign(
      algorithm, importedPrivateKey, data
    );

    let importedPublicKey = await crypto.subtle.importKey(
      "spki",
      base64ToArrayBuffer(publicKey),
      algorithm,
      false,
      ["verify"]
    );

    let signatureVerification = await crypto.subtle.verify(
      algorithm,
      importedPublicKey,
      signature,
      data
    );
    expect(signatureVerification).toBe(true);
  });
});
