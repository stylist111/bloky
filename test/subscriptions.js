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

const VALID_URL = "https://testpages.adblockplus.org/en/abp-testcase-subscription.txt";
const INVALID_URL = "invalidUrl";

describe("Subscriptions API", () =>
{
  it("adds a subscription", () =>
  {
    ABP.subscriptions.add(VALID_URL);

    let subscriptions = ABP.subscriptions.getAll();
    expect(subscriptions).toEqual([expect.objectContaining({
      url: VALID_URL,
      disabled: false,
      title: VALID_URL
    })]);
  });

  it("does not add an invalid subscription", () =>
  {
    expect(() => ABP.subscriptions.add(INVALID_URL))
      .toThrowError("Invalid subscription URL");
  });

  it("adds multiple subscriptions", () =>
  {
    ABP.subscriptions.add(VALID_URL);
    ABP.subscriptions.add(VALID_URL + "?2");

    let subscriptions = ABP.subscriptions.getAll();
    expect(subscriptions).toEqual([
      expect.objectContaining({url: VALID_URL}),
      expect.objectContaining({url: VALID_URL + "?2"})
    ]);
  });

  it("updates an existing subscription", () =>
  {
    ABP.subscriptions.add(VALID_URL);
    ABP.subscriptions.update(VALID_URL, {disabled: true, title: "test"});

    let subscriptions = ABP.subscriptions.getAll();
    expect(subscriptions).toEqual([expect.objectContaining({
      url: VALID_URL,
      disabled: true,
      title: "test"
    })]);
  });

  it("fails updating a nonexistent subscription", () =>
  {
    expect(
      () => ABP.subscriptions.update("DoesNotExist", {disabled: true})
    ).toThrowError("Subscription does not exist");
  });

  it("removes a subscription", () =>
  {
    ABP.subscriptions.add(VALID_URL);
    ABP.subscriptions.remove(VALID_URL);

    expect(ABP.subscriptions.getAll()).toEqual([]);
  });

  it("listens to onAdded events", () =>
  {
    let fake = sinon.fake();

    ABP.subscriptions.onAdded.addListener(fake);
    ABP.subscriptions.add(VALID_URL);
    ABP.subscriptions.onAdded.removeListener(fake);

    expect(fake.callCount).toBe(1);
    expect(fake.firstArg).toEqual(expect.objectContaining({
      url: VALID_URL,
      disabled: false,
      title: VALID_URL
    }));
  });

  it("listens to onChanged events", () =>
  {
    let fake = sinon.fake();

    ABP.subscriptions.onChanged.addListener(fake);
    ABP.subscriptions.add(VALID_URL);
    ABP.subscriptions.update(VALID_URL, {disabled: true});
    ABP.subscriptions.onChanged.removeListener(fake);

    expect(fake.callCount).toBe(1);
    expect(fake.firstArg).toEqual(expect.objectContaining({
      url: VALID_URL,
      disabled: true
    }));
  });

  it("listens to onRemoved events", () =>
  {
    let fake = sinon.fake();

    ABP.subscriptions.onRemoved.addListener(fake);
    ABP.subscriptions.add(VALID_URL);
    ABP.subscriptions.remove(VALID_URL);
    ABP.subscriptions.onRemoved.removeListener(fake);

    expect(fake.callCount).toBe(1);
    expect(fake.firstArg).toEqual(expect.objectContaining({url: VALID_URL}));
  });
});
