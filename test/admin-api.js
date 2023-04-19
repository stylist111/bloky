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

import express from "express";
import requestLogger from "./request-logger.js";

const HTTP_ADMIN_PORT = 3003;

let app = express();

let reply = "[Adblock Plus]\n";

// configure to reply (eg. ../configure?reply=123)
app.get("/configure", (req, res) => {
  reply = encodeURIComponent(req.query["reply"]);
  res.send("");
});

// clear the requests list and reset replies
app.get("/clear", (req, res) => {
  requestLogger.clearRequests();
  res.send("");
});

// get the requests list
app.get("/list", (req, res) => {
  res.send(JSON.stringify(requestLogger.getRequests().map(request => {
    return {
      method: request.method,
      url: request.url,
      query: request.query
    };
  }), null, 2));
});

// get the subscription content (GET)
app.get("/subscription.txt", requestLogger.logRequests, (req, res) => {
  res.send(reply);
});

// get the subscription content (HEAD)
app.head("/subscription.txt", requestLogger.logRequests, (req, res) => {
  res.send(reply);
});

let responses = new Map();

app.post("/clearUrlResponse", express.json(), (req, res) => {
  responses.delete(req.body.url);
  res.send("");
});

function createRouteHandler(urlToSet, replyData) {
  responses.set(urlToSet, replyData);

  app.get(urlToSet, requestLogger.logRequests, (areq, ares) => {
    if (responses.has(urlToSet))
      ares.send(responses.get(urlToSet));

    else
      ares.end();
  });
}

app.post("/setUrlResponse", express.json(), (req, res) => {
  let urlToSet = req.body.url;
  let replyData = req.body.responseToReplyWith;

  createRouteHandler(urlToSet, replyData);

  res.send("");
});

export function startAdminServer(host) {
  app.listen(HTTP_ADMIN_PORT, () => {
    console.log(`Admin commands server listening at http://${host}:${HTTP_ADMIN_PORT}`);
  });

  let buildTimeReplies = [
    {
      url: "/subscription-that-shouldnt-be-moved-to-dnr-world.txt",
      data: "[Adblock Plus]"
    },
    {
      url: "/anti-cv-subscription.txt",
      data: "[Adblock Plus]"
    }
  ];

  for (let i = 0; i < buildTimeReplies.length; i++)
        createRouteHandler(buildTimeReplies[i].url, buildTimeReplies[i].data);
}
