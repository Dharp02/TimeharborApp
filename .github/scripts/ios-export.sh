#!/bin/bash
set -e

echo "Exporting IPA..."

# Extract the Profile UUID again
PP_UUID=$(/usr/libexec/PlistBuddy -c 'Print :UUID' /dev/stdin <<< $(security cms -D -i $RUNNER_TEMP/build_pp.mobileprovision))
echo "Using Provisioning Profile UUID for export: $PP_UUID"

# Create export options plist
cat > $RUNNER_TEMP/ExportOptions.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>$IOS_TEAM_ID</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>os.mieweb.timeharbor</key>
    <string>$PP_UUID</string>
  </dict>
  <key>uploadBitcode</key>
  <false/>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
EOF

# Export archive
cd timeharbourapp/ios/App

xcodebuild -exportArchive \
  -archivePath $RUNNER_TEMP/TimeHarbor.xcarchive \
  -exportOptionsPlist $RUNNER_TEMP/ExportOptions.plist \
  -exportPath $RUNNER_TEMP/export

echo "✅ Export complete"
