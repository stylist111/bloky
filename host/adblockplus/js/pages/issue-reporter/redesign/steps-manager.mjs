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

import { $, $$ } from "../../../dom.mjs";

// both components are needed,
// and handled, by this file
import "../../../io-steps.mjs";
import "../../../io-highlighter.mjs";

// managers are invoked right away
// but their initialization might be asynchronous
const managers = [
  // First page: Combined screenshot + issue type selection
  // User must select an issue type to continue, then consent via modal
  ({ ioSteps, page, index, screenshot }) => {
    const screenshotContainer = $("#screenshotContainer");
    const consentModal = $("#screenshotConsentModal");
    const consentConfirm = $("#consentConfirm");
    const consentCancel = $("#consentCancel");
    const modalBackdrop = consentModal?.querySelector(".modal-backdrop");

    // Initialize highlighter immediately since screenshot is always included
    const ioHighlighter = document.createElement("io-highlighter");
    screenshotContainer.appendChild(ioHighlighter);
    ioHighlighter.edit(screenshot);

    let issueTypeSelected = false;
    let screenshotConsentGiven = false;

    // Show modal when trying to continue
    const showConsentModal = () => {
      if (consentModal) {
        consentModal.hidden = false;
      }
    };

    // Hide modal
    const hideConsentModal = () => {
      if (consentModal) {
        consentModal.hidden = true;
      }
    };

    // Handle consent confirm
    if (consentConfirm) {
      consentConfirm.addEventListener("click", () => {
        screenshotConsentGiven = true;
        hideConsentModal();
        // Now actually proceed to next step
        ioSteps.dispatchEvent(
          new CustomEvent("step:click", { detail: index + 1 })
        );
      });
    }

    // Handle consent cancel
    if (consentCancel) {
      consentCancel.addEventListener("click", hideConsentModal);
    }

    // Handle backdrop click to close
    if (modalBackdrop) {
      modalBackdrop.addEventListener("click", hideConsentModal);
    }

    // Listen for issue type selection
    page.addEventListener("change", (event) => {
      if (event.target.name === "type") {
        issueTypeSelected = true;
        ioSteps.setCompleted(index, true);
        enableContinue();
      }
    });

    // Intercept continue button to show modal first
    const btnContinue = $("#continue");
    btnContinue.addEventListener(
      "click",
      (event) => {
        // Only intercept on first page and if consent not yet given
        if (!screenshotConsentGiven && issueTypeSelected) {
          event.stopImmediatePropagation();
          showConsentModal();
        }
      },
      true
    ); // Use capture to intercept before other handlers
  },

  // Second page: Details (comment + include config)
  // Always valid - user can proceed with or without comment
  ({ ioSteps, page, index }) => {
    ioSteps.addEventListener("step:click", function once(event) {
      if (event.detail !== index) return;
      ioSteps.removeEventListener(event.type, once);

      // Details page is always valid - comment is optional
      ioSteps.setCompleted(index, true);
      enableContinue();
    });

    // Also listen for when data collection is complete
    ioSteps.addEventListener("requestcollected", () => {
      // Data is ready, can proceed to review
    });
  },

  // Third page: Review and send
  // Shows preview and allows user to send the report
  ({ ioSteps, page, index, resolve }) => {
    const reportConsent = $("#reportConsent");
    const sendButton = $("#send");

    // Update send button state based on consent
    const updateSendButtonState = () => {
      sendButton.disabled = !reportConsent || !reportConsent.checked;
    };

    // Listen for consent checkbox changes
    if (reportConsent) {
      reportConsent.addEventListener("change", updateSendButtonState);
    }

    ioSteps.addEventListener("step:click", function once(event) {
      if (event.detail !== index) return;
      ioSteps.removeEventListener(event.type, once);

      // Show send button, hide continue
      $("#continue").hidden = true;
      sendButton.hidden = false;
      // Send button disabled until consent is given
      updateSendButtonState();
      ioSteps.setCompleted(index, true);
    });

    // Handle send button click
    sendButton.addEventListener("click", function sendOnce() {
      sendButton.removeEventListener("click", sendOnce);
      sendButton.disabled = true;
      $("#back").hidden = true;
      $("#cancel").disabled = true;
      $("#cancel").hidden = true;

      // Hide review page heading/description during send
      const reviewHeading = page.querySelector("h1");
      const reviewDescription = page.querySelector("h1 + p");
      if (reviewHeading) reviewHeading.hidden = true;
      if (reviewDescription) reviewDescription.hidden = true;

      // Show sending state, hide preview
      $("#reportPreview").hidden = true;
      $("#sendingState").hidden = false;

      const ioHighlighter = $("io-highlighter");
      ioHighlighter.changeDepth.then(() => {
        resolve({
          screenshot: {
            get edited() {
              return ioHighlighter.edited;
            },
            get data() {
              return ioHighlighter.toDataURL();
            }
          }
        });
      });
    });
  }
];

const stepManager = ({ screenshot }) =>
  new Promise((resolve) => {
    const ioSteps = $("io-steps");
    const pages = $$("main > .page");
    const btnContinue = $("#continue");
    const btnBack = $("#back");
    let currentPage = pages[0];
    let index = 0;

    // Set initial page state
    document.body.setAttribute("data-page", currentPage.id);

    ioSteps.addEventListener("step:click", (event) => {
      index = event.detail;
      const nextPage = pages[index];
      if (nextPage === currentPage) return;
      currentPage.hidden = true;
      currentPage = nextPage;
      currentPage.hidden = false;
      document.body.setAttribute("data-page", nextPage.id);

      // Update button states
      btnContinue.disabled = !ioSteps.getCompleted(index);
      btnBack.hidden = index === 0;
    });

    btnContinue.addEventListener("click", (event) => {
      ioSteps.dispatchEvent(
        new CustomEvent("step:click", { detail: index + 1 })
      );
    });

    btnBack.addEventListener("click", (event) => {
      if (index > 0) {
        ioSteps.dispatchEvent(
          new CustomEvent("step:click", { detail: index - 1 })
        );
        // Re-show continue button if going back from review page
        $("#continue").hidden = false;
        $("#send").hidden = true;
      }
    });

    managers.forEach((setup, i) => {
      setup({ ioSteps, page: pages[i], index: i, resolve, screenshot });
    });
  });

function enableContinue() {
  $("#continue").disabled = false;
}

export default stepManager;
