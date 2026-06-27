const fetch = require('node-fetch');
const BaseAdapter = require('./baseAdapter');

class FmpAdapter extends BaseAdapter {
  constructor() {
    super('fmp');
    this.apiKey = process.env.FMP_API_KEY || '';
    this.baseUrl = 'https://financialmodelingprep.com/api/v3';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async request(path, params = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('apikey', this.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`FMP ${res.status}`);
    return res.json();
  }

  async getQuote(instrument) {
    const data = await this.request(`/quote/${encodeURIComponent(instrument.symbol)}`);
    const q = Array.isArray(data) ? data[0] : data;
    if (!q || q.price == null) throw new Error('No quote from FMP');

    const changePercent = q.changesPercentage ?? q.changePercentage ?? 0;
    return {
      symbol: instrument.symbol,
      price: q.price,
      change: q.change,
      changePercent,
      previousClose: q.previousClose,
      dayHigh: q.dayHigh,
      dayLow: q.dayLow,
      week52High: q.yearHigh,
      week52Low: q.yearLow,
      volume: q.volume,
      atr: null,
      gapStatus: changePercent > 1.2 ? 'gap-up' : changePercent < -1.2 ? 'gap-down' : 'none',
      marketStatus: q.marketStatus || 'Regular',
      preMarket: q.preMarketPrice || null,
      afterHours: q.afterHoursPrice || null,
      swingHigh: q.dayHigh,
      swingLow: q.dayLow,
      provider: 'fmp',
      isMock: false,
      updatedAt: new Date().toISOString()
    };
  }

  async getNews(instrument) {
    const data = await this.request('/stock_news', { tickers: instrument.symbol, limit: 20 });
    if (!Array.isArray(data)) return [];
    return data.map((n, i) => ({
      id: `fmp-${i}-${n.publishedDate}`,
      headline: n.title,
      source: n.site,
      url: n.url,
      summary: n.text?.slice(0, 300) || '',
      publishedAt: n.publishedDate,
      provider: 'fmp'
    }));
  }

  async getEarnings(instrument) {
    const data = await this.request('/earning_calendar', { symbol: instrument.symbol });
    const items = Array.isArray(data) ? data : [];
    const next = items.find(e => new Date(e.date) >= new Date());
    if (!next) return null;
    const date = new Date(next.date);
    const daysUntil = Math.ceil((date - Date.now()) / 86400000);
    return {
      symbol: instrument.symbol,
      date: next.date,
      confirmed: true,
      time: next.time || 'unknown',
      epsEstimate: next.epsEstimated,
      revenueEstimate: next.revenueEstimated,
      previousEps: next.eps,
      previousRevenue: next.revenue,
      surpriseHistory: [],
      avgPostMove: null,
      impliedMove: null,
      daysUntil,
      provider: 'fmp',
      isMock: false
    };
  }

  async getEconomicCalendar(instrument) {
    const from = new Date().toISOString().slice(0, 10);
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 14);
    const to = toDate.toISOString().slice(0, 10);
    const data = await this.request('/economic_calendar', { from, to });
    if (!Array.isArray(data)) return [];
    return data.slice(0, 30).map(e => {
      const dt = new Date(e.date);
      const now = new Date();
      return {
        eventName: e.event,
        country: e.country,
        dateTime: e.date,
        expectedImpact: e.impact || 'Medium',
        category: 'macro',
        whyItMatters: `Macro event — may affect ${instrument.symbol} via risk sentiment.`,
        previous: e.previous,
        forecast: e.estimate,
        actual: e.actual,
        isToday: dt.toDateString() === now.toDateString(),
        countdownMs: dt - now,
        relevantInstruments: [instrument.symbol],
        provider: 'fmp'
      };
    });
  }
}

module.exports = new FmpAdapter();
