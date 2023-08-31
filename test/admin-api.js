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

const HTTP_ADMIN_PORT = 3003;

let app = express();
let dirname = path.dirname(url.fileURLToPath(import.meta.url));

let reply = "[Adblock Plus]\n";

app.use(express.json());
app.use(delay);

// configure to reply (eg. ../configure?reply=123)
app.get("/configure", (req, res) => {
  reply = encodeURIComponent(req.query["reply"]);
  res.send("");
});

// clear the requests list and reset replies
app.post("/clearRequestLogs", (req, res) => {
  requestLogger.clearRequests();
  res.send("");
});

// get the requests list
app.get("/requestLogs", (req, res) => {
  res.send(JSON.stringify(requestLogger.getRequests(), null, 2));
});

// get the subscription content (GET)
app.get("/subscription.txt", requestLogger.logRequests, (req, res) => {
  res.send(reply);
});

// get the subscription content (HEAD)
app.head("/subscription.txt", requestLogger.logRequests, (req, res) => {
  res.send(reply);
});

// get the subscription content (GET)
app.get("/updatable_subscription.txt", requestLogger.logRequests, (req, res) => {
  let sub = fs.readFileSync(dirname + "/pages/updatable_subscription.txt");
  res.send(sub);
});

app.get("/mv2_updatable_subscription.txt", requestLogger.logRequests, (req, res) => {
  let sub = fs.readFileSync(dirname + "/pages/updatable_subscription.txt");
  res.send(sub);
});

// get the subscription content (HEAD)
app.head("/updatable_subscription.txt", requestLogger.logRequests, (req, res) => {
  res.send(reply);
});


let responses = new Map();

app.post("/clearUrlResponse", (req, res) => {
  responses.delete(req.body.url);
  res.send("");
});

function createRouteHandler(route) {
  responses.set(route.url, route.response);

  let handler = (req, res) => {
    let response = responses.get(route.url);
    if (typeof response == "function") {
      res.send(response());
    }
    else if (response) {
      res.send(response);
    }
    else {
      res.end();
    }
  };

  let method = (route.method || "GET").toUpperCase();

  if (method == "POST") {
    app.post(route.url, requestLogger.logRequests, handler);
  }
  else if (method == "GET") {
    app.get(route.url, requestLogger.logRequests, handler);
  }
  else {
    throw new Error(`Currently unsupported HTTP method: ${method}`);
  }
}

app.post("/setUrlResponse", (req, res, next) => {
  createRouteHandler(req.body);
  res.send("");
});

export function startAdminServer(host) {
  app.listen(HTTP_ADMIN_PORT, () => {
    console.log(`Admin commands server listening at http://${host}:${HTTP_ADMIN_PORT}`);
  });

  let buildTimeRoutes = [
    {
      url: "/subscription-that-shouldnt-be-moved-to-dnr-world.txt",
      response: "[Adblock Plus]"
    },
    {
      url: "/anti-cv-subscription.txt",
      response: "[Adblock Plus]\nlocalhost###migrate-diff-elem-item"
    },
    {
      url: "/updatable_subscription/diff.json",
      response: JSON.stringify({
        filters: {
          add: [],
          remove: []
        }
      })
    },
    {
      url: "/anti-cv-subscription_diff.json",
      response: JSON.stringify({
        filters: {
          add: [],
          remove: []
        }
      })
    },
    {
      url: "/telemetry",
      response: () => JSON.stringify({
        token: new Date().toISOString()
      }),
      method: "POST"
    }
  ];

  for (let route of buildTimeRoutes) {
    createRouteHandler(route);
  }
}

app.use(apiErrorHandler);
