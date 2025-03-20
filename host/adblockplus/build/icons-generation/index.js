/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const baseIcons = {
  abp: { width: 59, height: 25 },
  background: { width: 64, height: 64 },
  bell: { width: 32, height: 46 }
};
const iconSizes = [16, 20, 32, 40];
const iconVariants = [
  { type: "default", content: "abp", color: "#ED1E45" },
  { type: "disabled", content: "abp", color: "#A7A7A7" },
  { type: "notification", content: "bell", color: "#0797E1" }
];
const inputDir = "skin/icons/toolbar";
const outputDir = inputDir;

/**
 * Load an SVG file and modify its color
 * @param {string} name - File name without extension
 * @param {string} hexColor - Hex color code e.g. "#FF0000"
 * @returns {Promise<Buffer<ArrayBufferLike>>}
 */
async function loadAndColorizeSVG(name, hexColor) {
  const filepath = path.join(inputDir, `${name}.svg`);
  let svgContent = fs.readFileSync(filepath, "utf8");

  // Replace fill="..." or style="fill:..." with new color
  svgContent = svgContent.replace(/fill="[^"]*"/g, `fill="${hexColor}"`);
  svgContent = svgContent.replace(
    /style="[^"]*"/g,
    `style="fill:${hexColor};"`
  );

  return Buffer.from(svgContent);
}

/**
 * Create an icon with a given variant and size
 * @param {{color: string, content: string, type: string}} variant
 * @param {number} size
 * @returns {Promise<void>}
 */
async function createIcon(variant, size) {
  const { color, content, type } = variant;
  const { width: bgWidth, height: bgHeight } = baseIcons.background;
  const { width: contentWidth, height: contentHeight } = baseIcons[content];

  const outputFilepath = path.join(outputDir, `${type}-${size}.png`);

  // Load and colorize background and content SVGs
  const bgSVG = await loadAndColorizeSVG("background", color);
  const contentSVG = await loadAndColorizeSVG(content, "#FFFFFF"); // Always white

  // Process background image
  const bgImage = await sharp(bgSVG).resize(size, size).toBuffer();

  // Process content image (always white color)
  const contentImage = await sharp(contentSVG)
    .resize(
      Math.floor((contentWidth / bgWidth) * size),
      Math.floor((contentHeight / bgHeight) * size)
    )
    .toBuffer();

  // Composite content over background
  await sharp(bgImage)
    .composite([
      {
        input: contentImage,
        gravity: "center" // Center the content inside the background
      }
    ])
    .toFormat("png")
    .toFile(outputFilepath);

  // eslint-disable-next-line no-console
  console.log(`Created icon ${outputFilepath}`);
}

/**
 * Create all icons with different variants and sizes
 * @returns {Promise<Awaited<unknown>[]>}
 */
function createIcons() {
  const promises = [];
  for (const variant of iconVariants) {
    for (const size of iconSizes) {
      promises.push(createIcon(variant, size));
    }
  }
  return Promise.all(promises);
}

// Run the icon generation script
createIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
