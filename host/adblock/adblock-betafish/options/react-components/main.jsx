import React from "react";
import ReactDOM from "react-dom/client";
import {
  globalAbpPrefPropertyNames as abpPrefPropertyNames,
  globalSettings as settings,
  globalSubscriptionAdapter as SubscriptionAdapter,
} from "./shared/globals";
import { App } from "./app.jsx";

const checkAndAddApp = (data) => {
  const url = new URL(window.top.location.href);
  const showNewUI = url.searchParams.has("newUi");

  // TODO(newUi): Remove check and old UI hiding when transition complete
  if (!showNewUI) {
    return;
  }

  const container = document.getElementById("react-options");
  const root = ReactDOM.createRoot(container);
  root.render(<App {...data} />);

  const oldUI = document.getElementById("jq-options");
  oldUI.style.display = "none";
};

const fetchData = async () => {
  const subs = await SubscriptionAdapter.getSubscriptionsMinusText();
  return { subs, settings, prefs: abpPrefPropertyNames };
};

const initializeApp = async () => {
  const optionsData = await fetchData();
  checkAndAddApp({ optionsData });
};

(async () => await initializeApp())();
