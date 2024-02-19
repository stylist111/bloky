#! /bin/bash

set -eu

TEST_PARAMS="${TEST_PARAMS:-}"

npm run test-core -- $TEST_PARAMS
npm run -w core test:dist -- $TEST_PARAMS
