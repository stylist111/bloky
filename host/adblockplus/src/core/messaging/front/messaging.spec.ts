/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import type Browser from "webextension-polyfill";

const mockAddDisconnectListener = jest.fn();
const mockAddMessageListener = jest.fn();

const eventMessageType = "foo.respond";
const handledMessageType = "foo";
const handledMessageValue = "foo (response)";
const listenMessageType = "foo";
const nonEventMessageType = "foo.other";
const unhandledMessageType = "foo (no response)";

let mockPort: Browser.Runtime.Port;

jest.mock("../shared", () => {
  return {
    MessageEmitter: class {
      addListener(): void {}
      dispatch(message: any): any[] {
        if (message.type === handledMessageType) {
          return [handledMessageValue];
        }

        return [];
      }
    },
    getMessageResponse: (responses: any) => responses[0],
    isMessage(candidate: unknown) {
      return (
        candidate !== null &&
        typeof candidate === "object" &&
        "type" in candidate
      );
    }
  };
});

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("Messaging functionality", () => {
  beforeEach(() => {
    mockPort = {
      disconnect: () => {},
      name: "ui",
      onDisconnect: {
        addListener: mockAddDisconnectListener,
        hasListener: () => false,
        hasListeners: () => false,
        removeListener() {}
      } as any,
      onMessage: {
        addListener: mockAddMessageListener,
        hasListener: () => false,
        hasListeners: () => false,
        removeListener() {}
      } as any,
      postMessage: () => {}
    };

    jest.resetModules();
    jest.spyOn(browser.runtime, "connect").mockImplementation(() => mockPort);
  });

  it("initializes", async () => {
    jest.spyOn(browser.runtime.onMessage, "addListener");

    await import("./messaging");

    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    expect(browser.runtime.connect).toHaveBeenLastCalledWith({
      name: "ui"
    });
    expect(mockAddDisconnectListener).toHaveBeenCalled();
    expect(mockAddMessageListener).toHaveBeenCalled();
    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    expect(browser.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it("connect listener should be called", async () => {
    let disconnectPort = (port: Browser.Runtime.Port): void => {};
    mockPort.onDisconnect.addListener = (listener) => {
      disconnectPort = listener;
    };

    const messaging = await import("./messaging");

    const connectListener = jest.fn();
    messaging.addConnectListener(connectListener);

    expect(connectListener).toHaveBeenCalledTimes(1);

    // Trigger automatic reconnect
    disconnectPort(mockPort);
    await wait(200);

    expect(connectListener).toHaveBeenCalledTimes(2);
  });

  it("disconnect listener should be called", async () => {
    let disconnectPort = (port: Browser.Runtime.Port): void => {};
    mockPort.onDisconnect.addListener = (listener) => {
      disconnectPort = listener;
    };

    const messaging = await import("./messaging");

    const disconnectListener = jest.fn();
    messaging.addDisconnectListener(disconnectListener);

    jest.spyOn(browser.runtime, "connect").mockImplementation(() => {
      throw new Error();
    });

    // Trigger automatic reconnect
    disconnectPort(mockPort);
    await wait(200);

    expect(disconnectListener).toHaveBeenCalledTimes(1);

    messaging.removeDisconnectListener(disconnectListener);

    // Trigger automatic reconnect
    disconnectPort(mockPort);
    await wait(200);

    expect(disconnectListener).toHaveBeenCalledTimes(1);
  });

  it("incoming messages are handled", async () => {
    /* eslint-disable-next-line @typescript-eslint/no-invalid-void-type */
    let sendMessage: any = () => {};
    jest
      .spyOn(browser.runtime.onMessage, "addListener")
      .mockImplementation((listener) => {
        sendMessage = listener;
      });

    await import("./messaging");

    const value = sendMessage({ type: handledMessageType }, {});
    expect(value).toBeInstanceOf(Promise);
    expect(await value).toEqual(handledMessageValue);

    const valueNoResponse = sendMessage({ type: unhandledMessageType }, {});
    expect(valueNoResponse).toBeUndefined();

    const valueInvalid = sendMessage(handledMessageType, {});
    expect(valueInvalid).toBeUndefined();
  });

  it("message listener should be called for *.respond messages", async () => {
    let sendMessage = (message: any, port: Browser.Runtime.Port): void => {};
    mockPort.onMessage.addListener = (listener) => {
      sendMessage = listener;
    };

    const messaging = await import("./messaging");

    const callback = jest.fn();
    messaging.addMessageListener(callback);

    sendMessage({ type: eventMessageType }, mockPort);
    expect(callback).toHaveBeenCalledWith({
      type: eventMessageType
    });

    sendMessage({ type: nonEventMessageType }, mockPort);
    expect(callback).not.toHaveBeenCalledWith({
      type: nonEventMessageType
    });
  });

  it("listen messages should be sent on connect", async () => {
    let disconnectPort = (port: Browser.Runtime.Port): void => {};
    mockPort.onDisconnect.addListener = (listener) => {
      disconnectPort = listener;
    };
    mockPort.postMessage = jest.fn();

    const messaging = await import("./messaging");

    const filter = ["bar"];
    const tabId = 12;
    messaging.listen({
      type: listenMessageType,
      filter,
      tabId
    });

    // Trigger automatic reconnect
    disconnectPort(mockPort);
    await wait(200);

    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: `${listenMessageType}.listen`,
      filter,
      tabId
    });
  });
});
