"use strict";

let activeCount = 0;
let totalStarts = 0;

module.exports = {
  keepAlive() {
    activeCount++;
    totalStarts++;

    let stopped = false;
    return function stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      activeCount--;
    };
  },

  // Non-public API, for tests only
  _getActiveCount() {
    return activeCount;
  },
  _getTotalStarts() {
    return totalStarts;
  },
  _reset() {
    activeCount = 0;
    totalStarts = 0;
  }
};
