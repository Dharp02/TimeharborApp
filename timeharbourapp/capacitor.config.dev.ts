import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mieweb.timeharbor',
  appName: 'TimeHarbor',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    url: 'http://10.0.0.39:3000',
    cleartext: true
  }
};

export default config;
