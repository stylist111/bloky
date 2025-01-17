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

import expect from "expect";
import {EWE, clearTestEvents, getTestEvents} from "./messaging.js";
import {TEST_ADMIN_PAGES_URL} from "./test-server-urls.js";
import {Page, setEndpointResponse, clearEndpointResponse,
        setMinTimeout, expectElemHideVisible, expectElemHideHidden,
        syncSubHasLastFilter, syncSubHasNoLastFilter,
        waitForSubscriptionToBeSynchronized, waitForSubscriptionToFailToUpdate}
  from "./utils.js";

describe("Update using the full update mechanism [mv3-only]", function() {
  setMinTimeout(this, 10000);
  const SINGLE_IMAGE_PAGE = "image.html";
  const MULTI_IMAGE_PAGE = "image-multiple.html";
  const IMAGE = "image.png";
  const IMAGE2 = "image2.png";
  const IMAGE3 = "image3.png";

  // this subscription doesn't appear in background.js and isn't bundled
  const USER_SUBSCRIPTION_URL = `${TEST_ADMIN_PAGES_URL}/user-subscription.txt`;
  const USER_SUBSCRIPTION_URL_2 = `${TEST_ADMIN_PAGES_URL}/user-subscription-2.txt`;
  const RESPONSE_HEADER = "[Adblock Plus 2.0]\n";

  afterEach(async function() {
    await EWE.testing.testSetDynamicRulesAvailable(0);
    await clearEndpointResponse(USER_SUBSCRIPTION_URL);
    await clearEndpointResponse(USER_SUBSCRIPTION_URL_2);
  });

  it("blocks and loads based on a user's custom subscription state [fuzz]", async function() {
    await setEndpointResponse(USER_SUBSCRIPTION_URL, RESPONSE_HEADER);
    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    await new Page(SINGLE_IMAGE_PAGE)
      .expectResource(IMAGE)
      .toBeLoaded();

    // add filters
    await setEndpointResponse(USER_SUBSCRIPTION_URL,
                              RESPONSE_HEADER + IMAGE);

    clearTestEvents("subscriptions.onChanged");
    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    // now we block the image
    await new Page(SINGLE_IMAGE_PAGE)
      .expectResource(IMAGE)
      .toBeBlocked();

    // remove filters
    await setEndpointResponse(USER_SUBSCRIPTION_URL, RESPONSE_HEADER);
    clearTestEvents("subscriptions.onChanged");
    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    // now we don't block the image
    await new Page(SINGLE_IMAGE_PAGE)
      .expectResource(IMAGE)
      .toBeLoaded();
  });

  it("blocks and loads based on a user's custom subscription state with content filters [fuzz]", async function() {
    await setEndpointResponse(USER_SUBSCRIPTION_URL, RESPONSE_HEADER);
    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    const elemId = "diff-elem-item";
    await expectElemHideVisible({elemId});

    // add filter
    const contentFilter = "###diff-elem-item";
    await setEndpointResponse(USER_SUBSCRIPTION_URL,
                              RESPONSE_HEADER + contentFilter);
    await syncSubHasLastFilter(USER_SUBSCRIPTION_URL, contentFilter);

    await expectElemHideHidden({elemId, timeout: 10000});

    // remove filter
    await setEndpointResponse(USER_SUBSCRIPTION_URL, RESPONSE_HEADER + "otherFilter");
    await syncSubHasNoLastFilter(USER_SUBSCRIPTION_URL, contentFilter);

    await expectElemHideVisible({elemId});
  });

  it("doesn't remove enabled user filters which conflict with subscription filters in the full update", async function() {
    const FILTER = "/image-from-custom-filter.png^$image";

    await setEndpointResponse(USER_SUBSCRIPTION_URL, RESPONSE_HEADER + FILTER);
    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    await EWE.filters.add([FILTER]);
    let userFilters = await EWE.filters.getUserFilters();
    expect(userFilters[0]).toMatchObject({
      csp: null,
      enabled: true,
      selector: null,
      slow: false,
      text: FILTER,
      thirdParty: null,
      type: "blocking"
    });
    await new Page("image-from-custom-filter.html")
      .expectResource("image-from-custom-filter.png")
      .toBeBlocked();

    // update reply on the server to remove filter
    await setEndpointResponse(USER_SUBSCRIPTION_URL, RESPONSE_HEADER);
    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    userFilters = await EWE.filters.getUserFilters();
    expect(userFilters[0]).toMatchObject({
      csp: null,
      enabled: true,
      selector: null,
      slow: false,
      text: FILTER,
      thirdParty: null,
      type: "blocking"
    });
    await new Page("image-from-custom-filter.html")
      .expectResource("image-from-custom-filter.png")
      .toBeBlocked();
  });

  it("disables subscription filter in the full update when same user filter is disabled and enables when filter is removed", async function() {
    const FILTER = "/image-from-custom-filter.png^$image";

    await EWE.filters.add(FILTER);
    await EWE.filters.disable(FILTER);

    let userFilters = await EWE.filters.getUserFilters();
    expect(userFilters[0]).toEqual(expect.objectContaining({
      text: FILTER,
      enabled: false
    }));

    await setEndpointResponse(USER_SUBSCRIPTION_URL, RESPONSE_HEADER + FILTER);
    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    userFilters = await EWE.filters.getUserFilters();
    expect(userFilters[0]).toEqual(expect.objectContaining({
      text: FILTER,
      enabled: false
    }));

    await new Page("image-from-custom-filter.html")
      .expectResource("image-from-custom-filter.png")
      .toBeLoaded();

    let subscriptionFilters =
      await EWE.subscriptions.getFilters(USER_SUBSCRIPTION_URL);

    expect(subscriptionFilters[0]).toEqual(expect.objectContaining({
      text: FILTER,
      enabled: false
    }));

    await EWE.filters.remove(FILTER);

    subscriptionFilters =
      await EWE.subscriptions.getFilters(USER_SUBSCRIPTION_URL);

    expect(subscriptionFilters[0]).toEqual(expect.objectContaining({
      text: FILTER,
      enabled: true
    }));

    await new Page("image-from-custom-filter.html")
      .expectResource("image-from-custom-filter.png")
      .toBeBlocked();
  });

  it("doesn't block with filter that got updated on disabled user subscription", async function() {
    await setEndpointResponse(USER_SUBSCRIPTION_URL, RESPONSE_HEADER);
    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);
    await EWE.subscriptions.disable(USER_SUBSCRIPTION_URL);

    await new Page(SINGLE_IMAGE_PAGE)
      .expectResource(IMAGE)
      .toBeLoaded();

    await setEndpointResponse(USER_SUBSCRIPTION_URL,
                              RESPONSE_HEADER + IMAGE);
    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);

    await new Page(SINGLE_IMAGE_PAGE)
      .expectResource(IMAGE)
      .toBeLoaded();
  });

  it("sets an error state on the subscription when the DNR limit is reached in the full update", async function() {
    await EWE.testing.testSetDynamicRulesAvailable(1);
    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      "filterThatFits",
      "filterThatDoesNotFitIntoTheLimit"
    ].join("\n"));

    clearTestEvents("subscriptions.onChanged");
    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);

    await waitForSubscriptionToFailToUpdate(USER_SUBSCRIPTION_URL);

    const lastEvent = getTestEvents("subscriptions.onChanged").slice(-1);
    expect(lastEvent).toEqual([[
      expect.objectContaining({
        url: USER_SUBSCRIPTION_URL,
        downloadStatus: "synchronize_too_many_filters"
      }),
      "downloadStatus"
    ]]);
  });

  async function expectPageResourceLoadState(pageUrl,
                                             blockedPaths, loadedPaths) {
    let page = new Page(pageUrl);
    let loadedResources = loadedPaths.map(path => page.expectResource(path));
    let blockedResources = blockedPaths.map(path => page.expectResource(path));

    for (const resource of loadedResources) {
      await resource.toBeLoaded();
    }

    for (const resource of blockedResources) {
      await resource.toBeBlocked();
    }
  }

  it("does not apply new filters if we reach the DNR limit", async function() {
    await EWE.testing.testSetDynamicRulesAvailable(2);

    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE,
      IMAGE2,
      IMAGE3
    ].join("\n"));

    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToFailToUpdate(USER_SUBSCRIPTION_URL);

    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [],
                                      [IMAGE, IMAGE2, IMAGE3]);
  });

  it("does not apply new filters if we reach the DNR limit for an existing subscription", async function() {
    await EWE.testing.testSetDynamicRulesAvailable(2);

    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE
    ].join("\n"));

    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);
    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE],
                                      [IMAGE2, IMAGE3]);

    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE,
      IMAGE2,
      IMAGE3
    ].join("\n"));

    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToFailToUpdate(USER_SUBSCRIPTION_URL);
    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE],
                                      [IMAGE2, IMAGE3]);
  });

  it("does not remove existing filters if we reach the DNR limit for an existing subscription", async function() {
    await EWE.testing.testSetDynamicRulesAvailable(2);

    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE
    ].join("\n"));

    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);
    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE],
                                      [IMAGE2, IMAGE3]);

    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE2,
      IMAGE3,
      "filter_that_does_not_fit"
    ].join("\n"));

    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToFailToUpdate(USER_SUBSCRIPTION_URL);
    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE],
                                      [IMAGE2, IMAGE3]);
  });

  it("filters from custom user subscriptions are not removed when removing the same user filter", async function() {
    await EWE.filters.add(IMAGE);

    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE,
      IMAGE2
    ].join("\n"));

    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE, IMAGE2],
                                      [IMAGE3]);

    await EWE.filters.remove(IMAGE);
    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE, IMAGE2],
                                      [IMAGE3]);
  });

  it("does not create half-added filters if we reach the DNR limit when adding a subscription", async function() {
    await EWE.testing.testSetDynamicRulesAvailable(2);

    await EWE.filters.add(IMAGE);

    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE,
      IMAGE2,
      IMAGE3
    ].join("\n"));

    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToFailToUpdate(USER_SUBSCRIPTION_URL);

    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE],
                                      [IMAGE2, IMAGE3]);

    await EWE.filters.remove(IMAGE);

    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [],
                                      [IMAGE, IMAGE2, IMAGE3]);
  });

  it("does not half remove filters if we reach the DNR limit when updating a subscription", async function() {
    await EWE.testing.testSetDynamicRulesAvailable(2);

    await EWE.filters.add(IMAGE);

    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE
    ].join("\n"));

    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE],
                                      [IMAGE2, IMAGE3]);

    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE2,
      IMAGE3,
      "over_the_limit_image"
    ].join("\n"));
    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToFailToUpdate(USER_SUBSCRIPTION_URL);

    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE],
                                      [IMAGE2, IMAGE3]);

    await EWE.filters.remove(IMAGE);

    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE],
                                      [IMAGE2, IMAGE3]);
  });

  it("applies new filters close to the DNR limit taking removals into account", async function() {
    await EWE.testing.testSetDynamicRulesAvailable(2);

    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE,
      IMAGE2
    ].join("\n"));

    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE, IMAGE2],
                                      [IMAGE3]);

    // This update only just fits, and only fits if you take the
    // removal into account.
    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE2,
      IMAGE3
    ].join("\n"));
    await EWE.subscriptions.sync(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    await expectPageResourceLoadState(MULTI_IMAGE_PAGE, [IMAGE2, IMAGE3],
                                      [IMAGE]);
  });

  it("multiple custom user subscriptions can be independently disabled", async function() {
    await setEndpointResponse(USER_SUBSCRIPTION_URL, [
      RESPONSE_HEADER,
      IMAGE
    ].join("\n"));
    await setEndpointResponse(USER_SUBSCRIPTION_URL_2, [
      RESPONSE_HEADER,
      IMAGE
    ].join("\n"));

    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL_2);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL_2);

    await new Page(SINGLE_IMAGE_PAGE)
      .expectResource(IMAGE)
      .toBeBlocked();

    await EWE.subscriptions.disable(USER_SUBSCRIPTION_URL);

    await new Page(SINGLE_IMAGE_PAGE)
      .expectResource(IMAGE)
      .toBeBlocked();

    await EWE.subscriptions.remove(USER_SUBSCRIPTION_URL_2);

    await new Page(SINGLE_IMAGE_PAGE)
      .expectResource(IMAGE)
      .toBeLoaded();
  });
});
