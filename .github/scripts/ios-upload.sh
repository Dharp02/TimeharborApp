#!/bin/bash
set -e

echo "Uploading to TestFlight..."

# Create the directory for App Store Connect keys
mkdir -p ~/.appstoreconnect/private_keys

# Decode App Store Connect API key to the expected location
API_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_$APP_STORE_CONNECT_API_KEY_ID.p8
echo -n "$APP_STORE_CONNECT_API_KEY_BASE64" | base64 --decode -o $API_KEY_PATH
chmod 600 $API_KEY_PATH

# Upload to TestFlight using Fastlane
fastlane pilot upload \
  --ipa $RUNNER_TEMP/export/*.ipa \
  --api_key_path $API_KEY_PATH \
  --skip_waiting_for_build_processing

# Clean up the API key
rm -f $API_KEY_PATH

echo "✅ Upload complete"
