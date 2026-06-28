const fetch = require('node-fetch');
const BaseAdapter = require('./baseAdapter');

class FinnhubAdapter extends BaseAdapter {
  constructor() {
    super('finnhub');
    this.apiKey = process.env.FINNHUB_API_KEY || '';
    this.baseUrl = 'https://finnhub.io/api/v1';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async request(path, params = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('token', this.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Finnhub ${res.status}: ${res.statusText}`);
    return res.json();
  }

  normalizeSymbol(instrument) {
    // Proxy EUR/USD futures (6E) to spot FX symbol supported by Finnhub.
    if (instrument.symbol === '6E' || (instrument.assetType === 'commodity' && instrument.sector === 'fx')) {
      return 'OANDA:EUR_USD';
    }
    if (instrument.assetType === 'forex') return `OANDA:${instrument.symbol.replace('/', '_')}`;
    if (instrument.assetType === 'crypto') return `BINANCE:${instrument.symbol.split('/')[0]}USDT`;
    return instrument.symbol;
  }

  async getQuote(instrument) {
    const sym = this.normalizeSymbol(instrument);
    const data = await this.request('/quote', { symbol: sym });
    if (!data || data.c === 0) throw new Error('No quote data from Finnhub');

    const change = data.c - data.pc;
    const changePercent = data.pc ? (change / data.pc) * 100 : 0;
    const gapStatus = changePercent > 1.2 ? 'gap-up' : changePercent < -1.2 ? 'gap-down' : 'none';

    return {
      symbol: instrument.symbol,
      price: data.c,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      previousClose: data.pc,
      dayHigh: data.h,
      dayLow: data.l,
      week52High: null,
      week52Low: null,
      volume: null,
      atr: null,
      gapStatus,
      marketStatus: 'Regular',
      preMarket: null,
      afterHours: null,
      swingHigh: data.h,
      swingLow: data.l,
      provider: 'finnhub',
      isMock: false,
      updatedAt: new Date(data.t * 1000).toISOString()
    };
  }

  async getNews(instrument) {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    const data = await this.request('/company-news', {
      symbol: instrument.symbol,
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10)
    });
    if (!Array.isArray(data)) return [];
    return data.slice(0, 25).map((n, i) => ({
      id: `finnhub-${n.id || i}`,
      headline: n.headline,
      source: n.source,
      url: n.url,
      summary: n.summary || '',
      publishedAt: new Date(n.datetime * 1000).toISOString(),
      provider: 'finnhub'
    }));
  }

  async getEarnings(instrument) {
    const data = await this.request('/calendar/earnings', { symbol: instrument.symbol });
    const items = data?.earningsCalendar || [];
    const next = items.find(e => e.symbol === instrument.symbol);
    if (!next) return null;
    const date = new Date(next.date);
    const daysUntil = Math.ceil((date - Date.now()) / 86400000);
    return {
      symbol: instrument.symbol,
      date: next.date,
      confirmed: true,
      time: next.hour || 'unknown',
      epsEstimate: next.epsEstimate,
      revenueEstimate: next.revenueEstimate,
      previousEps: next.epsActual,
      previousRevenue: null,
      surpriseHistory: [],
      avgPostMove: null,
      impliedMove: null,
      daysUntil,
      provider: 'finnhub',
      isMock: false
    };
  }
}

module.exports = new FinnhubAdapter();
