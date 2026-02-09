/// <reference types="@capacitor/push-notifications" />

import type { CapacitorConfig } from '@capacitor/cli';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Check if we are in dev mode based on the environment variable
const isDev = process.env.CAPACITOR_MODE === 'dev';
const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL || 'http://localhost:3000';
const appId = process.env.CAPACITOR_APP_ID || 'os.mieweb.timeharbor';
const appName = process.env.CAPACITOR_APP_NAME || 'TimeHarbor';

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // Ensure the URL is set when in dev mode
    ...(isDev ? {
      url: devServerUrl,
      cleartext: true
    } : {})
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

// Log the configuration to verify if dev mode is detected
console.log(`Capacitor Config - Mode: ${process.env.CAPACITOR_MODE}, isDev: ${isDev}`);
if (isDev) {
  console.log(`Server URL set to: ${devServerUrl}`);
}

export default config;
