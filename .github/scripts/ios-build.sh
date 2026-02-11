#!/bin/bash
set -e

echo "Building iOS app..."

# Extract the Profile UUID
PP_UUID=$(/usr/libexec/PlistBuddy -c 'Print :UUID' /dev/stdin <<< $(security cms -D -i $RUNNER_TEMP/build_pp.mobileprovision))
echo "Using Provisioning Profile UUID: $PP_UUID"

# Build and archive
cd timeharbourapp/ios/App

xcodebuild -project App.xcodeproj \
  -scheme App \
  -configuration Release \
  -archivePath $RUNNER_TEMP/TimeHarbor.xcarchive \
  CODE_SIGN_STYLE=Manual \
  PROVISIONING_PROFILE=$PP_UUID \
  PROVISIONING_PROFILE_SPECIFIER=$PP_UUID \
  CODE_SIGN_IDENTITY="Apple Distribution" \
  DEVELOPMENT_TEAM=$IOS_TEAM_ID \
  archive

echo "✅ Build complete"
