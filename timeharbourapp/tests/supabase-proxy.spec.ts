import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe('Supabase Proxy Connectivity', () => {
  test.beforeAll(() => {
    expect(SUPABASE_URL).toBeTruthy();
    expect(SUPABASE_ANON_KEY).toBeTruthy();
  });

  test('should connect to health endpoint', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/auth/v1/health`);
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.version).toBeDefined();
    
    console.log(`✓ Health Check - ${response.ok() ? 'OK' : 'Failed'}`);
  });

  test('should access REST API endpoint', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    // REST API root might return 404 or 200, both indicate it's accessible
    expect([200, 404]).toContain(response.status());
    
    console.log(`✓ REST API - Status ${response.status()}`);
  });

  test('should access Auth endpoint', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    // 400, 401, 403 is expected for unauthenticated requests
    expect([200, 400, 401, 403]).toContain(response.status());
    
    console.log(`✓ Auth Endpoint - Status ${response.status()}`);
  });

  test('should access Storage endpoint', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    expect([200, 400, 403]).toContain(response.status());
    
    console.log(`✓ Storage Endpoint - Status ${response.status()}`);
  });

  test('should connect to Realtime WebSocket', async ({ page }) => {
    // Test WebSocket connection through the app
    await page.goto('/');
    
    // Inject WebSocket test - pass env vars directly
    const wsConnected = await page.evaluate(async ({ url, apiKey }) => {
      return new Promise((resolve) => {
        const wsUrl = url.replace('https://', 'wss://').replace('http://', 'ws://');
        const ws = new WebSocket(`${wsUrl}/realtime/v1/websocket?apikey=${apiKey}&vsn=1.0.0`);
        
        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        
        ws.onerror = () => {
          resolve(false);
        };
        
        setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);
      });
    }, { url: SUPABASE_URL, apiKey: SUPABASE_ANON_KEY });
    
    expect(wsConnected).toBeTruthy();
    
    console.log(`✓ Realtime WebSocket - Connected`);
  });
});

test.describe('Supabase Integration Tests', () => {
  test('should check Supabase configuration', async () => {
    // Just verify env vars are set correctly
    expect(SUPABASE_URL).toBeTruthy();
    expect(SUPABASE_URL).toContain('http');
    expect(SUPABASE_ANON_KEY).toBeTruthy();
    expect(SUPABASE_ANON_KEY.length).toBeGreaterThan(20);
  });
});
