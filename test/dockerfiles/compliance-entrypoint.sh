#! /bin/bash

set -eu
 XVFB_CMD=""
# Browser config
if [[ "$CUSTOM_BROWSER" == *"chromium"* || "$CUSTOM_BROWSER" == *"edge"* ]]; then
  XVFB_CMD="xvfb-run -a"
fi

if [[ "$MANIFEST" == *"mv2"* ]]; then
    cp -r dist/test-mv2 testpages.adblockplus.org/testext
    SKIP="((?!Subscriptions|Snippets).)"
  else 
    cp -r dist/test-mv3 testpages.adblockplus.org/testext
    SKIP="((?!Subscriptions|Snippets|Sitekey|Header).)"
fi

cd testpages.adblockplus.org
npm install
$XVFB_CMD npm test -- -g "^.*$CUSTOM_BROWSER$SKIP*$"

