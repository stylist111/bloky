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

import {ML} from "adblockpluscore/lib/ml.js";
import * as tfjs from "./tfjs-stripped.js";

let mlCache = new Map();

async function createML(model)
{
  let filename = "model.json";
  let module;

  try
  {
    module = await import(
      /* webpackMode: "eager" */
      /* webpackInclude: /[\\\/](model\.json|group1-shard\d+of\d+\.dat)$/ */
      `adblockpluscore/data/${model}/${filename}?model`
    );
  }
  catch
  {
    throw new Error(`Unknown model: ${model}`);
  }

  let ml = new ML(tfjs);
  ml.modelURL = module.default;
  return ml;
}

export async function inference(model, inputs)
{
  let mlPromise = mlCache.get(model);
  if (!mlPromise)
  {
    mlPromise = createML(model);
    mlCache.set(model, mlPromise);
  }

  let ml = await mlPromise;
  try
  {
    return await ml.predict(inputs);
  }
  catch (e)
  {
    if (e.message == "Failed to fetch" ||
        e.message == "NetworkError when attempting to fetch resource." ||
        e.message.startsWith("Failed to parse model JSON of response"))
    {
      // eslint-disable-next-line no-console
      console.info(`Cannot find model ${model}, skipping prediction`);
      return null;
    }

    throw e;
  }
}
