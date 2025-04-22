import * as ewe from "@eyeo/webext-ad-filtering-solution";

/**
 * Exposes all current experiment flags and their values.
 * @returns {Promise<Object>} An object with all experiment flag IDs and their values.
 */
export async function getExperimentFlags() {
  return ewe.experiments.getFlags();
}
