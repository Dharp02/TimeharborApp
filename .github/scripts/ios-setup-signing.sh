#!/bin/bash
set -e

echo "Setting up iOS code signing..."

# Create variables
CERTIFICATE_PATH=$RUNNER_TEMP/build_certificate.p12
PP_PATH=$RUNNER_TEMP/build_pp.mobileprovision
KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
KEYCHAIN_PASSWORD="temporary_password"

# Decode certificate and provisioning profile
echo -n "$IOS_CERTIFICATE_BASE64" | base64 --decode -o $CERTIFICATE_PATH
echo -n "$IOS_PROVISIONING_PROFILE_BASE64" | base64 --decode -o $PP_PATH

# Create temporary keychain
security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

# Import certificate to keychain
security import $CERTIFICATE_PATH -P "$IOS_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
security list-keychain -d user -s $KEYCHAIN_PATH

# Install provisioning profile
mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
cp $PP_PATH ~/Library/MobileDevice/Provisioning\ Profiles

echo "✅ Code signing setup complete"
