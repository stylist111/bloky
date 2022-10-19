#! /bin/bash

# Browser config
if [[ "$TEST_PARAMS" =~ (chromium|edge|incognito) ]]; then
  XVFB_CMD="xvfb-run -a"
fi

npm run test-server &
$XVFB_CMD npm test -- $TEST_PARAMS
