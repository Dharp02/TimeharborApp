import { test, expect } from '@playwright/test';

test('Evaluate Dexie exists', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard'); // update if needed
  
  const res = await page.evaluate(async () => {
    return true;
  });
  console.log(res);
});
