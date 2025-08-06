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

import { validate as validateSchemaVersion1Data } from "./schema1validator.js";

const schemaValidatorLookup = {
  1: validateSchemaVersion1Data,
};

export function validateRemoteConfig(data) {
  if (typeof data !== "object") {
    return ["root data is not an object"];
  }
  const schemaId = data.schemaId;
  if (!schemaValidatorLookup[schemaId]) {
    return [`This system does not support a schemaId of '${schemaId}'`];
  }
  return schemaValidatorLookup[schemaId](data);
}
