/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { Prefs } from "../../alias/prefs";
import { ExperimentSearchParameterKeys, noRevisionId } from "./url.types";
import { getExperiments } from "~/alias/uninstall";

/**
 * Constructs a URL based on the given URL and a trusted origin. If `url` is
 * relative, the given origin is used. If `url` is absolute, it's origin will
 * be checked whether it matches the trusted origin.
 *
 * @param url The URL to create the safe origin URL from. Can be relative
 *   or absolute
 *
 * @returns An absolute URL with a trusted origin, or `null` if creating a
 *   safe origin URL was not possible, or if origins did not match.
 */
export function createSafeOriginUrl(url: string): string | null {
  const defaultOrigin: string = Prefs.get("ipm_default_origin");
  const safeOrigins: string[] = Prefs.get("ipm_safe_origins");
  let safeOriginUrl: URL;

  try {
    // If the url is relative, it will use the default origin
    safeOriginUrl = new URL(url, defaultOrigin);
  } catch (ex) {
    return null;
  }

  // Verify that provided URL origin is in the list of trusted origins
  if (!safeOrigins.includes(safeOriginUrl.origin)) {
    return null;
  }

  return safeOriginUrl.href;
}

/**
 * Adds search params from the split experiment framework to the given URL.
 *
 * @param url The URL to add the params to
 * @returns The URL with the added params if the given URL is a valid URL,
 *  or `null` if it is not
 */
export async function addExperimentsSearchParams(url: string): Promise<string | null> {
  let extendedUrl: URL;

  try {
    extendedUrl = new URL(url);
  } catch (ex) {
    return null;
  }

  extendedUrl.searchParams.append(
    ExperimentSearchParameterKeys.revision,
    (await ewe.experiments.getRevisionId()) ?? noRevisionId,
  );
  extendedUrl.searchParams.append(ExperimentSearchParameterKeys.variants, await getExperiments());

  return extendedUrl.href;
}
