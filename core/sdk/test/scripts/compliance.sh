#! /bin/bash

set -xeu

if [[ "$MANIFEST" != "mv2" && "$MANIFEST" != "mv3" ]]; then
  echo "ERROR: Accepted \$MANIFEST values are \"mv2\" or \"mv3\""
  exit 1;
fi

rm -rf testpages.adblockplus.org
git clone https://gitlab.com/eyeo/developer-experience/testpages.adblockplus.org

# Zipping the test extension
pushd dist/test-$MANIFEST
zip -R ../../testpages.adblockplus.org/test-$MANIFEST.zip '*'
popd

pushd testpages.adblockplus.org
COMPLIANCE_IMAGE="${COMPLIANCE_IMAGE:-compliance}"
docker build -t $COMPLIANCE_IMAGE --build-arg EXTENSION_FILE="test-$MANIFEST.zip" .

if [[ "$MANIFEST" == "mv2" ]]; then
  SKIP="((?!Subscriptions|Snippets|Sitekey on MV3).)"
else
  SKIP="((?!Subscriptions|Snippets|Sitekey on MV2|Header).)"
fi

TERMINAL="${TERMINAL:-it}"
TESTS_TO_INCLUDE="${TESTS_TO_INCLUDE:-}"
BROWSER="${BROWSER:-chromium}"
VERSION="${VERSION:-latest}"
docker run --cpus=2 --memory=6g --shm-size=1g -$TERMINAL \
  -e SKIP_EXTENSION_DOWNLOAD="true" -e CUSTOM_BROWSER=$BROWSER \
  -e BROWSER_VERSION="$VERSION" -e GREP="^.*$BROWSER$SKIP*\$" \
  -e TESTS_TO_INCLUDE="$TESTS_TO_INCLUDE" $COMPLIANCE_IMAGE
