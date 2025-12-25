import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mieweb.timeharbor',
  appName: 'TimeHarbor',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
