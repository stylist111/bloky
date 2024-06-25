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

/* eslint-env node */
/* eslint-disable no-console */

class RequestLogger {
  constructor() {
    this.requests = [];
    this.logRequests = this.logRequests.bind(this);
  }

  setVerbose(verbose) {
    this.verbose = verbose;
  }

  getRequests() {
    if (this.verbose) {
      console.log("Get requests", this.requests);
    }
    return this.requests;
  }

  logRequests(req, res, next) {
    if (this.verbose) {
      console.log(new Date().toISOString(), req.method, req.url);
    }

    this.requests.push({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      body: req.body,
      authorization: req.get("Authorization")
    });
    next();
  }

  clearRequests() {
    if (this.verbose) {
      console.log("Clear requests");
    }
    this.requests = [];
  }
}

const requestLogger = new RequestLogger();

export default requestLogger;
