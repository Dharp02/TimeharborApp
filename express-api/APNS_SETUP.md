# APNs (Apple Push Notification service) Setup Guide

This guide explains how to set up direct APNs integration for iOS push notifications without using Firebase.

## Why Direct APNs?

- **No Firebase dependency** for iOS notifications
- **Better control** over iOS notification delivery
- **Lower latency** - direct connection to Apple's servers
- **More reliable** for iOS-specific features

## Prerequisites

- Apple Developer Account ($99/year)
- Xcode with your app configured
- Push Notifications capability enabled in Xcode

## Step 1: Create APNs Authentication Key

1. Go to [Apple Developer Account](https://developer.apple.com/account/resources/authkeys/list)
2. Click the **+** button to create a new key
3. Enter a key name (e.g., "TimeHarbor Push Notifications")
4. Check **Apple Push Notifications service (APNs)**
5. Click **Continue** and then **Register**
6. **Download the .p8 file** (you can only download it once!)
7. Note your **Key ID** (10 characters, e.g., ABC1234567)

## Step 2: Get Your Team ID

1. Go to [Apple Developer Membership](https://developer.apple.com/account/#/membership/)
2. Find your **Team ID** under "Membership Information" (10 characters)

## Step 3: Get Your Bundle ID

1. Open your iOS app in Xcode
2. Select your app target
3. Go to the **General** tab
4. Find your **Bundle Identifier** (e.g., `com.company.timeharbor`)

## Step 4: Configure the Backend

1. Copy your downloaded `.p8` file to the `express-api/` directory
2. Rename it to something simple like `AuthKey.p8`
3. Update your `.env` file:

```env
# Apple Push Notification service (APNs) for iOS
APNS_KEY_PATH=AuthKey.p8
APNS_KEY_ID=ABC1234567        # Your Key ID from Step 1
APNS_TEAM_ID=XYZ9876543      # Your Team ID from Step 2
APNS_BUNDLE_ID=com.company.timeharbor  # Your Bundle ID from Step 3
APNS_PRODUCTION=false         # Set to true for production builds
```

4. Add `AuthKey.p8` to `.gitignore` to keep it secure:
```
# APNs Authentication Key
AuthKey*.p8
```

## Step 5: Test iOS Notifications

1. Start the Express server:
```bash
cd express-api
npm run dev
```

2. Look for this log message:
```
✅ APNs Provider initialized (Development mode)
   Bundle ID: com.company.timeharbor
```

3. Open the iOS app on a **real device** (not simulator)
4. Log in to trigger push notification registration
5. Check for these logs in Xcode console:
```
🔔 ══════════════════════════════════════
📱 iOS PUSH NOTIFICATION REGISTRATION
══════════════════════════════════════ 🔔
✅ Device Token: <your-device-token>
```

6. Have another user perform an action (e.g., clock in/out)
7. You should receive a notification!

## Production Setup

For production (App Store builds):

1. Set in `.env`:
```env
APNS_PRODUCTION=true
```

2. Make sure you're using a production APNs SSL certificate or the same `.p8` key works for both development and production

## Troubleshooting

### No logs showing APNs initialization

- Check that `.env` has all required APNs variables
- Verify the `.p8` file path is correct
- Ensure the file is readable (check permissions)

### "BadDeviceToken" error

- Make sure `APNS_PRODUCTION` matches your build configuration:
  - `false` for Xcode development builds
  - `true` for App Store/TestFlight builds
- Check that `APNS_BUNDLE_ID` matches your app's Bundle Identifier exactly

### "DeviceTokenNotForTopic" error

- Your Bundle ID doesn't match
- Update `APNS_BUNDLE_ID` in `.env` to match Xcode

### Notifications still using FCM

- APNs will only be used if:
  1. APNs is properly initialized (check startup logs)
  2. User's `fcm_platform` is set to `'ios'` in database
  3. User has a valid device token

### Token not registering

- Push Notifications must be enabled in Xcode capabilities
- Must test on a real iOS device (not simulator)
- Check Xcode console for AppDelegate logs

## Architecture

```
iOS Device → APNs (Apple) → Express Server (node-apn)
Android Device → FCM (Firebase) → Express Server (firebase-admin)
```

The server automatically detects the platform:
- iOS users with valid APNs config → Direct APNs
- Android users OR iOS without APNs config → FCM (Firebase)

## Security Notes

- **Never commit your `.p8` file** to version control
- Keep your Key ID and Team ID secure (don't share publicly)
- Rotate keys periodically for security
- Use environment variables for production deployments
