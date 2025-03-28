import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRecommendations } from "./index.js";

describe("Rules utils", function () {
  const availableSubscriptions = [
    {
      id: "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
      type: "ads",
      languages: ["en"],
      title: "EasyList",
      homepage: "https://easylist.to/",
      url: "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt",
      mv2_url: "https://easylist-downloads.adblockplus.org/easylist.txt",
    },
    {
      id: "D72B6F06-52B2-4FED-96A2-1BF59CDD7AEC",
      type: "privacy",
      title: "EasyPrivacy",
      homepage: "https://easylist.to/",
      requires: ["8C13E995-8F06-4927-BEA7-6C845FB7EEBF"],
      url: "https://easylist-downloads.adblockplus.org/v3/full/easyprivacy.txt",
      mv2_url: "https://easylist-downloads.adblockplus.org/easyprivacy.txt",
    },
    {
      id: "5BD2BB73-459D-4A74-AF9D-A10157268350",
      type: "notifications",
      title: "Fanboy's Notifications Blocking List",
      homepage: "https://easylist.to/",
      url: "https://easylist-downloads.adblockplus.org/v3/full/fanboy-notifications.txt",
      mv2_url:
        "https://easylist-downloads.adblockplus.org/fanboy-notifications.txt",
    },
  ];

  it("filters a list of recommendations to only those with the given ids", function () {
    const recommendedIds = [
      availableSubscriptions[0].id,
      availableSubscriptions[2].id,
    ];
    const privilegedIds = [availableSubscriptions[2].id];
    const filtered = getRecommendations(
      availableSubscriptions,
      recommendedIds,
      privilegedIds,
    );

    expect(filtered).toEqual([
      availableSubscriptions[0],
      {
        ...availableSubscriptions[2],
        privileged: true,
      },
    ]);
  });

  it("throws an error if a recommended subscription isn't in the index", function () {
    const missingSubId = "missing-id";
    const recommendedIds = [missingSubId];
    const privilegedIds = [];
    expect(() =>
      getRecommendations(availableSubscriptions, recommendedIds, privilegedIds),
    ).toThrowError(new Error(`Missing subscription: ${missingSubId}`));
  });
});
