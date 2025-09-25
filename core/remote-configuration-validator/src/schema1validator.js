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
/* For ESLint: List any global identifiers used in this file below */
/* global console */
import { Rule } from "json-rules-engine";
import { Validator } from "jsonschema";
import { remoteConfigSchema } from "../schema/remoteConfigSchema.js";

const SCHEMA_ID = "1";

const validOperatorsByFact = {
  aaEnabled: ["equal", "notEqual"],
  browserName: ["equal", "notEqual", "in", "notIn"],
  browserLanguage: ["equal", "notEqual", "in", "notIn"],
  countryCode: ["equal", "notEqual", "in", "notIn"],
  partnerExtensionDected: ["equal", "notEqual"],
  extName: ["equal", "notEqual"],
  extVersion: [
    "equal",
    "notEqual",
    "in",
    "notIn",
    "lessThan",
    "lessThanInclusive",
    "greaterThan",
    "greaterThanInclusive",
  ],
  hasPremium: ["equal", "notEqual"],
  installDate: [
    "equal",
    "notEqual",
    "lessThan",
    "lessThanInclusive",
    "greaterThan",
    "greaterThanInclusive",
    "withinLast",
    "olderThan",
  ],
  installType: ["equal", "notEqual", "in", "notIn"],
  blockedCount: [
    "equal",
    "notEqual",
    "lessThan",
    "lessThanInclusive",
    "greaterThan",
    "greaterThanInclusive",
  ],
};

function isValidModValue(value) {
  return typeof value === "number" && value >= 0 && value <= 1000;
}

function isValidCondition(conditions, errors) {
  if (!conditions) {
    return;
  }
  conditions.forEach((condition, index) => {
    if (condition.fact && !validOperatorsByFact[condition.fact]) {
      errors.push(`\`${condition.fact}\` not a known fact`);
      return;
    }
    if (
      condition.fact &&
      !validOperatorsByFact[condition.fact].includes(condition.operator)
    ) {
      errors.push(
        `\`invalid operator ${condition.operator} for fact: ${condition.fact}\``,
      );
    }
  });
}

function getErrorsForExperiments(data) {
  let errors = [];
  let encounteredExperimentIds = new Set();
  let flagExperiments = new Map();

  data.experiments.forEach((experiment, experimentIndex) => {
    const experimentRef = `experiments[${experimentIndex}]`;

    if (encounteredExperimentIds.has(experiment.experimentId)) {
      errors.push(
        `\`${experimentRef}.experimentId\` ${experiment.experimentId} appears as the experiment ID on a previous experiment`,
      );
    }
    encounteredExperimentIds.add(experiment.experimentId);

    let encounteredVariantIds = new Set();
    let variantRanges = [];

    experiment.variants.forEach((variant, variantIndex) => {
      const variantRef = `${experimentRef}.variants[${variantIndex}]`;

      if (encounteredVariantIds.has(variant.variantId)) {
        errors.push(
          `\`${variantRef}.variantId\` ${variant.variantId} appears as the variantId on a previous variant in this experiment`,
        );
      }

      encounteredVariantIds.add(variant.variantId);

      if (variant.flags) {
        Object.keys(variant.flags).forEach((flag) => {
          if (!flagExperiments.has(flag)) {
            flagExperiments.set(flag, experiment.experimentId);
          } else if (flagExperiments.get(flag) !== experiment.experimentId) {
            errors.push(
              `\`${variantRef}.flag[${flag}] appears in multiple experiments`,
            );
          }
        });
      }

      if (!Array.isArray(variant.mods) || variant.mods.length !== 2) {
        errors.push(`\`${variantRef}.mods\` is not a two element array`);
        return errors;
      }

      const [start, end] = variant.mods;
      const validStart = isValidModValue(start);
      const validEnd = isValidModValue(end);

      if (!validStart) {
        errors.push(
          `\`${variantRef}.mods[0]\` is not a number between 0 and 1000`,
        );
      }
      if (!validEnd) {
        errors.push(
          `\`${variantRef}.mods[1]\` is not a number between 0 and 1000`,
        );
      }

      if (validStart && validEnd) {
        if (start >= end) {
          errors.push(
            `\`${variantRef}.mods[0]\` is not smaller than \`${variantRef}.mods[1]\``,
          );
        } else {
          for (const [prevStart, prevEnd] of variantRanges) {
            if (start < prevEnd && prevStart < end) {
              errors.push(
                `Mod ranges [${prevStart}-${prevEnd}] and [${start}-${end}] overlap in experiment '${experiment.experimentId}'`,
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

function getErrorsForCohorts(data) {
  let errors = [];
  if (data.cohorts) {
    data.cohorts.forEach((rule, cohortIndex) => {
      const ruleRef = `cohort[${cohortIndex}]`;

      try {
        const ruleObj = new Rule(rule);
        if (ruleObj && ruleObj.conditions) {
          if (ruleObj.conditions.all) {
            isValidCondition(ruleObj.conditions.all, errors);
          } else if (ruleObj.conditions.any) {
            isValidCondition(ruleObj.conditions.any, errors);
          } else if (ruleObj.conditions.not) {
            isValidCondition(ruleObj.conditions.not, errors);
          } else {
            errors.push(`Invalid rule, no conditions found '${ruleRef}'`);
          }
        }
      } catch (e) {
        // Should the error be returned?
        errors.push(`Invalid rule '${ruleRef}'`);
      }
    });
  }
  return errors;
}

function getErrorsForIpmCommands(data) {
  const errors = [];
  if (data.ipmCommands) {
    data.ipmCommands.forEach((command, commandIndex) => {
      const commandRef = `ipmCommands[${commandIndex}]`;

      if (command.cohort) {
        let exists = false;
        if (data.cohorts) {
          exists = data.cohorts.some(
            (cohort) => cohort.event.type === command.cohort,
          );
        }

        if (!exists) {
          errors.push(
            `\`${commandRef}.cohort\` ${command.cohort} cohort does not exist`,
          );
        }
      }
    });
  }
  return errors;
}

function getErrors(data) {
  let errors = [];

  if (typeof data !== "object") {
    errors.push("root data is not an object");
    return errors;
  }

  if (data.schemaId !== SCHEMA_ID) {
    errors.push(`This system only supports a schemaId of '${SCHEMA_ID}'`);
    return errors;
  }

  errors.push(...getErrorsForExperiments(data));
  errors.push(...getErrorsForCohorts(data));
  errors.push(...getErrorsForIpmCommands(data));

  return errors;
}

export function validate(data) {
  const validator = new Validator();
  let validateResult = {};
  try {
    // passing the 'base' property to the validate function
    // avoids an error when running certain tests in some browsers
    // see more here -> https://github.com/tdegrunt/jsonschema/issues/407
    validateResult = validator.validate(data, remoteConfigSchema, {
      base: "https://eyeo.com/remoteConfigSchema",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err.message);
    return [err.message];
  }

  if (validateResult && validateResult.errors && validateResult.errors.length) {
    // Filter out a lot of the validation error object,
    // the 'stack' property contains the most relevant information
    const errorStack = validateResult.errors.map((error) => error.stack);
    return errorStack;
  }

  return getErrors(data);
}
