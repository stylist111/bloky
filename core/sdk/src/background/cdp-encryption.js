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

import {base64ToArrayBuffer} from "adblockpluscore/lib/rsa.js";

const RSA_ALGORITHM = {
  name: "RSA-OAEP",
  hash: "SHA-256"
};

const PEM_PUBLIC_KEY_HEADER = "-----BEGIN PUBLIC KEY-----";
const PEM_PUBLIC_KEY_FOOTER = "-----END PUBLIC KEY-----";

function toArrayBuffer(dataString) {
  return Uint8Array.from(dataString, x => x.charCodeAt(0));
}

/**
 * Import RSA public key
 *
 * @param {String} pem Pem-encoded public key
 * @returns {CryptoKey} public key
 * @ignore
 */
export async function importRSAPublicKey(pem) {
  // fetch the part of the PEM string between header and footer
  const pemContents = pem.substring(
    PEM_PUBLIC_KEY_HEADER.length,
    pem.length - PEM_PUBLIC_KEY_FOOTER.length - 1);

  return await crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(pemContents),
    RSA_ALGORITHM,
    true,
    ["encrypt"]);
}

/**
 * Encrypt data with RSA
 *
 * @param {CryptoKey} publicKey Public key
 * @param {String|ArrayBuffer} data Data to encrypt
 * @returns {ArrayBuffer} Encrypted data
 * @ignore
 */
export async function encryptRSA(publicKey, data) {
  return await crypto.subtle.encrypt(
    RSA_ALGORITHM,
    publicKey,
    typeof data == "string" ? toArrayBuffer(data) : data);
}

/**
 * Decrypt RSA encrypted data
 *
 * @param {CryptoKey} privateKey Private key
 * @param {ArrayBuffer} data Encrypted data
 * @returns {ArrayBuffer} Decrypted data
 * @ignore
 */
export async function decryptRSA(privateKey, data) {
  return await crypto.subtle.decrypt(
    RSA_ALGORITHM,
    privateKey,
    data);
}

export const AES_LENGTH = 256;

const CREATE_AES_KEY_ALGORITHM = {
  name: "AES-GCM",
  length: AES_LENGTH
};

/**
 * Generate AES key
 * @returns {CryptoKey} Generated key
 * @ignore
 */
export async function createAESKey() {
  return await crypto.subtle.generateKey(
    CREATE_AES_KEY_ALGORITHM,
    true,
    ["encrypt", "decrypt"]);
}

/**
 * Prepare binary key representation
 *
 * @param {CryptoKey} key Key
 * @returns {ArrayBuffer} binary representation of the key
 * @ignore
 */
export async function AESkeyToBinary(key) {
  return await crypto.subtle.exportKey("raw", key);
}

/**
 * Generate AES nonce
 * @returns {Uint8Array} Generated nonce
 */
export function generateAESNonce() {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Encrypt with AES
 *
 * @param {Uint8Array} nonce Nonce
 * @param {CryptoKey} key Key
 * @param {String|ArrayBuffer} data Data to encrypt
 * @returns {ArrayBuffer} Encrypted data
 * @ignore
 */
export async function encryptAES(nonce, key, data) {
  const ENCRYPT_ALGORITHM = {
    name: "AES-GCM",
    iv: nonce
  };
  return await crypto.subtle.encrypt(
    ENCRYPT_ALGORITHM,
    key,
    typeof data == "string" ? toArrayBuffer(data) : data);
}

/**
 * Decrypt with AES
 *
 * @param {Uint8Array} nonce Nonce
 * @param {CryptoKey} key Key
 * @param {ArrayBuffer} data Data to decrypt
 * @returns {ArrayBuffer} Decrypted data
 * @ignore
 */
export async function decryptAES(nonce, key, data) {
  const DECRYPT_ALGORITHM = {
    name: "AES-GCM",
    iv: nonce
  };
  return await crypto.subtle.decrypt(
    DECRYPT_ALGORITHM,
    key,
    data);
}
