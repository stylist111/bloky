import { describe, it, expect } from "vitest";
import { AdWallMessage, Message, MessageSender } from "../index";
import { Tabs } from "webextension-polyfill";

describe("Polyfill / AdWallMessage", () => {
  it("should equal the Ad wall message type", () => {
    const msg: AdWallMessage = {
      type: "TypeScript",
      userLoggedIn: "1",
      currentPlaybackTime: 50,
      hasDismiss: false,
    };
    expect(msg.type).toEqual("TypeScript");
    expect(msg.userLoggedIn).toEqual("1");
    expect(msg.currentPlaybackTime).toEqual(50);
  });

  it("should test the generic Message type", () => {
    const msg: Message = { type: "TypeScript" };
    expect(msg.type).toEqual("TypeScript");
  });

  it("should test the MessageSender type", () => {
    const theTab: Tabs.Tab = {
      id: 45,
      index: 55,
      highlighted: true,
      active: true,
      pinned: true,
      incognito: true,
    };

    const msgSender: MessageSender = {
      frameId: 1,
      tab: theTab,
      page: { id: 50, url: new URL("http://www.example.com") },
    };
    expect(msgSender.page.id).toEqual(50);
    expect(msgSender.page.url).toEqual(new URL("http://www.example.com"));
    expect(msgSender.frameId).toEqual(1);
    expect(msgSender.tab).toEqual(theTab);
  });
});
