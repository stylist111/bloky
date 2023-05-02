#! /bin/bash

set -eu

cd testpages.adblockplus.org
npm install
npm test -- -g "^.*firefox latest((?!Subscriptions|Snippets).)*$"
