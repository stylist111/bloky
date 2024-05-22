import "mocha/mocha.js";
import "mocha/mocha.css";

import "../mocha/mocha-setup.js";
import "../expect-matchers.js";
import "../testing-mechanisms.js";
import "../request-filter.js";
import "../content-filter.js";
import "../subscriptions.js";
import "../filters.js";
import "../initialization.js";
import "../notifications.js";
import "../reporting.js";
import "../cdp.js";
import "../synchronization.js";
import "../popup-blocker.js";
import "../subscribe-links.js";
import "../allowlisting.js";
import "../dnr-filters-update.js";
import "../dnr-full-subscription-updates.js";
import "../telemetry.js";

import {start} from "../mocha/mocha-runner.js";
start();
