#! /bin/bash

set -eu

if [[ "$MODE" == *"[flaky"* ]]; then
  for i in {1..30}
    do
      echo "INFO: This job will run only tests marked as [flaky] in test"
      npm run test-core -- $TEST_PARAMS
    done
else
  npm run test-core -- $TEST_PARAMS
fi
