# Supported Platforms

Trader News Cockpit runs on these platforms. Copy the folder between them — dependencies reinstall automatically on first launch.

| Platform | Detected as | Start file | Node.js download |
|----------|-------------|------------|------------------|
| **Windows PC** | `win32-x64` | `START_TRADER_NEWS.bat` | [Windows 64-bit LTS](https://nodejs.org/) |
| **Mac Intel** | `darwin-x64` | `START_TRADER_NEWS.command` | [macOS Intel (x64)](https://nodejs.org/) |
| **Mac Apple Silicon** | `darwin-arm64` | `START_TRADER_NEWS.command` | [macOS Apple Silicon (ARM64)](https://nodejs.org/) |

## Moving Between Machines

Each computer gets its own `node_modules` build. The launcher tracks this in `.install-platform`:

```
win32-x64      → Windows PC
darwin-x64     → Mac Intel
darwin-arm64   → Mac Apple Silicon (M1/M2/M3/M4)
```

Copying from **PC → Mac Intel → Mac Apple Silicon** (or any combination) triggers a one-time reinstall. Your `.env`, `config/`, and `data/` travel with the folder.

**Do not copy `node_modules`** between machines — skip it when copying to save time.

## Node.js — Install the Right Build

### Windows PC
Download **Windows Installer (.msi)** — 64-bit LTS.

### Mac Intel
Download **macOS Installer** — choose the **Intel (x64)** build, or Universal (works on Intel Macs).

### Mac Apple Silicon (M1/M2/M3/M4)
Download **macOS Installer** — choose **Apple Silicon (ARM64)**, or Universal.

Verify after install:

```bash
node -p "process.platform + '-' + process.arch"
```

Expected on Apple Silicon: `darwin-arm64`  
Expected on Mac Intel: `darwin-x64`

If Apple Silicon shows `darwin-x64`, you installed Intel Node under Rosetta — reinstall the ARM64 build from nodejs.org.

## Mac First-Time Setup

```bash
cd /path/to/Trader-News
chmod +x START_TRADER_NEWS.command start.sh
```

If native modules fail to build:

```bash
xcode-select --install
npm rebuild better-sqlite3 --build-from-source
```

The app still works without SQLite — it falls back to JSON storage in `data/store.json`.

## OneDrive / iCloud Sync

Exclude `node_modules/` from sync on all devices. If SQLite locks on synced folders, set in `.env`:

```env
# Windows
TRADER_NEWS_DATA_DIR=C:\Users\You\AppData\Local\TraderNewsCockpit

# Mac
TRADER_NEWS_DATA_DIR=/Users/you/.trader-news-cockpit
```

## Troubleshooting by Platform

| Issue | Windows | Mac Intel | Mac Apple Silicon |
|-------|---------|-----------|-------------------|
| npm SSL error | Auto-retry in launcher | Auto-retry | Auto-retry |
| Native module fail | Reinstall Node 64-bit | `xcode-select --install` | ARM64 Node + Xcode CLT |
| Permission denied | Run `.bat` normally | `chmod +x *.command start.sh` | Same |
| Port in use | Close other window | Same | Same |
| Blank page | Use http://127.0.0.1:3847 | Same | Same |
