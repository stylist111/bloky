#!/bin/bash

set -eu

# Please contact the Apps team to get credentials for XCODE_AUTHENTICATION_KEY_PATH,
# XCODE_AUTHENTICATION_KEY_ID, XCODE_AUTHENTICATION_KEY_ISSUER_ID and XCODE_DEVELOPMENT_TEAM

APP_NAME=testSafariApp
# The certificate used to sign this bundle Id is managed by the Apps team
BUNDLE_ID=org.adblockplus.testSafariApp

pushd $(dirname "$0")
DIRNAME_PATH=$(pwd)
popd
pushd $DIRNAME_PATH/../../dist
DIST_PATH=$(pwd)
popd

# Path to a file with the Xcode private key. On the local run, the file is
# expected to be called "AuthKey.p8"
XCODE_AUTHENTICATION_KEY_PATH=${XCODE_AUTHENTICATION_KEY_PATH:-$DIRNAME_PATH/AuthKey.p8}
if [ ! -f $XCODE_AUTHENTICATION_KEY_PATH ]; then
  echo "Error: File $XCODE_AUTHENTICATION_KEY_PATH doesn't exist"
  exit 1
fi

# Generate the project with converted safari web extension, for iOS only
xcrun safari-web-extension-converter \
  --project-location $DIST_PATH $DIST_PATH/test-safari \
  --app-name $APP_NAME \
  --bundle-identifier $BUNDLE_ID \
  --no-open \
  --force \
  --no-prompt \
  --ios-only

# Build the project
xcodebuild -quiet \
  -project $DIST_PATH/$APP_NAME/$APP_NAME.xcodeproj \
  -target $APP_NAME \
  -sdk iphonesimulator \
  -allowProvisioningUpdates \
  -authenticationKeyPath $XCODE_AUTHENTICATION_KEY_PATH \
  -authenticationKeyID $XCODE_AUTHENTICATION_KEY_ID \
  -authenticationKeyIssuerID $XCODE_AUTHENTICATION_KEY_ISSUER_ID \
  DEVELOPMENT_TEAM=$XCODE_DEVELOPMENT_TEAM \
  build

# Make sure the build artifact exists
APP_PATH=$DIST_PATH/$APP_NAME/build/Release-iphonesimulator/$APP_NAME.app
if [ -e $APP_PATH ]; then
   echo "$APP_PATH generated"
else
   echo "Error: $APP_PATH doesn't exist after building"
fi
