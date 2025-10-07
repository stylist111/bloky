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

/* For ESLint: List any global identifiers used in this file below */
/* global selected, browser, initializeProxies, send */

$(async () => {
  await initializeProxies();

  /**
   * Creates a Blob from the debug data object, and downloads it
   * to the desktop
   *
   * @param {any} data the debug data for the extension
   */
  const downloadDebugData = (data) => {
    const myBlob = new Blob([JSON.stringify(data, null, 4)], {
      type: "text/plain",
    });
    const blobURL = URL.createObjectURL(myBlob);
    const a = document.createElement("a");
    a.setAttribute("href", blobURL);
    // use the current date & time (without seconds or the timezone) to create
    // a unique file name for the user
    const currentLocalTimeNoSpecialChars = new Date()
      .toISOString()
      .split(".")[0]
      .slice(0, -2)
      .replace(/[-T:]/g, "");
    a.setAttribute("download", `adblock-data-${currentLocalTimeNoSpecialChars}.txt`);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobURL);
  };

  $("#debuginfo_link").click(() => {
    browser.permissions
      .request({ permissions: ["management"] })
      .catch(() => false)
      .then(() => send("getDebugInfo"))
      .then(downloadDebugData)
      .catch(console.error);
  });

  selected("#whatsnew_link", () => {
    fetch(browser.runtime.getURL("RELEASE_NOTES.md"))
      .then((response) => response.text())
      .then((text) => {
        const unreleasedSection = "# Unreleased";
        let cleanedText = text;

        if (text.startsWith(unreleasedSection)) {
          const firstReleaseIndex = text.indexOf("#", unreleasedSection.length);
          if (firstReleaseIndex !== -1) {
            cleanedText = text.slice(firstReleaseIndex);
          }
        }

        $("#changes").text(cleanedText).fadeIn();
        $("body, html").animate(
          {
            scrollTop: $("#changes").offset().top,
          },
          1000,
        );
      });
  });
});
