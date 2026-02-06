import type { CapacitorConfig } from '@capacitor/cli';

// Check if we are in dev mode based on the environment variable
// Note: When running 'npx cap sync', this variable needs to be set
const isDev = process.env.CAPACITOR_MODE === 'dev';

const config: CapacitorConfig = {
  appId: 'com.mieweb.timeharbor',
  appName: 'TimeHarbor',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // Ensure the URL is set when in dev mode
    ...(isDev ? {
      url: 'http://10.0.0.8:3000',
      cleartext: true
    } : {})
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

// Log the configuration to verify if dev mode is detected
console.log(`Capacitor Config - Mode: ${process.env.CAPACITOR_MODE}, isDev: ${isDev}`);
if (isDev) {
  console.log(`Server URL set to: http://10.0.0.39:3000`);
}

export default config;
