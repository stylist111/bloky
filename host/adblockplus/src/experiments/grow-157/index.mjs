import * as ewe from "@eyeo/webext-ad-filtering-solution/ui";
import * as messaging from "~/core/messaging/front";
import { $ } from "../../../js/dom.mjs";

export const EXPERIMENT_CONTROL_FLAG = "grow-157-popup-qrcode-v0-enabled";

const EXPERIMENT_V1_FLAG = "grow-157-popup-qrcode-v1-enabled";
const EXPERIMENT_V2_FLAG = "grow-157-popup-qrcode-v2-enabled";
const EXPERIMENT_V3_FLAG = "grow-157-popup-qrcode-v3-enabled";
const EXPERIMENT_V4_FLAG = "grow-157-popup-qrcode-v4-enabled";

const EXPERIMENT_FLAGS = [
  EXPERIMENT_CONTROL_FLAG,
  EXPERIMENT_V1_FLAG,
  EXPERIMENT_V2_FLAG,
  EXPERIMENT_V3_FLAG,
  EXPERIMENT_V4_FLAG
];

/**
 * Hides popup menu footer and shows QRCode
 * promo for the appropriate variation ID.
 * @param {String} variation
 */
export function setupGrow157QRCode(variation) {
  const title = document.getElementById("grow-157-qrcode-title");
  const desc = document.getElementById("grow-157-qrcode-desc");
  const img = document.getElementById("grow-157-qrcode-img");

  // Set title, description & image per variant.
  switch (variation) {
    case EXPERIMENT_V1_FLAG:
      title.textContent = title.dataset.v1;
      desc.textContent = desc.dataset.v1;
      img.src = img.dataset.v1;
      break;
    case EXPERIMENT_V2_FLAG:
      title.textContent = title.dataset.v2;
      desc.textContent = desc.dataset.v2;
      img.src = img.dataset.v2;
      break;
    case EXPERIMENT_V3_FLAG:
      title.textContent = title.dataset.v3;
      desc.textContent = desc.dataset.v3;
      img.src = img.dataset.v3;
      break;
    case EXPERIMENT_V4_FLAG:
      title.textContent = title.dataset.v4;
      desc.textContent = desc.dataset.v4;
      img.src = img.dataset.v4;
      break;
    default:
      title.textContent = title.dataset.v1;
      desc.textContent = desc.dataset.v1;
      img.src = img.dataset.v1;
  }

  // Condense page-info panel to allow more vertical height for QRCode promo.
  $("#page-info").classList.add("grow-157-condensed");

  // Hide footer and show QRCode promo.
  $("io-popup-footer").hidden = true;
  $(".grow-157-qrcode-container").hidden = false;
}

/**
 * Returns experiment config object. Values are set only if
 * targeting criteria are met (English language, non-Premium
 * users only).
 * @param {Boolean} isPremium
 * @returns {Object} experimentConfig
 */
export async function getGrow157ExperimentConfig(isPremium) {
  const localeInfo = await messaging.app.get("localeInfo");
  const experimentConfig = {
    variation: null,
    experimentIDParam: null,
    experimentVarParam: null
  };

  // Targeting criteria is non-premium users,
  // English only.
  if (
    !isPremium &&
    typeof localeInfo.locale === "string" &&
    localeInfo.locale.startsWith("en-")
  ) {
    const flags = await ewe.experiments.getFlags();
    const variation = EXPERIMENT_FLAGS.find((flag) => flag in flags);

    if (variation) {
      experimentConfig.variation = variation;
      experimentConfig.experimentVarParam = getExperimentVarParam(variation);
    }
  }

  return experimentConfig;
}

/**
 * Returns experiment variation tracking parameter
 * for premium website links.
 * @param {String} variation
 * @returns {String} variation
 */
export function getExperimentVarParam(variation) {
  switch (variation) {
    case EXPERIMENT_CONTROL_FLAG:
      return "0";
    case EXPERIMENT_V1_FLAG:
      return "1";
    case EXPERIMENT_V2_FLAG:
      return "2";
    case EXPERIMENT_V3_FLAG:
      return "3";
    case EXPERIMENT_V4_FLAG:
      return "4";
    default:
      return "";
  }
}
