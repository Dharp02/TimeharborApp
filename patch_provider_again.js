const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'timeharbourapp', 'components', 'AppSessionProvider.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

const hookToInsert = `
  // ── Reactive Identity Sync ──────────────────────────────────────────
  useEffect(() => {
    const sub = identity.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED') {
        console.log('[AppSessionProvider] Identity updated from event:', session.user);
        setUserAndCache(session.user);
      }
    });
    return () => sub.unsubscribe();
  }, [setUserAndCache]);
`;

const insertIndex = lines.findIndex(line => line.includes('return ('));
if (insertIndex > -1) {
  lines.splice(insertIndex, 0, hookToInsert);
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log('Patched AppSessionProvider.tsx at line', insertIndex);
}
