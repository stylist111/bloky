#! /bin/bash

set -eu

XVFB_CMD=" "

# Browser config

if [[ "$TEST_PARAMS" =~ (chromium|edge|incognito) ]]; then
  XVFB_CMD="xvfb-run -a"
fi

npm run test-server &

if [[ "$MODE" == *"[flaky"* ]]; then
  echo "INFO: This job will run tests marked as [flaky] in test"
  $XVFB_CMD npm test -- $TEST_PARAMS --grep flaky
else 
  $XVFB_CMD npm test -- $TEST_PARAMS
fi
