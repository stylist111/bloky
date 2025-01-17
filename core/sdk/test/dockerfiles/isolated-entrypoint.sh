#! /bin/bash

set -u

INITIAL_TEST_PARAMS="$TEST_PARAMS"

failureCount=0
for suite in $TEST_SUITES; do
  echo "Running $suite in isolation"
  TEST_PARAMS="$INITIAL_TEST_PARAMS --grep $suite --testKinds functional" 
  test/dockerfiles/functional-entrypoint.sh 
  exitCode=$?

  if [ $exitCode -ne 0 ]; then
    failureCount=$(($failureCount + 1))
  fi
done

if [ "$failureCount" -gt "0" ]; then
  exit 1
fi