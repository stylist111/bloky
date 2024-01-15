#! /bin/bash

set -eu

npm run test-core -- $TEST_PARAMS
npm run -w core test:dist -- $TEST_PARAMS
