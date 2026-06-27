const fetch = require('node-fetch');
const BaseAdapter = require('./baseAdapter');

class AlphaVantageAdapter extends BaseAdapter {
  constructor() {
    super('alphaVantage');
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY || '';
    this.baseUrl = 'https://www.alphavantage.co/query';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async request(params) {
    const url = new URL(this.baseUrl);
    url.searchParams.set('apikey', this.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Alpha Vantage ${res.status}`);
    const data = await res.json();
    if (data.Note || data.Information) throw new Error(data.Note || data.Information);
    return data;
  }

  async getQuote(instrument) {
    const data = await this.request({ function: 'GLOBAL_QUOTE', symbol: instrument.symbol });
    const q = data['Global Quote'];
    if (!q || !q['05. price']) throw new Error('No quote from Alpha Vantage');

    const price = parseFloat(q['05. price']);
    const change = parseFloat(q['09. change']);
    const changePercent = parseFloat(String(q['10. change percent']).replace('%', ''));

    return {
      symbol: instrument.symbol,
      price,
      change,
      changePercent,
      previousClose: parseFloat(q['08. previous close']),
      dayHigh: parseFloat(q['03. high']),
      dayLow: parseFloat(q['04. low']),
      week52High: parseFloat(q['03. high']),
      week52Low: parseFloat(q['04. low']),
      volume: parseInt(q['06. volume'], 10),
      atr: null,
      gapStatus: changePercent > 1.2 ? 'gap-up' : changePercent < -1.2 ? 'gap-down' : 'none',
      marketStatus: 'Regular',
      preMarket: null,
      afterHours: null,
      swingHigh: parseFloat(q['03. high']),
      swingLow: parseFloat(q['04. low']),
      provider: 'alphaVantage',
      isMock: false,
      updatedAt: new Date().toISOString()
    };
  }
}

module.exports = new AlphaVantageAdapter();
