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

export const EXPERIMENT_FLAG = "onboarding_flow";

export const EXPERIMENT_ID = "experiment-1";
export const LOWER_VARIANT_ID = "lower-variant";
export const UPPER_VARIANT_ID = "upper-variant";
export const LOWER_VARIANT_FLAG = LOWER_VARIANT_ID + "-flag";
export const UPPER_VARIANT_FLAG = UPPER_VARIANT_ID + "-flag";
export const LOWER_HALF_USER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";  // Hashes with experimentid-1 to 215
export const UPPER_HALF_USER_ID = "e5c619b9-7928-4d8a-b25c-84e5df2080c2";  // Hashes with experimentid-1 to 907

export function oneVariantConfig(flag) {
  return [
    {
      experimentId: EXPERIMENT_ID,
      variants: [
        {
          variantId: "variant1",
          flags: {
            [EXPERIMENT_FLAG]: flag
          },
          mods: [0, 1000]
        }
      ]
    }
  ];
}

export function twoVariantConfig(lowerMods, upperMods) {
  return [{
    experimentId: EXPERIMENT_ID,
    variants: [
      {
        variantId: LOWER_VARIANT_ID,
        flags: {[EXPERIMENT_FLAG]: LOWER_VARIANT_FLAG},
        mods: lowerMods
      },
      {
        variantId: UPPER_VARIANT_ID,
        flags: {
          [EXPERIMENT_FLAG]: UPPER_VARIANT_FLAG,
          "Second flag": "second flag value"
        },
        mods: upperMods
      }
    ]
  }];
}

export const LOWER_VARIANT_IPM_ID = "lower-variant-ipm";
export const UPPER_VARIANT_IPM_ID = "upper-variant-ipm";

function makeCreateTabCommand(ipmId) {
  return {
    command_name: "create_tab",
    ipm_id: ipmId,
    version: 1,
    url: `https://www.example.com/${ipmId}`
  };
}

export function twoVariantConfigWithIpmCommands(lowerMods, upperMods) {
  return [{
    experimentId: EXPERIMENT_ID,
    variants: [
      {
        variantId: LOWER_VARIANT_ID,
        flags: {[EXPERIMENT_FLAG]: LOWER_VARIANT_FLAG},
        mods: lowerMods,
        ipmCommands: [makeCreateTabCommand(LOWER_VARIANT_IPM_ID)]
      },
      {
        variantId: UPPER_VARIANT_ID,
        flags: {[EXPERIMENT_FLAG]: UPPER_VARIANT_FLAG},
        mods: upperMods,
        ipmCommands: [makeCreateTabCommand(UPPER_VARIANT_IPM_ID)]
      }
    ]
  }];
}
