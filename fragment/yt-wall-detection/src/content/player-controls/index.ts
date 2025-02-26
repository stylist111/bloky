import browser from "webextension-polyfill";
import { isInHavenExperiment } from "../shared.js";

const manifest = browser.runtime.getManifest();

/**
 * Wait for an element to be present in the DOM
 * @param {string} selector - The CSS selector to wait for
 */
async function waitForElement(selector: string): Promise<Element> {
  return await new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });
}

/**
 * Create a button that will be inserted into the YouTube player controls
 */
function getWatchingButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.style.width = "auto";
  btn.style.height = "100%";
  btn.style.border = "none";
  btn.style.backgroundColor = "transparent";
  btn.style.opacity = "0.9";
  btn.style.color = "inherit";
  btn.style.fontSize = "109%";
  btn.style.cursor = "pointer";
  btn.style.display = "inline-block";
  btn.style.verticalAlign = "top";
  btn.style.margin = "0px 12px";

  btn.addEventListener("mouseover", () => {
    btn.style.opacity = "1";
  });

  btn.addEventListener("mouseout", () => {
    btn.style.opacity = "0.9";
  });

  const btnText = document.createElement("span");
  btnText.innerHTML = `Watching with <b>${manifest.short_name}</b>`;
  btnText.style.borderBottom = "2px #e1002d solid";
  btnText.style.paddingBottom = "2px";

  btn.appendChild(btnText);
  return btn;
}

/**
 * Start the content script
 */
async function start(): Promise<void> {
  const isEnabled = await isInHavenExperiment();

  if (!isEnabled || !window.location.hash.includes("yt-haven")) {
    return;
  }

  const controlsContainer = await waitForElement(".ytp-right-controls");

  const watchingBtn = getWatchingButton();
  watchingBtn.addEventListener("click", () => {
    const response = confirm(
      `Disabling ${manifest.short_name} player might result in more ads. Do you want to proceed?`,
    );

    if (response) {
      // TODO: Disable YT Haven
    }
  });

  // Insert the button as the first child of the container
  controlsContainer.insertBefore(watchingBtn, controlsContainer.firstChild);
}

// Start the content script
void start();
