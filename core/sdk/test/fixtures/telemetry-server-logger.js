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

import {TEST_ADMIN_PAGES_URL} from "@eyeo/test-utils/sdk-urls";
import {EWE} from "../messaging.js";
import {setConfig} from "./remote-config.js";

export const DEBUG_TELEMETRY_URL = `${TEST_ADMIN_PAGES_URL}/telemetry-log-event`;
export const DEBUG_TELEMETRY_BEARER = "SSBhbSBhIGJlYXIuLi4gZXIuLi4gUkFXUg==";
export const INTERVAL_BETWEEN_BATCHES = 1000;
export const ERROR_DELAY = 2000;


export async function restartWithTestArgs() {
  await EWE.testing.resetServerLogUploader();
  await EWE.testing.startServerLogUploader({
    url: DEBUG_TELEMETRY_URL,
    bearer: DEBUG_TELEMETRY_BEARER
  }, INTERVAL_BETWEEN_BATCHES, ERROR_DELAY);

  const testingConfig = {
    schemaId: "1",
    experiments: [],
    loggingLevels: {
      global: "debug",
      mods: [0, 1000]
    }
  };

  await setConfig(testingConfig);
  await EWE.remoteConfig.sync();
}
