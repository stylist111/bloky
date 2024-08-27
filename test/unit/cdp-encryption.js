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

import crypto from "crypto";
import expect from "expect";
import * as cdpEncrypt from "../../sdk/api/cdp-encryption.js";

const PEM_ENCODED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA6D2rA84PYRZQFv4NL4V5
UMCivHsmRE8JticuyWzTAx7vyptEjsstuk/oW3v25+glc4Jr0zi8z9IzUUJ097tX
RioZ9fc5bCtUFLU0+XbxiUiMBYsocPkFr/XkDClWDF7OcCvZcltZfbRnOsui8v5W
zEK1nWFTv3PPHhpBbKjnP+acnI9mxxbjC9kYzytyH03vLEGPayDujP5QyZAH6U9v
3RB6pS/46vrVbYbNuMHYrUQGSNAXotweKqx/iMs7kur5Xp0ugUoyR6mrBftmk2vP
Z5y4mIqwUhGMX1XLzQRVhT+7ngKK1QhxB0ruQuX/Dvn8Y6bIE+ola8B3txJ31l5I
8+05Dcr4AAmkq67KQUTcce/+0Nz7MWWMObf12+S/j95b4nqROGrNlwtV83MoYH8e
QtJr9Ejt+zdl/OAahyp4zvAiPFLA8fRQGoHhPXt/fYHsxySG7OPMazLJxFarmWT/
UlvVm112lG9ij3Mc/f64cKzmenKoIe0c2HSGMxFagEDnAgMBAAE=
-----END PUBLIC KEY-----`;

describe("CDP encryption", function() {
  before(function() {
    global.crypto = crypto; // eslint-disable-line no-undef
  });

  const RSA_ALGORITHM = {
    name: "RSA-OAEP",
    hash: "SHA-256"
  };

  const CREATE_RSA_KEY_PAIR_ALGORITHM = {
    ...RSA_ALGORITHM,
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1])
  };

  async function createRSAKeypair() {
    return await crypto.subtle.generateKey(
      CREATE_RSA_KEY_PAIR_ALGORITHM,
      true,
      ["encrypt", "decrypt"]);
  }

  const DATA = JSON.stringify([{
    site_id: "domain1.com",
    sessions: 1
  }]);

  it("imports public RSA key", async function() {
    const publicKey = await cdpEncrypt.importRSAPublicKey(
      PEM_ENCODED_PUBLIC_KEY);
    expect(publicKey).not.toBeNull();
    expect(publicKey.byteLength).not.toEqual(0);
  });

  it("encrypts the data with RSA", async function() {
    const {privateKey, publicKey} = await createRSAKeypair();

    // example CDP payload (part)
    const encryptedData = await cdpEncrypt.encryptRSA(
      publicKey, DATA);

    const buffer = await cdpEncrypt.decryptRSA(
      privateKey, encryptedData);
    const decoder = new TextDecoder("utf-8");
    const actualDomainStats = decoder.decode(buffer);
    expect(actualDomainStats).toEqual(DATA);
  });

  it("generates AES key", async function() {
    const key = await cdpEncrypt.createAESKey();
    expect(key).not.toBeNull();
  });

  it("convert AES key to binary", async function() {
    const key = await cdpEncrypt.createAESKey();
    const binary = await cdpEncrypt.AESkeyToBinary(key);
    expect(binary).not.toBeNull();
  });

  it("encrypts the data with AES", async function() {
    const nonce = await cdpEncrypt.generateAESNonce();
    const key = await cdpEncrypt.createAESKey();
    const encryptedData = await cdpEncrypt.encryptAES(nonce, key, DATA);
    expect(encryptedData).not.toBeNull();

    const buffer = await cdpEncrypt.decryptAES(
      nonce, key, encryptedData);
    const decoder = new TextDecoder("utf-8");
    const decryptedData = decoder.decode(buffer);
    expect(decryptedData).toEqual(DATA);
  });
});
