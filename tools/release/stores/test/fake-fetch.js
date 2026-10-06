/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2026-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * A request captured by a fake `fetch`.
 *
 * @typedef {object} RecordedCall
 * @property {string} url Requested URL.
 * @property {string} method HTTP method.
 * @property {Record<string, string>} headers Headers as passed by the caller.
 * @property {unknown} body Request body as passed by the caller.
 */

/**
 * Creates a `fetch` stand-in that answers with queued responses in order and
 * records every call. Queue an `Error` to simulate a network failure. A call
 * with an empty queue fails, so unexpected extra requests show up in tests.
 *
 * @param {Array<Response|Error>} responses Responses to return, in order.
 * @returns {typeof fetch & {calls: RecordedCall[]}} The fake `fetch`.
 */
export function createFakeFetch(responses) {
  const queue = [...responses];
  const calls = [];

  async function fakeFetch(url, init = {}) {
    const method = init.method ?? "GET";
    calls.push({
      url: String(url),
      method,
      headers: { ...init.headers },
      body: init.body,
    });

    const next = queue.shift();
    if (next === undefined) {
      throw new Error(`Unexpected request: ${method} ${url}`);
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  }

  fakeFetch.calls = calls;
  return fakeFetch;
}

/**
 * Creates a JSON response.
 *
 * @param {unknown} body Value to serialize.
 * @param {{status?: number, headers?: Record<string, string>}} [init]
 * @returns {Response} The response.
 */
export function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * Creates a plain-text response, e.g. an error page.
 *
 * @param {string} text Response body.
 * @param {{status?: number, headers?: Record<string, string>}} [init]
 * @returns {Response} The response.
 */
export function textResponse(text, { status = 200, headers = {} } = {}) {
  return new Response(text, { status, headers });
}
