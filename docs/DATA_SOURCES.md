# Data Sources

## Overview

Trader News Cockpit uses an adapter-based architecture. Each data type can be served by multiple providers with automatic fallback.

## Market Data

| Provider | Key Required | Notes |
|----------|--------------|-------|
| Finnhub | FINNHUB_API_KEY | Primary for stocks, forex, crypto |
| Alpha Vantage | ALPHA_VANTAGE_API_KEY | Fallback quotes (rate limited on free tier) |
| FMP | FMP_API_KEY | Quotes with extended hours, 52-week range |
| Mock | No | Realistic sample data for offline use |

## News

| Provider | Key Required | Notes |
|----------|--------------|-------|
| Finnhub | FINNHUB_API_KEY | Company news by symbol |
| News API | NEWS_API_KEY | General search by company name |
| FMP | FMP_API_KEY | Stock news feed |
| Mock | No | Defence/sector-themed sample headlines |

## Earnings

| Provider | Key Required | Notes |
|----------|--------------|-------|
| FMP | FMP_API_KEY | Calendar with estimates |
| Finnhub | FINNHUB_API_KEY | Earnings calendar |
| Mock | No | Sample dates for LMT/RTX |

## Economic Calendar

| Provider | Key Required | Notes |
|----------|--------------|-------|
| FMP | FMP_API_KEY | Macro events with impact ratings |
| Mock | No | FOMC, CPI, NFP, defence budget samples |

## SEC Filings

| Provider | Key Required | Notes |
|----------|--------------|-------|
| SEC EDGAR | No | Public SEC API; requires CIK in instrument config |
| Mock | No | Sample 10-K/10-Q/8-K when CIK present but API fails |

## Company IR / Press Releases

| Provider | Key Required | Notes |
|----------|--------------|-------|
| Company IR | No | Links to IR pages; sample releases (extend with RSS) |
| Mock | No | Sample earnings releases and presentations |

## Political Events

| Provider | Key Required | Notes |
|----------|--------------|-------|
| White House | No | Attempts to parse briefings page (may be limited) |
| Manual | No | User-added events via API |
| Mock | No | Sample presidential briefing and NATO events |

## Caching

All provider responses are cached in SQLite with configurable TTLs in `config/apiProviders.json`:

- Prices: 30 seconds
- News: 3 minutes
- Economic calendar: 30 minutes
- Filings: 15 minutes
- Earnings: 1 hour
- Political events: 10 minutes

## Rate Limits

Adapters respect provider rate limits via caching. On failure, stale cache is served when available. Clear cache from Settings if needed.

## SpaceX (SPCX) Note

SpaceX is not publicly listed. The SPCX symbol is a placeholder — configure an alternate proxy ticker or provider symbol in `config/instruments.json` based on your data source.
