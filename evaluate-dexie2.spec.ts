import { test, expect } from '@playwright/test';

test('Evaluate Dexie exists existing db', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard'); // update if needed
  
  const res = await page.evaluate(async () => {
    try {
      const dbInfo = await window.indexedDB.databases();
      const dexieExists = await Dexie.exists(dbInfo[0] ? dbInfo[0].name : 'Missing');
      return { dexieExists, dbInfo };
    } catch (e) {
      return { error: e.toString() };
    }
  });
  console.log(res);
});
