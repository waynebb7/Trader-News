# Limitations

## Not Financial Advice

Trader News Cockpit is an information and decision-support tool. It does not provide investment advice, trading recommendations, or guarantees about market direction.

## No Trade Execution

This application does not connect to brokers, place orders, or manage positions. All trading decisions are entirely your responsibility.

## Data Accuracy

- API data may be **delayed**, **incomplete**, or **incorrect**
- Sample/mock data is used when API keys are missing or providers fail
- SEC filing summaries are **automated** and may miss critical context
- White House event parsing is **best-effort** and may be incomplete
- SpaceX (SPCX) is not a standard public ticker — provider support varies

## Sentiment Limitations

- Keyword-based NLP cannot fully understand context, sarcasm, or nuance
- The same headline may be bullish for one sector and bearish for another — sector rules help but are not exhaustive
- Provider-supplied sentiment (when available) may also be wrong
- Social media and rumour sources are flagged but may still appear in feeds

## Source Credibility

Credibility scores are configurable guidelines, not authoritative ratings. Even high-credibility sources can publish incorrect information. Official company releases are factual but promotional.

## Political Events

Presidential schedule data is difficult to obtain in structured form. The app combines White House page parsing, manual entries, and sample data. **Always verify** official schedules on whitehouse.gov before making time-sensitive decisions.

## Charts

Intraday charts require additional provider integration. A placeholder is shown until chart API keys and widgets are configured.

## Rate Limits

Free API tiers have strict rate limits. The app caches aggressively but may serve stale data during heavy use.

## Local Only

Decision logs and daily briefs are stored locally in SQLite. Back up `data/trader-news.sqlite` regularly. No cloud sync is provided.

## Security

API keys in `.env` are never sent to the browser. Keep `.env` private and do not commit it to version control.

## Regulatory

Automated analysis of SEC filings, news, and events does not replace reading primary sources, consulting licensed professionals, or complying with applicable regulations in your jurisdiction.
