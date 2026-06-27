#!/usr/bin/env node
/**
 * Cross-platform launcher — Windows PC, Mac Intel, Mac Apple Silicon.
 */
const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const net = require('net');
const {
  ROOT,
  getPlatformKey,
  getPlatformInfo,
  readInstallStamp,
  writeInstallStamp,
  clearInstallStamp,
  stampMismatchMessage,
  verifyBetterSqlite3,
  nativeBuildHints
} = require('./platform');

const PORT = parseInt(process.env.PORT || '3847', 10);
const HOST = '127.0.0.1';
const URL = `http://${HOST}:${PORT}`;

process.chdir(ROOT);

function log(msg) {
  console.log(msg);
}

function fail(msg) {
  console.error('\n  ERROR: ' + msg + '\n');
  process.exit(1);
}

function checkNode() {
  const v = process.version.slice(1).split('.').map(Number);
  if (v[0] < 18) {
    fail(`Node.js 18+ required (found ${process.version}). Install from https://nodejs.org/`);
  }

  const info = getPlatformInfo();
  if (info.isAppleSilicon && process.arch === 'x64') {
    log('  ⚠ Running Intel (x64) Node under Rosetta on Apple Silicon.');
    log('    For best results install Apple Silicon Node from https://nodejs.org');
    log('');
  }
}

function removeNodeModules() {
  const nm = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nm)) return;
  log('  Removing dependencies built for another computer...');
  fs.rmSync(nm, { recursive: true, force: true });
  clearInstallStamp();
}

function runNpmInstall() {
  const env = { ...process.env, NODE_OPTIONS: '--use-system-ca' };
  const opts = { cwd: ROOT, stdio: 'inherit', env };

  if (process.platform === 'win32') {
    execSync('npm install', { ...opts, shell: true });
  } else {
    execSync('npm install', opts);
  }
}

function runNpmRebuild() {
  const env = { ...process.env, NODE_OPTIONS: '--use-system-ca' };
  const opts = { cwd: ROOT, stdio: 'inherit', env };
  const cmd = 'npm rebuild better-sqlite3 --build-from-source';
  if (process.platform === 'win32') {
    execSync(cmd, { ...opts, shell: true });
  } else {
    execSync(cmd, opts);
  }
}

function ensureDeps() {
  const nm = path.join(ROOT, 'node_modules');
  const expressOk = fs.existsSync(path.join(nm, 'express'));
  const stamp = readInstallStamp();
  const platformKey = getPlatformKey();
  const platformMatch = stamp === platformKey;

  if (expressOk && platformMatch) {
    const sqlite = verifyBetterSqlite3(ROOT);
    if (sqlite.ok) return;
    log('  Native SQLite module needs rebuilding for this computer...');
    try {
      runNpmRebuild();
      if (verifyBetterSqlite3(ROOT).ok) {
        writeInstallStamp();
        return;
      }
    } catch {
      log('  Rebuild failed — app will use JSON storage (still fully usable).');
      nativeBuildHints().forEach((h) => log('    ' + h));
      return;
    }
  }

  if (expressOk && !platformMatch) {
    log('  ' + stampMismatchMessage(stamp));
    removeNodeModules();
  }

  log('  Installing dependencies for this computer (one-time)...');
  log(`  Target: ${getPlatformInfo().label} [${platformKey}]`);
  try {
    runNpmInstall();
    writeInstallStamp();
    const sqlite = verifyBetterSqlite3(ROOT);
    if (!sqlite.ok) {
      log('  SQLite unavailable — trying rebuild...');
      try {
        runNpmRebuild();
      } catch {
        log('  Using JSON file storage instead of SQLite.');
        nativeBuildHints().slice(0, 3).forEach((h) => log('    ' + h));
      }
    }
  } catch {
    log('  Retrying npm install with SSL workaround...');
    try {
      const env = { ...process.env, NODE_OPTIONS: '--use-system-ca' };
      const cmd = 'npm install --strict-ssl=false';
      if (process.platform === 'win32') {
        execSync(cmd, { cwd: ROOT, stdio: 'inherit', env, shell: true });
      } else {
        execSync(cmd, { cwd: ROOT, stdio: 'inherit', env });
      }
      writeInstallStamp();
    } catch {
      fail('npm install failed. Open a terminal in this folder and run: npm install');
    }
  }
}

function ensureEnv() {
  const envPath = path.join(ROOT, '.env');
  const examplePath = path.join(ROOT, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    log('  Created .env from .env.example');
  }
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(true));
    srv.once('listening', () => { srv.close(); resolve(false); });
    srv.listen(port, HOST);
  });
}

function waitForHealth(maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = () => {
      attempts++;
      const req = http.get(`${URL}/api/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (attempts < maxAttempts) setTimeout(tick, 500);
        else reject(new Error('Server health check failed'));
      });
      req.on('error', () => {
        if (attempts < maxAttempts) setTimeout(tick, 500);
        else reject(new Error('Server did not start'));
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tick();
  });
}

function openBrowser() {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', URL], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [URL], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [URL], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    log(`  Open manually: ${URL}`);
  }
}

async function main() {
  const info = getPlatformInfo();

  console.log('');
  console.log('  ========================================');
  console.log('   TRADER NEWS COCKPIT - Starting...');
  console.log(`   ${info.label}`);
  console.log('  ========================================');
  console.log('');

  checkNode();
  ensureEnv();
  ensureDeps();

  const inUse = await isPortInUse(PORT);
  if (inUse) {
    log(`  Port ${PORT} already in use — checking if app is running...`);
    try {
      await waitForHealth(5);
      log(`  App already running at ${URL}`);
      openBrowser();
      return;
    } catch {
      fail(`Port ${PORT} is in use by another program. Close it or set PORT=3848 in .env`);
    }
  }

  log(`  Starting server on ${URL} ...`);
  const serverProc = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) }
  });

  serverProc.on('error', (err) => fail(err.message));
  serverProc.on('exit', (code) => {
    if (code !== 0 && code !== null) process.exit(code);
  });

  try {
    await waitForHealth();
    log('  Server ready — opening browser');
    openBrowser();
    log('');
    log('  Press Ctrl+C to stop the server.');
    log('');
  } catch (err) {
    serverProc.kill();
    fail(err.message);
  }
}

main().catch((err) => fail(err.message));
