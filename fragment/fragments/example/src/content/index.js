/**
 * This file is part of eyeo"s Public API fragment,
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

import browser from "webextension-polyfill";
import { imageCountEvent } from "../shared/constants.js";

/**
 * Counts the img tags that have the src attribute defined.
 *
 * @returns {number} The number of available images
 */
function countImages() {
  const availableImages = document.querySelectorAll("img[src]").length;
  console.log(`Displayed images count: ${availableImages}`);

  return availableImages;
}

/**
 * Sends the number of images to the service worker.
 *
 * @param imageCount The number of images to be sent.
 * @returns {Promise<void>}
 */
async function sendCountToWorker(imageCount) {
  await browser.runtime.sendMessage({
    type: imageCountEvent,
    imageCount,
  });
}

function displayCounterOnPage(counter) {
  const displayDiv = document.createElement("div");
  displayDiv.style.position = "fixed";
  displayDiv.style.bottom = "10px";
  displayDiv.style.right = "10px";
  displayDiv.style.padding = "10px";
  displayDiv.style.backgroundColor = "rgba(255, 0, 0, 0.7)";
  displayDiv.style.color = "white";
  displayDiv.style.borderRadius = "5px";
  displayDiv.style.zIndex = "9999";
  displayDiv.innerText = `Images with src: ${counter}`;
  document.body.appendChild(displayDiv);
}

/**
 * Starts the initialization of content script
 */
export async function start() {
  const counter = countImages();
  sendCountToWorker(counter).then((r) =>
    console.log("Sent counter to service worker"),
  );
  displayCounterOnPage(counter);
}

await start();
