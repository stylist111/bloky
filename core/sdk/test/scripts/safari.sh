#! /bin/bash

set -eu

APP_NAME=testSafariApp
BUNDLE_ID=org.adblockplus.testSafariApp
IOS_DEVICE_NAME="iPhone 17 Pro"
IOS_PLATFORM_VERSION="26.2"

pushd $(dirname "$0")
DIRNAME_PATH=$(pwd)
popd

pushd $DIRNAME_PATH/../../dist
DIST_PATH=$(pwd)
popd
APP_PATH=$DIST_PATH/$APP_NAME/build/Release-iphonesimulator/$APP_NAME.app

pushd $DIRNAME_PATH/../..
SDK_PATH=$(pwd)
popd

pushd $DIRNAME_PATH/../../../../tools/test
TEST_TOOLS_PATH=$(pwd)
popd

testingProject=nasapp-testing
NASAPP_TESTING_PATH=eyeo/network-filtering/$testingProject.git
GITLAB_NASAPP_TESTING_TOKEN=${GITLAB_NASAPP_TESTING_TOKEN:-}

# Software requirements check
# https://gitlab.com/eyeo/network-filtering/nasapp-testing#requirements
for binary in java node; do
  if ! command -v $binary 2>&1 >/dev/null; then
    echo "Error: $binary not found"
    exit 1
  fi
done

# Setup testing project
pushd $SDK_PATH
rm -rf $testingProject

if [ -n "$GITLAB_NASAPP_TESTING_TOKEN" ]; then
  git clone https://read_repository:$GITLAB_NASAPP_TESTING_TOKEN@gitlab.com/$NASAPP_TESTING_PATH
else
  git clone git@gitlab.com:$NASAPP_TESTING_PATH
fi

pushd $testingProject
npm install

# Run tests
env \
  APP_PATH="$APP_PATH" \
  APP_BUNDLE_ID=$BUNDLE_ID \
  IOS_DEVICE_NAME="$IOS_DEVICE_NAME" \
  IOS_PLATFORM_VERSION="$IOS_PLATFORM_VERSION" \
  TEST_SERVER_PATH=$TEST_TOOLS_PATH \
  ./gradlew testSDK
