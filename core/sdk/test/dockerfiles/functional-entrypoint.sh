#! /bin/bash

set -u

# Browser config
XVFB_CMD=""
if [[ "$TEST_PARAMS" =~ (chromium|chrome|edge|incognito) ]]; then
  XVFB_CMD="xvfb-run -a"
fi

if [[ "$ONLY_FLAKY" == "true" ]]; then
  echo "INFO: This job will only run tests marked as [flaky] in test"
  TEST_PARAMS="$TEST_PARAMS --grep flaky"
fi

$XVFB_CMD npm run -w=@eyeo/webext-ad-filtering-solution test:functional -- $TEST_PARAMS
