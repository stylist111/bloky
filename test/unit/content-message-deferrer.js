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

import env from "./environment.js";
import {mock} from "./mock/mock.js";
import expect from "expect";

describe("Content script message deferrer", function() {
  this.timeout(5000);
  let api;

  const tabId = 1;
  const frameId = 2;
  const message = {
    type: "type",
    content: "content1"
  };

  const tabId1 = tabId;
  const frameId1 = frameId;
  const message1 = message;

  const tabId2 = 3;
  const frameId2 = 4;
  const message2 = {
    type: "type",
    content: "content2"
  };

  function simulateFrameLoadingStarted(_tabId, _frameId) {
    env.browser.webNavigation.onBeforeNavigate._trigger({
      tabId: _tabId, frameId: _frameId
    });
  }

  function simulateTabRemoved(_tabId) {
    env.browser.tabs.onRemoved._trigger(_tabId);
  }

  async function simulateContentHelloReceived(_tabId, _frameId) {
    await api.onContentHelloReceived(_tabId, _frameId);
  }

  beforeEach(async function() {
    env.configure();
    api = await mock("content-message-deferrer.js", [], ["debugging.js"]);
    await api.start();
  });

  it("defers sending message until ewe:content-hello is received", async function() {
    simulateFrameLoadingStarted(tabId, frameId);
    api.sendContentMessage(tabId, frameId, message);

    expect(api._getDeferredMessages().getState()[tabId][frameId]).toEqual([
      message
    ]);
    expect(env.browser.tabs.getMessages()).toEqual([]);
  });

  it("sends deferred messages on ewe:content-hello is received", async function() {
    simulateFrameLoadingStarted(tabId, frameId);
    await api.sendContentMessage(tabId, frameId, message);
    await simulateContentHelloReceived(tabId, frameId);

    expect(env.browser.tabs.getMessages()).toEqual([
      {tabId, message, options: {frameId}}
    ]);
    expect(api._getDeferredMessages().getState()[tabId]).toBeUndefined();
  });

  it("sends the messages immediately if ewe:content-hello is already received", async function() {
    simulateFrameLoadingStarted(tabId, frameId);
    await simulateContentHelloReceived(tabId, frameId);

    expect(env.browser.tabs.getMessages()).toEqual([]);
    await api.sendContentMessage(tabId, frameId, message);

    expect(env.browser.tabs.getMessages()).toEqual([
      {tabId, message, options: {frameId}}
    ]);
  });

  it("keeps sending messages after ewe:content-hello is received", async function() {
    simulateFrameLoadingStarted(tabId1, frameId1);

    await api.sendContentMessage(tabId1, frameId1, message1);
    expect(env.browser.tabs.getMessages()).toEqual([]);

    await simulateContentHelloReceived(tabId1, frameId1);

    expect(env.browser.tabs.getMessages()).toEqual([{
      tabId: tabId1,
      message: message1,
      options: {
        frameId: frameId1
      }
    }]);
    expect(api._getDeferredMessages().getState()[tabId1]).toBeUndefined();

    await api.sendContentMessage(tabId2, frameId2, message2);

    expect(env.browser.tabs.getMessages()).toEqual([{
      tabId: tabId1,
      message: message1,
      options: {
        frameId: frameId1
      }
    }, {
      tabId: tabId2,
      message: message2,
      options: {
        frameId: frameId2
      }
    }]);
  });

  it("cleans-up when tab is removed before ewe:content-hello is received", async function() {
    simulateFrameLoadingStarted(tabId, frameId);

    await api.sendContentMessage(tabId, frameId, message);
    expect(api._getDeferredMessages().getState()[tabId][frameId]).toEqual([
      message
    ]);

    simulateTabRemoved(tabId);
    expect(api._getDeferredMessages().getState()[tabId]).toBeUndefined();
  });

  it("cleans-up when tab is removed after ewe:content-hello is received", async function() {
    simulateFrameLoadingStarted(tabId, frameId);

    await simulateContentHelloReceived(tabId, frameId);
    expect(api._getDeferredMessages().getState()[tabId]).toBeUndefined();

    simulateTabRemoved(tabId); // make sure ut does not break anything
    expect(api._getDeferredMessages().getState()[tabId]).toBeUndefined();
  });

  it("supports multiple messages", async function() {
    simulateFrameLoadingStarted(tabId, frameId);
    await api.sendContentMessage(tabId, frameId, message);
    await api.sendContentMessage(tabId, frameId, message2);
    await simulateContentHelloReceived(tabId, frameId);

    expect(env.browser.tabs.getMessages()).toEqual([{
      tabId,
      message: message1,
      options: {
        frameId
      }
    }, {
      tabId,
      message: message2,
      options: {
        frameId
      }
    }]);
  });

  it("supports multiple frames", async function() {
    simulateFrameLoadingStarted(tabId1, frameId1);
    simulateFrameLoadingStarted(tabId2, frameId2);

    await api.sendContentMessage(tabId1, frameId1, message1);
    await api.sendContentMessage(tabId2, frameId2, message2);

    await simulateContentHelloReceived(tabId1, frameId1);

    expect(env.browser.tabs.getMessages()).toEqual([{
      tabId: tabId1,
      message: message1,
      options: {
        frameId: frameId1
      }
    }]);

    await simulateContentHelloReceived(tabId2, frameId2);

    expect(env.browser.tabs.getMessages()).toEqual([{
      tabId: tabId1,
      message: message1,
      options: {
        frameId: frameId1
      }
    }, {
      tabId: tabId2,
      message: message2,
      options: {
        frameId: frameId2
      }
    }]);
  });

  it("saves and loads the deferred messages", async function() {
    let framesIdsToMessages = {};
    framesIdsToMessages[frameId] = [message];
    api._getDeferredMessages().getState()[tabId] = framesIdsToMessages;
    api._doSaveDeferredMessages();
    await api._awaitSavingComplete();
    api._getDeferredMessages().clearState();
    await api._loadDeferredMessages();
    expect(api._getDeferredMessages().getState()[tabId][frameId]).toEqual([
      message]);
  });
});

