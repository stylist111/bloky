#! /bin/bash

# Browser config
if [[ "$TEST_PARAMS" == *"chromium"* ]] || [[ "$TEST_PARAMS" == *"edge"* ]]; then
  XVFB_CMD="xvfb-run -a"
fi

cd webext-sdk
npm run build
npm run test-server &

$XVFB_CMD npm test -- $TEST_PARAMS
