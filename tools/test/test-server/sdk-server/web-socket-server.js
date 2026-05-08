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

import WebSocket from "ws";

const WS_PORT = 3001;

let wss;
export function startSDKWebSocketServer(host) {
  wss = new WebSocket.Server({ port: WS_PORT });
  wss.on("listening", () => {
    console.log(`SDK Web Socket Server listening at ws://${host}:${WS_PORT}`);
  });
}

export function stopSDKWebSocketServer() {
  if (wss) {
    wss.clients.forEach((ws) => ws.terminate());
    wss.close(() => {
      console.log("SDK Web Socket Server closed");
    });
    wss = null;
  }
}
