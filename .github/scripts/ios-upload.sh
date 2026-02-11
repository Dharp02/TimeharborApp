#!/bin/bash
set -e

echo "Uploading to TestFlight..."

# Create the directory for App Store Connect keys
mkdir -p ~/.appstoreconnect/private_keys

# Decode App Store Connect API key to the expected location
API_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_$APP_STORE_CONNECT_API_KEY_ID.p8
echo -n "$APP_STORE_CONNECT_API_KEY_BASE64" | base64 --decode -o $API_KEY_PATH
chmod 600 $API_KEY_PATH

echo "API Key created at: $API_KEY_PATH"
echo "Looking for IPA at: $RUNNER_TEMP/export/"
ls -la $RUNNER_TEMP/export/

# Upload to TestFlight using Fastlane with explicit API key parameters
fastlane pilot upload \
  --ipa $(ls $RUNNER_TEMP/export/*.ipa) \
  --api_key_path $API_KEY_PATH \
  --api_key_issuer_id $APP_STORE_CONNECT_ISSUER_ID \
  --api_key_id $APP_STORE_CONNECT_API_KEY_ID \
  --skip_waiting_for_build_processing \
  --verbose

# Clean up the API key
rm -f $API_KEY_PATH

echo "✅ Upload complete"
