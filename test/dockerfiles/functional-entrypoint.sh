#! /bin/bash

set -u

# Browser config
XVFB_CMD=""
if [[ "$TEST_PARAMS" =~ (chromium|edge|incognito) ]]; then
  XVFB_CMD="xvfb-run -a"
fi

if [[ "$ONLY_FLAKY" == "true" ]]; then
  echo "INFO: This job will only run tests marked as [flaky] in test"
  TEST_PARAMS="$TEST_PARAMS --grep flaky"
fi

failureCount=0
errorsThrown=""
for ((i=1; i<=$TEST_RUNS; i++)); do
  if [ "$TEST_RUNS" -gt "1" ]; then
    echo "--- Running attempt $i out of $TEST_RUNS. $failureCount failures so far ---"
  fi

  $XVFB_CMD npm run test:functional -- $TEST_PARAMS
  exitCode=$?

  if [ $exitCode -ne 0 ]; then
    failureCount=$(($failureCount + 1))
    errorsThrown="$errorsThrown$i,"
  fi
done

if [ "$TEST_RUNS" -eq "1" ]; then exit $exitCode; fi

allowedFailures=2
echo "--- Run finished with $failureCount failures (allowed <= $allowedFailures) ---"
if [ "$failureCount" -gt "$allowedFailures" ]; then
  echo "Run attempts that failed: $errorsThrown scroll up for more details"
  exit 1
fi
