import { useEffect, useRef, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { onAuthStateChange } from '@/TimeharborAPI/auth';
import { useNotifications } from '@/contexts/NotificationContext';
import { getApiUrl } from '@/TimeharborAPI/apiUrl';

const API_URL = getApiUrl();

export function usePushNotifications() {
  const initialized = useRef(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    // Only run on native platforms
    if (Capacitor.getPlatform() === 'web') {
      console.log('📱 Platform:', Capacitor.getPlatform(), '- Skipping push notifications');
      return;
    }

    // Initialize on mount if not already initialized
    if (!initialized.current) {
      console.log('🔧 Initializing push notifications on mount...');
      initialized.current = true;
      initializePushNotifications();
    }

    // Listen for auth state changes
    const { unsubscribe } = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        console.log('🔑 User signed in - Re-initializing push notifications...');
        // Re-initialize push notifications after login
        initializePushNotifications();
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out - Clearing FCM token state');
        setFcmToken(null);
      }
    });

    // Cleanup function
    return () => {
      unsubscribe();
      PushNotifications.removeAllListeners();
    };
  }, []);

  const initializePushNotifications = async () => {
    try {
      const platform = Capacitor.getPlatform();
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔔 [INIT] Starting push notification initialization');
      console.log('📱 [INIT] Platform:', platform);
      console.log('🕐 [INIT] Time:', new Date().toISOString());
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Remove any existing listeners to avoid duplicates
      console.log('🧹 [INIT] Removing old listeners...');
      await PushNotifications.removeAllListeners();
      console.log('✅ [INIT] Old listeners removed');
      
      // Request permission
      console.log('🔍 [PERMISSIONS] Checking current permissions...');
      let permStatus = await PushNotifications.checkPermissions();
      console.log('📋 [PERMISSIONS] Current status:', JSON.stringify(permStatus, null, 2));
      console.log('📋 [PERMISSIONS] Receive permission:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        console.log('⏳ [PERMISSIONS] Status is "prompt" - requesting permissions...');
        permStatus = await PushNotifications.requestPermissions();
        console.log('📋 [PERMISSIONS] Request result:', JSON.stringify(permStatus, null, 2));
      } else if (permStatus.receive === 'granted') {
        console.log('✅ [PERMISSIONS] Already granted - will re-register device token');
      } else if (permStatus.receive === 'denied') {
        console.log('❌ [PERMISSIONS] Previously denied!');
        console.log('⚠️  [PERMISSIONS] User must enable in:');
        if (platform === 'ios') {
          console.log('   iOS: Settings > TimeHarbor > Notifications > Allow Notifications');
        } else {
          console.log('   Android: Settings > Apps > TimeHarbor > Notifications');
        }
      }

      if (permStatus.receive !== 'granted') {
        console.log('❌ [PERMISSIONS] Not granted - stopping initialization');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return;
      }

      console.log('✅ [PERMISSIONS] Permission granted!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 [REGISTER] Calling PushNotifications.register()...');
      if (platform === 'ios') {
        console.log('📱 [REGISTER] iOS: This will call AppDelegate methods');
        console.log('📱 [REGISTER] iOS: Watch for AppDelegate logs in Xcode console');
      } else {
        console.log('📱 [REGISTER] Android: Registering with FCM');
      }
      
      // Setup listeners before registering
      console.log('👂 [LISTENERS] Setting up event listeners...');
      
      // Listener: Successfully registered with APNs/FCM
      PushNotifications.addListener('registration', async (token) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ [REGISTRATION] SUCCESS!');
        console.log('🔑 [REGISTRATION] Platform:', Capacitor.getPlatform());
        console.log('📱 [REGISTRATION] Token received:', token.value);
        console.log('📊 [REGISTRATION] Token length:', token.value.length);
        console.log('📋 [REGISTRATION] Copy token for testing:');
        console.log(token.value);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setFcmToken(token.value);
        await registerTokenWithBackend(token.value);
      });

      // Listener: Registration failed
      PushNotifications.addListener('registrationError', (error) => {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [REGISTRATION] FAILED!');
        console.error('📱 [REGISTRATION] Platform:', Capacitor.getPlatform());
        console.error('⚠️  [REGISTRATION] Error:', JSON.stringify(error, null, 2));
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('💡 [TROUBLESHOOTING] Common iOS issues:');
        console.error('   1. Running on iOS Simulator (APNs requires real device)');
        console.error('   2. Push Notifications capability not enabled in Xcode');
        console.error('   3. APNs certificate/key not configured in Firebase Console');
        console.error('   4. Provisioning profile doesn\'t include push notifications');
        console.error('   5. No internet connection');
        console.error('💡 [TROUBLESHOOTING] Steps to fix:');
        console.error('   1. Use a real iOS device (not simulator)');
        console.error('   2. In Xcode: Signing & Capabilities > Add Push Notifications');
        console.error('   3. In Firebase Console: Upload APNs Authentication Key');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      });

      // Listener: Notification received when app is in foreground
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('📬 Push notification received (foreground):', notification);
        // Add to notification context history
        addNotification({
          title: notification.title || 'New Notification',
          message: notification.body || '',
          data: notification.data
        });
      });

      // Listener: User tapped on a notification
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('👆 [NOTIFICATION TAP] User tapped notification');
        
        // Add to notification history if not already present
        addNotification({
          title: notification.notification.title || 'New Notification',
          message: notification.notification.body || '',
          data: notification.notification.data
        });

        console.log('📋 [NOTIFICATION TAP] Full notification:', JSON.stringify(notification, null, 2));
        console.log('📋 [NOTIFICATION TAP] Data:', JSON.stringify(notification.notification.data, null, 2));
        
        const data = notification.notification.data;
        console.log('🔍 [NOTIFICATION TAP] Type:', data?.type);
        console.log('🔍 [NOTIFICATION TAP] Member ID:', data?.memberId);
        console.log('🔍 [NOTIFICATION TAP] Team ID:', data?.teamId);
        
        let targetUrl = '/dashboard'; // default
        
        // Handle navigation based on notification type
        if (data?.type === 'ticket_assigned' && data?.ticketId) {
          targetUrl = `/dashboard/tickets/${data.ticketId}`;
          console.log('🎯 [NOTIFICATION TAP] Navigating to ticket:', targetUrl);
        } else if (data?.type === 'team_invitation' && data?.teamId) {
          targetUrl = `/dashboard/teams/${data.teamId}`;
          console.log('🎯 [NOTIFICATION TAP] Navigating to team:', targetUrl);
        } else if (data?.type === 'new_team_member' && data?.teamId) {
          targetUrl = `/dashboard/teams/${data.teamId}`;
          console.log('🎯 [NOTIFICATION TAP] Navigating to team (new member):', targetUrl);
        } else if ((data?.type === 'clock_in' || data?.type === 'clock_out') && data?.memberId && data?.teamId) {
          targetUrl = `/dashboard/member?id=${data.memberId}&teamId=${data.teamId}`;
          console.log('🎯 [NOTIFICATION TAP] Navigating to member page:', targetUrl);
        } else {
          console.log('⚠️  [NOTIFICATION TAP] No specific route, using default dashboard');
        }
        
        console.log('🚀 [NOTIFICATION TAP] Final target URL:', targetUrl);
        
        // Store navigation intent for the app to handle
        try {
          // Prevent race conditions by checking if we're already handling this navigation
          const currentPending = localStorage.getItem('pendingNavigation');
          if (currentPending !== targetUrl) {
             localStorage.setItem('pendingNavigation', targetUrl);
          }
        } catch (e) {
          console.error('Error handling navigation storage:', e);
        }
        
        // Try to navigate
        if (typeof window !== 'undefined') {
          window.location.href = targetUrl;
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      });

      console.log('👂 [LISTENERS] All listeners registered');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Register with APNs/FCM after setting up listeners
      console.log('📞 [REGISTER] Calling PushNotifications.register() now...');
      await PushNotifications.register();
      console.log('📞 [REGISTER] register() called - waiting for system response...');
      console.log('⏳ [REGISTER] Waiting for "registration" or "registrationError" event...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [INIT] EXCEPTION caught during initialization!');
      console.error('❌ [INIT] Error:', error);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  const registerTokenWithBackend = async (fcmToken: string) => {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📤 [BACKEND] Registering token with backend...');
      
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        console.log('⚠️  [BACKEND] No access token, skipping registration');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return;
      }
      console.log('✅ [BACKEND] Access token found');

      const platform = Capacitor.getPlatform() as 'ios' | 'android';
      console.log(`📤 [BACKEND] Platform: ${platform}`);
      console.log(`📤 [BACKEND] Token length: ${fcmToken.length}`);
      console.log(`📤 [BACKEND] API URL: ${API_URL}/auth/register-device`);

      const response = await fetch(`${API_URL}/auth/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fcm_token: fcmToken,
          platform,
        }),
      });

      console.log(`📤 [BACKEND] Sending POST request...`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ [BACKEND] Token registered successfully!');
        console.log('📊 [BACKEND] Response:', data);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
        const error = await response.json();
        console.error('❌ [BACKEND] Registration failed!');
        console.error('📊 [BACKEND] Status:', response.status);
        console.error('📊 [BACKEND] Error:', error);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ [BACKEND] Exception during registration!');
      console.error('❌ [BACKEND] Error:', error);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  return { fcmToken };
}

// Hook to manually get delivered notifications
export function useDeliveredNotifications() {
  const getDeliveredNotifications = async () => {
    if (Capacitor.getPlatform() === 'web') {
      return [];
    }

    try {
      const notificationList = await PushNotifications.getDeliveredNotifications();
      return notificationList.notifications;
    } catch (error) {
      console.error('Error getting delivered notifications:', error);
      return [];
    }
  };

  return { getDeliveredNotifications };
}
