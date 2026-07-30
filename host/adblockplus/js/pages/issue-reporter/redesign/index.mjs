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

import { convertDoclinks } from "../../../common.mjs";
import { $ } from "../../../dom.mjs";
import { initI18n, setElementLinks, setElementText } from "~/i18n/ui";
import {
  gatherInitialData,
  closeRequestsCollectingTab,
  updateConfigurationInfo,
  updateDebugInfo,
  buildReport
} from "./report.mjs";
import stepsManager from "./steps-manager.mjs";
import * as ewe from "@eyeo/webext-ad-filtering-solution/ui";

import "../../../../src/issue-reporter/ui/issue-reporter-redesign.css";

const serverLogger = new ewe.telemetry.ServerLogger("adblockplus_ui");

const optionalPermissions = {
  permissions: ["management"]
};

convertDoclinks();
initI18n();

function formatReportForPreview(
  report,
  includeConfig = true,
  includeDebug = true
) {
  const i18n = (key) => browser.i18n.getMessage(key);
  const escape = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const section = (title, content) => {
    if (!content) return "";
    return `<div class="preview-section">
      <h3>${escape(title)}</h3>
      <div class="preview-content">${content}</div>
    </div>`;
  };

  const row = (label, value) => {
    if (!value) return "";
    return `<div class="preview-row">
      <span class="preview-label">${escape(label)}:</span>
      <span class="preview-value">${escape(value)}</span>
    </div>`;
  };

  let html = "";

  // Issue
  if (report.issue) {
    const typeLabels = {
      "false positive": i18n("issueReporter_falsePositive_label"),
      "false negative": i18n("issueReporter_falseNegative_label"),
      other: i18n("issueReporter_other_label")
    };
    let content = "";
    if (report.issue.type) {
      content += `<p><strong>${i18n("issueReporter_preview_issueType")}:</strong> ${escape(typeLabels[report.issue.type] || report.issue.type)}</p>`;
    }
    if (report.issue.description) {
      content += `<p><strong>${i18n("issueReporter_preview_issueDescription")}:</strong> ${escape(report.issue.description)}</p>`;
    }
    html += section(i18n("issueReporter_preview_issue"), content);
  }

  // Page URL
  if (report.page && report.page.url) {
    html += section(
      i18n("issueReporter_preview_pageUrl"),
      `<p>${escape(report.page.url)}</p>`
    );
  }

  // Email
  if (report.contactEmail) {
    html += section(
      i18n("issueReporter_preview_email"),
      `<p>${escape(report.contactEmail)}</p>`
    );
  }

  // Comment
  if (report.userComment) {
    html += section(
      i18n("issueReporter_preview_comment"),
      `<p>${escape(report.userComment)}</p>`
    );
  }

  // Screenshot
  if (report.screenshot) {
    const edited = report.screenshot.edited ? "yes" : "no";
    const data = report.screenshot.data;
    let content = `<p>${i18n("issueReporter_preview_screenshotIncluded").replace("{0}", edited)}</p>`;
    if (data && data.startsWith("data:image")) {
      content += `<img src="${data}" class="preview-screenshot" alt="Screenshot preview">`;
    }
    html += section(i18n("issueReporter_preview_screenshot"), content);
  }

  // Product Info
  if (report.product) {
    const isPremium = report.hasPremium;
    html += section(
      i18n("issueReporter_preview_adblockplus"),
      row("Product", report.product.name) +
        row("Source", report.product.source) +
        row("Version", report.product.version) +
        row("Locale", report.product.locale) +
        (isPremium ? row("Premium", "Yes") : "")
    );
  }

  // Browser Info (only if includeConfig is true)
  if (includeConfig && report.application) {
    html += section(
      i18n("issueReporter_preview_browser"),
      row("Name", report.application.name) +
        row("Version", report.application.version) +
        row("User Agent", report.application.userAgent)
    );
  }

  // Platform Info (only if includeConfig is true)
  if (includeConfig && report.platform) {
    html += section(
      i18n("issueReporter_preview_platform"),
      row("Name", report.platform.name) +
        row("Version", report.platform.version)
    );
  }

  // Subscriptions (Filter Lists)
  if (report.subscriptions && report.subscriptions.length > 0) {
    let content = "";
    report.subscriptions.forEach((sub) => {
      content += `<div class="preview-list-item">${escape(sub.id || "")}</div>`;
    });
    html += section(
      i18n("issueReporter_preview_subscriptions"),
      `<div class="preview-list">${content}</div>`
    );
  }

  // Requests
  if (report.requests && report.requests.length > 0) {
    html += section(
      i18n("issueReporter_preview_requests"),
      `<p>${report.requests.length} request(s) logged</p>`
    );
  }

  // Filters
  if (report.matchedFiltersSummary && report.matchedFiltersSummary.length > 0) {
    let content = "";
    report.matchedFiltersSummary.forEach((filter) => {
      content += `<div class="preview-list-item"><code>${escape(filter.text || "")}</code></div>`;
    });
    html += section(
      i18n("issueReporter_preview_filters"),
      `<div class="preview-list">${content}</div>`
    );
  }

  // Extensions (only if includeConfig is true)
  if (includeConfig && report.extensions && report.extensions.length > 0) {
    let content = "";
    report.extensions.forEach((ext) => {
      content += `<div class="preview-list-item">${escape(ext.name || "")} (${escape(ext.version || "")})</div>`;
    });
    html += section(
      i18n("issueReporter_preview_extensions"),
      `<div class="preview-list">${content}</div>`
    );
  }

  // Debug data (only if includeDebug is true)
  if (includeDebug && report.debugData) {
    html += section(
      i18n("issueReporter_preview_debugData"),
      `<div class="preview-list"><pre style="font-size: 0.75rem; white-space: pre-wrap; word-break: break-all;">${escape(JSON.stringify(report.debugData, null, 2))}</pre></div>`
    );
  }

  return html || `<p>${i18n("issueReporter_preview_notProvided")}</p>`;
}

function containsPermissions() {
  // Firefox doesn't trigger the promise's catch() but instead throws
  try {
    return browser.permissions.contains(optionalPermissions);
  } catch (ex) {
    return Promise.reject(ex);
  }
}

function getScreenshotData() {
  const ioHighlighter = $("io-highlighter");
  if (!ioHighlighter) return null;

  const proc = browser.i18n.getMessage("issueReporter_processing_screenshot");
  return {
    edited: ioHighlighter.edited || false,
    data: ioHighlighter.toDataURL() || `data:image/png;base64,...${proc}...`
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  const supportEmail = "support@adblockplus.org";
  setElementLinks("sr-warning", `mailto:${supportEmail}`);
  setElementLinks(
    "other-issues",
    `mailto:${supportEmail}?subject=${encodeURIComponent("[Issue Reporter]")}`
  );

  const cancelButton = $("#cancel");
  cancelButton.addEventListener("click", closeMe);
  $("#hide-notification").addEventListener("click", () => {
    $("#notification").setAttribute("aria-hidden", true);
  });

  const screenshot = await browser.tabs.captureVisibleTab(null, {
    format: "png"
  });
  // activate current tab and let the user report
  const tab = await browser.tabs.getCurrent();
  await browser.tabs.update(tab.id, { active: true });
  const manageSteps = stepsManager({ screenshot });

  // Gather initial data (browser info, subscriptions, etc.)
  const dataReady = gatherInitialData().catch((e) => {
    console.error(e);
    alert(e);
    closeMe();
  });

  $("#send").addEventListener("click", async function sendAll(event) {
    const sendButton = event.currentTarget;
    const lastStep = $("io-steps button:last-child");
    sendButton.removeEventListener("click", sendAll);
    sendButton.disabled = true;
    lastStep.disabled = false;
    lastStep.click();

    // Add sending class to body to hide consent and back button via CSS
    document.body.classList.add("sending");

    $("io-highlighter").addEventListener("changecolordepth", (evt) => {
      const progress = $("#sendingProgress");
      const { max, value } = evt.detail;
      progress.max = max * 2;
      progress.value = value;
    });

    try {
      // Wait for data gathering and steps to complete
      await Promise.all([dataReady, manageSteps]);

      window.removeEventListener("beforeunload", closeMe);
      cancelButton.disabled = true;
      cancelButton.hidden = true;

      // Build report fresh at send time
      const report = await buildReport(getScreenshotData());
      sendReport(report);
      serverLogger.behavior("issue_report_submitted");

      sendButton.textContent = browser.i18n.getMessage(
        "issueReporter_closeButton_label"
      );
      $("io-steps").setCompleted(-1, true);
    } catch (error) {
      console.error("Failed to send report:", error);
      window.removeEventListener("beforeunload", closeMe);
      document.body.classList.remove("sending");
      document.body.classList.add("sent");
      $("#sendingState").hidden = true;
      $("#error").textContent = "Something went wrong. Please try again.";
      $("#error").hidden = false;
      sendButton.disabled = false;
      sendButton.textContent = browser.i18n.getMessage(
        "issueReporter_closeButton_label"
      );
      sendButton.addEventListener("click", closeMe);
    }
  });

  // We query our permissions here to find out whether the browser supports them
  containsPermissions()
    .then(() => {
      const includeConfig = $("#includeConfig");

      const requestConfigPermissions = () => {
        return browser.permissions
          .request(optionalPermissions)
          .then((granted) => {
            return updateConfigurationInfo(granted).then(() => {
              includeConfig.checked = granted;
            });
          })
          .catch(console.error)
          .then(() => browser.permissions.remove(optionalPermissions))
          .then((success) => {
            if (!success) throw new Error("Failed to remove permissions");
          })
          .catch(console.error);
      };

      includeConfig.addEventListener("change", (event) => {
        if (!includeConfig.checked) {
          updateConfigurationInfo(false);
          return;
        }
        event.preventDefault();
        requestConfigPermissions();
      });
    })
    .catch((err) => {
      // No need to ask for more data if we won't be able to access it anyway
      const includeConfig = $("#includeConfigContainer");
      includeConfig.hidden = true;
    });

  // Debug data checkbox handler
  const includeDebugCheckbox = $("#includeDebug");
  includeDebugCheckbox.addEventListener("change", () => {
    updateDebugInfo(includeDebugCheckbox.checked);
  });
  // Initialize debug data since it's checked by default
  updateDebugInfo(true).then((debugData) => {
    // Check if user is logged in premium
    if (debugData && debugData.account) {
      const { hasPremium, isLoggedIn, user } = debugData.account;

      if (hasPremium && isLoggedIn && user && user.email) {
        // Hide regular email section, show premium email section
        const regularEmailSection = $("#regularEmailSection");
        const premiumEmailSection = $("#premiumEmailSection");
        const premiumEmailDisplay = $("#premiumEmailDisplay");
        const emailField = $("#email");

        if (regularEmailSection) {
          regularEmailSection.hidden = true;
        }
        if (premiumEmailSection) {
          premiumEmailSection.hidden = false;
        }
        if (premiumEmailDisplay) {
          premiumEmailDisplay.textContent = user.email;
        }

        // Set the email field (default is "use this email")
        if (emailField) {
          emailField.value = user.email;
        }

        // Handle radio button changes
        const usePremiumEmail = $("#usePremiumEmail");
        const reportAnonymously = $("#reportAnonymously");

        if (usePremiumEmail) {
          usePremiumEmail.addEventListener("change", () => {
            if (usePremiumEmail.checked && emailField) {
              emailField.value = user.email;
            }
          });
        }

        if (reportAnonymously) {
          reportAnonymously.addEventListener("change", () => {
            if (reportAnonymously.checked && emailField) {
              emailField.value = "";
            }
          });
        }
      }
    }
  });

  // Populate preview when entering review page
  const ioStepsPreview = $("io-steps");
  ioStepsPreview.addEventListener("step:click", async (event) => {
    // Review page is index 2 (third page)
    if (event.detail === 2) {
      // Ensure debug data is updated based on checkbox before showing preview
      const includeDebugCb = $("#includeDebug");
      await updateDebugInfo(includeDebugCb && includeDebugCb.checked);

      await dataReady;
      await closeRequestsCollectingTab();

      // Build report for preview
      const includeConfigCheckbox = $("#includeConfig");
      const includeConfig =
        includeConfigCheckbox && includeConfigCheckbox.checked;
      const includeDebug = includeDebugCb && includeDebugCb.checked;

      const report = await buildReport(getScreenshotData());
      const previewElement = $("#reportPreview");
      previewElement.innerHTML = formatReportForPreview(
        report,
        includeConfig,
        includeDebug
      );
      previewElement.focus();
    }
  });
});

let notifyClosing = true;
window.addEventListener("beforeunload", closeMe);
function closeMe() {
  if (notifyClosing) {
    notifyClosing = false;
    browser.runtime
      .sendMessage({
        type: "app.get",
        what: "senderId"
      })
      .then((tabId) => {
        if (tabId) {
          return browser.tabs.remove(tabId);
        }
      })
      .catch(console.error);
  }
}

const REQUEST_TIMEOUT_MS = 30000;
const SUPPORT_EMAIL = "support@adblockplus.org";

function sendReport(reportData) {
  const url = "https://issue-report.adblockplus.org/api/v1/issue-report";

  const setSupportEmailLink = (element, reportId = null) => {
    const href = reportId
      ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Issue Report: ${reportId}`)}`
      : `mailto:${SUPPORT_EMAIL}`;
    for (const link of element.querySelectorAll("a[data-i18n-index]")) {
      link.href = href;
      link.className = "support-email";
    }
  };

  const showError = () => {
    document.getElementById("sendReportMessage").hidden = true;
    document.getElementById("sendingProgressContainer").hidden = true;
    document.body.classList.remove("sending");
    document.body.classList.add("sent");

    const errorElement = document.getElementById("error");
    setElementText(errorElement, "issueReporter_errorMessage_simple", null);
    setSupportEmailLink(errorElement);

    errorElement.hidden = false;

    document.getElementById("continue").disabled = false;
    $("#send").disabled = false;
    $("#send").addEventListener("click", closeMe);
  };

  const showSuccess = (reportId) => {
    document.getElementById("sendReportMessage").hidden = true;
    document.getElementById("sendingProgressContainer").hidden = true;
    document.body.classList.remove("sending");
    document.body.classList.add("sent");

    const resultElement = document.getElementById("result");
    resultElement.textContent = "";

    const reportIdElement = document.createElement("p");
    reportIdElement.className = "report-id";
    reportIdElement.textContent = browser.i18n
      .getMessage("issueReporter_reportId")
      .replace("{0}", reportId);
    resultElement.appendChild(reportIdElement);

    const supportMessage = document.createElement("p");
    supportMessage.className = "support-message";
    setElementText(supportMessage, "issueReporter_supportContact", null);
    setSupportEmailLink(supportMessage, reportId);
    resultElement.appendChild(supportMessage);

    resultElement.hidden = false;

    document.getElementById("continue").disabled = false;
    $("#send").disabled = false;
    $("#send").addEventListener("click", closeMe);
  };

  const reportSent = () => {
    let success = false;
    let reportId = null;

    try {
      success = request.status === 200;
    } catch (e) {
      // Getting request status might throw if no connection was established
    }

    if (success) {
      try {
        const response = JSON.parse(request.responseText);
        reportId = response.reportId;
      } catch (e) {
        success = false;
      }
    }

    if (success && reportId) {
      showSuccess(reportId);
    } else {
      showError();
    }
  };

  const reportTimeout = () => {
    request.abort();
    showError();
  };

  const request = new XMLHttpRequest();
  request.open("POST", url);
  request.setRequestHeader("Content-Type", "application/json");
  request.setRequestHeader("X-Adblock-Plus", "1");
  request.timeout = REQUEST_TIMEOUT_MS;
  request.addEventListener("load", reportSent);
  request.addEventListener("error", reportSent);
  request.addEventListener("timeout", reportTimeout);
  const progress = document.getElementById("sendingProgress");
  request.upload.addEventListener("progress", (event) => {
    if (!event.lengthComputable) return;

    if (event.loaded > 0) {
      progress.max = 100;
      progress.value = 50 + (50 * event.loaded) / event.total;
    }
  });
  request.send(JSON.stringify(reportData));
}

document.body.hidden = false;
