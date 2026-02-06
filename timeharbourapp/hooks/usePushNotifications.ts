import { useEffect, useRef, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function usePushNotifications() {
  const initialized = useRef(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    // Only run on native platforms
    if (Capacitor.getPlatform() === 'web' || initialized.current) {
      console.log('📱 Platform:', Capacitor.getPlatform());
      return;
    }

    console.log('🔧 Initializing push notifications...');
    initialized.current = true;
    initializePushNotifications();

    // Cleanup function
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  const initializePushNotifications = async () => {
    try {
      // Request permission
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('❌ Push notification permission denied');
        return;
      }

      // Register with APNs/FCM
      await PushNotifications.register();

      // Listener: Successfully registered with APNs/FCM
      PushNotifications.addListener('registration', async (token) => {
        console.log('✅ Push registration success, token:', token.value);
        console.log('📋 Copy this FCM token for testing:', token.value);
        setFcmToken(token.value);
        await registerTokenWithBackend(token.value);
      });

      // Listener: Registration failed
      PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ Push registration error:', error);
      });

      // Listener: Notification received when app is in foreground
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('📬 Push notification received (foreground):', notification);
        // You can show a custom UI here or handle the notification
        // For now, we'll just log it
      });

      // Listener: User tapped on a notification
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('👆 Push notification tapped:', notification);
        
        const data = notification.notification.data;
        
        // Handle navigation based on notification type
        if (data?.type === 'ticket_assigned' && data?.ticketId) {
          // Navigate to ticket detail
          window.location.href = `/dashboard/tickets/${data.ticketId}`;
        } else if (data?.type === 'team_invitation' && data?.teamId) {
          // Navigate to team detail
          window.location.href = `/dashboard/teams/${data.teamId}`;
        } else if (data?.type === 'new_team_member' && data?.teamId) {
          // Navigate to team detail
          window.location.href = `/dashboard/teams/${data.teamId}`;
        } else if (data?.type === 'clock_in' && data?.teamId) {
          // Navigate to activity page to see team member activity
          window.location.href = `/dashboard/activity`;
        } else {
          // Default: navigate to dashboard
          window.location.href = '/dashboard';
        }
      });

      console.log('✅ Push notifications initialized');
    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
    }
  };

  const registerTokenWithBackend = async (fcmToken: string) => {
    try {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        console.log('⚠️  No access token, skipping token registration');
        return;
      }

      const platform = Capacitor.getPlatform() as 'ios' | 'android';

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

      if (response.ok) {
        console.log('✅ FCM token registered with backend');
      } else {
        const error = await response.json();
        console.error('❌ Failed to register token with backend:', error);
      }
    } catch (error) {
      console.error('❌ Error registering token with backend:', error);
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
