/**
 * This file is part of eyeo's YouTube ad wall detection fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import * as browser from "webextension-polyfill";
import { matchingElementFoundKey } from "../shared/index.js";
import { isInHavenExperiment, isWatchPage } from "./shared.js";
import { start as startEmbedExperiment } from "./embed-haven.js";
import { insertOverlayExp, removeOverlayExperiment } from "./overlay.js";
import { startPause, unpauseCurrentVideo } from "./pause-video.js";

/**
 * CSS selector identifying YouTube player element
 */
const ytPlayerSelector = "ytd-player";

/**
 * Adds the YT Haven experiments
 */
const addExperiments = async (): Promise<void> => {
  const targetElement = document.querySelector<HTMLElement>(ytPlayerSelector);
  if (!targetElement) {
    return;
  }

  await Promise.all([
    insertOverlayExp(targetElement),
    startEmbedExperiment(targetElement),
  ]);
};

/**
 * Removes the YT Haven experiments
 */
const removeExperiments = (): void => {
  removeOverlayExperiment();
};

/**
 * Only start the experiment if the page was allowlisted and the user is in
 * the haven experiment
 */
const shouldStartExperiment = async (): Promise<boolean> => {
  const matchingElementFound = await browser.storage.local.get(
    matchingElementFoundKey,
  );

  return (
    (await isInHavenExperiment()) &&
    typeof matchingElementFound[matchingElementFoundKey] !== "undefined"
  );
};

/**
 * Starts the YT Haven experiments
 */
export async function start(): Promise<void> {
  if (!(await shouldStartExperiment())) {
    return;
  }

  startPause();

  const navigateListener = async (event: CustomEvent): Promise<void> => {
    removeExperiments();

    if (!isWatchPage() || !(await shouldStartExperiment())) {
      return;
    }

    const isEmbeddable =
      event?.detail?.response?.playerResponse?.playabilityStatus
        ?.playableInEmbed;

    // Unpause the current Video if is not embeddable
    if (!isEmbeddable) {
      unpauseCurrentVideo();
      return;
    }

    await addExperiments();
  };

  window.addEventListener("yt-navigate-finish", (event: CustomEvent) => {
    void navigateListener(event);
  });
}
