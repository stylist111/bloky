#! /bin/bash

set -eu

XVFB_CMD=" "

# Browser config

if [[ "$TEST_PARAMS" =~ (chromium|edge|incognito) ]]; then
  XVFB_CMD="xvfb-run -a"
fi

npm run test-server &

# Run in "Flaky debug" mode or not

if [[ "$MODE" == *"[flaky"* ]]; then

  for i in {1..30}
    do
      echo "INFO: This job will run only tests marked as [flaky] in test"
      $XVFB_CMD npm test -- $TEST_PARAMS --grep flaky
    done
else 
  $XVFB_CMD npm test -- $TEST_PARAMS
fi
