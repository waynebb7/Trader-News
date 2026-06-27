/**
 * Platform detection for Windows PC, Mac Intel (x64), and Mac Apple Silicon (arm64).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STAMP_FILE = path.join(ROOT, '.install-platform');

const SUPPORTED = {
  'win32-x64': { label: 'Windows PC (64-bit)', short: 'Windows' },
  'win32-arm64': { label: 'Windows PC (ARM)', short: 'Windows ARM' },
  'darwin-x64': { label: 'Mac Intel', short: 'Mac Intel' },
  'darwin-arm64': { label: 'Mac Apple Silicon', short: 'Mac Apple Silicon' },
  'linux-x64': { label: 'Linux (64-bit)', short: 'Linux' },
  'linux-arm64': { label: 'Linux (ARM)', short: 'Linux ARM' }
};

function getPlatformKey() {
  return `${process.platform}-${process.arch}`;
}

function getPlatformInfo() {
  const key = getPlatformKey();
  const known = SUPPORTED[key];
  return {
    key,
    label: known ? known.label : `${process.platform} (${process.arch})`,
    short: known ? known.short : key,
    supported: Boolean(known),
    isMac: process.platform === 'darwin',
    isWindows: process.platform === 'win32',
    isAppleSilicon: process.platform === 'darwin' && process.arch === 'arm64',
    isMacIntel: process.platform === 'darwin' && process.arch === 'x64'
  };
}

function readInstallStamp() {
  try {
    return fs.readFileSync(STAMP_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

function writeInstallStamp() {
  fs.writeFileSync(STAMP_FILE, getPlatformKey(), 'utf8');
}

function clearInstallStamp() {
  try {
    fs.unlinkSync(STAMP_FILE);
  } catch {
    // ignore
  }
}

function stampMismatchMessage(previousStamp) {
  const prev = SUPPORTED[previousStamp];
  const curr = getPlatformInfo();
  const prevLabel = prev ? prev.label : previousStamp;
  return `Was installed for ${prevLabel} → now on ${curr.label}`;
}

function verifyBetterSqlite3(root) {
  const modPath = path.join(root || ROOT, 'node_modules', 'better-sqlite3');
  if (!fs.existsSync(modPath)) {
    return { ok: false, reason: 'not installed' };
  }
  try {
    const prev = module.paths.slice();
    module.paths.unshift(path.join(root || ROOT, 'node_modules'));
    const resolved = require.resolve('better-sqlite3', { paths: [root || ROOT] });
    delete require.cache[resolved];
    require(resolved);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function nativeBuildHints() {
  const info = getPlatformInfo();
  const hints = [];

  if (info.isMac) {
    hints.push('Install Xcode Command Line Tools: xcode-select --install');
    if (info.isAppleSilicon) {
      hints.push('Use Apple Silicon Node.js from https://nodejs.org (not the Intel/Rosetta build)');
    }
    if (info.isMacIntel) {
      hints.push('Use Intel (x64) Node.js from https://nodejs.org');
    }
  }
  if (info.isWindows) {
    hints.push('Install Node.js LTS (64-bit) from https://nodejs.org');
  }
  hints.push('Or run manually in this folder: npm rebuild better-sqlite3');
  hints.push('The app still works without SQLite — it falls back to JSON file storage.');

  return hints;
}

module.exports = {
  ROOT,
  STAMP_FILE,
  SUPPORTED,
  getPlatformKey,
  getPlatformInfo,
  readInstallStamp,
  writeInstallStamp,
  clearInstallStamp,
  stampMismatchMessage,
  verifyBetterSqlite3,
  nativeBuildHints
};
