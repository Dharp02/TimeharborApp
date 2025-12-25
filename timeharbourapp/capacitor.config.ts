import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_MODE === 'dev';

const config: CapacitorConfig = {
  appId: 'com.mieweb.timeharbor',
  appName: 'TimeHarbor',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    ...(isDev ? {
      url: 'http://10.0.0.39:3000',
      cleartext: true
    } : {})
  }
};

export default config;
