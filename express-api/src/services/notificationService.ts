import admin from 'firebase-admin';
import apn from 'apn';
import User from '../models/User';
import Notification from '../models/Notification';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

// Initialize APNs Provider for iOS
let apnProvider: apn.Provider | null = null;

export const initializeFirebase = () => {
  if (firebaseInitialized) return;

  try {
    // Check for service account file path (recommended approach)
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath) {
      const absolutePath = path.isAbsolute(serviceAccountPath) 
        ? serviceAccountPath 
        : path.join(process.cwd(), serviceAccountPath);
      
      if (!fs.existsSync(absolutePath)) {
        console.error(`❌ Firebase service account file not found: ${absolutePath}`);
        return;
      }

      const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized from service account file');
      return;
    }

    // Fallback to individual environment variables (legacy support)
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      console.warn('⚠️  Firebase credentials not configured. Push notifications disabled.');
      console.warn('   Set FIREBASE_SERVICE_ACCOUNT_PATH or (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey,
        clientEmail,
      }),
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
  }
};

// Initialize APNs Provider for iOS push notifications
export const initializeAPNs = () => {
  try {
    const apnsKeyPath = process.env.APNS_KEY_PATH;
    const apnsKeyId = process.env.APNS_KEY_ID;
    const apnsTeamId = process.env.APNS_TEAM_ID;
    const apnsBundleId = process.env.APNS_BUNDLE_ID || 'os.mieweb.timeharbor';
    const apnsProduction = process.env.APNS_PRODUCTION === 'true';

    if (!apnsKeyPath || !apnsKeyId || !apnsTeamId) {
      console.warn('⚠️  APNs credentials not configured. iOS push notifications will use FCM fallback.');
      console.warn('   Set APNS_KEY_PATH, APNS_KEY_ID, and APNS_TEAM_ID for direct APNs.');
      return;
    }

    const absolutePath = path.isAbsolute(apnsKeyPath) 
      ? apnsKeyPath 
      : path.join(process.cwd(), apnsKeyPath);
    
    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ APNs key file not found: ${absolutePath}`);
      return;
    }

    apnProvider = new apn.Provider({
      token: {
        key: absolutePath,
        keyId: apnsKeyId,
        teamId: apnsTeamId,
      },
      production: apnsProduction,
    });

    console.log(`✅ APNs Provider initialized (${apnsProduction ? 'Production' : 'Development'} mode)`);
    console.log(`   Bundle ID: ${apnsBundleId}`);
  } catch (error) {
    console.error('❌ Failed to initialize APNs Provider:', error);
  }
};

// Notification payload interface
export interface NotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
  imageUrl?: string;
}

// Send notification via APNs (for iOS)
const sendAPNsNotification = async (
  user: any,
  payload: NotificationPayload
): Promise<boolean> => {
  try {
    const notification = new apn.Notification();
    notification.alert = {
      title: payload.title,
      body: payload.body,
    };
    notification.sound = 'default';
    notification.badge = 1;
    notification.topic = process.env.APNS_BUNDLE_ID || 'os.mieweb.timeharbor';
    notification.payload = payload.data || {};

    const result = await apnProvider!.send(notification, user.fcm_token);
    
    // Check for failures
    if (result.failed && result.failed.length > 0) {
      const failure = result.failed[0];
      console.log('[NOTIFICATION] ⚠️  APNs send failed:', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        userName: user.full_name || 'Unknown',
        userEmail: user.email,
        reason: failure.response?.reason || 'Unknown',
        statusCode: failure.status
      });

      // Clear invalid tokens
      if (failure.response?.reason === 'BadDeviceToken' || 
          failure.response?.reason === 'Unregistered' ||
          failure.response?.reason === 'DeviceTokenNotForTopic') {
        console.log('[NOTIFICATION] ⚠️  Invalid APNs token - Clearing from database');
        await User.update(
          { fcm_token: undefined, fcm_platform: undefined, fcm_updated_at: undefined },
          { where: { id: user.id } }
        );
      }
      return false;
    }

    console.log('[NOTIFICATION] ✅ Successfully sent via APNs:', {
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.full_name || 'Unknown',
      userEmail: user.email,
      notificationType: payload.data?.type || 'generic',
      title: payload.title,
      sent: result.sent.length
    });
    
    return true;
  } catch (error: any) {
    console.error('[NOTIFICATION] ❌ APNs error:', {
      timestamp: new Date().toISOString(),
      userId: user.id,
      error: error.message
    });
    return false;
  }
};

// Send notification via Firebase Cloud Messaging (for Android and iOS fallback)
const sendFCMNotification = async (
  user: any,
  payload: NotificationPayload
): Promise<boolean> => {
  try {
    const message: admin.messaging.Message = {
      token: user.fcm_token,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
      },
      data: payload.data || {},
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
    };

    const response = await admin.messaging().send(message);
    
    console.log('[NOTIFICATION] ✅ Successfully sent via FCM:', {
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.full_name || 'Unknown',
      userEmail: user.email,
      notificationType: payload.data?.type || 'generic',
      title: payload.title,
      messageId: response,
      platform: user.fcm_platform || 'unknown'
    });
    
    return true;
  } catch (error: any) {
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-argument') {
      console.log('[NOTIFICATION] ⚠️  Invalid token - Clearing from database:', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        userName: user.full_name || 'Unknown',
        userEmail: user.email || 'Unknown',
        reason: 'Invalid or unregistered FCM token',
        action: 'Token cleared from database'
      });
      await User.update(
        { fcm_token: undefined, fcm_platform: undefined, fcm_updated_at: undefined },
        { where: { id: user.id } }
      );
    } else {
      console.error('[NOTIFICATION] ❌ Failed to send via FCM:', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        userName: user.full_name || 'Unknown',
        userEmail: user.email || 'Unknown',
        notificationType: payload.data?.type || 'generic',
        title: payload.title,
        error: error.message,
        errorCode: error.code
      });
    }
    return false;
  }
};

// Send notification to a specific user
export const sendNotificationToUser = async (
  userId: string,
  payload: NotificationPayload
): Promise<boolean> => {
  try {
    // Save notification to database
    try {
      await Notification.create({
        userId,
        title: payload.title,
        body: payload.body,
        type: (payload.data?.type as string) || 'info',
        data: payload.data,
        readAt: null
      });
      console.log(`[NOTIFICATION] ✅ Saved to database for user ${userId}`);
    } catch (dbError) {
      console.error('[NOTIFICATION] ❌ Failed to save to database:', dbError);
    }

    // Get user's FCM token
    const user = await User.findByPk(userId);
    
    console.log('[NOTIFICATION] Attempting to send notification:', {
      timestamp: new Date().toISOString(),
      userId,
      userName: user?.full_name || 'Unknown',
      userEmail: user?.email || 'Unknown',
      platform: user?.fcm_platform || 'unknown',
      notificationType: payload.data?.type || 'generic',
      title: payload.title
    });
    
    if (!user || !user.fcm_token) {
      console.log(`No FCM token found for user ${userId}`);
      return false;
    }

    // Use APNs for iOS devices if configured, otherwise fall back to FCM
    if (user.fcm_platform === 'ios' && apnProvider) {
      console.log('[NOTIFICATION] Routing to APNs for iOS device');
      return await sendAPNsNotification(user, payload);
    } else if (firebaseInitialized) {
      console.log('[NOTIFICATION] Routing to FCM');
      return await sendFCMNotification(user, payload);
    } else {
      console.warn('Neither APNs nor Firebase initialized. Skipping notification.');
      return false;
    }
  } catch (error: any) {
    console.error('[NOTIFICATION] ❌ Error in sendNotificationToUser:', {
      timestamp: new Date().toISOString(),
      userId,
      error: error.message
    });
    return false;
  }
};

// Send notification to multiple users
export const sendNotificationToUsers = async (
  userIds: string[],
  payload: NotificationPayload
): Promise<{ success: number; failed: number }> => {
  if (!firebaseInitialized && !apnProvider) {
    console.warn('Neither APNs nor Firebase initialized. Skipping notifications.');
    return { success: 0, failed: userIds.length };
  }

  console.log('[NOTIFICATION] Batch send initiated:', {
    timestamp: new Date().toISOString(),
    recipientCount: userIds.length,
    notificationType: payload.data?.type || 'generic',
    title: payload.title
  });

  let success = 0;
  let failed = 0;

  // Send notifications in parallel
  const results = await Promise.allSettled(
    userIds.map(userId => sendNotificationToUser(userId, payload))
  );

  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      success++;
    } else {
      failed++;
    }
  });

  console.log('[NOTIFICATION] Batch send completed:', {
    timestamp: new Date().toISOString(),
    totalRecipients: userIds.length,
    successful: success,
    failed: failed,
    notificationType: payload.data?.type || 'generic',
    title: payload.title
  });

  return { success, failed };
};

// Send notification when team member clocks in
export const sendClockInNotification = async (
  leaderIds: string[],
  memberName: string,
  teamName: string,
  teamId: string,
  memberId: string
) => {
  console.log('[NOTIFICATION] Clock-in event trigger:', {
    timestamp: new Date().toISOString(),
    teamId,
    teamName,
    memberName,
    memberId,
    recipientLeaderIds: leaderIds,
    leaderCount: leaderIds.length
  });
  
  return sendNotificationToUsers(leaderIds, {
    title: 'Team Member Clocked In',
    body: `${memberName} clocked in to ${teamName}`,
    data: {
      type: 'clock_in',
      teamId,
      memberId,
    },
  });
};

// Send notification when team member clocks out
export const sendClockOutNotification = async (
  leaderIds: string[],
  memberName: string,
  teamName: string,
  teamId: string,
  memberId: string
) => {
  console.log('[NOTIFICATION] Clock-out event trigger:', {
    timestamp: new Date().toISOString(),
    teamId,
    teamName,
    memberName,
    memberId,
    recipientLeaderIds: leaderIds,
    leaderCount: leaderIds.length
  });
  
  return sendNotificationToUsers(leaderIds, {
    title: 'Team Member Clocked Out',
    body: `${memberName} clocked out from ${teamName}`,
    data: {
      type: 'clock_out',
      teamId,
      memberId,
    },
  });
};
