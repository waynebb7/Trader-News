# Trader News Cockpit

A local desktop-hosted trading intelligence dashboard for stocks, forex, crypto, commodities, and defence/aerospace instruments. **Decision support only — not financial advice. Does not execute trades.**

**Windows PC only.**

## Quick Start

1. Install [Node.js 18+](https://nodejs.org/) (Windows 64-bit LTS)
2. Double-click **`START_TRADER_NEWS.bat`**
3. Browser opens at **http://127.0.0.1:3847** when the server is ready

If `npm install` fails with an SSL error, the launcher retries automatically.

Manual start:

```powershell
cd Trader-News
npm install
npm start
```

## Moving to Another Windows PC

Copy the entire folder. On first launch on the new PC, dependencies install automatically (~30 seconds).

| Travels with folder | Rebuilt on new PC |
|---------------------|-------------------|
| `.env`, `config/`, `data/` | `node_modules/` |

Skip `node_modules` when copying to save time.

## OneDrive Note

If the folder syncs via OneDrive, SQLite can occasionally lock. Set a local data path in `.env`:

```env
TRADER_NEWS_DATA_DIR=C:\Users\You\AppData\Local\TraderNewsCockpit
```

## API Keys (Optional)

Copy `.env.example` to `.env` and add any keys you have. The app runs with **sample data** when no keys are set.

## Default Instruments

- **SpaceX** (SPCX)
- **Lockheed Martin** (LMT)
- **RTX Corporation** (RTX)

## Disclaimer

This application provides information and decision support only. It is not financial advice and does not execute trades.

See `docs/LIMITATIONS.md` for full limitations.
