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

/**
 * Base class for all HTTP-based errors.
 */
export class HttpError extends Error {
  constructor(url, status, message = "HTTP error", apiError = {}) {
    super(apiError.message || "HTTP error");
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.apiError = apiError || {};
  }
}

/**
 * 4xx errors (client fault)
 */
export class ClientError extends HttpError {
  constructor(url, status, apiError = {}) {
    super(url, status, "Client error", apiError);
    this.name = "ClientError";
  }
}

/**
 * 429 Too Many Requests errors (client fault)
 */
export class RateLimitError extends ClientError {
  constructor(url, status, apiError = {}) {
    super(url, status, apiError);
    this.name = "RateLimitError";
  }
}

/**
 * Unauthorized error (401 Unauthorized)
 */
export class UnauthorizedError extends ClientError {
  constructor(url, status, apiError = {}) {
    super(url, status, apiError);
    this.name = "UnauthorizedError";
  }
}

/**
 * 5xx errors (server fault)
 */
export class ServerError extends HttpError {
  constructor(url, status, apiError = {}) {
    super(url, status, "Server error", apiError);
    this.name = "ServerError";
  }
}

/**
 * Network-level errors (e.g. no connection, DNS fail)
 */
export class NetworkError extends Error {
  constructor(url, cause = null) {
    super("Network error occurred");
    this.name = "NetworkError";
    this.cause = cause;
    this.url = url;
  }
}

/**
 * When max retry attempts are exceeded for retryable errors.
 */
export class MaxRetryError extends Error {
  constructor(url, cause = null) {
    super("Max retry attempts exceeded");
    this.name = "MaxRetryError";
    this.cause = cause;
    this.url = url;
  }
}
