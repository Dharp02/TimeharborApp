import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const ENV_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? process.env.BASE_URL;
const BASE_URL = ENV_BASE_URL ?? 'http://localhost:3000';
const SHOULD_START_WEB_SERVER = !ENV_BASE_URL;
const IS_CI = !!process.env.CI;
const RUN_ALL_BROWSERS =
  IS_CI || process.env.PLAYWRIGHT_ALL_BROWSERS === '1';

const parsedWorkers = Number.parseInt(process.env.PLAYWRIGHT_WORKERS ?? '1', 10);
const LOCAL_WORKERS = Number.isFinite(parsedWorkers) && parsedWorkers > 0
  ? parsedWorkers
  : 1;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',

  // Keep local runs light to avoid freezing developer machines.
  fullyParallel: IS_CI,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : LOCAL_WORKERS,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    // Suppress the walkthrough modal for all tests by default.
    // Walkthrough-specific tests clear this key via reopenWalkthrough().
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            { name: 'th_walkthrough_completed', value: '1' },
          ],
        },
      ],
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  expect: {
    timeout: 10_000,
  },

  projects: RUN_ALL_BROWSERS
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
        {
          name: 'mobile-chrome',
          use: { ...devices['Pixel 7'] },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ],

  webServer: SHOULD_START_WEB_SERVER
    ? {
        command: 'npm run dev',
        url: BASE_URL,
        ignoreHTTPSErrors: true,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
