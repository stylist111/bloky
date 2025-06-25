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

/**
 * The website root domain we want to run the experiment on
 */
export const experimentDomain = "https://stackoverflow.com";

/**
 * The flag we use to check whether we run the experiment
 */
export const experimentFlag = "growth-experiment-cookie-banner-enabled";

/**
 * The key where we store whether we have already run this experiment.
 */
export const cookieBannerExperimentStorageKey = "cookie_banner_experiment_run";
