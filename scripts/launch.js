#!/usr/bin/env node
/**
 * Windows launcher — install deps, start server, wait for health, open browser.
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

process.chdir(ROOT);

function log(msg) {
  console.log(msg);
}

function fail(msg) {
  console.error('\n  ERROR: ' + msg + '\n');
  process.exit(1);
}

function checkPlatform() {
  if (process.platform !== 'win32') {
    fail('Trader News Cockpit is Windows-only. Use START_TRADER_NEWS.bat on a Windows PC.');
  }
}

function checkNode() {
  const v = process.version.slice(1).split('.').map(Number);
  if (v[0] < 18) {
    fail(`Node.js 18+ required (found ${process.version}). Install from https://nodejs.org/`);
  }
}

function ensureDeps() {
  const nm = path.join(ROOT, 'node_modules', 'express');
  if (fs.existsSync(nm)) {
    try {
      require('better-sqlite3');
      return;
    } catch {
      log('  Rebuilding native modules...');
    }
  } else {
    log('  Installing dependencies (first run)...');
  }

  const env = { ...process.env, NODE_OPTIONS: '--use-system-ca' };
  try {
    execSync('npm install', { cwd: ROOT, stdio: 'inherit', env, shell: true });
  } catch {
    log('  Retrying npm install with SSL workaround...');
    try {
      execSync('npm install --strict-ssl=false', { cwd: ROOT, stdio: 'inherit', env, shell: true });
    } catch {
      fail('npm install failed. Open Command Prompt in this folder and run: npm install');
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
    spawn('cmd', ['/c', 'start', '', URL], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    log(`  Open manually: ${URL}`);
  }
}

async function main() {
  console.log('');
  console.log('  ========================================');
  console.log('   TRADER NEWS COCKPIT - Starting...');
  console.log('  ========================================');
  console.log('');

  checkPlatform();
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
      fail(`Port ${PORT} is in use. Close the other program or set PORT=3848 in .env`);
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
