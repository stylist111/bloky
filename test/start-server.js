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

/* eslint-env node */

import path from "path";
import url from "url";
import fs from "fs";
import crypto from "crypto";

import express from "express";
import onHeaders from "on-headers";
import {default as WebSocket} from "ws";

const HOST = "localhost";
const HTTP_PORT = 3000;
const WS_PORT = 3001;

let app = express();
let dirname = path.dirname(url.fileURLToPath(import.meta.url));

function bypassCache(req, res, next) {
  let userAgent = req.get("User-Agent");
  if (userAgent && userAgent.includes("Gecko/") && req.path == "/csp.html") {
    onHeaders(res, () => {
      res.removeHeader("Etag");
      res.removeHeader("Last-Modified");
    });
  }

  next();
}

// Adds a sitekey to the response if you pass in ?sitekey=1 as a query
// parameter.
async function sitekeyHeader(req, res, next) {
  if (req.query.sitekey) {
    let pem = await fs.promises.readFile(path.join(dirname, "sitekey.pem"));
    let privateKey = crypto.createPrivateKey(pem);
    let publicKey = crypto.createPublicKey(privateKey);
    let spki = publicKey.export({type: "spki", format: "der"});
    let data = `${req.url}\0${req.get("Host")}\0${req.get("User-Agent")}`;
    let signature = crypto.sign("rsa-sha1", Buffer.from(data), privateKey);
    let value = `${spki.toString("base64")}_${signature.toString("base64")}`;
    res.header("X-Adblock-Key", value);
  }

  next();
}

// Adds a sitekey with an invalid signature to the response if you
// pass in ?invalid-sitekey=1 as a query parameter.
async function invalidSitekeyHeader(req, res, next) {
  if (req.query["invalid-sitekey"]) {
    let pem = await fs.promises.readFile(path.join(dirname, "sitekey.pem"));
    let privateKey = crypto.createPrivateKey(pem);
    let publicKey = crypto.createPublicKey(privateKey);
    let spki = publicKey.export({type: "spki", format: "der"});
    let data = "this data to sign isn't the right data to sign";
    let signature = crypto.sign("rsa-sha1", Buffer.from(data), privateKey);
    let value = `${spki.toString("base64")}_${signature.toString("base64")}`;
    res.header("X-Adblock-Key", value);
  }

  next();
}

// Some tests require certain things to happen before other
// things. This middleware lets you add a delay before the server
// responds. Pass ?delay=500 as a query parameter to add a 500ms
// delay.
async function delay(req, res, next) {
  if (req.query.delay)
    setTimeout(next, parseInt(req.query.delay, 10));
  else
    next();
}

function testHeader(req, res, next) {
  let header = req.query["header-name"];

  if (header)
    res.header(header, req.query["header-value"] || "");

  next();
}

app.use(bypassCache);
app.use(sitekeyHeader);
app.use(invalidSitekeyHeader);
app.use(delay);
app.use(testHeader);
app.use(express.static(path.join(dirname, "pages")));

app.post("/ping-handler", (req, res) => res.sendStatus(200));

app.listen(HTTP_PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Test pages server listening at http://${HOST}:${HTTP_PORT}`);
});

new WebSocket.Server({host: HOST, port: WS_PORT}).on("listening", () => {
  // eslint-disable-next-line no-console
  console.log(`Web socket server listening at ws://${HOST}:${WS_PORT}`);
});
