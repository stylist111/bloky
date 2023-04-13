import "mocha/mocha.js";
import "mocha/mocha.css";

import "./mocha/mocha-setup.js";
import "./expect-matchers.js";
import "./testing-mechanisms.js";
import "./request-filter.js";
import "./content-filter.js";
import "./subscriptions.js";
import "./filters.js";
import "./initialization.js";
import "./notifications.js";
import "./reporting.js";
import "./synchronization.js";
import "./popup-blocker.js";
import "./subscribe-links.js";
import "./allowlisting.js";

import {start} from "./mocha/mocha-runner.js";
start();
