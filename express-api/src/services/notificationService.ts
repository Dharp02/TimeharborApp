import admin from 'firebase-admin';
import User from '../models/User';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

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

// Notification payload interface
export interface NotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
  imageUrl?: string;
}

// Send notification to a specific user
export const sendNotificationToUser = async (
  userId: string,
  payload: NotificationPayload
): Promise<boolean> => {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized. Skipping notification.');
    return false;
  }

  try {
    // Get user's FCM token
    const user = await User.findByPk(userId);
    
    console.log('[NOTIFICATION] Attempting to send notification:', {
      timestamp: new Date().toISOString(),
      userId,
      userName: user?.full_name || 'Unknown',
      userEmail: user?.email || 'Unknown',
      notificationType: payload.data?.type || 'generic',
      title: payload.title
    });
    
    if (!user || !user.fcm_token) {
      console.log(`No FCM token found for user ${userId}`);
      return false;
    }

    // Send notification
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
    
    console.log('[NOTIFICATION] ✅ Successfully sent:', {
      timestamp: new Date().toISOString(),
      userId,
      userName: user.full_name || 'Unknown',
      userEmail: user.email,
      notificationType: payload.data?.type || 'generic',
      title: payload.title,
      messageId: response,
      platform: user.fcm_platform || 'unknown'
    });
    
    return true;
  } catch (error: any) {
    const user = await User.findByPk(userId);
    
    // Handle invalid token errors
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      console.log('[NOTIFICATION] ⚠️  Invalid token:', {
        timestamp: new Date().toISOString(),
        userId,
        userName: user?.full_name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        reason: 'Invalid or unregistered FCM token',
        action: 'Token cleared from database'
      });
      await User.update(
        { fcm_token: undefined, fcm_platform: undefined, fcm_updated_at: undefined },
        { where: { id: userId } }
      );
    } else {
      console.error('[NOTIFICATION] ❌ Failed to send:', {
        timestamp: new Date().toISOString(),
        userId,
        userName: user?.full_name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        notificationType: payload.data?.type || 'generic',
        title: payload.title,
        error: error.message,
        errorCode: error.code
      });
    }
    return false;
  }
};

// Send notification to multiple users
export const sendNotificationToUsers = async (
  userIds: string[],
  payload: NotificationPayload
): Promise<{ success: number; failed: number }> => {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized. Skipping notifications.');
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

// Send notification for ticket assignment
export const sendTicketAssignmentNotification = async (
  userId: string,
  ticketTitle: string,
  ticketId: string
) => {
  console.log('[NOTIFICATION] Ticket assignment trigger:', {
    timestamp: new Date().toISOString(),
    userId,
    ticketId,
    ticketTitle
  });
  
  return sendNotificationToUser(userId, {
    title: 'New Ticket Assigned',
    body: `You've been assigned: ${ticketTitle}`,
    data: {
      type: 'ticket_assigned',
      ticketId,
    },
  });
};

// Send notification for team invitation
export const sendTeamInvitationNotification = async (
  userId: string,
  teamName: string,
  teamId: string
) => {
  console.log('[NOTIFICATION] Team invitation trigger:', {
    timestamp: new Date().toISOString(),
    userId,
    teamId,
    teamName
  });
  
  return sendNotificationToUser(userId, {
    title: 'Team Invitation',
    body: `You've been added to ${teamName}`,
    data: {
      type: 'team_invitation',
      teamId,
    },
  });
};

// Send notification for new team member
export const sendNewTeamMemberNotification = async (
  userId: string,
  memberName: string,
  teamName: string,
  teamId: string
) => {
  console.log('[NOTIFICATION] New team member trigger:', {
    timestamp: new Date().toISOString(),
    recipientUserId: userId,
    teamId,
    teamName,
    newMemberName: memberName
  });
  
  return sendNotificationToUser(userId, {
    title: 'New Team Member',
    body: `${memberName} joined ${teamName}`,
    data: {
      type: 'new_team_member',
      teamId,
    },
  });
};

// Send notification for ticket status change
export const sendTicketStatusNotification = async (
  userId: string,
  ticketTitle: string,
  newStatus: string,
  ticketId: string
) => {
  console.log('[NOTIFICATION] Ticket status change trigger:', {
    timestamp: new Date().toISOString(),
    userId,
    ticketId,
    ticketTitle,
    newStatus
  });
  
  return sendNotificationToUser(userId, {
    title: 'Ticket Status Updated',
    body: `${ticketTitle} is now ${newStatus}`,
    data: {
      type: 'ticket_status',
      ticketId,
      status: newStatus,
    },
  });
};

// Send notification when team member clocks in
export const sendClockInNotification = async (
  leaderIds: string[],
  memberName: string,
  teamName: string,
  teamId: string
) => {
  console.log('[NOTIFICATION] Clock-in event trigger:', {
    timestamp: new Date().toISOString(),
    teamId,
    teamName,
    memberName,
    recipientLeaderIds: leaderIds,
    leaderCount: leaderIds.length
  });
  
  return sendNotificationToUsers(leaderIds, {
    title: 'Team Member Clocked In',
    body: `${memberName} clocked in to ${teamName}`,
    data: {
      type: 'clock_in',
      teamId,
    },
  });
};

// Send notification when team member clocks out
export const sendClockOutNotification = async (
  leaderIds: string[],
  memberName: string,
  teamName: string,
  teamId: string
) => {
  console.log('[NOTIFICATION] Clock-out event trigger:', {
    timestamp: new Date().toISOString(),
    teamId,
    teamName,
    memberName,
    recipientLeaderIds: leaderIds,
    leaderCount: leaderIds.length
  });
  
  return sendNotificationToUsers(leaderIds, {
    title: 'Team Member Clocked Out',
    body: `${memberName} clocked out from ${teamName}`,
    data: {
      type: 'clock_out',
      teamId,
    },
  });
};
