#!/usr/bin/env node
/**
 * Cross-platform launcher: install deps, start server, wait for health, open browser.
 * Works on Windows, macOS, and Linux.
 */
const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const net = require('net');

const ROOT = path.join(__dirname, '..');
const PORT = parseInt(process.env.PORT || '3847', 10);
const HOST = '127.0.0.1';
const URL = `http://${HOST}:${PORT}`;
const PLATFORM_KEY = `${process.platform}-${process.arch}`;
const STAMP_FILE = path.join(ROOT, '.install-platform');

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
}

function readInstallStamp() {
  try {
    return fs.readFileSync(STAMP_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

function writeInstallStamp() {
  fs.writeFileSync(STAMP_FILE, PLATFORM_KEY, 'utf8');
}

function removeNodeModules() {
  const nm = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nm)) return;
  log('  Removing dependencies built for another computer...');
  fs.rmSync(nm, { recursive: true, force: true });
  try {
    fs.unlinkSync(STAMP_FILE);
  } catch {
    // ignore
  }
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

function ensureDeps() {
  const nm = path.join(ROOT, 'node_modules');
  const expressOk = fs.existsSync(path.join(nm, 'express'));
  const stamp = readInstallStamp();
  const platformMatch = stamp === PLATFORM_KEY;

  if (expressOk && platformMatch) {
    // Quick sanity check — native module must load on this machine
    try {
      require('better-sqlite3');
      return;
    } catch {
      log('  Native modules need rebuilding for this computer...');
      removeNodeModules();
    }
  } else if (expressOk && !platformMatch) {
    log(`  Folder moved to ${process.platform} — reinstalling for this machine...`);
    removeNodeModules();
  }

  log('  Installing dependencies (first run on this computer)...');
  log(`  Platform: ${PLATFORM_KEY}`);
  try {
    runNpmInstall();
    writeInstallStamp();
  } catch {
    log('  Retrying npm install with SSL workaround...');
    try {
      if (process.platform === 'win32') {
        execSync('npm install --strict-ssl=false', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--use-system-ca' }, shell: true });
      } else {
        execSync('npm install --strict-ssl=false', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--use-system-ca' } });
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
  console.log('');
  console.log('  ========================================');
  console.log('   TRADER NEWS COCKPIT - Starting...');
  console.log(`   ${process.platform} / ${process.arch}`);
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
