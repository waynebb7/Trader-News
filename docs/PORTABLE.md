# Portable Setup — PC ↔ MacBook

Trader News Cockpit is designed to live in a single folder you can copy between computers.

## What You Need on Each Computer

- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- Nothing else — no global install, no registry, no admin rights

## Copy the Folder

Copy the whole `Trader-News` folder to:

- Another Windows PC
- Your MacBook
- A USB stick
- OneDrive / Dropbox (see note below)

## First Launch on a New Computer

1. Run the start file for that OS:
   - **Windows:** `START_TRADER_NEWS.bat`
   - **Mac:** `START_TRADER_NEWS.command` (see Mac note below)

2. The launcher detects the new computer and runs `npm install` automatically.

3. Browser opens when the server is ready.

You only wait for install **once per computer**. After that, startup is fast.

## Mac First-Time Setup

When copying from Windows, execute permission may be missing. Run once in Terminal:

```bash
cd /path/to/Trader-News
chmod +x START_TRADER_NEWS.command start.sh
```

Then double-click `START_TRADER_NEWS.command`.

If macOS blocks the file: **System Settings → Privacy & Security → Open Anyway**.

## What Travels With the Folder

| Item | Location | Notes |
|------|----------|-------|
| API keys | `.env` | Copy this file — never commit to git |
| Watchlist & instruments | `config/instruments.json` | Editable |
| Credibility rules | `config/sourceCredibility.json` | Editable |
| Decision log | `data/trader-news.sqlite` | Local journal |
| Daily briefs | `data/trader-news.sqlite` | Saved history |
| Cache | `data/` | Safe to delete |

## What Does NOT Travel (Rebuilt Automatically)

| Item | Why |
|------|-----|
| `node_modules/` | Contains OS-specific native code (Windows ≠ Mac) |
| `.install-platform` | Stamp file — regenerated on install |

**Do not copy `node_modules` from PC to Mac** — the launcher will reinstall correctly.

## Recommended Copy List

Minimum to move:

```
Trader-News/
├── config/          ← your settings
├── .env             ← your API keys
├── data/            ← your logs & briefs (optional)
├── public/
├── server/
├── scripts/
├── ... (all source files)
├── package.json
├── START_TRADER_NEWS.bat
├── START_TRADER_NEWS.command
└── start.sh
```

Skip `node_modules/` to make copying faster.

## Cloud Sync (OneDrive / iCloud)

If the folder syncs through OneDrive or iCloud:

- The app works, but SQLite files in `data/` can occasionally conflict
- **Recommended:** point data to a local-only path in `.env`:

Windows:
```env
TRADER_NEWS_DATA_DIR=C:\Users\YourName\AppData\Local\TraderNewsCockpit
```

Mac:
```env
TRADER_NEWS_DATA_DIR=/Users/yourname/.trader-news-cockpit
```

Keep `.env` and `config/` in the synced folder; only data goes local.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Mac: "permission denied" | Run `chmod +x START_TRADER_NEWS.command start.sh` |
| Mac: "node not found" | Install Node.js from nodejs.org |
| npm install SSL error | Launcher retries automatically; or run `npm install --strict-ssl=false` |
| Port in use | Close other instance or set `PORT=3848` in `.env` |
| Blank page | Use http://127.0.0.1:3847 — do not open HTML files directly |

## Stopping the App

Press **Ctrl+C** in the terminal/command window.
