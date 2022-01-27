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

let messages = [];
let emit = () => {};
let setConnected;
let connected = new Promise(resolve => {
  setConnected = resolve;
});
let runner = mocha.run();

function sendMessage(id, arg) {
  messages.push([id, arg]);
  emit();
}

runner.on("end", () =>
  sendMessage("end", {failures: runner.failures, total: runner.total})
);

mocha.Mocha.reporters.Base.useColors = true;
mocha.Mocha.reporters.Base.consoleLog = (...args) => sendMessage("log", args);
new mocha.Mocha.reporters.Spec(runner);

self.poll = async function() {
  setConnected(true);

  if (messages.length == 0) {
    await new Promise(resolve => {
      emit = resolve;
    });
  }

  let newMessages = messages;
  messages = [];

  return newMessages;
};

export function isConnected() {
  return Promise.race([
    connected,
    new Promise(resolve => setTimeout(resolve, 1000, false))
  ]);
}

export function click(url, selector) {
  sendMessage("click", {url, selector});
}
