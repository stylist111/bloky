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

import {isMV3, isIncognito} from "../utils.js";
import {isConnected, isFuzzingServiceWorker} from "./mocha-runner.js";

mocha.setup("bdd");

let timeout = new URLSearchParams(document.location.search).get("timeout");

if (timeout) {
  mocha.timeout(parseInt(timeout, 10));
}
else {
  mocha.timeout(4000);
}

if (isFuzzingServiceWorker()) {
  mocha.slow(20000);
}
else {
  mocha.slow(3000);
}


// eslint-disable-next-line mocha/no-top-level-hooks
beforeEach(async function() {
  let title = this.currentTest.fullTitle();
  let tags = [{
    id: "mv2",
    condition: () => !isMV3()
  }, {
    id: "mv3",
    condition: () => isMV3()
  }, {
    id: "runner",
    condition: () => isConnected()
  }, {
    id: "incognito",
    condition: () => isIncognito()
  }, {
    id: "fuzz",
    condition: () => isFuzzingServiceWorker()
  }];

  for (let tag of tags) {
    let onlyTag = title.includes(`[${tag.id}-only]`);
    let skipTag = title.includes(`[${tag.id}-skip]`);

    if (!onlyTag && !skipTag) {
      continue;
    }

    let value = await tag.condition();
    if (onlyTag && !value || skipTag && value) {
      this.skip();
    }
  }

  if (isFuzzingServiceWorker() && !/\[fuzz(-only)?\]/.test(title)) {
    this.skip();
  }
});
