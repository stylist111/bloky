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

/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import url from "url";

import express from "express";
import requestLogger from "./request-logger.js";
import {delay, apiErrorHandler} from "./api-middleware.js";
import {TEST_ADMIN_PAGES_PORT} from "./test-server-urls.js";
import {emptyDiffResponse} from "./api-fixtures.js";

let dirname = path.dirname(url.fileURLToPath(import.meta.url));

const BUILD_TIME_ROUTES = [
  {
    url: "/example-dynamic-endpoint",
    response: "build time response"
  },
  {
    url: "/subscription.txt",
    response: "[Adblock Plus]\n"
  },
  {
    url: "/subscription-that-shouldnt-be-moved-to-dnr-world.txt",
    response: "[Adblock Plus]"
  },
  {
    url: "/anti-cv-subscription.txt",
    response: "[Adblock Plus]\nlocalhost###migrate-diff-elem-item"
  },
  {
    url: "/easylist.txt",
    response: "[Adblock Plus]\n"
  },
  {
    url: "/exceptionrules.txt",
    response: "[Adblock Plus]\n"
  },
  {
    url: "/updatable_subscription.txt",
    response: fs.readFileSync(dirname + "/pages/updatable_subscription.txt")
  },
  {
    url: "/mv2_updatable_subscription.txt",
    response: fs.readFileSync(dirname + "/pages/updatable_subscription.txt")
  },
  {
    url: "/mv3_diffurl_update.txt",
    response: fs.readFileSync(dirname + "/pages/updatable_subscription.txt")
  },
  {
    url: "/updatable_subscription/001.json",
    response: emptyDiffResponse
  },
  {
    url: "/updatable_subscription/002.json",
    response: emptyDiffResponse
  },
  {
    url: "/updatable_subscription/diff.json",
    response: emptyDiffResponse
  },
  {
    url: "/index.json",
    response: fs.readFileSync(dirname + "/pages/index.json")
  },
  {
    url: "/telemetry",
    response: () => JSON.stringify({
      token: new Date().toISOString()
    }),
    method: "POST"
  },
  {
    url: "/cdp-ping",
    response: () => "{}",
    method: "POST"
  },
  {
    url: "/cdp-aggregate",
    response: () => "{}",
    method: "POST"
  },
  {
    url: "/public-key",
    response: fs.readFileSync(dirname + "/pages/public-key.txt"),
    method: "GET",
    headers: {
      "Pubkey-Id": "aeec16f98f5c69aca7a91c77c494a135"
    }
  }
];

let app = express();

app.use(express.json({limit: "10MB"}));
app.use(delay);

// clear the requests list and reset replies
app.post("/clearRequestLogs", (req, res) => {
  requestLogger.clearRequests();
  res.send("");
});

// get the requests list
app.get("/requestLogs", (req, res) => {
  res.send(JSON.stringify(requestLogger.getRequests(), null, 2));
});

let responses = new Map();

app.post("/clearUrlResponse", (req, res) => {
  responses.delete(req.body.url);
  let buildTimeRoute = BUILD_TIME_ROUTES.find(r => r.url == req.body.url);
  if (buildTimeRoute) {
    createRouteHandler(buildTimeRoute);
  }

  res.send("");
});

function createRouteHandler(route) {
  let method = (route.method || "GET").toUpperCase();
  route.method = method;

  if (!["GET", "POST"].includes(method)) {
    throw new Error(`Currently unsupported HTTP method: ${method}`);
  }

  responses.set(route.url, route);
}

app.post("/setUrlResponse", (req, res) => {
  createRouteHandler(req.body);
  res.send("");
});

app.all("*", requestLogger.logRequests, (req, res, next) => {
  let isHeadRequest = req.method.toUpperCase() == "HEAD";
  let route = responses.get(req.path);

  let routeMatches = route &&
    (req.method.toUpperCase() == route.method ||
      (isHeadRequest && route.method == "GET"));

  if (!routeMatches) {
    next();
    return;
  }

  if (route.status) {
    res.status(route.status);
  }

  if (route.headers) {
    // Without this, cross origin requests can't access all the headers from
    // scripts, although in our tests this restriction only actually applied to
    // the oldest chromium we test.
    res.set({"Access-Control-Expose-Headers": "*"});

    res.set(route.headers);
  }

  if (isHeadRequest) {
    res.end();
  }
  else if (typeof route.response == "function") {
    res.send(route.response());
  }
  else if (route.response) {
    res.send(route.response);
  }
  else {
    res.end();
  }
});

export function startAdminServer(host, verbose) {
  requestLogger.setVerbose(verbose);
  app.listen(TEST_ADMIN_PAGES_PORT, () => {
    console.log(`Admin commands server listening at http://${host}:${TEST_ADMIN_PAGES_PORT}`);
  });

  for (let route of BUILD_TIME_ROUTES) {
    createRouteHandler(route);
  }
}

app.use(apiErrorHandler);
