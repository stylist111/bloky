import {v4 as uuidv4} from "uuid";
import browser from "webextension-polyfill";

import {setServerLogLevel, resetServerLogLevel} from "./server-logger.js";
import {MILLIS_IN_DAY} from "adblockpluscore/lib/time.js";
import {PersistentState} from "../persistence.js";
import {Scheduler} from "../../all/scheduler.js";
import {default as remoteConfig} from "../remote-config/index.js";
import {modHashString} from "../../all/hashing.js";
import {getLoggingConfig} from "../remote-config/storage.js";

const DEFAULT_ID_ROTATION_PERIOD = 7 * MILLIS_IN_DAY;
let idRotationPeriod = DEFAULT_ID_ROTATION_PERIOD;
let scheduler = null;

const rotatingClientStorage = new PersistentState(
  "ewe:telemetry-rotating-client-id",
  browser.storage.local
);

export async function setRotationPeriod(periodInMs) {
  idRotationPeriod = periodInMs;

  const state = await rotatingClientStorage.getStateLoaded();
  if (state.rotatingClientId) {
    state.nextRotationTime = Date.now() + periodInMs;
    await rotatingClientStorage.save();
  }

  if (scheduler) {
    scheduler.checkNow();
  }
}

export async function resetRotationPeriod() {
  idRotationPeriod = DEFAULT_ID_ROTATION_PERIOD;

  const state = await rotatingClientStorage.getStateLoaded();
  if (state.rotatingClientId) {
    state.nextRotationTime = Date.now() + DEFAULT_ID_ROTATION_PERIOD;
    await rotatingClientStorage.save();
  }

  if (scheduler) {
    scheduler.checkNow();
  }
}

export async function startRotationScheduler() {
  if (scheduler) {
    return;
  }

  scheduler = new Scheduler({
    interval: 0, // this causes the scheduler to always call getNextTimestamp
    errorRetryDelay: 10000,
    async listener() {
      await setRotatingClientId(uuidv4());
      return true;
    },
    async getNextTimestamp() {
      const state = await rotatingClientStorage.getStateLoaded();
      return state.nextRotationTime || null;
    }
  });
}

export async function getRotatingClientId() {
  const state = await rotatingClientStorage.getStateLoaded();

  if (!state.rotatingClientId) {
    await setRotatingClientId(uuidv4());
  }

  return state.rotatingClientId;
}

export async function setRotatingClientId(id) {
  const state = await rotatingClientStorage.getStateLoaded();
  state.rotatingClientId = id;
  state.nextRotationTime = Date.now() + idRotationPeriod;
  await rotatingClientStorage.save();

  const loggingConfig = await remoteConfig.getLoggingConfig();
  await sync(loggingConfig);
}

/**
 * Checks if a rotating client ID falls within a specified range.
 *
 * @param {string} rotatingClientId The rotating client identifier
 * @param {Array<number>} modRange An array defining the range [min, max]
 * @return {Promise<boolean>} True if the hashed ID falls within the range
 */
async function isInModRange(rotatingClientId, modRange) {
  if (!rotatingClientId || !modRange || modRange.length !== 2) {
    return false;
  }

  const hash = await modHashString(rotatingClientId + ":logging");
  return hash >= modRange[0] && hash < modRange[1];
}

/**
 * Represents the logging configuration from the remote config.
 *
 * @typedef {Object} LoggingConfig
 * @property {object} byModule - Module-specific logging levels
 * @property {string} global - Global logging level
 * @property {Array<number>} mods - Range for logging eligibility
 */
/**
 * Synchronizes server logging configuration based on client eligibility,
 * by reading the {@link LoggingConfig} from the remote config and applying it.
 *
 * @return {Promise<void>}
 */
export async function sync() {
  const config = await getLoggingConfig();
  const {byModule, global, mods} = config;

  const rotatingClientId = await getRotatingClientId();
  const inRange = await isInModRange(rotatingClientId, mods);

  if (!inRange) {
    await resetServerLogLevel();
    return;
  }

  await setServerLogLevel({
    global,
    byModule
  });
}

export default {
  sync,
  setRotatingClientId,
  getRotatingClientId,
  setRotationPeriod,
  resetRotationPeriod,
  startRotationScheduler
};
