import {TEST_ADMIN_PAGES_URL} from "@eyeo/test-utils/sdk-urls";
import {MILLIS_IN_SECOND} from "../../adblockpluscore/lib/time.js";
import {setEndpointResponse} from "../utils.js";
import {EWE} from "../messaging.js";

export const REMOTE_CONFIG_URL = `${TEST_ADMIN_PAGES_URL}/experiments.json`;
export const SCHEMA_ID = "1";
export const ERROR_BACKOFF_MS = 2 * MILLIS_IN_SECOND;
export const PING_INTERVAL_MS = MILLIS_IN_SECOND;

export const DEFAULT_CONFIG = {
  schemaId: SCHEMA_ID,
  experiments: [{
    experimentId: "my-experiment",
    variants: [{
      variantId: "variant1",
      flags: {
        hello: "world"
      },
      mods: [0, 1000]
    }]
  }],
  cohorts: [
    {
      name: "Users who are older than 7 days",
      conditions: {
        all: [
          {
            fact: "installDate",
            operator: "olderThan",
            value: 7 * 24 * 60 * 60 * 1000
          }
        ]
      },
      event: {
        type: "my-first-cohort"
      }
    }
  ]
};

export const UPDATED_CONFIG = {
  ...DEFAULT_CONFIG,
  cohorts: [
    ...DEFAULT_CONFIG.cohorts,
    {
      name: "Users who are older than 14 days",
      conditions: {
        all: [
          {
            fact: "installDate",
            operator: "olderThan",
            value: 14 * 24 * 60 * 60 * 1000
          }
        ]
      },
      event: {
        type: "my-second-cohort"
      }
    }
  ]
};

export async function setConfig(config, status = 200, etag = "", countryCode = "US") {
  await setEndpointResponse(REMOTE_CONFIG_URL, JSON.stringify(config), "GET", status, {
    etag,
    "X-Country-Code": countryCode
  });
}

export async function startWithTestArgs(disableAutosync) {
  await EWE.testing.restartRemoteConfig(
    REMOTE_CONFIG_URL, PING_INTERVAL_MS, ERROR_BACKOFF_MS, disableAutosync
  );
}
