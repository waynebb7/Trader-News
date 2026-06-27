# Trader News Cockpit

A local desktop-hosted trading intelligence dashboard for stocks, forex, crypto, commodities, and defence/aerospace instruments. **Decision support only — not financial advice. Does not execute trades.**

Runs on **Windows**, **macOS**, and **Linux**. Copy the folder to any computer — no install beyond Node.js.

---

## Quick Start — Windows

1. Install [Node.js 18+](https://nodejs.org/)
2. Double-click **`START_TRADER_NEWS.bat`**
3. Browser opens at **http://127.0.0.1:3847** when ready

## Quick Start — Mac

1. Install [Node.js 18+](https://nodejs.org/)
2. **First time only** — open Terminal in the folder and run:
   ```bash
   chmod +x START_TRADER_NEWS.command start.sh
   ```
3. Double-click **`START_TRADER_NEWS.command`**

   Or from Terminal:
   ```bash
   ./start.sh
   ```

## Quick Start — Any OS (Terminal)

```bash
cd Trader-News
npm install    # first run on this computer only
npm start
```

Open http://127.0.0.1:3847

---

## Moving Between PC and MacBook

Copy the **entire folder** (USB drive, OneDrive, AirDrop, etc.).

| Travels with folder | Rebuilt on each computer |
|---------------------|---------------------------|
| `.env` (API keys) | `node_modules/` |
| `config/` | `.install-platform` |
| `data/` (logs, briefs, cache) | |

On first launch on a **new computer**, the launcher automatically reinstalls dependencies for that machine (Windows vs Mac use different native modules). This takes about 30–60 seconds.

**What to copy:** everything except `node_modules` (optional — it will be replaced anyway).

**Your settings travel with you:** API keys in `.env`, watchlist in `config/`, decision logs and daily briefs in `data/`.

See **`docs/PORTABLE.md`** for full details.

---

## OneDrive / Cloud Sync Note

If the folder syncs via OneDrive or iCloud, SQLite can occasionally lock. Set a local data path in `.env`:

```env
TRADER_NEWS_DATA_DIR=C:\Users\You\AppData\Local\TraderNewsCockpit
```

On Mac:
```env
TRADER_NEWS_DATA_DIR=/Users/you/.trader-news-cockpit
```

---

## API Keys (Optional)

Copy `.env.example` to `.env` and add any keys you have:

```env
FINNHUB_API_KEY=
FMP_API_KEY=
NEWS_API_KEY=
```

The app runs with **sample data immediately** — no API keys required.

| Provider | Used For |
|----------|----------|
| Finnhub | Quotes, news, earnings |
| FMP | Quotes, news, earnings, economic calendar |
| News API | News fallback |
| SEC EDGAR | Filings (no key required) |

---

## Default Instruments

- **SpaceX** (SPCX) — configurable ticker
- **Lockheed Martin** (LMT)
- **RTX Corporation** (RTX)

Add more via Watchlist page or edit `config/instruments.json`.

---

## Start Files

| File | Platform |
|------|----------|
| `START_TRADER_NEWS.bat` | Windows — double-click |
| `START_TRADER_NEWS.command` | macOS — double-click |
| `start.sh` | macOS / Linux — Terminal |
| `npm start` | All platforms |

---

## Disclaimer

This application provides information and decision support only. It is not financial advice, does not guarantee market direction, and does not execute trades. You are responsible for all trading decisions.

See `docs/LIMITATIONS.md` for full limitations.
