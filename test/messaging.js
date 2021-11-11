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

import browser from "webextension-polyfill";
import sinon from "sinon/pkg/sinon.js";

export async function runInBackgroundPage(operations)
{
  let {result, error} =
    await browser.runtime.sendMessage({type: "ewe-test:run", operations});
  if (error)
    throw new Error(error);

  return result;
}

export async function makeCallbackInBackgroundPage(callback)
{
  let id = await browser.runtime.sendMessage({type: "ewe-test:make-callback"});

  browser.runtime.onMessage.addListener(message =>
  {
    if (message.type == "ewe-test:call-callback" && message.id == id)
      callback(...message.args);
  });

  return id;
}

export function callMethod(namespace, method, args = [])
{
  return runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    ...namespace.map(arg => ({op: "getProp", arg})),
    ...args.map(arg => ({op: "pushArg", arg})),
    {op: "callMethod", arg: method},
    {op: "await"}
  ]);
}

export function addFilter(text)
{
  return callMethod(["filters"], "add", [[text]]);
}

let removalOperations = [];

export async function addFakeListener({namespace, eventName, eventOptions,
                                       method = "addListener",
                                       removeMethod = "removeListener",
                                       callback = sinon.fake()})
{
  let id = await makeCallbackInBackgroundPage(callback);

  await runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: namespace},
    ...eventName ? [{op: "getProp", arg: eventName}] : [],
    {op: "pushCallback", arg: id},
    ...eventOptions ? [{op: "pushArg", arg: eventOptions}] : [],
    {op: "callMethod", arg: method}
  ]);

  removalOperations.push([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: namespace},
    ...eventName ? [{op: "getProp", arg: eventName}] : [],
    {op: "pushCallback", arg: id},
    ...eventOptions ? [{op: "pushArg", arg: eventOptions}] : [],
    {op: "callMethod", arg: removeMethod}
  ]);

  return callback;
}

export async function removeFakeListeners()
{
  for (let operations of removalOperations)
    await runInBackgroundPage(operations);

  removalOperations = [];
}

export function setTestSnippets(name)
{
  let isolatedCode = `exports.snippets = {${name}: () => self.works = true};`;
  let injectedCode = `let snippets = {${name}: () => self.works = true};`;

  return runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "snippets"},
    {op: "pushArg", arg: name ? {isolatedCode, injectedCode,
                                 injectedList: [name]} : []},
    {op: "callMethod", arg: "setLibrary"}
  ]);
}
