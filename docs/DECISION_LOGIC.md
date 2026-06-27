# Decision Logic

## Overview

The Decision Cockpit synthesises news sentiment, price action, and upcoming events into a trade-readiness state. This is **decision support**, not a trading signal or financial advice.

## Trade Readiness States

| State | Colour | Meaning |
|-------|--------|---------|
| GREEN | Bullish setup forming | Net bullish score dominates with sufficient confidence |
| RED | Bearish risk/setup | Net bearish score dominates |
| AMBER | Event risk / wait | Earnings within 7 days, major macro today, or political events |
| GREY | No trade / unclear | Mixed or insufficient signal |

## Market Read Labels

- **Bullish** — weighted bullish news + positive price momentum
- **Bearish** — weighted bearish news + negative price momentum
- **Neutral** — insufficient directional signal
- **Mixed** — conflicting bullish and bearish drivers
- **Event risk** — upcoming catalyst overrides directional read

## Sentiment Scoring

Each news item receives:

1. **Provider sentiment** (if available from API)
2. **Local NLP fallback** using financial keyword weighting

### Local NLP factors

- Financial positive/negative keywords (beat, miss, upgrade, downgrade, etc.)
- Sector-specific rules from `config/sectorRules.json`
- Defence/aerospace keywords weighted differently for defence stocks vs broad market
- Macro keywords (recession, rate cut, etc.)

### Output

- `rawSentimentScore`: -1 to +1
- `label`: bullish, bearish, neutral, mixed
- `confidence`: 0–100 based on keyword match density
- `catalystType`: company, macro, geopolitical, earnings, etc.
- `impactHorizon`: immediate, today, this week, this month, long term

## Source Credibility

From `config/sourceCredibility.json`:

- **Green badge** (80+): SEC, Reuters, Bloomberg, established press
- **Amber badge** (60–79): CNBC, specialist press
- **Red badge** (<60): Social media, unknown sources
- **Blue badge**: Official company/regulator (promotional bias warning)

Items with `includeInDecision: false` (e.g. social media) are excluded from the decision score but still displayed.

## Relevance Scoring

0–100 based on:

- Symbol mention (+40)
- Company name mention (+30)
- Sector/tag match (+10–15 each)

Only items with relevance ≥ 40 contribute to decision drivers.

## Decision Score Calculation

For each qualifying news item:

```
weight = (relevance / 100) × (credibility / 100) × impactMultiplier
bullishScore += rawSentiment × weight × 100  (if bullish)
bearishScore += |rawSentiment| × weight × 100  (if bearish)
```

Impact multipliers: Low 0.5, Medium 1.0, High 1.5, Critical 2.0

Price adjustments:

- Daily change > ±1.5% adds ±15 to respective score
- Gap up/down adds ±8

## Event Risk Overrides

- Earnings within 7 days → AMBER, "Avoid until after event"
- Critical macro event today → AMBER
- Political/White House event today → AMBER
- Breaking critical news → "High-volatility news risk"

## Suggested Actions

| Action | When |
|--------|------|
| Watch only | Neutral/mixed or low confidence |
| Prepare long idea | GREEN state, bullish dominance |
| Prepare short idea | RED state, bearish dominance |
| Avoid until after event | AMBER with earnings/macro |
| High-volatility news risk | Critical breaking news |

## Confidence Score

Base 35 + (3 × number of decision-relevant news items), capped at 85–90 depending on state. Reduced when event risk is active.

## Alerts

Generated for: breaking news, high-impact credible news, earnings proximity, macro events, political events, price gaps, API failures, stale data.

Severity: Info, Watch, Warning, Critical
