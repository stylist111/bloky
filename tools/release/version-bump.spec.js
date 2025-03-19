/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

import { describe, expect, it } from 'vitest';
import { updateVersionInConfigContent } from './version-bump.js';

describe('updateVersionInConfigContent', () => {
  it('updates the version number and preserves the rest of the file', () => {
    const configFile = 
      `export default {
        basename: "adblock",
        version: "6.10.0",
        webpack: {
          // some other config
        }
      }`;

    const result = updateVersionInConfigContent(configFile, "7.0.0");
    expect(result).toEqual(configFile.replace("6.10.0", "7.0.0"));
  });

  it('updates the version number if the file is minified', () => {
    const configFile = `export default{webpack:{},version:"8.1"}`;

    const result = updateVersionInConfigContent(configFile, "7.0.0");
    expect(result).toEqual(configFile.replace("8.1", "7.0.0"));
  });
  
  it('throws error if version field not found', () => {
    const configWithoutVersion = 
    `export default {
      basename: "adblock",
      someOtherField: "6.10.0"
    }`;

    expect(() => {
      updateVersionInConfigContent(configWithoutVersion, "7.0.0");
    }).toThrow('Could not find version field in the config file');
  });
});
