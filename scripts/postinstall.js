/**
 * Runs after npm install — records platform stamp and verifies native modules.
 */
const { ROOT, getPlatformInfo, writeInstallStamp, verifyBetterSqlite3, nativeBuildHints } = require('./platform');

const info = getPlatformInfo();

console.log('');
console.log(`  Trader News Cockpit — postinstall (${info.label})`);

writeInstallStamp();

const check = verifyBetterSqlite3(ROOT);
if (check.ok) {
  console.log('  SQLite native module: OK');
} else {
  console.log('  SQLite native module: unavailable (' + check.reason + ')');
  console.log('  App will use JSON file storage until rebuilt.');
  nativeBuildHints().slice(0, 2).forEach((h) => console.log('  → ' + h));
}

console.log('');
