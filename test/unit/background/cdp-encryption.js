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

import {webcrypto} from "crypto";
import expect from "expect";
import * as cdpEncrypt from "../../../sdk/background/cdp-encryption.js";
import {base64ToArrayBuffer} from "adblockpluscore/lib/rsa.js";

const PEM_ENCODED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1o/kPjEWAnTlUmAXHHgj
S+5sHNjzIGQ9vzs6jv2FanstDhVhRqoOvpHliYfoQHhmvQP2YGroBYCYLelA1PvJ
IlWJahwEnxapCdvV2Gd7QtkKJUU/ecqcTb69gOjHtERD5OSmPKo0qynv4YMo3+KY
1rWDAyC5WYsoBw2w4rSsTGSDmdez3kQYCacCVerHbxQz+h/Ngg7AZPhdCk8Q4dtw
jcMVJ2fosp+/XPAyEoy/sMO/aYrA9VzA+9ZcCdekPs66aLYJP2b7OjbiR/CYq5hD
9Fon1ARmmLmSi3ns+RuIXeN2S/v+RLQ4J0rFRdq+RjD71rxN6sk/lhOHCoMaxZeV
JwIDAQAB
-----END PUBLIC KEY-----`;

const PEM_ENCODED_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDL+uCy/FopkZbG
Dw0zWhoGxOUpI9iHxC7wYBZHcKRSAslYxy2ugUzK1+1jXzc3ab+g+5SBCDBFQCoO
vcWuegfXOzD+h6FnSZnA+lPqakuJrtsrwHBiebibEhSPKS68TfP/XuE3oyxgtP9b
zMlbf88iYQbQ7MJjaCJ7KvtWtEOBbFVbbqX6AcTrGLbx8zR6zkT0LEL1FwIOwS0G
w+IEHqatekQqYJaJ8BP/g1Ngagc8L4fcm0mDtdrgt5W22sSa0kDBVhXSfnzYXm+n
7brhUqgz3pfaQr/Xztc85DuvaS5sAFgd86gQyX66LsOg3ElaWcSpBrJY8l+rbmOc
sm/aNZDrAgMBAAECgf9yjRNv+UfcQ4i1flgFD784p42BlZdRDcH5KuvgmTbhxnuh
zp/QV6qMyBzEIIoMada0AC5uSBFcJ+hDXwtHG1HlhKUHoTSUTLh64wjW1/z6O6cv
JpZc+2TbbNz8u/lHTypqv13MchItLADElYmyJaWcSxQZ6v5Qod2qTcXYWkFsqArk
MPFwq4Iy87f5EKnFVBW+whe2q8eTGleRQ21K4GTBVqmjm/xh34Nwjd6QewJGNDmK
d/B/scMtU8eoYVTa0eu5fOoanEowkjmjqbX0qUiUU/bUA4zVW6JtejY/doH4lAHr
5LasSVDlJCXB838R0975m7Kh4srq95rpXXamrMkCgYEA1Ldy0JN3/xL0vmOQYlaI
yK5oWaq+ZhCvE9skymhjoDnl9KFtBKWKBBd7M36R2V5iM9ER2Qqr5Av0TIpaw3/v
QZ5rS6ujZRtMMQiNM0MFtJEsmSCLsA/DxmASpEzrlw3JQ787e4eJSxKV2+vjjhF9
ZBqWDdgvsFilQnPLTqamA4MCgYEA9XxVZhza0zH0wHryRy+fjAx4SNf5PMOyNaeL
wJzK9RApQtA6ViLatABdo7yokHofEADONTwjrL88NcqTQTS7vzDKbki0DEhUR90C
XLsE4js34fTuepipx7P2BkZmo/NIJyCDZ2rNMMd87qdSf+RjhDlrtIQdCeSiVFyn
i4md+HkCgYAtxy0WZiY05sd1EchI4YaeaapbYbuIC58iDs9kIAMQwGUUuIjVryp8
pvEErACHXyCTNjM5GmrTsR7qOfw+hpHe9VDyAAYyBCXph4WbupjHu1Z1veNSCJKB
ZrucUFGDOJxP0B/k/c42MdG+eo2GTY1GtdIFOLlKokkue+0NCCBCMQKBgQCazBJV
17AtKP07Osv4E5G6EErxNC9YH9cKemJnzPc2XUCHfyKqGkRq6SgjDd4FbNyVjMx7
STb9wYFIMjt1DLmvMCcWMAZJEHsE7dqFevDzb4AnnfmbmRTGdzaWcmJa1BgVhC0Y
U4KcVc7z9tLRDsWqJUNDi2N8T44FQH/uP5M7kQKBgQCgwzMLLupfgxjf32OX3A1S
na0Nxxf69L+dENVnOnaMz0Y5Myts9xlX6r9IkKLHgtB0Q7bkTKvvf2fDT8U8f0S0
JgGb8puSlgrzZpG9L++MB14LxL2f3pRQgLDoqhb+llYKqrUWxT2Ic1h47sodozH4
86lbywX4ujDY0tK148e8gA==
-----END PRIVATE KEY-----`;

describe("CDP encryption", function() {
  before(function() {
    if (!global.crypto) { // eslint-disable-line no-undef
      // This is needed for Node < 19. After that, Node has it in the global
      // exports, same as the browsers.
      global.crypto = webcrypto; // eslint-disable-line no-undef
    }
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

  const PEM_PRIVATE_KEY_HEADER = "-----BEGIN PRIVATE KEY-----";
  const PEM_PRIVATE_KEY_FOOTER = "-----END PRIVATE KEY-----";

  async function createRSAKeypair() {
    return await crypto.subtle.generateKey(
      CREATE_RSA_KEY_PAIR_ALGORITHM,
      true,
      ["encrypt", "decrypt"]);
  }

  const IMPORT_RSA_PRIVATE_KEY = {
    name: "RSA-OAEP",
    hash: "SHA-256"
  };

  async function importRSAPrivateKey(pem) {
    // fetch the part of the PEM string between header and footer
    const pemContents = pem.substring(
      PEM_PRIVATE_KEY_HEADER.length,
      pem.length - PEM_PRIVATE_KEY_FOOTER.length - 1);

    return await crypto.subtle.importKey(
      "pkcs8",
      base64ToArrayBuffer(pemContents),
      IMPORT_RSA_PRIVATE_KEY,
      true,
      ["decrypt"]);
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

  it("imports RSA private key", async function() {
    const privateKey = await importRSAPrivateKey(PEM_ENCODED_PRIVATE_KEY);
    expect(privateKey).not.toBeNull();
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
