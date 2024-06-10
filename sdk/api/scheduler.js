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

import {MILLIS_IN_HOUR} from "adblockpluscore/lib/time.js";

const MAX_POLL_TIMEOUT = MILLIS_IN_HOUR;

export class Scheduler {
  constructor(config) {
    this.config = config;
    this.checkInProgress = false;
    this.stopped = false;

    this._check = async() => {
      this.checkInProgress = true;
      let nextPollTimeout;
      try {
        nextPollTimeout = await this.callListenerIfItsTime();
      }
      finally {
        if (typeof nextPollTimeout == "undefined") {
          nextPollTimeout = this.config.errorRetryDelay;
        }

        if (nextPollTimeout > MAX_POLL_TIMEOUT) {
          nextPollTimeout = MAX_POLL_TIMEOUT;
        }

        // If stop was called while currently triggering something, don't
        // schedule the next timeout.
        if (!this.stopped) {
          this.timeout = setTimeout(this._check, nextPollTimeout);
        }
        this.checkInProgress = false;
      }
    };
    this._check();
  }

  async callListenerIfItsTime() {
    let nextTimestamp = await this.config.getNextTimestamp();
    let nowTimestamp = Date.now();
    if (nextTimestamp && nowTimestamp < nextTimestamp) {
      return nextTimestamp - nowTimestamp;
    }

    let success = await this.config.listener();
    if (!success) {
      return this.config.errorRetryDelay;
    }

    return this.config.interval;
  }

  stop() {
    if (this.stopped) {
      return;
    }

    this.stopped = true;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  checkNow() {
    if (!this.stopped && !this.checkInProgress) {
      clearTimeout(this.timeout);
      this._check();
    }
  }
}
