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

// Elements
const subscriptionContent = document.getElementById("subscriptionContent");
const metricsSection = document.getElementById("metricsSection");
const startupSection = document.getElementById("startupSection");
const refreshDebugBtn = document.getElementById("refreshDebug");
const refreshSubscriptionsBtn = document.getElementById("refreshSubscriptions");
const logsContent = document.getElementById("logsContent");
const clearLogsBtn = document.getElementById("clearLogs");
const refreshLogsBtn = document.getElementById("refreshLogs");
const copyLogsBtn = document.getElementById("copyLogs");
const logLevelFilter = document.getElementById("logLevelFilter");
const logTextFilter = document.getElementById("logTextFilter");
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");

// Log filter state
let activeLevel = "all";
let activeTextFilter = "";

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const targetId = tab.dataset.tab;

    // Update tab buttons
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    // Update tab contents
    tabContents.forEach(content => {
      content.classList.toggle("active", content.id === targetId);
    });

    // Load content for the active tab
    if (targetId === "debug") {
      loadDebug();
    }
    else if (targetId === "subscriptions") {
      loadSubscriptions();
    }
    else if (targetId === "logs") {
      loadLogs();
    }
  });
});

// Load debug info on startup since debug tab is active by default
loadDebug();

// ============ SUBSCRIPTIONS ============

async function loadSubscriptions() {
  subscriptionContent.className = "loading";
  subscriptionContent.textContent = "Loading subscriptions...";

  try {
    const response = await browser.runtime.sendMessage({type: "getSubscriptions"});

    if (response.error) {
      showSubscriptionError(response.error);
      return;
    }

    if (!response.subscriptions || response.subscriptions.length === 0) {
      subscriptionContent.className = "empty";
      subscriptionContent.textContent = "No subscriptions found. Try refreshing.";
      return;
    }

    renderSubscriptions(response.subscriptions);
  }
  catch (error) {
    showSubscriptionError(error.message);
  }
}

function showSubscriptionError(message) {
  subscriptionContent.className = "error";
  subscriptionContent.textContent = `Error: ${message}`;
}

function renderSubscriptions(subscriptions) {
  subscriptionContent.className = "subscription-list";
  subscriptionContent.innerHTML = "";

  for (const sub of subscriptions) {
    const item = document.createElement("div");
    item.className = "subscription-item";

    const info = document.createElement("div");
    info.className = "subscription-info";

    const title = document.createElement("div");
    title.className = "subscription-title";
    title.textContent = sub.title || sub.url;

    const type = document.createElement("div");
    type.className = "subscription-type";
    type.textContent = sub.type || "filter list";

    info.appendChild(title);
    info.appendChild(type);

    const toggle = document.createElement("label");
    toggle.className = "toggle";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = sub.enabled;
    checkbox.dataset.url = sub.url;
    checkbox.addEventListener("change", handleToggle);

    const slider = document.createElement("span");
    slider.className = "toggle-slider";

    toggle.appendChild(checkbox);
    toggle.appendChild(slider);

    item.appendChild(info);
    item.appendChild(toggle);
    subscriptionContent.appendChild(item);
  }
}

function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

// ============ DEBUG TAB ============

async function loadDebug() {
  await Promise.all([
    loadStartupInfo(),
    loadMetrics()
  ]);
}

async function loadStartupInfo() {
  startupSection.innerHTML = "<p style=\"color: #888;\">Loading...</p>";

  try {
    // Load logs first to get session/error counts
    const logsResponse = await browser.runtime.sendMessage({type: "getLogs"});
    if (!logsResponse.error) {
      mergeLogsWithSessions(logsResponse.logs, logsResponse.sessionStartTime);
    }

    const info = await browser.runtime.sendMessage({type: "getStartupInfo"});
    renderStartupInfo(info);
  }
  catch (error) {
    startupSection.innerHTML = `<p style="color: #ff3b30;">Error: ${error.message}</p>`;
  }
}

function renderStartupInfo(info) {
  const runningDuration = formatDurationLong(info.runningDuration);
  const eweStartTime = info.eweStartDuration !== null ?
    formatDuration(info.eweStartDuration) :
    "...";
  const eweSetupTime = info.eweSetupDuration !== null ?
    formatDuration(info.eweSetupDuration) :
    "...";

  // Calculate error count and session count from stored logs
  let errorCount = 0;
  for (const session of storedLogSessions) {
    for (const log of session.logs) {
      if (log.level === "error") {
        errorCount++;
      }
    }
  }
  const sessionCount = storedLogSessions.length;

  let html = "<h4>Startup Info</h4>";
  html += "<div class=\"debug-item\">" +
    "<span class=\"debug-label\">EWE Start Time</span>";
  html += `<span class="debug-value">${eweStartTime}</span></div>`;
  html += "<div class=\"debug-item\"><span class=\"debug-label\">EWE Setup Time</span>";
  html += `<span class="debug-value">${eweSetupTime}</span></div>`;
  html += "<div class=\"debug-item\"><span class=\"debug-label\">Running Duration</span>";
  html += `<span class="debug-value">${runningDuration}</span></div>`;
  html += "<div class=\"debug-item\"><span class=\"debug-label\">Error Count</span>";
  html += `<span class="debug-value">${errorCount}</span></div>`;
  html += "<div class=\"debug-item\"><span class=\"debug-label\">Session Count</span>";
  html += `<span class="debug-value">${sessionCount}</span></div>`;

  startupSection.innerHTML = html;

  // Inject hidden debug JSON into page (all durations in milliseconds)
  injectDebugJson({
    eweStartDurationMs: info.eweStartDuration,
    eweSetupDurationMs: info.eweSetupDuration,
    runningDurationMs: info.runningDuration,
    errorCount,
    sessionCount
  });
}

function injectDebugJson(data) {
  // Remove existing hidden debug container if present
  const existingContainer = document.getElementById("hidden-debug-container");
  if (existingContainer) {
    existingContainer.remove();
  }

  // Create outer container with "debug" text (hidden via style)
  const outerDiv = document.createElement("div");
  outerDiv.id = "hidden-debug-container";
  outerDiv.style.width = "0";
  outerDiv.style.overflow = "hidden";
  const debugFlag = document.createElement("span");
  debugFlag.textContent = "debug-meta";
  // Create inner div with JSON data (no style, hidden by parent)
  const debugValue = document.createElement("span");
  debugValue.id = "hidden-debug-json";
  debugValue.textContent = JSON.stringify(data);

  outerDiv.appendChild(debugFlag);
  outerDiv.appendChild(debugValue);
  document.body.appendChild(outerDiv);
}

function formatDurationLong(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

async function loadMetrics() {
  metricsSection.innerHTML = "<p style=\"color: #888;\">Loading metrics...</p>";

  try {
    const response = await browser.runtime.sendMessage({type: "getSubscriptions"});

    if (response.error) {
      metricsSection.innerHTML = `<p style="color: #ff3b30;">Error: ${response.error}</p>`;
      return;
    }

    renderMetrics(response.subscriptions || []);
  }
  catch (error) {
    metricsSection.innerHTML = `<p style="color: #ff3b30;">Error: ${error.message}</p>`;
  }
}

function renderMetrics(subscriptions) {
  if (subscriptions.length === 0) {
    metricsSection.innerHTML = "<p style=\"color: #888;\">No subscriptions found.</p>";
    return;
  }

  // Calculate totals
  let totalAdd = 0;
  let totalToggle = 0;
  let hasAnyMetric = false;

  for (const sub of subscriptions) {
    if (typeof sub.addDuration !== "undefined") {
      totalAdd += sub.addDuration;
      hasAnyMetric = true;
    }
    if (typeof sub.enableDuration !== "undefined") {
      totalToggle += sub.enableDuration;
      hasAnyMetric = true;
    }
  }

  if (!hasAnyMetric) {
    metricsSection.innerHTML = "<p style=\"color: #888;\">No timing data yet. Toggle subscriptions to see metrics.</p>";
    return;
  }

  let html = "<h4>Timing Metrics</h4>";
  html += "<table class=\"metrics-table\">";
  html += "<tr><th>Subscription</th><th>Add</th><th>Toggle</th></tr>";

  for (const sub of subscriptions) {
    const title = sub.title.length > 20 ?
      sub.title.substring(0, 20) + "..." :
      sub.title;

    let addCell = "-";
    let toggleCell = "-";

    if (typeof sub.addDuration !== "undefined") {
      addCell = `<span class="value">${formatDuration(sub.addDuration)}</span>`;
    }

    if (typeof sub.enableDuration !== "undefined") {
      const action = sub.lastEnableAction ? "on" : "off";
      toggleCell = `<span class="value">${formatDuration(sub.enableDuration)}</span> (${action})`;
    }

    html += `<tr><td>${title}</td><td>${addCell}</td><td>${toggleCell}</td></tr>`;
  }

  // Add totals row
  html += "<tr class=\"total-row\">";
  html += "<td>Total</td>";
  html += `<td>${totalAdd > 0 ? formatDuration(totalAdd) : "-"}</td>`;
  html += `<td>${totalToggle > 0 ? formatDuration(totalToggle) : "-"}</td>`;
  html += "</tr>";

  html += "</table>";
  metricsSection.innerHTML = html;
}

async function handleToggle(event) {
  const checkbox = event.target;
  const url = checkbox.dataset.url;
  const enabled = checkbox.checked;

  checkbox.disabled = true;

  try {
    const response = await browser.runtime.sendMessage({
      type: "setSubscriptionEnabled",
      url,
      enabled
    });

    if (response && response.error) {
      checkbox.checked = !enabled;
      showSubscriptionError(response.error);
    }
  }
  catch (error) {
    checkbox.checked = !enabled;
    showSubscriptionError(error.message);
  }
  finally {
    checkbox.disabled = false;
  }
}

// ============ LOGS ============

// Persistent log storage across sessions
// Array of sessions: { logs: [], sessionStartTime: number }
let storedLogSessions = [];
let currentSessionStartTime = null;

async function loadLogs() {
  try {
    const response = await browser.runtime.sendMessage({type: "getLogs"});

    if (response.error) {
      logsContent.innerHTML = `<div class="log-entry error">Error: ${response.error}</div>`;
      return;
    }

    const {sessionStartTime, logs: newLogs} = response;
    mergeLogsWithSessions(newLogs, sessionStartTime);
    renderAllSessions();
  }
  catch (error) {
    logsContent.innerHTML = `<div class="log-entry error">Error: ${error.message}</div>`;
  }
}

function mergeLogsWithSessions(newLogs, sessionStartTime) {
  // Detect if this is a new session by comparing session start times
  if (currentSessionStartTime === null) {
    // First load - check if we have stored sessions
    if (storedLogSessions.length === 0) {
      // Brand new, create first session
      storedLogSessions.push({logs: newLogs, sessionStartTime});
    }
    else {
      // We have previous sessions, check if new logs match current session
      const lastSession = storedLogSessions[storedLogSessions.length - 1];
      if (lastSession.sessionStartTime === sessionStartTime) {
        // Same session, update logs
        lastSession.logs = newLogs;
      }
      else {
        // New session detected
        storedLogSessions.push({logs: newLogs, sessionStartTime});
      }
    }
  }
  else if (sessionStartTime !== currentSessionStartTime) {
    // Session changed - background restarted
    storedLogSessions.push({logs: newLogs, sessionStartTime});
  }
  else {
    // Same session, update the latest session's logs
    storedLogSessions[storedLogSessions.length - 1].logs = newLogs;
  }

  currentSessionStartTime = sessionStartTime;
}

function renderAllSessions() {
  if (storedLogSessions.length === 0 ||
      storedLogSessions.every(s => s.logs.length === 0)) {
    logsContent.innerHTML = '<div class="log-entry">No logs yet.</div>';
    return;
  }

  let html = "";

  // Render sessions in reverse order (newest first)
  for (let i = storedLogSessions.length - 1; i >= 0; i--) {
    const session = storedLogSessions[i];

    // Add session separator (except for the most recent session at the top)
    if (i < storedLogSessions.length - 1) {
      html += '<div class="log-session-separator">New Session</div>';
    }

    // Render logs in reverse order (newest first)
    html += [...session.logs].reverse().map(log => {
      const level = log.level || "info";
      const time = new Date(log.timestamp).toLocaleTimeString();
      const message = typeof log.message === "object" ?
        JSON.stringify(log.message, null, 2) :
        log.message;
      const fullText = `[${time}] [${level.toUpperCase()}] ${message}`;
      const levelHidden = activeLevel !== "all" && activeLevel !== level;
      const textHidden = activeTextFilter &&
        !fullText.toLowerCase().includes(activeTextFilter.toLowerCase());
      const hidden = levelHidden || textHidden ? " hidden" : "";
      const cls = `log-entry ${level}${hidden}`;
      return `<div class="${cls}" data-level="${level}">${fullText}</div>`;
    }).join("");
  }

  logsContent.innerHTML = html;
}

function applyLogFilter() {
  const entries = logsContent.querySelectorAll(".log-entry[data-level]");
  entries.forEach(entry => {
    const level = entry.dataset.level;
    const text = entry.textContent;
    const levelHidden = activeLevel !== "all" && activeLevel !== level;
    const textHidden = activeTextFilter &&
      !text.toLowerCase().includes(activeTextFilter.toLowerCase());
    entry.classList.toggle("hidden", levelHidden || textHidden);
  });
}

async function clearLogs() {
  try {
    await browser.runtime.sendMessage({type: "clearLogs"});
    // Clear all stored sessions
    storedLogSessions = [];
    currentSessionStartTime = null;
    logsContent.innerHTML = '<div class="log-entry">Logs cleared.</div>';
  }
  catch (error) {
    logsContent.innerHTML = `<div class="log-entry error">Error: ${error.message}</div>`;
  }
}

function copyLogs() {
  const text = logsContent.innerText;
  navigator.clipboard.writeText(text).then(() => {
    copyLogsBtn.textContent = "Copied!";
    setTimeout(() => {
      copyLogsBtn.textContent = "Copy";
    }, 1500);
  });
}

// ============ EVENT LISTENERS ============

refreshDebugBtn.addEventListener("click", loadDebug);
refreshSubscriptionsBtn.addEventListener("click", loadSubscriptions);
clearLogsBtn.addEventListener("click", clearLogs);
refreshLogsBtn.addEventListener("click", loadLogs);
copyLogsBtn.addEventListener("click", copyLogs);

// Log level dropdown
logLevelFilter.addEventListener("change", () => {
  activeLevel = logLevelFilter.value;
  applyLogFilter();
});

// Log text filter
logTextFilter.addEventListener("input", () => {
  activeTextFilter = logTextFilter.value;
  applyLogFilter();
});

// ============ BACKGROUND NOTIFICATIONS ============

browser.runtime.onMessage.addListener(message => {
  if (message.type === "timingUpdate") {
    // Refresh the appropriate section based on what was updated
    if (message.section === "startup") {
      loadStartupInfo();
    }
    else if (message.section === "metrics") {
      loadMetrics();
    }
  }
});
