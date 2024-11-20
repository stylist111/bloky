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

const SCHEMA_ID = "1";

function getErrors(data) {
  let errors = [];

  const requiredString = (field, obj, objRef) => {
    const valid = typeof obj[field] === "string";
    if (!valid) {
      errors.push(`\`${objRef}.${field}\` is not a string`);
    }
    return valid;
  };

  const optionalString = (field, obj, objRef) => {
    if (typeof obj[field] !== "undefined" && typeof obj[field] !== "string") {
      errors.push(`\`${objRef}.${field}\` is not a string`);
    }
  };

  const optionalBoolean = (field, obj, objRef) => {
    if (typeof obj[field] !== "undefined" && typeof obj[field] !== "boolean") {
      errors.push(`\`${objRef}.${field}\` is not a boolean`);
    }
  };

  const requiredObject = (field, obj, objRef) => {
    const valid = typeof obj[field] === "object";
    if (!valid) {
      errors.push(`\`${objRef}.${field}\` is not an object`);
    }
    return valid;
  };

  function isValidModValue(value) {
    return typeof value === "number" && value >= 0 && value <= 1000;
  }

  if (typeof data !== "object") {
    errors.push("root data is not an object");
    return errors;
  }

  if (data.schemaId !== SCHEMA_ID) {
    errors.push(`This system only supports a schemaId of '${SCHEMA_ID}'`);
    return errors;
  }

  if (!Array.isArray(data.experiments)) {
    errors.push("`experiments` is not an array");
    return errors;
  }

  let encounteredExperimentIds = new Set();
  let flagExperiments = new Map();

  data.experiments.forEach((experiment, experimentIndex) => {
    const experimentRef = `experiments[${experimentIndex}]`;

    if (requiredString("experimentId", experiment, experimentRef)) {
      if (encounteredExperimentIds.has(experiment.experimentId)) {
        errors.push(`\`${experimentRef}.experimentId\` ${experiment.experimentId} appears as the experiment ID on a previous experiment`);
      }

      encounteredExperimentIds.add(experiment.experimentId);
    }

    optionalString("name", experiment, experimentRef);
    optionalString("description", experiment, experimentRef);
    optionalBoolean("enabled", experiment, experimentRef);

    if (!Array.isArray(experiment.variants)) {
      errors.push(`\`${experimentRef}.variants\` is not an array`);
      return;
    }

    let encounteredVariantIds = new Set();
    let variantRanges = [];

    experiment.variants.forEach((variant, variantIndex) => {
      const variantRef = `${experimentRef}.variants[${variantIndex}]`;

      if (requiredString("variantId", variant, variantRef)) {
        if (encounteredVariantIds.has(variant.variantId)) {
          errors.push(`\`${variantRef}.variantId\` ${variant.variantId} appears as the variantId on a previous variant in this experiment`);
        }

        encounteredVariantIds.add(variant.variantId);
      }

      optionalString("name", variant, variantRef);

      if (requiredObject("flags", variant, variantRef)) {
        Object.keys(variant.flags).forEach(flag => {
          if (!flagExperiments.has(flag)) {
            flagExperiments.set(flag, experiment.experimentId);
          }
          else if (flagExperiments.get(flag) !== experiment.experimentId) {
            errors.push(`\`${variantRef}.flag[${flag}] appears in multiple experiments`);
          }
        });
      }

      if (!Array.isArray(variant.mods) || variant.mods.length !== 2) {
        errors.push(`\`${variantRef}.mods\` is not a two element array`);
        return;
      }

      const [start, end] = variant.mods;
      const validStart = isValidModValue(start);
      const validEnd = isValidModValue(end);

      if (!validStart) {
        errors.push(`\`${variantRef}.mods[0]\` is not a number between 0 and 1000`);
      }
      if (!validEnd) {
        errors.push(`\`${variantRef}.mods[1]\` is not a number between 0 and 1000`);
      }

      if (validStart && validEnd) {
        if (start >= end) {
          errors.push(`\`${variantRef}.mods[0]\` is not smaller than \`${variantRef}.mods[1]\``);
        }
        else {
          for (const [prevStart, prevEnd] of variantRanges) {
            if (start < prevEnd && prevStart < end) {
              errors.push(
                `Mod ranges [${prevStart}-${prevEnd}] and [${start}-${end}] overlap in experiment '${experiment.experimentId}'`
              );
            }
          }
          variantRanges.push([start, end]);
        }
      }
    });
  });


  return errors;
}

export function validateExperimentData(data) {
  const errors = getErrors(data);

  return {
    errors: errors.length === 0 ? null : errors
  };
}
