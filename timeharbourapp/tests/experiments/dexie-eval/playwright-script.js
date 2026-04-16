const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("file://" + path.resolve('test.html'));
  
  const result = await page.evaluate(async () => {
    try {
      const db = new Dexie('TestDB123');
      db.version(1).stores({ test: 'id' });
      await db.test.put({ id: 1 });
      
      const exists1 = await Dexie.exists('TestDB123');
      const exists2 = await Dexie.exists('NonExistentDB');
      
      const dbs = await indexedDB.databases();
      return { exists1, exists2, dbs };
    } catch(e) { return e.toString(); }
  });
  console.log("Evaluation Result:", result);
  await browser.close();
})();
